'use strict';

// Bundled using createXMediaPublisher.toString(). The caller owns the user token and
// supplies request(path, {method, headers, body?, signal}) -> {status, json}.
// Restrict that transport to https://api.x.com, reject redirects, and send each request once.
// Required OAuth user scopes: media.write, tweet.write, tweet.read, users.read.
// https://docs.x.com/x-api/media/quickstart/media-upload-chunked
// https://docs.x.com/x-api/posts/create-or-edit-post
function createXMediaPublisher(request, options = {}) {
  const sleep = options.sleep || wait;
  const upload = '/2/media/upload';
  // JSON APPEND carries base64; only one segment is read into memory at a time.
  // https://docs.x.com/x-api/media/append-media-upload
  const chunkSize = 4 * 1024 * 1024;
  const isId = id => typeof id === 'string' && /^[0-9]{1,19}$/.test(id);
  let busy = false;

  function failure(code, status) {
    const error = new Error(code);
    error.code = code;
    if (status) error.status = status;
    return error;
  }

  function checkCancelled(signal) {
    if (signal?.aborted) throw failure('CANCELLED');
  }

  function wait(ms, signal) {
    checkCancelled(signal);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', abort);
        resolve();
      }, ms);
      function abort() {
        clearTimeout(timer);
        reject(failure('CANCELLED'));
      }
      signal?.addEventListener('abort', abort, {once: true});
    });
  }

  function httpFailure(status, json, creatingPost) {
    if (creatingPost && (!(status >= 400 && status < 500) || status === 408)) {
      return failure('POST_UNCERTAIN', status);
    }
    if (status === 402 || /\/(?:usage-capped|credits-depleted)$/i.test(json?.type || '')) {
      return failure('QUOTA', status);
    }
    const reasons = [json?.detail, json?.message, ...(Array.isArray(json?.errors) ? json.errors.map(e => e?.message || e?.detail) : [])];
    if (creatingPost && status === 403 && reasons.some(value =>
        typeof value === 'string' && /not allowed to post a video longer than/i.test(value))) {
      return failure('DURATION_LIMIT', status);
    }
    if (creatingPost && [400, 422].includes(status)) return failure('POST_REJECTED', status);
    const errors = {401: 'AUTH_REQUIRED', 403: 'ACCESS_DENIED', 413: 'TOO_LARGE', 429: 'RATE_LIMITED'};
    return failure(errors[status] || 'API_ERROR', status);
  }

  async function send(path, method, body, signal) {
    checkCancelled(signal);
    const creatingPost = path === '/2/tweets';
    const options = {method, signal};
    if (body !== undefined) {
      options.headers = {'Content-Type': 'application/json'};
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await request(path, options);
    } catch {
      if (creatingPost) throw failure('POST_UNCERTAIN');
      checkCancelled(signal);
      throw failure('NETWORK');
    }
    const status = response?.status;
    const json = response?.json;
    if (!Number.isInteger(status) || status < 200 || status >= 300) {
      throw httpFailure(status, json, creatingPost);
    }
    if (!creatingPost && json?.errors?.length) throw failure('API_ERROR', status);
    return json?.data;
  }

  async function encodeSegment(part) {
    let bytes;
    try {
      bytes = new Uint8Array(await part.arrayBuffer());
    } catch {
      throw failure('FILE_READ');
    }
    if (typeof bytes.toBase64 === 'function') return bytes.toBase64();
    // Older browser engines limit the number of arguments to fromCharCode().
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  }

  async function publish({file, text = '', signal, onProgress} = {}) {
    if (busy) throw failure('BUSY');
    checkCancelled(signal);
    const mime = String(file?.type || '').split(';')[0].trim().toLowerCase();
    const namedMp4 = (!mime || mime === 'application/octet-stream') && /\.mp4$/i.test(file?.name || '');
    if (!(file instanceof Blob) || !Number.isSafeInteger(file.size) || file.size < 1 ||
        (mime !== 'video/mp4' && !namedMp4)) throw failure('INVALID_FILE');
    // The initialize schema caps total_bytes at 16 GiB. X enforces the posting
    // account's own size/duration entitlement at upload and post creation.
    // https://docs.x.com/x-api/media/quickstart/best-practices
    if (file.size > 17179869184) throw failure('TOO_LARGE');
    if (typeof text !== 'string') throw failure('INVALID_TEXT');

    busy = true;
    let uploadedBytes = 0;
    const progress = (stage, percent = Math.floor(uploadedBytes * 100 / file.size)) =>
      onProgress?.({stage, uploadedBytes, totalBytes: file.size, percent});
    try {
      progress('initialize');
      const init = await send(upload + '/initialize', 'POST',
        {media_type: 'video/mp4', media_category: 'tweet_video', total_bytes: file.size}, signal);
      const mediaId = init?.id;
      if (!isId(mediaId)) throw failure('INVALID_RESPONSE');
      const path = upload + '/' + mediaId;
      progress('upload');
      for (let index = 0; uploadedBytes < file.size; index++) {
        checkCancelled(signal);
        const end = Math.min(uploadedBytes + chunkSize, file.size);
        const media = await encodeSegment(file.slice(uploadedBytes, end));
        await send(path + '/append', 'POST', {segment_index: index, media}, signal);
        uploadedBytes = end;
        progress('upload');
      }

      const finalized = await send(path + '/finalize', 'POST', undefined, signal);
      if (finalized?.id !== mediaId) throw failure('INVALID_RESPONSE');
      let info = finalized.processing_info;
      // Respect the validity window on the returned media; never poll before X's delay.
      const expirySeconds = finalized.expires_after_secs ?? init.expires_after_secs ?? 86400;
      const deadline = Date.now() + expirySeconds * 1000;
      while (info != null && info.state !== 'succeeded') {
        if (info.state === 'failed') throw failure('PROCESSING_FAILED');
        if (info.state !== 'pending' && info.state !== 'in_progress') throw failure('INVALID_RESPONSE');
        progress('processing', Number.isFinite(info.progress_percent) ? info.progress_percent : 0);
        const seconds = info.check_after_secs ?? 1;
        if (!Number.isSafeInteger(seconds) || seconds < 0) throw failure('INVALID_RESPONSE');
        const ms = Math.max(1, seconds) * 1000;
        if (!Number.isFinite(deadline) || Date.now() + ms >= deadline) throw failure('PROCESSING_TIMEOUT');
        await sleep(ms, signal);
        const status = await send(upload + '?command=STATUS&media_id=' + mediaId, 'GET', undefined, signal);
        if (status?.id !== mediaId || !status.processing_info) throw failure('INVALID_RESPONSE');
        info = status.processing_info;
      }

      progress('post');
      const body = {media: {media_ids: [mediaId]}};
      if (text) body.text = text;
      const result = await send('/2/tweets', 'POST', body, signal);
      if (!isId(result?.id)) throw failure('POST_UNCERTAIN');
      return {id: result.id, mediaId, url: 'https://x.com/i/status/' + result.id};
    } finally {
      busy = false;
    }
  }

  return {publish};
}

module.exports = {createXMediaPublisher};
