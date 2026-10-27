/**
 * Canonical TypeScript source for packages/lib/src/dom/VideoCaptureUtil.js (Task788).
 * Screenshots: video frame to canvas, comment HTML (SVG foreignObject) overlay, PNG
 * download, an off-screen capture video for a given time, and the CapTube bridge to
 * the embedded YouTube player (only for YouTube origins).
 */
/** Video element or the HLS wrapper that exposes `drawableElement`. */
export type CaptureVideo = HTMLVideoElement & {drawableElement?: HTMLVideoElement | HTMLCanvasElement & {readyState?: number; seeking?: boolean}};
interface Pending {resolve(value: unknown): void; reject(reason: unknown): void; timer?: ReturnType<typeof setTimeout>}
interface CapTubeBridge {
  post(body: unknown, options?: {timeout?: number; transfer?: Transferable[]}): Promise<unknown>;
  send(body: unknown, sessionId?: string, options?: {transfer?: Transferable[]}): void;
}
type CaptureFn = (src: string, sec: number, options?: {signal?: AbortSignal; timeout?: number}) => Promise<HTMLCanvasElement>;
type CapTubeState = {promises: Record<string, Pending>; sessionId: number; bridge: CapTubeBridge | null;
  frameWindow: Window | null; messageHandler: ((e: MessageEvent) => void) | null};

/** createVideoElement (packages/zenza/src/videoPlayer/createVideoElement.js). */
declare const createVideoElement: (name: string) => CaptureVideo | null;
declare const sleep: (ms?: number) => Promise<void>;

const VideoCaptureUtil = (() => {
  const videoToCanvas = async (video: CaptureVideo) => {
    const frame = (video.drawableElement || video) as CanvasImageSource & {readyState?: number};
    const width = video.videoWidth, height = video.videoHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
        (typeof frame.readyState === 'number' && frame.readyState < 2)) {
      throw new Error('Video frame is not ready');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.drawImage(frame, 0, 0, width, height);
    // Check actual canvas origin cleanliness; blob/HLS URLs are valid inputs.
    context.getImageData(0, 0, 1, 1);
    return {canvas};
  };

  // 参考
  // https://developer.mozilla.org/ja/docs/Web/HTML/Canvas/Drawing_DOM_objects_into_a_canvas
  const htmlToSvg = (html: string, width = 682, height = 384) => {
    const data =
      (`<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>
          <foreignObject width='100%' height='100%'>${html}</foreignObject>
        </svg>`).trim();
    const svg = new Blob([data], {type: 'image/svg+xml;charset=utf-8'});
    return {svg, data};
  };

  const htmlToCanvas = async (html: string, width = 640, height = 360) => {
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
      const context = canvas.getContext('2d') as CanvasRenderingContext2D;
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

  const nicoVideoToCanvas = async ({video, html, minHeight = 1080, processVideoCanvas = null}: {
    video: CaptureVideo; html: string; minHeight?: number;
    processVideoCanvas?: ((canvas: HTMLCanvasElement) => HTMLCanvasElement) | null}) => {
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
    const ct = canvas.getContext('2d', {alpha: false}) as CanvasRenderingContext2D;

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

  const saveToFile = (canvas: HTMLCanvasElement, fileName = 'sample.png') => {
    const dataUrl = canvas.toDataURL('image/png');
    const bin = atob(dataUrl.split(',')[1] as string);
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
})() as {
  videoToCanvas(video: CaptureVideo): Promise<{canvas: HTMLCanvasElement}>;
  htmlToCanvas(html: string, width?: number, height?: number): Promise<{canvas: HTMLCanvasElement; img: HTMLImageElement}>;
  nicoVideoToCanvas(options: {video: CaptureVideo; html: string; minHeight?: number;
    processVideoCanvas?: ((canvas: HTMLCanvasElement) => HTMLCanvasElement) | null}): Promise<{canvas: HTMLCanvasElement; img: HTMLImageElement}>;
  saveToFile(canvas: HTMLCanvasElement, fileName?: string): void;
  capture: CaptureFn;
  initCapTube: () => CapTubeBridge | null;
  capTube: (info: {title: string; videoId: string; author: string}) => void;
  capTubeThumbnail: (width?: number, height?: number, type?: string) => Promise<unknown> | undefined;
};
VideoCaptureUtil.capture = function(this: {lastSrc?: string; wait?: Promise<unknown>}, src: string, sec: number,
  {signal, timeout = 30000}: {signal?: AbortSignal; timeout?: number} = {}): Promise<HTMLCanvasElement> {
  if (!Number.isFinite(sec) || sec < 0 || typeof src !== 'string' || !src) {
    return Promise.reject(new TypeError('Invalid capture source or position'));
  }
  const wait = (this.lastSrc === src && this.wait) ? this.wait : sleep(1000);
  this.lastSrc = src;
  const delay = 1000 + (src.includes('dmc.nico') ? 2000 : 0) + (src.includes('.m3u8') ? 2000 : 0);
  const result = new Promise<HTMLCanvasElement>((resolve, reject) => {
    let video: CaptureVideo | null | undefined, target = sec, settled = false, capturing = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      clearTimeout(timer);
      signal && signal.removeEventListener('abort', abort);
      if (!video) { return; }
      for (const [name, handler] of events) { video.removeEventListener(name, handler); }
      try { video.pause(); } catch (error) {}
      try { video.src = ''; video.removeAttribute('src'); video.load(); } catch (error) {}
      try { video.remove(); } catch (error) {}
    };
    const finish = (error: unknown, canvas?: HTMLCanvasElement) => {
      if (settled) { return; }
      settled = true;
      cleanup();
      error ? reject(error) : resolve(canvas as HTMLCanvasElement);
    };
    const abort = () => finish(new Error('Video capture aborted'));
    const frame = () => {
      if (settled || capturing || !video) { return; }
      const drawable = (video.drawableElement || video) as {readyState: number; seeking?: boolean};
      if (drawable.readyState < 2 || drawable.seeking || Math.abs(video.currentTime - target) > 0.1) { return; }
      capturing = true;
      VideoCaptureUtil.videoToCanvas(video).then(({canvas}) => finish(null, canvas), finish);
    };
    const metadata = () => {
      try {
        if (Number.isFinite((video as CaptureVideo).duration) && (video as CaptureVideo).duration > 0) { target = Math.min(sec, Math.max(0, (video as CaptureVideo).duration - 0.001)); }
        (video as CaptureVideo).currentTime = target;
        frame();
      } catch (error) { finish(error); }
    };
    const events: Array<[string, () => void]> = [['loadedmetadata', metadata], ['loadeddata', frame], ['canplay', frame], ['seeked', frame],
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

VideoCaptureUtil.initCapTube = function(this: CapTubeState): CapTubeBridge | null {
  const iframe = document.querySelector<HTMLIFrameElement>(
    '#ZenzaWatchVideoPlayerContainer iframe[title^=YouTube]');
  if (!iframe || !iframe.contentWindow) { return null; }
  const cw = iframe.contentWindow;
  const targetOrigin = new URL(iframe.src, location.href).origin;
  // Never send video/capture metadata to an arbitrary embedded origin.
  if (!/^https:\/\/www\.(?:youtube\.com|youtube-nocookie\.com)$/.test(targetOrigin)) { return null; }
  if (this.bridge && this.frameWindow === cw) { return this.bridge; }

  if (this.messageHandler) {
    self.removeEventListener?.('message', this.messageHandler);
    for (const pending of Object.values(this.promises)) {
      if (pending.timer !== undefined) { clearTimeout(pending.timer); }
      pending.reject(new Error('CapTube iframe replaced'));
    }
    this.promises = {};
  }
  this.frameWindow = cw;
  const promises = this.promises;
  const handler = (e: MessageEvent) => {
    if (e.source !== cw || e.origin !== targetOrigin) { return; }
    const data = e.data;
    if (!data || typeof data !== 'object' || data.id !== 'CapTube') { return; }
    const {body, sessionId} = data;
    if (!body || body.command !== 'commandResult') { return; }
    const pending = promises[sessionId];
    if (!pending) { return; }
    delete promises[sessionId];
    if (pending.timer !== undefined) { clearTimeout(pending.timer); }
    if (body.status === 'ok') {
      pending.resolve(body.params?.result);
    } else {
      pending.reject(body.params?.result || new Error('CapTube request failed'));
    }
  };
  this.messageHandler = handler;
  self.addEventListener('message', handler);
  const send = (body: unknown, sessionId?: string, options: {transfer?: Transferable[]} = {}) =>
    cw.postMessage({body, sessionId}, targetOrigin, options.transfer);
  const post = (body: unknown, options: {timeout?: number; transfer?: Transferable[]} = {}) => {
    const sessionId = `send:CapTube:${this.sessionId++}`;
    return new Promise((resolve, reject) => {
      const pending: Pending = {resolve, reject};
      promises[sessionId] = pending;
      try {
        send(body, sessionId, options);
        if (typeof options.timeout === 'number' && options.timeout > 0) {
          pending.timer = setTimeout(() => {
            if (promises[sessionId] !== pending) { return; }
            delete promises[sessionId];
            reject({status: 'fail', message: 'timeout'});
          }, options.timeout);
        }
      } catch (error) {
        delete promises[sessionId];
        reject(error);
      }
    });
  };
  return this.bridge = {post, send};
}.bind({promises: {}, sessionId: 1, bridge: null, frameWindow: null, messageHandler: null});

VideoCaptureUtil.capTube = ({title, videoId, author}) => {
  const tube = VideoCaptureUtil.initCapTube();
  if (!tube) { return; }
  const command = 'capTube';
  // Screenshot starts a download in the iframe; it has no acknowledgement.
  tube.send({command, params: {title, videoId, author}});
};

VideoCaptureUtil.capTubeThumbnail = (width = 320, height = 180, type = 'image/webp') => {
  const tube = VideoCaptureUtil.initCapTube();
  if (!tube) { return; }
  const command = 'capTubeThumbnail';
  return tube.post({command, params: {width, height, type}}, {timeout: 30000});
};

export {VideoCaptureUtil};
