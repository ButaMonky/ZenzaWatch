import {ShareClipQueue} from './ShareClipQueue';
import {RequestDiagnostics} from '../packages/lib/src/infra/RequestDiagnostics';
//===BEGIN===
//@require RequestDiagnostics
//@require ShareClipQueue
// The permission, processing and posting decisions belong to NicoNico's clip service.
const ShareOfficialClip = (() => {
  const base = 'https://nvapi.nicovideo.jp/v1';
  const pollInterval = 5000;
  const recent = new Map();
  const pendingCreations = new Map();
  const pendingDeletions = new Map();
  const publications = new Map();
  const receiptObservers = new Set();
  const pollLimit = 30 * 60 * 1000;
  const ignored = {reason:'cancelled'};
  const schema = missing => ({kind:'schema', missing});
  const postFailures = {
    X_TOKEN_INVALID:{reason:'token-invalid',message:'X アカウントの連携を公式ページで確認してください。'},
    X_TOO_MANY_REQUESTS:{reason:'rate-limit',message:'X の利用上限に達しました。しばらく時間をおいてください。'},
    VIDEO_CLIP_NOT_FOUND:{reason:'clip-missing',message:'公式サービスでクリップが見つかりません。'}
  };
  function postFailure(code) {
    return Object.hasOwn(postFailures,code) ? postFailures[code] : {reason:'post-failed',message:'X への投稿に失敗しました。'};
  }
  function publicationLabel(watchId,from,to) {
    return '公式クリップ（' + watchId + '、' + from + '〜' + to + '秒）　';
  }
  function publicationDetails(stage, reason, error) {
    const details = {stage,reason,clipReady:['verify','post','receipt'].includes(stage),
      postAttempted:stage === 'post' || stage === 'receipt'};
    if (error?.httpStatus) details.statusCode = error.httpStatus;
    if (error?.missing) details.missing = error.missing;
    if (error?.retrySeconds) details.retrySeconds = error.retrySeconds;
    return details;
  }
  function responseIssue(operation, data, expired) {
    if (operation === 'clip-permission') {
      if (typeof data?.isLogin !== 'boolean') return schema('data.isLogin');
      if (!data.isLogin || data.isClipTweetAllowedVideo === false || data.isClipTweetAllowed === false) return;
      if (typeof data.twitterLinkage?.isLinked !== 'boolean') return schema('data.twitterLinkage.isLinked');
      if (data.twitterLinkage.isLinked && typeof data.isClipTweetAllowed !== 'boolean') return schema('data.isClipTweetAllowed');
    } else if (operation === 'clip-license' && typeof data?.isUseLicensedMusic !== 'boolean') {
      return schema('data.isUseLicensedMusic');
    } else if (operation === 'clip-create') {
      if (!(typeof data?.clipId === 'string' && data.clipId.trim()) && !(Number.isSafeInteger(data?.clipId) && data.clipId > 0)) return schema('data.clipId');
    } else if (operation === 'clip-status' || operation === 'clip-post-status') {
      const posting = operation === 'clip-post-status';
      if (typeof data?.status !== 'string' || !data.status.trim()) return schema('data.status');
      if (data.status === 'DONE') {
        if (!posting) {
          try { if (new URL(data.clipUri).protocol !== 'https:') return schema('data.clipUri'); }
          catch (_) { return schema('data.clipUri'); }
        }
      } else if (data.status === 'FAILED' || data.status === 'ERROR') {
        return posting && Object.hasOwn(postFailures, data.failureReason) ? ignored : {kind:'service'};
      } else {
        const pending = posting ? ['WAITING','PENDING','PROCESSING','POSTING'] : ['WAITING','GENERATING'];
        if (!pending.includes(data.status)) {
          // Nico's X client treats nonterminal states as pending. Preserve polling while it may still finish.
          return posting && !expired ? ignored : schema('data.status');
        }
        // A polling reply that still says "waiting" cannot confirm that a prior failure has cleared.
        return expired ? {kind:'timeout'} : ignored;
      }
    }
  }

  function transport(win,videoId,signal,expired) {
    const beginDiagnostic = (operation, request) => typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin(operation, videoId, 'response', () => !signal.aborted, undefined, request);
    async function request(operation, path, method = 'GET', fields) {
      const abort = new win.AbortController();
      const stop = () => abort.abort();
      if (signal.aborted) throw new Error('closed');
      // Closing the panel cannot revoke a submitted POST. Retain its response
      // long enough to obtain the server ID and resume with a GET on reopen.
      if (operation !== 'clip-create') signal.addEventListener('abort', stop, {once:true});
      const ticket = beginDiagnostic(operation, {url:base + path, method});
      let wire = {};
      let timedOut = false, diagnostic = {kind:'network'};
      const failure = new Error('request failed');
      const timeout = win.setTimeout(() => { timedOut = true; stop(); }, 20000);
      try {
        const headers = {'Accept':'application/json', 'X-Frontend-Id':'6', 'X-Frontend-Version':'0'};
        if (method !== 'GET') headers['X-Request-With'] = win.location.origin;
        const options = {method, headers, credentials:'include', cache:'no-store', signal:abort.signal};
        if (fields) options.body = new win.URLSearchParams(fields);
        const response = await win.fetch(base + path, options);
        if (abort.signal.aborted) throw new Error('interrupted');
        if (ticket) wire = {...RequestDiagnostics.responseEvidence(response), httpStatus:response.status};
        if (response.ok && response.status === 204 && (operation === 'clip-delete' || operation === 'clip-post')) {
          ticket?.success();
          return;
        }
        let envelope;
        try { envelope = await response.json(); }
        catch (cause) { if (response.ok) { diagnostic = {...(ticket && RequestDiagnostics.readFailure(response, cause)), ...schema('json')}; throw new Error('invalid response'); } }
        if (abort.signal.aborted) throw new Error('interrupted');
        if (Number.isInteger(envelope?.meta?.status)) wire.apiStatus = envelope.meta.status;
        if (!response.ok || !Number.isInteger(envelope?.meta?.status) ||
            envelope.meta.status < 200 || envelope.meta.status >= 300) {
          if (envelope?.meta?.errorCode === 'USER_LIMIT_EXCEEDED') failure.message = 'USER_LIMIT_EXCEEDED';
          const statusCode = response.ok ? envelope?.meta?.status : response.status;
          if (Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599) failure.httpStatus = statusCode;
          if (statusCode === 429 || failure.message === 'USER_LIMIT_EXCEEDED') {
            const wait = response.headers?.get?.('Retry-After');
            const retry = /^\d+$/.test(wait || '') ? Date.now() + Number(wait) * 1000 : Date.parse(wait);
            const seconds = Math.ceil((retry - Date.now()) / 1000);
            if (Number.isSafeInteger(seconds) && seconds > 0) failure.retrySeconds = seconds;
          }
          if (!failure.httpStatus) diagnostic = schema('meta.status');
          else if ([401,403,404,429].includes(statusCode) || failure.message === 'USER_LIMIT_EXCEEDED' ||
              (operation === 'clip-post' && [400,422].includes(statusCode))) diagnostic = ignored;
          else diagnostic = statusCode === 408 ? {kind:'timeout', statusCode} : {statusCode};
          throw failure;
        }
        const issue = responseIssue(operation, envelope.data, expired());
        if (issue?.kind === 'schema') { diagnostic = issue; throw new Error('invalid response'); }
        if (issue) ticket?.failure({...wire, ...issue}); else ticket?.success();
        return envelope.data;
      } catch (_) {
        ticket?.failure({...wire, ...(timedOut ? {kind:'timeout'} : diagnostic)});
        const code = failure.httpStatus;
        if (timedOut || code === 408) failure.reason = 'timeout';
        else if (code === 429 || failure.message === 'USER_LIMIT_EXCEEDED') failure.reason = 'rate-limit';
        else if (diagnostic.kind === 'schema') {
          failure.reason = 'invalid-response';
          failure.missing = diagnostic.missing;
        } else if (code === 401) failure.reason = 'login-required';
        else if (code === 403) failure.reason = 'permission-denied';
        else if (operation === 'clip-post' && [400,422].includes(code)) failure.reason = 'invalid-text';
        else failure.reason = code ? 'http-error' : 'network';
        throw failure;
      } finally {
        win.clearTimeout(timeout);
        signal.removeEventListener('abort', stop);
      }
    }
    return {request,beginDiagnostic};
  }
  const permissionMessages = {
    'video-ineligible':'ニコニコでは、この動画の公式クリップ投稿を利用できません。',
    'login-required':'公式投稿にはニコニコへのログインとXアカウント連携が必要です。',
    'unlinked':'公式投稿には、ニコニコの視聴ページでXアカウントの連携が必要です。',
    'permission-denied':'ニコニコでは、この動画またはアカウントの公式クリップ投稿を利用できません。'
  };
  function permissionReason(data) {
    if (data.isClipTweetAllowedVideo === false) return 'video-ineligible';
    if (!data.isLogin) return 'login-required';
    if (data.twitterLinkage?.isLinked === false) return 'unlinked';
    if (data.isClipTweetAllowed !== true || data.twitterLinkage?.isLinked !== true) return 'permission-denied';
  }
  function linkedName(permission) {
    const name = permission.twitterLinkage?.screenName;
    return typeof name === 'string' ? name.trim() : '';
  }

  function read(win,key) {
    try { return recent.get(key) || win.sessionStorage.getItem(key); }
    catch (_) { return recent.get(key); }
  }
  function store(win,key,value) {
    if (value) recent.set(key,value); else recent.delete(key);
    try {
      if (value) win.sessionStorage.setItem(key,value); else win.sessionStorage.removeItem(key);
    } catch (_) { /* The tab can continue when session storage is unavailable. */ }
  }
  function savedScene(win,key) {
    try {
      const value = JSON.parse(read(win,key) || 'null');
      if (value && ['clip','post','posted'].includes(value.kind) && value.id) return value;
    } catch (_) { /* An unavailable or old record cannot be resumed. */ }
    return null;
  }
  function rangeKey(accountKey,first,last) {
    return accountKey + ':range:' + first + '-' + last;
  }
  function restoreAccount(win,videoId,account) {
    const prefix = 'zenzaWatch:officialClip:' + videoId + ':';
    const accountKey = prefix + account.toLowerCase();
    // Preserve receipts saved under the display casing and the earlier per-account key.
    if (accountKey !== prefix + account) {
      for (const suffix of ['',':creation']) {
        const oldKey = prefix + account + suffix, value = read(win,oldKey);
        if (!value) continue;
        if (!read(win,accountKey + suffix)) store(win,accountKey + suffix,value);
        store(win,oldKey,null);
      }
    }
    const previous = savedScene(win,accountKey);
    if (previous) {
      const key = rangeKey(accountKey,Math.round(previous.start * 1000),Math.round(previous.end * 1000));
      if (!read(win,key)) store(win,key,JSON.stringify(previous));
      store(win,accountKey,null);
      if (!read(win,accountKey + ':last')) store(win,accountKey + ':last',key);
    }
    return accountKey;
  }
  function createTracked(win, request, source, accountKey, key, first, last, text) {
    const quotaKey = accountKey + ':creation';
    const retrySeconds = Math.ceil((Number(read(win,quotaKey)) - Date.now()) / 1000);
    if (retrySeconds > 0) {
      return Promise.reject(Object.assign(new Error('USER_LIMIT_EXCEEDED'),{reason:'rate-limit',httpStatus:429,retrySeconds}));
    }
    store(win,quotaKey,null);
    store(win,key + ':creation','unconfirmed');
    const pending = request('clip-create',source + '/clips','POST',{startTime:String(first),endTime:String(last)})
      .then(({clipId}) => {
        store(win,key,JSON.stringify({kind:'clip',id:clipId,start:first/1000,end:last/1000,text}));
        store(win,key + ':creation',null);
        return clipId;
      }).catch(error => {
        if (error.httpStatus === 429 || error.message === 'USER_LIMIT_EXCEEDED') {
          store(win,key + ':creation',null);
          store(win,quotaKey,error.retrySeconds ? String(Date.now()+error.retrySeconds*1000) : 'limited');
        } else if (error.httpStatus >= 400 && error.httpStatus < 500 && ![408,409].includes(error.httpStatus)) {
          store(win,key + ':creation',null);
        }
        throw error;
      }).finally(() => pendingCreations.delete(key));
    pendingCreations.set(key,pending);
    return pending;
  }

  // The publication owns only the submitted values. Editors subscribe while open;
  // switching video or dismissing the dialog cannot replace its target or its text.
  function publish(win,spec,onNotify,holdWatchPage) {
    const {key,accountKey,videoId,watchId,source,first,last,text,account} = spec;
    const existing = publications.get(key);
    if (existing) return existing;
    const controller = new win.AbortController();
    const {signal} = controller;
    let deadline;
    const {request,beginDiagnostic} = transport(win,videoId,signal,() => Date.now() >= deadline);
    const job = {phase:'queued',message:'公式クリップの投稿を予約しました。順番を待っています。',kind:'clip',id:spec.id,
      first,last,text,uri:spec.uri,listeners:new Set()};
    publications.set(key,job);
    let stage = 'create', details;
    function emit(phase,message) {
      job.phase = phase;
      job.message = message;
      for (const fn of job.listeners) fn();
    }
    function finish(phase,message,reason,error) {
      details = publicationDetails(stage,reason,error);
      emit(phase,message);
    }
    const releaseLinks = holdWatchPage?.();
    const stop = () => { job.ticket?.cancel(); controller.abort(); };
    win.addEventListener('pagehide',stop,{once:true});
    const remember = (kind,failureNotified) => store(win,key,JSON.stringify({kind,id:job.id,start:first/1000,end:last/1000,text,failureNotified}));
    const clipPath = () => '/clips/' + encodeURIComponent(job.id);
    async function poll(posting) {
      deadline = Date.now() + pollLimit;
      for (;;) {
        signal.throwIfAborted();
        const result = await request(posting ? 'clip-post-status' : 'clip-status',clipPath() + (posting ? '/x-post' : ''));
        if (result.status === 'DONE' || result.status === 'FAILED' || result.status === 'ERROR') return result;
        if (Date.now() >= deadline) throw Object.assign(new Error('timeout'),{reason:'timeout'});
        await new Promise(resolve => {
          const resume = () => { win.clearTimeout(timer); signal.removeEventListener('abort',resume); resolve(); };
          const timer = win.setTimeout(resume,pollInterval);
          signal.addEventListener('abort',resume,{once:true});
        });
      }
    }
    async function run() {
      if (!job.id) {
        emit('creating','クリップを作成しています…');
        job.id = await createTracked(win,request,source,accountKey,key,first,last,text);
        signal.throwIfAborted();
        stage = 'generate';
        emit('generating','ニコニコでクリップを生成しています…');
        const clip = await poll(false);
        if (clip.status !== 'DONE') return finish('clipError','クリップの生成に失敗しました。','generation-failed');
        job.uri = clip.clipUri;
      }
      signal.throwIfAborted();
      stage = 'verify';
      emit('verifying','ニコニコで投稿先アカウントを確認しています…');
      const permission = await request('clip-permission',source + '/tweet-possibility');
      signal.throwIfAborted();
      const denied = permissionReason(permission);
      const current = linkedName(permission);
      if (denied || current.toLowerCase() !== account.toLowerCase()) {
        return finish('postFailed',permissionMessages[denied] || '連携アカウントが変更されています。共有画面を開き直してください。',denied || 'account-changed');
      }
      if (!account && !spec.id) {
        return finish('preview','クリップを作成しました。連携先の名前を取得できないため、ニコニコで投稿先を確認してから投稿してください。','account-unknown');
      }
      job.kind = 'post';
      // Mark the attempt before dispatch. A timeout or reload can now only resume a GET.
      remember('post');
      stage = 'post';
      emit('posting','X にクリップを送信しています…');
      try { await request('clip-post',clipPath() + '/x-post','POST',{text}); }
      catch (error) {
        if (error.httpStatus >= 400 && error.httpStatus < 500 && ![408,409].includes(error.httpStatus)) {
          job.kind = 'clip';
          remember('clip');
          if ([400,422].includes(error.httpStatus)) return finish('preview','投稿が受理されませんでした。本文の長さや内容を確認して修正してください。',error.reason,error);
          if (error.httpStatus === 429) return finish('preview','X の利用上限に達しました。時間をおいてからお試しください。',error.reason,error);
          return finish('postFailed','投稿が受理されませんでした。公式の視聴ページで連携と利用条件を確認してください。',error.reason,error);
        }
        // The server may already have accepted it. Read the receipt without repeating the POST.
      }
      stage = 'receipt';
      const result = await poll(true);
      if (result.status !== 'DONE') {
        const failure = postFailure(result.failureReason);
        remember('post',true);
        return finish('postFailed',failure.message,failure.reason);
      }
      beginDiagnostic('clip-post')?.success();
      remember('posted');
      finish('posted','X にクリップをポストしました。','posted');
    }
    function failed(error) {
      if (signal.aborted) return;
      details = publicationDetails(stage,error.reason || 'network',error);
      if (job.kind === 'post') emit('postUnknown','投稿結果を確認できません。「状態を再確認」で結果を確認してください。');
      else if (job.phase === 'verifying') emit('preview','投稿先を確認できませんでした。まだ投稿していません。もう一度確認してください。');
      else if (job.id) emit('clipUnknown','生成状況を確認できません。「状態を再確認」で確認してください。');
      else if (error.httpStatus === 429 || error.message === 'USER_LIMIT_EXCEEDED') emit('edit','作成回数の制限に達しました。時間をおいてお試しください。');
      else if ([401,403].includes(error.httpStatus)) emit('denied','ニコニコで公式クリップを作成できません。ログイン、X連携、動画の共有設定を確認してください。');
      else emit('createUnknown','クリップの作成結果を確認できません。ニコニコの視聴ページで確認してください。');
    }
    function release() {
      releaseLinks?.();
      win.removeEventListener('pagehide',stop);
      publications.delete(key);
      for (const fn of job.listeners) fn();
      job.listeners.clear();
      for (const refresh of receiptObservers) refresh(accountKey);
    }
    job.ticket = ShareClipQueue.enqueue({
      name:spec.name, from:first/1000, to:last/1000, kind:'official',
      onCancel(reason) {
        const message = reason === 'failed' ? '予約を開始できませんでした。もう一度予約してください。' : '公式クリップの投稿予約を取り消しました。';
        emit(spec.id ? 'preview' : 'edit',message);
        release();
        if (reason === 'failed') onNotify?.(publicationLabel(watchId,first/1000,last/1000) + message,'warning');
      },
      async run() {
        try { await run(); }
        catch (error) { failed(error); }
        finally { release(); }
        if (!signal.aborted) {
          const confirmedFailure = job.phase === 'clipError' || (job.phase === 'postFailed' && stage === 'receipt');
          const level = job.phase === 'posted' ? 'info' : confirmedFailure ? 'error' : 'warning';
          onNotify?.(publicationLabel(watchId,first/1000,last/1000) + job.message,level,details);
        }
        if (job.phase !== 'posted') throw new Error(job.phase);
      }
    });
    return job;
  }

  function mount(container, {info, startTime, endTime, text, officialUrl, onUseLocal, sharedEditor = false, onSubmitState, onNotify, holdWatchPage}) {
    const win = container.ownerDocument.defaultView;
    const duration = Number(info.duration);
    const videoId = String(info.videoId || info.watchId || '');
    const source = '/videos/' + encodeURIComponent(videoId);
    const lifetime = new win.AbortController();
    let timer;
    let clipId;
    let phase = 'checking';
    let task;
    let deadline;
    let account;
    let accountKey, recordKey;
    let selectionVersion = 0;
    let retryAt = 0, retryTimer, unobserve;

    container.innerHTML = `
<p>${sharedEditor ? 'ニコニコが元動画の3〜30秒を切り出し、連携したXに直接投稿します。' : 'ニコニコが元動画の指定区間（3〜30秒）を切り出します。コメントと音声はプレビューで確認し、ここから連携済みのXに投稿できます。'}</p>
<p name="account"></p>
<div class="shareRow">
  <label>開始 <input name="clipStart" type="number" min="0" step="0.001"> 秒</label>
  <label>終了 <input name="clipEnd" type="number" min="0" step="0.001"> 秒</label>
</div>
<div name="editor" hidden>
<p name="license" hidden></p>
<button type="button" name="create" disabled>プレビューを作成</button>
<div name="composer" hidden>
<video aria-label="作成したビデオクリップ" controls playsinline preload="metadata" hidden></video>
<label>投稿本文<textarea name="clipText" rows="3"></textarea></label>
<div class="shareRow"><button type="button" name="post" disabled>この内容でXに投稿する</button>
<button type="button" name="check" hidden>状態を再確認</button>
<button type="button" name="again" hidden>別のクリップを作成</button>
<button type="button" name="discard" hidden>クリップを削除して選び直す</button></div></div>
</div>
<p role="status" class="shareStatus"></p>
<details name="otherReceipts" hidden><summary>ほかの区間の未確認の投稿</summary><div name="receiptActions"></div></details>
<p name="receiptResult" role="status" hidden></p>
<div class="shareRow"><button name="useLocal" type="button" hidden>この範囲を端末で作成</button>
<a class="shareAction" target="_blank" rel="noopener noreferrer">ニコニコの視聴ページで開く</a></div>`;
    const find = name => container.querySelector('[name="' + name + '"]');
    const status = container.querySelector('[role=status]');
    const preview = container.querySelector('video');
    const link = container.querySelector('a');
    const start = find('clipStart');
    const end = find('clipEnd');
    const draft = find('clipText');
    const create = find('create');
    const post = find('post');
    const check = find('check');
    const discard = find('discard');
    const again = find('again');
    const useLocal = find('useLocal');
    if (sharedEditor) {
      start.closest('.shareRow').remove();
      draft.closest('label').remove();
      create.remove();
      post.remove();
      useLocal.remove();
    }
    // The service uses integer milliseconds. Both HTML step validation and draft
    // matching must use the very same range we send to the server.
    const limit = Number.isFinite(duration) && duration > 0 ? Math.floor(duration * 1000) / 1000 : Infinity;
    const seconds = value => Math.round(value * 1000) / 1000;
    const hasEnd = Number.isFinite(endTime);
    const initialStart = seconds(Math.max(0, Math.min(Number(startTime) || 0, hasEnd ? limit : Math.max(0, limit - 3))));
    const initialEnd = seconds(Math.max(0, Math.min(limit, hasEnd ? endTime : initialStart + 10)));
    start.value = String(initialStart);
    end.value = String(initialEnd);
    if (Number.isFinite(limit)) start.max = end.max = String(limit);
    useLocal.hidden = typeof onUseLocal !== 'function';
    useLocal.onclick = () => {
      if (lifetime.signal.aborted || typeof onUseLocal !== 'function') return;
      const from = start.valueAsNumber, to = end.valueAsNumber;
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from || to > limit) {
        status.textContent = '開始と終了を動画の範囲内で指定してください。';
        return;
      }
      onUseLocal({start:from, end:to});
    };
    link.href = officialUrl;
    const shareUrl = 'https://nico.ms/' + encodeURIComponent(info.watchId);
    const suppliedText = String(text() || '');
    draft.value = suppliedText.includes(shareUrl) ? suppliedText : [suppliedText, shareUrl].filter(Boolean).join('\n');

    function validRange() {
      const first = Math.round(start.valueAsNumber * 1000);
      const last = Math.round(end.valueAsNumber * 1000);
      return Number.isSafeInteger(first) && Number.isSafeInteger(last) && start.validity.valid && end.validity.valid &&
        last - first >= 3000 && last - first <= 30000 && last <= Math.floor(limit * 1000);
    }
    function update() {
      const edit = phase === 'edit';
      start.disabled = end.disabled = !['edit','denied','checking'].includes(phase);
      find('composer').hidden = !clipId;
      create.hidden = sharedEditor || !!clipId;
      create.disabled = !edit || Date.now() < retryAt || !validRange();
      post.disabled = phase !== 'preview' || !draft.value.trim();
      if (sharedEditor) {
        link.hidden = !['denied','postFailed','postUnknown','clipUnknown','clipError','createUnknown'].includes(phase) && !(phase === 'preview' && !account);
        const busy = ['queued','creating','generating','verifying','posting','discarding'].includes(phase);
        onSubmitState?.({enabled:(phase === 'preview' || (edit && Date.now() >= retryAt && validRange())) && !!String(text() || '').trim(),
          busy,phase,account:account || '',status:status.textContent,
          label:phase === 'preview' ? 'このクリップをXに投稿' : 'クリップを作成してXに投稿'});
      }
      draft.disabled = ['posting', 'posted', 'postUnknown'].includes(phase);
      again.hidden = phase !== 'posted';
      check.hidden = phase !== 'postUnknown' && phase !== 'clipUnknown';
      discard.hidden = !clipId || !['preview','clipError','clipUnknown','postFailed'].includes(phase);
    }
    function state(value, message) {
      if (lifetime.signal.aborted) return;
      phase = value;
      const busy = ['checking','queued','creating','generating','verifying','posting','discarding'].includes(phase);
      status.dataset.busy = String(busy);
      container.querySelector('[name=editor]').setAttribute('aria-busy', String(busy));
      status.textContent = message;
      update();
    }
    start.oninput = end.oninput = () => {
      if (phase !== 'edit') return;
      if (accountKey && validRange()) selectScene(); else update();
      if (phase !== 'edit') return;
      if (!validRange()) status.textContent = '動画の範囲内で、3〜30秒の区間を選んでください。';
      if (Number.isFinite(start.valueAsNumber) && start.valueAsNumber >= 0) {
        const url = new URL(officialUrl);
        url.searchParams.set('from', String(Math.floor(start.valueAsNumber)));
        link.href = url.href;
      }
    };
    draft.oninput = update;
    preview.onerror = () => {
      if (phase === 'preview') {
        task = 'clip';
        state('clipUnknown', 'プレビューを読み込めません。「状態を再確認」で取得し直してください。');
      }
    };

    function saved(key = recordKey) {
      return savedScene(win,key);
    }
    function createNotice() {
      const key = accountKey + ':creation';
      const value = read(win,key) || read(win,recordKey + ':creation');
      if (!value) return '';
      if (value === 'unconfirmed') return '前回の作成リクエストが受理されたか確認できません。公式ページで状態を確認してから、必要な場合にもう一度作成してください。';
      if (value === 'limited') return '前回、ニコニコが短時間の作成リクエストを制限しました。時間をおいてから再度作成するか、「この範囲を端末で作成」を選べます。';
      const secondsLeft = Math.ceil((Number(value) - Date.now()) / 1000);
      if (secondsLeft > 0) {
        retryAt = Number(value);
        win.clearTimeout(retryTimer);
        retryTimer = win.setTimeout(() => {
          if (phase === 'edit' && !lifetime.signal.aborted) state('edit', createNotice() || 'もう一度作成を試せます。');
        }, Math.min(retryAt - Date.now() + 1, 2147483647));
        return 'ニコニコからの再試行の目安はあと' + secondsLeft + '秒です。「この範囲を端末で作成」も選べます。';
      }
      store(win,key,null);
      return '';
    }
    const {request,beginDiagnostic} = transport(win,videoId,lifetime.signal,() => Date.now() >= deadline);
    async function load() {
      if (!videoId || limit < 3) {
        state('denied', '公式クリップには長さ3秒以上のニコニコ動画が必要です。');
        return;
      }
      state('checking', 'ニコニコに公式投稿の利用状況を確認しています…');
      try {
        const permission = await request('clip-permission', source + '/tweet-possibility');
        if (lifetime.signal.aborted) return;
        const reason = permissionReason(permission);
        if (reason) { state('denied', permissionMessages[reason]); return; }
        account = linkedName(permission);
        find('account').textContent = account ? '投稿先　@' + account : '連携した X アカウントに投稿';
        find('editor').hidden = false;
        accountKey = restoreAccount(win,videoId,account);
        if (!hasEnd && !sharedEditor) {
          const lastKey = read(win,accountKey + ':last');
          const lastRecord = lastKey && saved(lastKey);
          if (lastRecord) {
            start.value = String(seconds(Number(lastRecord.start)));
            end.value = String(seconds(Number(lastRecord.end)));
          }
        }
        refreshReceipts(accountKey);
        receiptObservers.add(refreshReceipts);
        selectScene();
        let licensed;
        try { licensed = (await request('clip-license', source + '/license'))?.isUseLicensedMusic; } catch (_) { /* report uncertainty below */ }
        if (lifetime.signal.aborted) return;
        const note = find('license');
        note.hidden = licensed === false;
        note.textContent = licensed === true ? '権利楽曲利用の可能性があるため、クリップは映像のみになります。' :
          '音声の利用可否は、作成したクリップのプレビューで確認してください。';
      } catch (_) {
        state('denied', 'ニコニコの公式投稿を利用できるか確認できません。');
      }
    }
    // Lost X acknowledgements stay reachable after the timeline moves. A check
    // reads the original clip's receipt and never submits another publication.
    let otherReceipts = [];
    const checkingReceipts = new Set();
    function refreshReceipts(changedAccount) {
      if (changedAccount !== accountKey || lifetime.signal.aborted) return;
      const keys = new Set(recent.keys());
      try {
        for (let i = 0; i < win.sessionStorage.length; i++) keys.add(win.sessionStorage.key(i));
      } catch (_) { /* In-memory records are still available. */ }
      const prefix = accountKey + ':range:';
      otherReceipts = [];
      for (const key of keys) {
        if (!key?.startsWith(prefix) || publications.has(key)) continue;
        const record = saved(key);
        if (record?.kind === 'post' && !record.failureNotified) otherReceipts.push({key,record});
      }
      renderReceiptActions();
    }
    function renderReceiptActions() {
      const actions = find('receiptActions');
      actions.replaceChildren();
      for (const {key,record} of otherReceipts) {
        if (key === recordKey) continue;
        const button = container.ownerDocument.createElement('button');
        button.type = 'button';
        button.textContent = record.start + '〜' + record.end + '秒の投稿結果を再確認';
        button.disabled = checkingReceipts.has(key);
        button.onclick = async () => {
          if (checkingReceipts.has(key)) return;
          checkingReceipts.add(key);
          button.disabled = true;
          let message;
          try {
            const result = await request('clip-post-status','/clips/' + encodeURIComponent(record.id) + '/x-post');
            if (lifetime.signal.aborted) return;
            message = resolveReceipt(key,record.id,result) || 'ニコニコで投稿を処理しています。';
          } catch (_) { message = '投稿結果を確認できません。時間をおいて再確認してください。'; }
          finally { checkingReceipts.delete(key); }
          if (lifetime.signal.aborted) return;
          const notice = find('receiptResult');
          notice.hidden = false;
          notice.textContent = record.start + '〜' + record.end + '秒　' + message;
          refreshReceipts(accountKey);
        };
        actions.append(button);
      }
      find('otherReceipts').hidden = !actions.childElementCount;
    }
    function resolveReceipt(key,id,result) {
      const posted = result.status === 'DONE';
      if (!posted && !['FAILED','ERROR'].includes(result.status)) return;
      const failure = posted ? null : postFailure(result.failureReason);
      const message = posted ? 'X にクリップをポストしました。' : failure.message;
      const previous = saved(key);
      if (previous?.id !== id || previous.kind !== 'post' || previous.failureNotified) return message;
      if (posted) beginDiagnostic('clip-post')?.success();
      store(win,key,JSON.stringify({...previous,kind:posted ? 'posted' : 'post',failureNotified:!posted}));
      onNotify?.(publicationLabel(info.watchId || videoId,previous.start,previous.end) + message,
        posted ? 'info' : 'error',publicationDetails('receipt',posted ? 'posted' : failure.reason));
      for (const refresh of receiptObservers) refresh(accountKey);
      return message;
    }
    function sceneKey(from,to) {
      return rangeKey(accountKey,Math.round(from * 1000),Math.round(to * 1000));
    }
    function selectScene() {
      unobserve?.();
      const version = ++selectionVersion;
      win.clearTimeout(timer);
      win.clearTimeout(retryTimer);
      retryAt = 0;
      clipId = null;
      preview.hidden = true;
      preview.removeAttribute('src');
      recordKey = sceneKey(start.valueAsNumber,end.valueAsNumber);
      renderReceiptActions();
      const running = publications.get(recordKey);
      if (running) { observe(running); return; }
      function resume() {
        if (lifetime.signal.aborted || version !== selectionVersion) return;
        const previous = saved();
        if (previous) restore(previous);
        else state('edit',createNotice());
      }
      const deleting = pendingDeletions.get(recordKey);
      const pending = deleting || pendingCreations.get(recordKey);
      if (pending) {
        if (deleting) state('discarding','クリップを削除しています…');
        else state('creating','先ほどの作成リクエストの結果を確認しています…');
        void pending.then(resume,resume);
      } else resume();
    }
    const clipPath = () => '/clips/' + encodeURIComponent(clipId);
    function restore(previous) {
      clipId = previous.id;
      start.value = String(seconds(Number(previous.start)));
      end.value = String(seconds(Number(previous.end)));
      draft.value = previous.text;
      if (previous.kind === 'posted') state('posted', 'X にクリップをポストしました。');
      else {
        task = previous.kind;
        deadline = Date.now() + pollLimit;
        void poll();
      }
    }
    function uncertain() {
      if (task === 'post') state('postUnknown', '投稿結果を確認できません。「状態を再確認」で結果を確認してください。');
      else state('clipUnknown', '生成状況を確認できません。「状態を再確認」で確認してください。');
    }
    async function poll() {
      if (lifetime.signal.aborted) return;
      const version = selectionVersion;
      const posting = task === 'post';
      state(posting ? 'posting' : 'generating', posting ? 'X への投稿結果を確認しています…' : 'クリップを生成しています…');
      try {
        const result = await request(posting ? 'clip-post-status' : 'clip-status', clipPath() + (posting ? '/x-post' : ''));
        if (lifetime.signal.aborted || version !== selectionVersion) return;
        if (result?.status === 'DONE') {
          if (posting) {
            state('posted',resolveReceipt(recordKey,clipId,result));
            return;
          }
          const uri = new URL(result.clipUri);
          if (uri.protocol !== 'https:') throw new Error('preview');
          preview.src = uri.href;
          preview.hidden = false;
          state('preview', '作成したクリップと投稿本文を確認してください。');
          return;
        }
        if (result?.status === 'FAILED' || result?.status === 'ERROR') {
          if (posting) {
            state('postFailed',resolveReceipt(recordKey,clipId,result));
          }
          else state('clipError', 'クリップの生成に失敗しました。');
          return;
        }
        if (!result?.status || (!posting && !['WAITING', 'GENERATING'].includes(result.status)) ||
            Date.now() >= deadline) { uncertain(); return; }
        timer = win.setTimeout(poll, pollInterval);
      } catch (error) {
        if (lifetime.signal.aborted || version !== selectionVersion) return;
        if (!posting && [404,410].includes(error.httpStatus)) {
          startAnother();
          if (phase === 'edit') state('edit', '前回のプレビューはニコニコで利用できなくなりました。区間を確認して新しく作成できます。');
        } else uncertain();
      }
    }
    create.onclick = async () => {
      if (phase !== 'edit' || !validRange() || pendingCreations.has(recordKey) || publications.has(recordKey)) return;
      store(win,accountKey + ':last',recordKey);
      state('creating', 'クリップの作成をリクエストしています…');
      const version = selectionVersion;
      try {
        const id = await createTracked(win,request,source,accountKey,recordKey,Math.round(start.valueAsNumber * 1000),
          Math.round(end.valueAsNumber * 1000),draft.value);
        if (lifetime.signal.aborted || version !== selectionVersion) return;
        clipId = id;
        task = 'clip';
        deadline = Date.now() + pollLimit;
        await poll();
      } catch (error) {
        if (lifetime.signal.aborted || version !== selectionVersion) return;
        if (error.httpStatus === 429 || error.message === 'USER_LIMIT_EXCEEDED') state('edit', createNotice());
        else if (error.httpStatus === 401 || error.httpStatus === 403) {
          state('denied', 'ニコニコで公式クリップを作成できません。ログイン、X連携、動画の共有設定を確認してください。');
        } else state('createUnknown', 'ニコニコでのクリップ作成結果を確認できません。');
      }
    };
    function observe(job) {
      unobserve?.();
      const sync = () => {
        if (lifetime.signal.aborted) return;
        clipId = job.id;
        task = job.kind;
        start.value = String(job.first/1000);
        end.value = String(job.last/1000);
        draft.value = job.text;
        if (job.uri && !sharedEditor && preview.getAttribute('src') !== job.uri) {
          preview.src = job.uri;
          preview.hidden = false;
        }
        let message = job.message;
        if (job.phase === 'edit') message = createNotice() || message;
        state(job.phase,message);
      };
      job.listeners.add(sync);
      unobserve = () => { job.listeners.delete(sync); unobserve = null; };
      sync();
    }
    function submit() {
      if (lifetime.signal.aborted || !recordKey || publications.has(recordKey) || pendingCreations.has(recordKey)) return;
      if (phase !== 'preview' && !(sharedEditor && phase === 'edit' && validRange() && Date.now() >= retryAt)) return;
      const previous = saved();
      if (previous?.kind === 'post' || previous?.kind === 'posted') {
        restore(previous);
        return;
      }
      const body = sharedEditor ? String(text() || '') : draft.value;
      if (!body.trim()) return;
      store(win,accountKey + ':last',recordKey);
      observe(publish(win,{key:recordKey,accountKey,account,source,videoId,name:String(info.title || info.watchId || videoId),watchId:String(info.watchId || videoId),
        id:phase === 'preview' ? clipId : null,uri:preview.getAttribute('src'),
        first:Math.round(start.valueAsNumber*1000),last:Math.round(end.valueAsNumber*1000),text:body},onNotify,holdWatchPage));
    }
    post.onclick = submit;
    check.onclick = () => {
      if (!['postUnknown', 'clipUnknown'].includes(phase)) return;
      deadline = Date.now() + pollLimit;
      void poll();
    };
    function startAnother() {
      store(win,recordKey,null);
      if (hasEnd && !sharedEditor) {
        start.value = String(initialStart);
        end.value = String(initialEnd);
      }
      selectScene();
      if (phase === 'edit') state('edit', '新しい区間を選んでください。');
    }
    again.onclick = () => { if (phase === 'posted') startAnother(); };
    discard.onclick = async () => {
      if (!clipId || discard.hidden) return;
      const previous = phase, key = recordKey, version = selectionVersion;
      state('discarding', 'クリップを削除しています…');
      const deleting = request('clip-delete',clipPath(),'DELETE')
        .then(() => store(win,key,null))
        .finally(() => pendingDeletions.delete(key));
      pendingDeletions.set(key,deleting);
      try {
        await deleting;
        if (!lifetime.signal.aborted && version === selectionVersion) startAnother();
      } catch (_) {
        if (version === selectionVersion) state(previous,'削除結果を確認できません。公式の視聴ページで確認してください。');
      }
    };
    void load();
    const cleanup = () => {
      unobserve?.();
      lifetime.abort();
      receiptObservers.delete(refreshReceipts);
      win.clearTimeout(timer);
      win.clearTimeout(retryTimer);
      if (!preview.paused) preview.pause();
      preview.removeAttribute('src');
      if (preview.currentSrc) preview.load();
    };
    return Object.assign(cleanup,{submit,refresh:update,setRange(range) {
      if (!range || lifetime.signal.aborted || !Number.isFinite(range.start) || !Number.isFinite(range.end)) return;
      const from = seconds(range.start), to = seconds(range.end);
      if (from === start.valueAsNumber && to === end.valueAsNumber) return;
      start.value = String(from);
      end.value = String(to);
      if (accountKey) selectScene(); else update();
    }});
  }
  async function submitQuick({watchId,videoId,name,from,to,text},onNotify,holdWatchPage) {
    const first = Math.round(from * 1000), last = Math.round(to * 1000);
    const source = '/videos/' + encodeURIComponent(videoId);
    const {request} = transport(window,videoId,new AbortController().signal,() => false);
    let permission;
    try { permission = await request('clip-permission',source + '/tweet-possibility'); }
    catch (error) {
      onNotify('公式投稿の利用状況を確認できませんでした。','warning',publicationDetails('permission',error.reason || 'network',error));
      return;
    }
    const denied = permissionReason(permission), account = linkedName(permission);
    if (denied || !account) {
      onNotify(permissionMessages[denied] || '連携先の名前を確認できません。ニコニコの視聴ページで投稿先を確認してください。','warning');
      return;
    }
    const accountKey = restoreAccount(window,videoId,account);
    const key = rangeKey(accountKey,first,last);
    const previous = savedScene(window,key);
    if (publications.has(key) || pendingCreations.has(key) || pendingDeletions.has(key)) {
      onNotify('この区間は処理中です。','warning');
      return;
    }
    if (previous || read(window,key + ':creation') === 'unconfirmed' || read(window,accountKey + ':creation') === 'unconfirmed') {
      onNotify(previous?.kind === 'posted' ? 'この区間はすでに投稿済みです。' : 'この区間には前回の作成・投稿記録があります。共有画面で状態を確認してください。','warning');
      return;
    }
    store(window,accountKey + ':last',key);
    publish(window,{key,accountKey,account,source,videoId,watchId,name,first,last,text},onNotify,holdWatchPage);
  }
  return {mount,submitQuick};
})();
//===END===
export {ShareOfficialClip};
