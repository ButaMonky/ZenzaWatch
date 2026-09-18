import {CommentLayer} from './CommentLayer';
import {NicoChat} from './NicoChat';
import {global} from '../../../../src/ZenzaWatchIndex';
import {ScreenFilter} from '../videoPlayer/ScreenFilter';
//===BEGIN===
/*
 * Task 070: コメント付きピクチャーインピクチャー
 *
 * 通常のPiPは<video>要素そのものを小窓に出すため、HTMLで重ねているコメントは映らない。
 * そこで、動画のフレームと「今見えているコメント」を1枚のcanvasに描き、
 * canvas.captureStream() を非表示の<video>に流して、その<video>をPiPにする。
 *
 * 高速化のため:
 * - コメントの位置は既存のレイアウト計算結果（NicoChatViewModel）をそのまま使い、DOMは触らない
 * - コメント1件ごとの文字の絵は最初の1回だけ作ってキャッシュし、毎フレームは位置を変えて貼るだけ
 * - 表示中のコメントは開始時刻順の配列を二分探索して探す（全コメントを毎フレーム走査しない）
 * - タブが裏に回ってもrequestAnimationFrameが止まらないよう、Workerのタイマーで描画する
 * - 一時停止中で時刻も大きさも変わらない時は描き直さない
 */
const CommentPictureInPicture = (() => {
  const SCREEN = CommentLayer.SCREEN;
  const FPS = 60;
  const MAX_DRAW_COMMENTS = 200;
  const DEFAULT_FONT = `'ＭＳ Ｐゴシック', 'MS PGothic', 'IPAMonaPGothic', 'Hiragino Sans', 'Yu Gothic', sans-serif, Arial`;
  const COMMAND_FONT = {
    gothic: `'游ゴシック', 'Yu Gothic', 'YuGothic', Simsun, 'ＭＳ ゴシック', 'IPAMonaPGothic', sans-serif, Arial`,
    mincho: `'游明朝体', 'Yu Mincho', 'YuMincho', Simsun, 'ＭＳ 明朝', 'Hiragino Mincho ProN', serif`,
    defont: `arial, 'ＭＳ Ｐゴシック', 'MS PGothic', 'Hiragino Sans', 'IPAMonaPGothic', sans-serif`
  };
  const HTML5_LINE_HEIGHT = {big: 47.5 - 1, medium: (384 - 4) / 13, small: (384 - 4) / 21};
  const HTML5_LINE_HEIGHT_RESIZED = {big: 48, medium: (384 - 4) * 2 / 25 - 0.4, small: (384 - 4) * 2 / 38};
  const FLASH_LINE_HEIGHT = {big: 45, medium: 29, small: 18};

  /*
   * Task 070修正: 流れるコメントの横位置は、CSS3表示（NicoChatCss3View._buildNakaCss）のアニメーションと同じ式で求める。
   * NicoChatViewModel.getXposBySecond() は符号が逆（時間とともに右へ進む）で、CSS表示では使われていなかったため使わない。
   *   開始位置 left = WIDTH + (OUTER_WIDTH_FULL - WIDTH) / 2
   *   移動量 OUTER_WIDTH_FULL + width * cssScale を、duration + durationDiff 秒かけて左へ
   *   開始時刻 beginLeftTiming - durationDiff / 2 （durationDiff = (OUTER_WIDTH_FULL - WIDTH) / speed）
   * 表示時間外は null。
   */
  const getNakaXpos = (chat, sec, width) => {
    const outer = SCREEN.OUTER_WIDTH_FULL;
    const screenDiff = outer - SCREEN.WIDTH;
    const speed = chat.speed > 0 ? chat.speed : (width + SCREEN.WIDTH) / Math.max(0.1, chat.duration);
    const durationDiff = screenDiff / speed;
    const duration = chat.duration + durationDiff;
    const begin = chat.beginLeftTiming - durationDiff / 2;
    let progress = (sec - begin) / Math.max(0.001, duration);
    if (progress < 0 || progress > 1) {
      return null;
    }
    if (chat.isReverse) {
      progress = 1 - progress;
    }
    const scaledWidth = (chat.width || width) * (chat.cssScale || 1);
    return SCREEN.WIDTH + screenDiff / 2 - progress * (outer + scaledWidth);
  };

  const isSupported = () =>
    !!(document.pictureInPictureEnabled &&
      HTMLCanvasElement.prototype.captureStream &&
      HTMLVideoElement.prototype.requestPictureInPicture);

  const createCanvas = (width, height) => {
    if (self.OffscreenCanvas) {
      return new OffscreenCanvas(width, height);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };

  // 裏タブでも止まらないタイマー（Workerのタイマーは裏タブで間引かれにくい）
  const createTicker = (interval, callback) => {
    let worker = null, url = null, timer = null;
    try {
      url = URL.createObjectURL(new Blob([
        'let t = null; onmessage = e => { clearInterval(t); t = e.data > 0 ? setInterval(() => postMessage(0), e.data) : null; };'
      ], {type: 'text/javascript'}));
      worker = new Worker(url);
      worker.onmessage = () => callback();
      worker.postMessage(interval);
    } catch (e) {
      console.warn('CommentPictureInPicture: worker ticker unavailable', e);
      worker = null;
      timer = setInterval(callback, interval);
    }
    return {
      stop() {
        if (worker) {
          worker.postMessage(0);
          worker.terminate();
        }
        url && URL.revokeObjectURL(url);
        timer && clearInterval(timer);
        worker = timer = url = null;
      }
    };
  };

  const decoder = document.createElement('textarea');
  const textLinesCache = new WeakMap();
  const getTextLines = chat => {
    let lines = textLinesCache.get(chat);
    if (lines) {
      return lines;
    }
    const html = chat.htmlText || '';
    if (html) {
      decoder.innerHTML = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>/g, '');
      lines = decoder.value.split('\n');
    } else {
      lines = String(chat.text || '').split('\n');
    }
    textLinesCache.set(chat, lines);
    return lines;
  };

  class CommentRenderer {
    constructor({config}) {
      this.config = config;
      this.bitmaps = new Map();
      this.snapshot = {key: '', list: [], maxSpan: 10, updatedAt: 0};
    }

    clearCache() {
      this.bitmaps.clear();
    }

    _getLineHeight(chat) {
      const size = chat.size || NicoChat.SIZE.MEDIUM;
      if (chat.commentVer === 'html5') {
        return (chat.isLineResized ? HTML5_LINE_HEIGHT_RESIZED[size] : HTML5_LINE_HEIGHT[size]) ||
          chat.fontSizePixel * 1.235;
      }
      const lh = Math.floor(chat.lineHeight);
      return lh > 0 ? lh : (FLASH_LINE_HEIGHT[size] || chat.fontSizePixel * 1.235);
    }

    _getFont(chat) {
      const props = this.config.props;
      const weight = chat.fontCommand ? 400 : (props.baseFontBolder ? (props.cssFontWeight || 'bold') : 'normal');
      const baseFont = (props.baseFontFamily || '').replace(/[;{}*/]/g, '');
      const family = COMMAND_FONT[chat.fontCommand] || (baseFont ? `${baseFont}, ${DEFAULT_FONT}` : DEFAULT_FONT);
      return `${weight} ${chat.fontSizePixel}px ${family}`;
    }

    _getBitmap(chat, scale) {
      const cache = this.bitmaps.get(chat);
      if (cache && cache.scale === scale) {
        cache.lastUsed = this.frame;
        return cache;
      }
      const lines = getTextLines(chat);
      const scaleX = chat.cssScale || 1;
      const scaleY = chat.cssScaleY || scaleX;
      const lineHeight = this._getLineHeight(chat);
      const padding = 2;
      const layerWidth = Math.max(1, chat.width || 1);
      const layerHeight = (lineHeight * lines.length + padding * 2) * scaleY;
      const margin = 3;
      const width = Math.min(8192, Math.ceil(layerWidth * scale) + margin * 2);
      const height = Math.min(4096, Math.ceil(layerHeight * scale) + margin * 2);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      const font = this._getFont(chat);
      ctx.font = font;
      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = '1px';
      }
      let measured = 1;
      for (const line of lines) {
        measured = Math.max(measured, ctx.measureText(line).width);
      }
      // 実際の表示幅（レイアウト計算時にDOMで測った幅）に合わせる。フォント差があってもコメントアートが崩れにくい
      const fitX = Math.max(0.5, Math.min(2, layerWidth / Math.max(1, measured * scaleX)));
      const color = chat.color || '#FFFFFF';
      const isBlack = /^#0{3,6}$/i.test(color) || color === 'black';
      ctx.setTransform(scale * scaleX * fitX, 0, 0, scale * scaleY, margin, margin);
      ctx.font = font;
      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = '1px';
      }
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeStyle = isBlack ? 'rgba(160, 160, 160, 0.8)' : 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = Math.min(chat.fontSizePixel / 6, 2.4 / Math.max(0.2, scaleX));
      ctx.fillStyle = color;
      lines.forEach((line, i) => {
        if (!line) { return; }
        const y = padding + lineHeight * i + lineHeight / 2;
        ctx.strokeText(line, 0, y);
        ctx.fillText(line, 0, y);
      });
      const bitmap = {canvas, scale, layerWidth, layerHeight, margin, lastUsed: this.frame};
      this.bitmaps.set(chat, bitmap);
      return bitmap;
    }

    _updateSnapshot(viewModel, now) {
      const groups = [NicoChat.TYPE.NAKA, NicoChat.TYPE.TOP, NicoChat.TYPE.BOTTOM]
        .map(type => viewModel.getGroup(type))
        .filter(Boolean);
      const key = groups.map(g => (g.members || []).length).join(',');
      const snapshot = this.snapshot;
      if (snapshot.viewModel === viewModel && snapshot.key === key && now - snapshot.updatedAt < 2000) {
        return snapshot;
      }
      const list = groups.flatMap(g => g.members || []);
      list.sort((a, b) => a.beginLeftTiming - b.beginLeftTiming);
      let maxSpan = 1;
      for (const chat of list) {
        const span = chat.endRightTiming - chat.beginLeftTiming;
        span > maxSpan && span < 3600 && (maxSpan = span);
      }
      const ids = new Set(list);
      for (const chat of this.bitmaps.keys()) {
        ids.has(chat) || this.bitmaps.delete(chat);
      }
      Object.assign(snapshot, {viewModel, key, list, maxSpan, updatedAt: now});
      return snapshot;
    }

    _getInView(viewModel, sec, now) {
      const {list, maxSpan} = this._updateSnapshot(viewModel, now);
      let lo = 0, hi = list.length;
      const from = sec - maxSpan - 3;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        list[mid].beginLeftTiming < from ? (lo = mid + 1) : (hi = mid);
      }
      const naka = [], fixed = [];
      for (let i = lo; i < list.length; i++) {
        const chat = list[i];
        if (chat.beginLeftTiming > sec + 1) { break; }
        if (chat.isInvisible) { continue; }
        if (chat.isFixed) {
          sec >= chat.beginLeftTiming && sec <= chat.endRightTiming && chat.isInViewBySecond(sec) && fixed.push(chat);
        } else if (sec <= chat.endRightTiming + 2 && chat.isInViewBySecond(Math.min(sec, chat.endRightTiming))) {
          // CSS表示では画面外の余白分だけ endRightTiming より少し長く流れるため、終了判定は getNakaXpos に任せる
          naka.push(chat);
        }
      }
      return {naka, fixed};
    }

    draw(ctx, {viewModel, sec, width, height, now}) {
      if (!viewModel) {
        return;
      }
      this.frame = (this.frame || 0) + 1;
      const scale = Math.round(height / SCREEN.HEIGHT * 100) / 100;
      const offsetX = (width - SCREEN.WIDTH * scale) / 2;
      const offsetY = (height - SCREEN.HEIGHT * scale) / 2;
      const props = this.config.props;
      const layerOpacity = typeof props.commentLayerOpacity === 'number' ? props.commentLayerOpacity : 1;
      const easyOpacity = props['commentLayer.easyCommentOpacity'];
      const aiOpacity = props['commentLayer.aiCommentOpacity'];
      const {naka, fixed} = this._getInView(viewModel, sec, now);
      const chats = naka.concat(fixed);
      const start = Math.max(0, chats.length - MAX_DRAW_COMMENTS);
      for (let i = start; i < chats.length; i++) {
        const chat = chats[i];
        let bitmap;
        try {
          bitmap = this._getBitmap(chat, scale);
        } catch (e) {
          continue;
        }
        const h = bitmap.layerHeight;
        const fontSize = chat.fontSizePixel;
        const isHtml5 = chat.commentVer === 'html5';
        let x, y;
        if (chat.isFixed) {
          x = (SCREEN.WIDTH - bitmap.layerWidth) / 2;
          const isEdge = isHtml5 ? h >= SCREEN.HEIGHT - fontSize / 2 : h >= SCREEN.HEIGHT * 0.7;
          if (isEdge) {
            y = chat.type === NicoChat.TYPE.BOTTOM ? SCREEN.HEIGHT - h : 0;
          } else {
            y = chat.ypos;
          }
        } else {
          x = getNakaXpos(chat, sec, bitmap.layerWidth);
          if (x === null) { continue; }
          const isAlignMiddle = isHtml5 ?
            (h >= SCREEN.HEIGHT - fontSize / 2 || chat.isOverflow) :
            (h >= SCREEN.HEIGHT - fontSize / 2 && h < SCREEN.HEIGHT + fontSize);
          y = isAlignMiddle ? (SCREEN.HEIGHT - h) / 2 : chat.ypos;
        }
        const dx = offsetX + x * scale - bitmap.margin;
        if (dx > width || dx + bitmap.canvas.width < 0) { continue; }
        let alpha = layerOpacity * (typeof chat.opacity === 'number' ? chat.opacity : 1);
        chat.fork === 2 && typeof easyOpacity === 'number' && (alpha *= easyOpacity);
        chat.fork === 3 && typeof aiOpacity === 'number' && (alpha *= aiOpacity);
        if (alpha <= 0) { continue; }
        ctx.globalAlpha = Math.min(1, alpha);
        ctx.drawImage(bitmap.canvas, Math.round(dx), Math.round(offsetY + y * scale - bitmap.margin));
      }
      ctx.globalAlpha = 1;
      if (this.frame % 600 === 0) {
        for (const [chat, bitmap] of this.bitmaps) {
          this.frame - bitmap.lastUsed > 600 && this.bitmaps.delete(chat);
        }
      }
    }
  }

  let session = null;

  const waitEvent = (target, name, timeout) => new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), timeout);
    target.addEventListener(name, () => { clearTimeout(timer); resolve(true); }, {once: true});
  });

  class Session {
    constructor({getVideo, getViewModel, config, onPlay, onPause, onEnd}) {
      this.getVideo = getVideo;
      this.getViewModel = getViewModel;
      this.config = config;
      this.onPlay = onPlay;
      this.onPause = onPause;
      this.onEnd = onEnd;
      this.renderer = new CommentRenderer({config});
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', {alpha: false, desynchronized: true}) || this.canvas.getContext('2d');
      this.height = 720;
      this.lastKey = '';
      this.ignorePipEventsUntil = 0;
      this.video = null;
      this._onVideoPlay = this._onVideoPlay.bind(this);
      this._onVideoPause = this._onVideoPause.bind(this);
      this._onVideoSeeked = this._onVideoSeeked.bind(this);
      this._onResize = this._onResize.bind(this);
      this.draw = this.draw.bind(this);
    }

    _bindVideo(video) {
      if (this.video === video) { return; }
      if (this.video) {
        this.video.removeEventListener('play', this._onVideoPlay);
        this.video.removeEventListener('pause', this._onVideoPause);
        this.video.removeEventListener('seeked', this._onVideoSeeked);
      }
      this.video = video;
      if (video) {
        video.addEventListener('play', this._onVideoPlay);
        video.addEventListener('pause', this._onVideoPause);
        video.addEventListener('seeked', this._onVideoSeeked);
      }
    }

    _syncPip(action) {
      const pip = this.pipVideo;
      if (!pip) { return; }
      this.ignorePipEventsUntil = performance.now() + 500;
      action === 'play' ? pip.play().catch(() => {}) : pip.pause();
    }

    _onVideoPlay() { this.pipVideo && this.pipVideo.paused && this._syncPip('play'); }
    _onVideoPause() { this.pipVideo && !this.pipVideo.paused && this._syncPip('pause'); }
    _onVideoSeeked() {
      // 一時停止中にシークした時は、小窓の絵を更新するため一瞬だけ再生する
      const video = this.video, pip = this.pipVideo;
      if (!video || !pip || !video.paused) { return; }
      this.lastKey = '';
      this.draw();
      this._syncPip('play');
      setTimeout(() => this.video && this.video.paused && this._syncPip('pause'), 150);
    }

    _onPipPlay() {
      if (performance.now() < this.ignorePipEventsUntil) { return; }
      this.video && this.video.paused && this.onPlay && this.onPlay();
    }
    _onPipPause() {
      if (performance.now() < this.ignorePipEventsUntil) { return; }
      this.video && !this.video.paused && this.onPause && this.onPause();
    }

    _onResize() {
      const pipWindow = this.pipWindow;
      if (!pipWindow) { return; }
      const dpr = window.devicePixelRatio || 1;
      const height = Math.max(360, Math.min(1080, Math.round(pipWindow.height * dpr / 90) * 90));
      if (height !== this.height) {
        this.height = height;
        this.lastKey = '';
      }
    }

    _resizeCanvas(video) {
      const vw = video && video.videoWidth || 16;
      const vh = video && video.videoHeight || 9;
      const aspect = Math.max(vw / vh, 16 / 9);
      const height = this.height;
      const width = Math.round(height * aspect / 2) * 2;
      const canvas = this.canvas;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        this.renderer.clearCache();
        return true;
      }
      return false;
    }

    draw() {
      if (this.isDrawing) { return; }
      this.isDrawing = true;
      try {
        const video = this.getVideo();
        this._bindVideo(video);
        const resized = this._resizeCanvas(video);
        const canvas = this.canvas, ctx = this.ctx;
        const width = canvas.width, height = canvas.height;
        const sec = video ? video.currentTime : 0;
        const showComment = !!this.config.props.showComment;
        const viewModel = this.getViewModel();
        // Task 077: 一時停止中に画面フィルターを変えた時も描き直す
        const filterKey = `${ScreenFilter.buildFilter()}:${ScreenFilter.flipH}:${ScreenFilter.flipV}`;
        const key = `${sec}:${width}:${showComment}:${video && video.readyState}:${filterKey}`;
        if (!resized && video && video.paused && key === this.lastKey) {
          return;
        }
        this.lastKey = key;
        const now = performance.now();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        if (video && video.readyState >= 2 && video.videoWidth) {
          const scale = Math.min(width / video.videoWidth, height / video.videoHeight);
          const w = video.videoWidth * scale, h = video.videoHeight * scale;
          // Task 077: 画面フィルター（明るさ・反転など）も小窓に反映する（設定でOFFにできる）。
          // コメントには掛けない（drawVideo の中で save/restore している）。
          ScreenFilter.drawVideo(ctx, video.drawableElement || video, (width - w) / 2, (height - h) / 2, w, h,
            {target: 'commentPip'});
        }
        if (showComment && viewModel) {
          this.renderer.draw(ctx, {viewModel, sec, width, height, now});
        }
      } catch (e) {
        if (e && e.name === 'SecurityError') {
          console.warn('CommentPictureInPicture: canvas tainted', e);
          this.stop();
        } else {
          this.drawErrorCount = (this.drawErrorCount || 0) + 1;
          this.drawErrorCount < 5 && console.warn('CommentPictureInPicture draw error', e);
        }
      } finally {
        this.isDrawing = false;
      }
    }

    async start() {
      const video = this.getVideo();
      if (!video) {
        throw new Error('動画がありません');
      }
      this._bindVideo(video);
      this._resizeCanvas(video);
      this.draw();
      const stream = this.stream = this.canvas.captureStream(FPS);
      const pip = this.pipVideo = document.createElement('video');
      pip.className = 'zenzaCommentPipVideo';
      pip.muted = true;
      pip.playsInline = true;
      pip.autoplay = true;
      Object.assign(pip.style, {
        position: 'fixed', left: '0', bottom: '0', width: '2px', height: '2px',
        opacity: '0', pointerEvents: 'none', zIndex: '-1'
      });
      document.body.append(pip);
      pip.srcObject = stream;
      this.ticker = createTicker(Math.floor(1000 / FPS), this.draw);
      const metadata = pip.readyState >= 1 ? Promise.resolve(true) : waitEvent(pip, 'loadedmetadata', 3000);
      this.lastKey = '';
      this.draw();
      await pip.play().catch(() => {});
      await metadata;
      if (video.paused) {
        this._syncPip('pause');
      }
      pip.addEventListener('play', () => this._onPipPlay());
      pip.addEventListener('pause', () => this._onPipPause());
      pip.addEventListener('leavepictureinpicture', () => this.stop(), {once: true});
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture().catch(() => {});
      }
      this.pipWindow = await pip.requestPictureInPicture();
      this.pipWindow.addEventListener('resize', this._onResize);
      this._onResize();
    }

    stop() {
      if (this.isStopped) { return; }
      this.isStopped = true;
      this.ticker && this.ticker.stop();
      this._bindVideo(null);
      this.pipWindow && this.pipWindow.removeEventListener('resize', this._onResize);
      const pip = this.pipVideo;
      if (pip) {
        if (document.pictureInPictureElement === pip) {
          document.exitPictureInPicture().catch(() => {});
        }
        pip.srcObject = null;
        pip.remove();
      }
      this.stream && this.stream.getTracks().forEach(track => track.stop());
      this.renderer.clearCache();
      this.pipVideo = this.stream = this.pipWindow = null;
      this.onEnd && this.onEnd();
    }
  }

  const start = async params => {
    if (!isSupported()) {
      throw new Error('このブラウザはコメント付きPiPに対応していません');
    }
    stop();
    const current = session = new Session({
      ...params,
      onEnd: () => {
        session === current && (session = null);
        params.onEnd && params.onEnd();
      }
    });
    try {
      await current.start();
    } catch (e) {
      current.stop();
      throw e;
    }
    return current;
  };

  const stop = () => {
    session && session.stop();
    session = null;
  };

  const toggle = params => session ? (stop(), Promise.resolve(null)) : start(params);

  const api = {
    isSupported,
    start,
    stop,
    toggle,
    get isActive() { return !!session; },
    CommentRenderer,
    getNakaXpos
  };
  global.debug.commentPictureInPicture = api;
  return api;
})();
//===END===
export {CommentPictureInPicture};
