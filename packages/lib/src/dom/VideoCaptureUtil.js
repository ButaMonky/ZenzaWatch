import {createVideoElement} from '../../../zenza/src/videoPlayer/createVideoElement';
import {sleep} from '../infra/sleep';
import {CrossDomainGate} from '../infra/CrossDomainGate';
import {PRODUCT} from '../../../../src/ZenzaWatchIndex';
//===BEGIN===

const VideoCaptureUtil = (() => {
  const videoToCanvas = async video => {
    const frame = video.drawableElement || video;
    const width = video.videoWidth, height = video.videoHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
        (typeof frame.readyState === 'number' && frame.readyState < 2)) {
      throw new Error('Video frame is not ready');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(frame, 0, 0, width, height);
    // Check actual canvas origin cleanliness; blob/HLS URLs are valid inputs.
    context.getImageData(0, 0, 1, 1);
    return {canvas};
  };

  // 参考
  // https://developer.mozilla.org/ja/docs/Web/HTML/Canvas/Drawing_DOM_objects_into_a_canvas
  const htmlToSvg = (html, width = 682, height = 384) => {
    const data =
      (`<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>
          <foreignObject width='100%' height='100%'>${html}</foreignObject>
        </svg>`).trim();
    const svg = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
    return {svg, data};
  };

  const htmlToCanvas = async (html, width = 640, height = 360) => {
    const imageW = height * 16 / 9;
    const imageH = imageW * 9 / 16;
    const {svg} = htmlToSvg(html);
    const url = window.URL.createObjectURL(svg);
    if (!url) { throw new Error('convert svg fail'); }
    try {
      const img = new Image();
      img.width = 682;
      img.height = 384;
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      img.src = url;
      await img.decode();
      context.drawImage(img, (width - imageW) / 2, (height - imageH) / 2, imageW, imageH);
      return {canvas, img};
    } finally {
      window.URL.revokeObjectURL(url);
    }
  };

  const nicoVideoToCanvas = async ({video, html, minHeight = 1080, processVideoCanvas = null}) => {
    let scale = 1;
    let width =
      Math.max(video.videoWidth, video.videoHeight * 16 / 9);
    let height = video.videoHeight;
    // 動画の解像度が低いときは、可能な範囲で整数倍に拡大する
    if (height < minHeight) {
      scale = Math.floor(minHeight / height);
      width *= scale;
      height *= scale;
    }

    const canvas = document.createElement('canvas');
    const ct = canvas.getContext('2d', {alpha: false});

    canvas.width = width;
    canvas.height = height;

    const {canvas: rawVideoCanvas} = await videoToCanvas(video);
    // Task 077: 画面フィルター等、動画の絵だけに掛けたい加工があればここで掛ける
    const videoCanvas = processVideoCanvas ? processVideoCanvas(rawVideoCanvas) : rawVideoCanvas;

    ct.fillStyle = 'rgb(0, 0, 0)';
    ct.fillRect(0, 0, width, height);

    ct.drawImage(
      videoCanvas,
      (width - video.videoWidth * scale) / 2,
      (height - video.videoHeight * scale) / 2,
      video.videoWidth * scale,
      video.videoHeight * scale
    );

    const {canvas: htmlCanvas, img} = await htmlToCanvas(html, width, height);

    ct.drawImage(htmlCanvas, 0, 0, width, height);
    return {canvas, img};
  };

  const saveToFile = (canvas, fileName = 'sample.png') => {
    const dataUrl = canvas.toDataURL('image/png');
    const bin = atob(dataUrl.split(',')[1]);
    const buf = new Uint8Array(bin.length);
    for (let i = 0, len = buf.length; i < len; i++) {
      buf[i] = bin.charCodeAt(i);
    }
    const blob = new Blob([buf.buffer], {type: 'image/png'});
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');

    window.console.info('download fileName: ', fileName);
    a.setAttribute('download', fileName);
    a.setAttribute('href', url);
    a.setAttribute('rel', 'noopener');
    document.body.append(a);
    a.click();
    window.setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 2000);
  };

  return {
    videoToCanvas,
    htmlToCanvas,
    nicoVideoToCanvas,
    saveToFile
  };
})();
VideoCaptureUtil.capture = function(src, sec, {signal, timeout = 30000} = {}) {
  if (!Number.isFinite(sec) || sec < 0 || typeof src !== 'string' || !src) {
    return Promise.reject(new TypeError('Invalid capture source or position'));
  }
  const wait = (this.lastSrc === src && this.wait) ? this.wait : sleep(1000);
  this.lastSrc = src;
  const delay = 1000 + (src.includes('dmc.nico') ? 2000 : 0) + (src.includes('.m3u8') ? 2000 : 0);
  const result = new Promise((resolve, reject) => {
    let video, target = sec, settled = false, capturing = false, timer;
    const cleanup = () => {
      clearTimeout(timer);
      signal && signal.removeEventListener('abort', abort);
      if (!video) { return; }
      for (const [name, handler] of events) { video.removeEventListener(name, handler); }
      try { video.pause(); } catch (error) {}
      try { video.src = ''; video.removeAttribute('src'); video.load(); } catch (error) {}
      try { video.remove(); } catch (error) {}
    };
    const finish = (error, canvas) => {
      if (settled) { return; }
      settled = true;
      cleanup();
      error ? reject(error) : resolve(canvas);
    };
    const abort = () => finish(new Error('Video capture aborted'));
    const frame = () => {
      if (settled || capturing || !video) { return; }
      const drawable = video.drawableElement || video;
      if (drawable.readyState < 2 || drawable.seeking || Math.abs(video.currentTime - target) > 0.1) { return; }
      capturing = true;
      VideoCaptureUtil.videoToCanvas(video).then(({canvas}) => finish(null, canvas), finish);
    };
    const metadata = () => {
      try {
        if (Number.isFinite(video.duration) && video.duration > 0) { target = Math.min(sec, Math.max(0, video.duration - 0.001)); }
        video.currentTime = target;
        frame();
      } catch (error) { finish(error); }
    };
    const events = [['loadedmetadata', metadata], ['loadeddata', frame], ['canplay', frame], ['seeked', frame],
      ['error', () => finish(new Error('Video capture media failed'))]];
    if (signal && signal.aborted) { abort(); return; }
    signal && signal.addEventListener('abort', abort, {once: true});
    timer = setTimeout(() => finish(new Error('Video capture timed out')),
      Number.isFinite(timeout) && timeout > 0 ? timeout : 30000);
    wait.then(() => {
      if (settled) { return; }
      try {
        video = createVideoElement('capture');
        if (!video) { throw new Error('Capture video unavailable'); }
        Object.assign(video.style, {width: '64px', height: '36px', position: 'fixed', left: '-100px', top: '-100px'});
        video.volume = 0; video.muted = true; video.autoplay = false; video.controls = false;
        video.crossOrigin = 'anonymous';
        for (const [name, handler] of events) { video.addEventListener(name, handler); }
        document.body.append(video);
        video.src = src;
        // The HLS capture wrapper starts buffering through currentTime.
        // Waiting for metadata before this would leave autoStartLoad=false idle.
        video.currentTime = sec;
      } catch (error) { finish(error); }
    }, finish);
  });
  // Keep throttling internally while exposing failures to the caller.
  this.wait = Promise.all([Promise.resolve(wait).catch(() => {}),
    result.then(() => sleep(delay), () => sleep(delay * 2))]).then(() => undefined);
  return result;
}.bind({});

VideoCaptureUtil.initCapTube = function() {
  const iframe = document.querySelector(
    '#ZenzaWatchVideoPlayerContainer iframe[title^=YouTube]');
  if (!iframe) {
    return null;
  }
  if (this.bridge) {
    return this.bridge;
  }

  const cw = iframe.contentWindow;
  const promises = this.promises;
  self.addEventListener('message', e => {
    if (e.source !== cw) { return; }
    const {id, body, sessionId, status} = e.data;
    const {command, params} = body;
    if (id !== 'CapTube') {
      return;
    }
    switch (command) {
      case 'commandResult':
        if (promises[sessionId]) {
          if (status === 'ok') {
            promises[sessionId].resolve(params.result);
          } else {
            promises[sessionId].reject(params.result);
          }
          delete promises[sessionId];
        }
        return;
    }
  });
  const post = (body, options = {}) => {
    const sessionId = `send:CapTube:${this.sessionId++}`;
    return new Promise((resolve, reject) => {
        promises[sessionId] = {resolve, reject};
        cw.postMessage({body, sessionId}, location.href, options.transfer);
        if (typeof options.timeout === 'number') {
          setTimeout(() => {
            reject({status: 'fail', message: 'timeout'});
            delete promises[sessionId];
          }, options.timeout);
        }
      }).finally(() => { delete promises[sessionId]; });
  };
  return this.bridge = {post};
}.bind({promises: {}, sessionId: 1, bridge: null});

VideoCaptureUtil.capTube = ({title, videoId, author}) => {
  const tube = VideoCaptureUtil.initCapTube();
  if (!tube) { return; }
  const command = 'capTube';
  tube.post({command, params: {title, videoId, author}}, {timeout: 30000});
};

VideoCaptureUtil.capTubeThumbnail = (width = 320, height = 180, type = 'image/webp') => {
  const tube = VideoCaptureUtil.initCapTube();
  if (!tube) { return; }
  const command = 'capTubeThumbnail';
  tube.post({command, params: {width, height, type}}, {timeout: 30000});
};


//===END===

export {VideoCaptureUtil};