import {ShareHlsPreview} from './ShareHlsPreview';
import {RequestDiagnostics} from '../packages/lib/src/infra/RequestDiagnostics';
//===BEGIN===
//@require ShareHlsPreview
//@require RequestDiagnostics
const ShareClipTimeline = (() => {
  const previewInterval = 1000 / 30;
  const sessionFrames = new WeakMap();
  function framesFor(video, session) {
    if (session == null) return new Map();
    const url = video.currentSrc, object = video.srcObject;
    if (object && typeof WeakRef !== 'function') return new Map();
    const cached = sessionFrames.get(video);
    if (cached && cached.session === session && cached.url === url && (cached.object?.deref() || null) === object) return cached.frames;
    const entry = {session,url,object:object ? new WeakRef(object) : null, frames:new Map()};
    sessionFrames.set(video,entry);
    return entry.frames;
  }
  function displayFrame(frame, maxHeight = Infinity) {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, maxHeight/frame.height);
    canvas.width = Math.max(1,Math.round(frame.width*scale)); canvas.height = Math.max(1,Math.round(frame.height*scale));
    canvas.getContext('2d').drawImage(frame,0,0,canvas.width,canvas.height);
    return canvas;
  }
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const clock = (time, fine = false) => {
    const value = Math.max(0, Math.round(time * (fine ? 10 : 1)));
    const seconds = fine ? Math.floor(value / 10) : value;
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0') + (fine ? '.' + value % 10 : '');
  };
  const panel = `
    <style>
    .zwClipTimeline {min-width:0;color:#eaf0f7;--clip-blue:#429aff}
    .zwClipTimeline .zwClipScreen {display:block;position:relative;padding:0;border:0;color:inherit;cursor:pointer;background:#0c1015;aspect-ratio:16/9;width:100%;max-height:38vh;overflow:hidden;border-radius:5px}
    .zwClipScreen>canvas,.zwClipScreen>.zwClipScene {display:block;width:100%;height:100%;object-fit:contain}
    .zwClipScreen>.zwClipScene {position:absolute!important;inset:0;background:#0c1015}
    .zwClipScene>canvas {display:block;width:100%;height:100%;object-fit:contain!important}
    .zwClipScreen .zwClipMessage {position:absolute;inset:0;display:grid;place-items:center;padding:12px;text-align:center;background:#10161ce8}
    .zwClipTimeline [hidden] {display:none!important}
    .zwClipTimeline .zwClipReadout,.zwClipTimeline .zwClipTools {display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0}
    .zwClipTimeline output {font-variant-numeric:tabular-nums}
    .zwClipReadout .zwClipLength {margin-left:auto;color:#c1d0df;white-space:nowrap}
    .zwClipLength input {width:8ch;font:inherit;font-variant-numeric:tabular-nums}
    .zwClipReadout .zwClipRangeError {width:100%;color:#ffc9b5}
    .zwClipTimeline .zwClipRailWrap {padding:0 12px;margin:8px 0}
    .zwClipTimeline .zwClipTicks {display:flex;justify-content:space-between;font-size:11px;color:#b7c6d6;font-variant-numeric:tabular-nums;line-height:1.4}
    .zwClipTimeline .zwClipRail {position:relative;height:clamp(38px,6vw,60px);margin-top:5px;touch-action:none;user-select:none;cursor:crosshair;isolation:isolate}
    .zwClipFrames {display:flex;position:absolute;inset:0;overflow:hidden;background:#212a35;border-radius:3px}
    .zwClipFrames>div {flex:1;min-width:0;height:100%;overflow:hidden;border-right:1px solid #172029;display:grid;place-items:center;color:#b5c0c9;font-size:10px}
    .zwClipFrames canvas {display:block;width:100%;height:100%;object-fit:cover}
    .zwClipRail .zwClipMask {position:absolute;inset-block:0;background:#080c13a0;pointer-events:none}
    .zwClipRail .zwClipRange {position:absolute;inset-block:0;border-block:3px solid var(--clip-blue);box-sizing:border-box;cursor:grab}
    .zwClipTimeline .zwClipRail [data-edge] {box-sizing:border-box;position:absolute;z-index:1;top:50%;transform:translate(-50%,-50%);height:calc(100% + 4px);width:17px;min-width:0;padding:0;border:1px solid #80baff;border-radius:4px;background:#297ce5;cursor:ew-resize;touch-action:none;color:white;box-shadow:0 1px 3px #0008}
    .zwClipTimeline .zwClipRail [data-edge]::after {content:'';display:block;width:3px;height:17px;margin:auto;background:#fff;border-radius:2px}
    .zwClipTimeline .zwClipRail [data-edge]:focus-visible {outline:2px solid white;outline-offset:2px;z-index:2}
    .zwClipTimeline .zwClipTools {font-size:12px}
    .zwClipTimeline .zwClipTools button {font:inherit;padding:3px 8px}
    </style>
    <button type="button" class="zwClipScreen" aria-label="区間を再生" aria-pressed="false"><canvas aria-label="選択した場面"></canvas><span class="zwClipScene" hidden></span><span class="zwClipMessage" hidden></span></button>
    <div class="zwClipReadout"><button type="button" data-clip="play" aria-pressed="false">区間を再生</button><output class="zwClipTime" aria-label="プレビュー時刻"></output><label class="zwClipLength">選択 <input type="number" name="length" min="0" step="any" aria-label="選択した区間の長さ（秒）"> 秒</label><span class="zwClipRangeError" aria-live="polite" hidden></span></div>
    <div class="zwClipRailWrap"><div class="zwClipTicks" aria-hidden="true"></div>
      <div class="zwClipRail"><div class="zwClipFrames" aria-hidden="true"></div><div class="zwClipMask"></div><div class="zwClipMask"></div><div class="zwClipRange"></div>
        <button type="button" data-edge="start" role="slider" aria-label="開始位置"></button>
        <button type="button" data-edge="end" role="slider" aria-label="終了位置"></button>
      </div></div>
    <div class="zwClipThumbHint" hidden><small aria-live="polite" aria-atomic="true" tabindex="-1"></small> <button type="button" data-clip="thumbnails">動画からサムネイルを読み込む</button></div>
    <div class="zwClipTools" aria-label="タイムラインの表示範囲"><button type="button" data-clip="prev" aria-label="前の範囲">←</button><button type="button" data-clip="next" aria-label="次の範囲">→</button>
    <button type="button" data-clip="zoomIn">拡大</button><button type="button" data-clip="zoomOut">縮小</button><button type="button" data-clip="all">全体</button></div>`;

  function waitForFrame(video, time, signal, request, timeoutMs = 6000) {
    return new Promise((resolve, reject) => {
      const events = ['loadedmetadata','loadeddata','seeked','canplay'];
      let requested = false;
      const done = error => {
        clearTimeout(timeout);
        for (const event of events) video.removeEventListener(event, check);
        video.removeEventListener('error', failed);
        signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve();
      };
      const check = event => {
        const tolerance = event?.type === 'seeked' ? 0.12 : 0.002;
        // An HLS preview can buffer only the selected section. Seek as soon as
        // metadata is ready, even when there is no decodable frame at time zero.
        if (video.readyState >= 1 && request && !requested) {
          requested = true;
          try {
            if (Math.abs(video.currentTime - time) > tolerance && request() === false) return failed();
          } catch (error) { return done(error); }
        }
        if (video.readyState >= 2 && !video.seeking && (time == null || Math.abs(video.currentTime - time) <= tolerance)) done();
      };
      const failed = () => done(Error('この場面を読み込めませんでした。'));
      const abort = () => done(new DOMException('中断', 'AbortError'));
      const timeout = setTimeout(() => done(new DOMException('選んだ区間の映像を時間内に読み込めませんでした。','TimeoutError')), timeoutMs);
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, {once:true});
      for (const event of events) video.addEventListener(event, check);
      video.addEventListener('error', failed, {once:true});
      check();
    });
  }

  async function prepareHlsPreview(media, url, position, signal, height, onFailure) {
    await ShareHlsPreview.attach(media,url,position,signal,height,onFailure);
    await waitForFrame(media,position,signal,() => { media.currentTime = position; },15000);
  }
  function mount(container, {startInput, endInput, getSource, getThumbnail, getHlsSource, getDetailedFrames, getStoryboardInterval,
    getPreviewRenderer, getPreviewHeight, getSceneHeight, clipSession, isPreviewActive = () => true, onLengthValidityChange,
    isLocalSource = video => video.matches('[data-role=source]'), maxLength = Infinity}) {
    const root = document.createElement('div');
    root.className = 'zwClipTimeline';
    root.innerHTML = panel;
    container.append(root);
    const find = selector => root.querySelector(selector);
    const action = key => find('[data-clip=' + key + ']');
    const rail = find('.zwClipRail'), frames = find('.zwClipFrames'), ticks = find('.zwClipTicks');
    const range = find('.zwClipRange'), masks = root.querySelectorAll('.zwClipMask');
    const handles = [...root.querySelectorAll('[data-edge]')];
    const canvas = find('.zwClipScreen canvas'), scene = find('.zwClipScene'), message = find('.zwClipMessage');
    const screen = find('.zwClipScreen'), timeDisplay = find('.zwClipTime');
    const lengthInput = find('.zwClipLength input'), rangeError = find('.zwClipRangeError');
    const listeners = new AbortController();
    let source, sourceUrl, sourceObject, decoder, thumbVideo, renderer, session, thumbnails, releaseScene;
    let windowStart = 0, span = 0, initialSpan = 0, duration = 0, time = 0, drag, disposed = false, writing = false;
    let thumbKey, rendererError, dragTimer, thumbReport = '';
    let resumeTime = null, editingLength = false;
    const thumbReleases = new Map();
    let capturedFrames = new Map();
    let detailRequest, detailTimer;
    const on = (node, event, fn) => node.addEventListener(event, fn, {signal:listeners.signal});
    const sameSource = () => source && source === getSource() && source.currentSrc === sourceUrl && source.srcObject === sourceObject;
    const locked = () => disposed || startInput.disabled || endInput.disabled || !sameSource();
    const values = () => [startInput.valueAsNumber, endInput.valueAsNumber];
    const showMessage = text => {
      if (message.textContent !== text) message.textContent = text;
      if (message.hidden !== !text) message.hidden = !text;
    };
    const setTime = value => {
      time = value;
      const label = clock(value,true) + ' / ' + clock(duration);
      if (timeDisplay.textContent !== label) timeDisplay.textContent = label;
    };
    const clearScene = () => {
      if (scene.hidden && !releaseScene) return;
      releaseScene?.(); releaseScene = null; scene.hidden = true; scene.replaceChildren();
    };
    const newDecoder = () => {
      const video = document.createElement('video');
      video.playsInline = true;
      video.preload = 'auto';
      video.muted = true;
      video.src = source.currentSrc || source.src;
      return video;
    };
    const unload = video => { if (video) { video.pause(); video.removeAttribute('src'); video.load(); } };
    const draw = media => {
      if (media.seeking || media.readyState < 2 || !media.videoWidth) return false;
      // The recorder has its own full-resolution canvas. Only scale the interactive preview.
      const targetHeight = Number(getPreviewHeight?.(source));
      const scale = targetHeight > 0 ? Math.min(1, targetHeight / media.videoHeight)
        : Math.min(1, 480 / Math.max(media.videoWidth, media.videoHeight), 270 / Math.min(media.videoWidth, media.videoHeight));
      const width = Math.max(1, Math.round(media.videoWidth * scale)), height = Math.max(1, Math.round(media.videoHeight * scale));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('映像プレビューを利用できません。');
      if (rendererError) throw rendererError;
      if (renderer) {
        const drawn = renderer.drawFrame ? renderer.drawFrame(ctx, width, height, media, media.currentTime) : renderer.draw(ctx, width, height);
        if (drawn !== true) throw Error('選択したレイヤーを描画できません。');
      } else { ctx.drawImage(media, 0, 0, width, height); }
      clearScene(); showMessage('');
      setTime(media.currentTime);
      return true;
    };
    const previewUrl = () => {
      const url = source && !source.mediaKeys && getHlsSource?.(source);
      return url && ShareHlsPreview.accepts(url) ? url : null;
    };
    function fileForPreview() {
      if (!source || source.mediaKeys) return null;
      if (source.srcObject) return source.srcObject instanceof Blob ? source.srcObject : null;
      if (!source.currentSrc) return null;
      const url = new URL(source.currentSrc,location.href);
      if (url.protocol === 'blob:' && url.origin === location.origin) return url;
      if (url.protocol === 'https:' && /\.(mp4|m4v|webm|mov)$/i.test(url.pathname) &&
          (url.origin === location.origin || source.crossOrigin)) return url;
      return null;
    }
    async function attachFile(media, file, signal) {
      if (!file) throw Error('この動画では場面画像と時刻で区間を選べます。');
      if (file instanceof Blob) {
        const objectUrl = URL.createObjectURL(file);
        signal.addEventListener('abort',() => URL.revokeObjectURL(objectUrl),{once:true});
        media.src = objectUrl;
        return;
      }
      if (file.protocol === 'blob:') {
        // A MediaSource URL belongs to its original element. Only actual file
        // blobs respond to a byte-range fetch and can safely be opened twice.
        const response = await fetch(file.href,{headers:{Range:'bytes=0-0'},signal});
        await response.body?.cancel();
        if (!response.ok) throw Error('元ファイルの確認再生を利用できません。');
      }
      signal.throwIfAborted();
      if (source.crossOrigin !== null) media.crossOrigin = source.crossOrigin;
      media.src = file.href;
    }
    function showPlaying(playing) {
      const label = playing ? '一時停止' : '区間を再生';
      action('play').textContent = label;
      screen.setAttribute('aria-label', label);
      for (const button of [screen, action('play')]) button.setAttribute('aria-pressed', String(playing));
    }
    function stopPreview() {
      resumeTime = null;
      clearTimeout(dragTimer); dragTimer = null;
      clearScene();
      const active = session;
      session = null;
      if (active) {
        active.controller.abort();
        cancelAnimationFrame(active.frameRequest);
        if (active.media === decoder) decoder.pause();
        else unload(active.media);
      }
      if (active?.collecting) {
        const focused = document.activeElement === thumbButton;
        updateThumbHint();
        if (focused && thumbButton.hidden) thumbStatus.focus({preventScroll:true});
      }
      showPlaying(false);
      return null;
    }
    function beginSession() {
      stopPreview();
      const media = decoder || document.createElement('video');
      media.playsInline = true;
      media.muted = true;
      const active = session = {media, controller:new AbortController()};
      media.addEventListener('error', () => previewFailed(active, {message:'この場面の映像・音声を再生できませんでした。',
        missing:'decoder', ...(media.error?.code === 2 ? {kind:'network'} : {reason:'not supported'})}), {signal:active.controller.signal});
      return active;
    }
    const previewDiagnostic = () => typeof RequestDiagnostics === 'undefined' ? null :
      RequestDiagnostics.begin('clip-preview', (clipSession ?? 0) + (decoder ? ':file' : ':stream'), 'response');
    function previewFailed(active, failure) {
      if (session !== active) return;
      previewDiagnostic()?.failure(failure);
      stopPreview();
      showMessage(failure.message + (failure.status ? '（HTTP ' + failure.status + '）' : '') + ' タイムラインで区間を選べます。');
    }
    async function prepare(active, position) {
      const {media,controller} = active;
      if (media !== decoder) {
        const url = previewUrl();
        if (url) return prepareHlsPreview(media,url,position,controller.signal,
          active.collecting ? getSceneHeight?.(source) : getPreviewHeight?.(source), failure => previewFailed(active, failure));
        else await attachFile(media,fileForPreview(),controller.signal);
      }
      await waitForFrame(media,position,controller.signal,() => { media.currentTime = position; },15000);
    }
    async function preview(seconds, play = false) {
      if (locked()) { stopPreview(); return; }
      const position = clamp(seconds, 0, duration);
      const active = beginSession(), media = active.media;
      try {
        if (play) {
          active.playing = true;
          setTime(position);
          showPlaying(true);
          media.playbackRate = 1;
        }
        await prepare(active, position);
        if (session !== active) return;
        if (!draw(media)) throw Error('選択した場面を読み込めませんでした。');
        previewDiagnostic()?.success();
        if (!play) { stopPreview(); return; }
        if (!canPreviewNow()) { stopPreview(); return; }
        media.volume = source.volume;
        media.muted = source.muted;
        let drawnTime = media.currentTime;
        let lastPaint = performance.now();
        await media.play();
        if (session !== active) return;
        const step = now => {
          if (session !== active) return;
          const secondsLeft = endInput.valueAsNumber - media.currentTime;
          if (!canPreviewNow() || secondsLeft <= 0 || media.ended || media.paused) { stopPreview(); return; }
          try {
            const elapsed = now - lastPaint;
            if (elapsed >= previewInterval) {
              if (media.currentTime !== drawnTime && draw(media)) drawnTime = media.currentTime;
              lastPaint = now - elapsed % previewInterval;
            }
            active.frameRequest = requestAnimationFrame(step);
          } catch (error) { stopPreview(); showMessage(error.message); }
        };
        active.frameRequest = requestAnimationFrame(step);
      } catch (error) {
        if (session === active) {
          if (error.name === 'TimeoutError') {
            previewFailed(active, {kind:'timeout', missing:'firstFrame', message:error.message});
            return;
          }
          stopPreview();
          showMessage(error.name === 'NotAllowedError' ? '「区間を再生」を押すと、この場面から再生します。' :
            error.message || '選択した場面を表示できません。');
        }
      }
    }
    const thumbHint = find('.zwClipThumbHint');
    const thumbButton = action('thumbnails'), thumbStatus = thumbHint.querySelector('small');
    const hasFrame = cell => !!cell.querySelector('canvas') || !!cell.querySelector('img')?.naturalWidth;
    function updateThumbHint() {
      const cells = [...frames.children];
      const missing = cells.filter(cell => !hasFrame(cell) && cell.getAttribute('aria-busy') !== 'true' && cell.textContent !== '読み込み中');
      const collecting = !!session?.collecting || !!detailRequest;
      const canRead = !decoder && !locked() && !!(previewUrl() || fileForPreview());
      thumbHint.hidden = !cells.length || (!collecting && !missing.length && !thumbReport);
      thumbButton.hidden = !collecting && (!missing.length || !canRead);
      thumbButton.textContent = collecting ? '取得を中止' : '動画からサムネイルを読み込む';
      thumbStatus.textContent = collecting ? '場面を取得中（' + cells.filter(hasFrame).length + ' / ' + cells.length + '枚）' :
        thumbReport || (canRead ? '場面一覧にない画像を低画質で取得できます。' :
          '場面画像がない位置も、開始・終了時刻で指定できます。');
    }
    function tileFrom(media) {
      const tile = document.createElement('canvas');
      const maxHeight = Number(getSceneHeight?.(source)) || 90;
      const scale = Math.min(1, maxHeight * 16/9 / media.videoWidth, maxHeight / media.videoHeight);
      tile.width = Math.max(1, Math.round(media.videoWidth*scale));
      tile.height = Math.max(1, Math.round(media.videoHeight*scale));
      tile.getContext('2d').drawImage(media, 0, 0, tile.width, tile.height);
      return tile;
    }
    function rememberFrame(cell, sec, tile) {
      const release = thumbReleases.get(cell);
      if (release) { release(); thumbReleases.delete(cell); }
      cell.replaceChildren(displayFrame(tile,90));
      capturedFrames.set(sec,tile);
      // Full-size crops may be several MiB. Keep the strip itself inexpensive
      // and bound decoded pixels as well as the number of reusable frames.
      let bytes = 0;
      for (const frame of capturedFrames.values()) bytes += frame.width * frame.height * 4;
      for (const [time,frame] of capturedFrames) {
        if (capturedFrames.size <= 48 && bytes <= 32*1024*1024) break;
        bytes -= frame.width * frame.height * 4;
        capturedFrames.delete(time);
      }
    }
    function cancelDetails() {
      clearTimeout(detailTimer); detailTimer = null;
      detailRequest?.abort(); detailRequest = null;
    }
    async function readDetails(cells) {
      if (!getDetailedFrames || !cells.length || locked() || !previewUrl()) return false;
      const controller = detailRequest = new AbortController();
      updateThumbHint();
      try {
        const times = cells.map(cell => Number(cell.dataset.seconds));
        const tiles = await getDetailedFrames(source,times,controller.signal);
        if (controller.signal.aborted || locked() || tiles?.length !== cells.length) return false;
        for (const [index,tile] of tiles.entries()) {
          if (tile?.width && tile.height) rememberFrame(cells[index],times[index],tile);
        }
        return cells.every(hasFrame);
      } catch (_) { return false; }
      finally { if (detailRequest === controller) { detailRequest = null; updateThumbHint(); } }
    }
    async function collectFrames() {
      if (detailRequest || session?.collecting) {
        thumbReport = '取得を中止しました。'; cancelDetails(); stopPreview(); updateThumbHint(); return;
      }
      if (locked() || decoder || !(previewUrl() || fileForPreview())) return;
      clearTimeout(detailTimer);
      thumbReport = '';
      const visible = thumbnails;
      const missing = [...frames.children].filter(cell => !hasFrame(cell));
      if (getDetailedFrames && await readDetails(missing)) return;
      if (visible !== thumbnails || locked() || thumbReport === '取得を中止しました。') return;
      const active = beginSession(), media = active.media;
      active.collecting = true;
      thumbReport = '';
      updateThumbHint();
      let failures = 0;
      try {
        const firstMissing = [...frames.children].find(cell => !hasFrame(cell));
        if (!firstMissing) return;
        await prepare(active, Number(firstMissing.dataset.seconds));
        for (const cell of frames.children) {
          if (session !== active || !sameSource()) return;
          if (hasFrame(cell)) continue;
          const sec = Number(cell.dataset.seconds);
          try {
            await waitForFrame(media, sec, active.controller.signal, () => { media.currentTime = sec; }, 15000);
            if (session !== active || !sameSource()) return;
            rememberFrame(cell,sec,tileFrom(media));
            failures = 0;
            updateThumbHint();
          } catch (error) {
            if (error.name === 'AbortError' || ++failures >= 2) break;
          }
        }
        if (session === active) {
          const ready = [...frames.children].filter(hasFrame).length;
          thumbReport = ready === frames.children.length ? ready + '枚の場面を読み込みました。' :
            '一部の場面を読み込めませんでした。取得済みの画像はそのまま使えます。';
        }
      } catch (_) {
        if (session === active) thumbReport = '場面画像を取得できませんでした。開始・終了時刻で区間を選べます。';
      } finally { if (session === active) stopPreview(); }
    }
    on(thumbButton,'click',collectFrames);
    const thumbObserver = new MutationObserver(updateThumbHint);
    thumbObserver.observe(frames,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-busy']});
    function clearThumbs() {
      cancelDetails();
      thumbnails?.abort(); thumbnails = null;
      for (const release of thumbReleases.values()) release();
      thumbReleases.clear();
    }
    function paintStrip() {
      const key = [windowStart, span, duration].join('/');
      if (key === thumbKey) return;
      if (session?.collecting) stopPreview();
      thumbKey = key;
      thumbReport = '';
      clearThumbs();
      const controller = thumbnails = new AbortController();
      ticks.replaceChildren();
      for (let i = 0; i <= 4; i++) {
        const tick = document.createElement('span');
        tick.textContent = clock(windowStart + span * i / 4, span < 8);
        ticks.append(tick);
      }
      const cells = Array.from({length:8}, (_, i) => {
        const cell = document.createElement('div');
        const sec = windowStart + span * (i + 0.5) / 8;
        cell.dataset.seconds = String(sec);
        cell.title = clock(sec, true);
        cell.textContent = decoder ? '読み込み中' : '–';
        return {cell, sec};
      });
      frames.replaceChildren(...cells.map(item => item.cell));
      if (!decoder) {
        for (const {cell, sec} of cells) {
          const tile = capturedFrames.get(sec);
          if (tile) { cell.replaceChildren(displayFrame(tile,90)); continue; }
          try { const release = getThumbnail?.(cell, sec); if (typeof release === 'function') thumbReleases.set(cell, release); }
          catch (_) { cell.textContent = '画像なし'; }
        }
        const uncached = cells.filter(({sec}) => !capturedFrames.has(sec));
        const interval = Number(getStoryboardInterval?.()) || 2;
        if (getDetailedFrames && uncached.length && span < initialSpan && span/cells.length < interval) {
          detailTimer = setTimeout(() => {
            if (!controller.signal.aborted) void readDetails(uncached.map(item => item.cell));
          },250);
        }
        return;
      }
      const media = thumbVideo;
      (async () => {
        try {
          await waitForFrame(media, null, controller.signal);
          for (const {cell, sec} of cells) {
            await waitForFrame(media, sec, controller.signal, () => { media.currentTime = sec; });
            if (controller.signal.aborted) return;
            cell.replaceChildren(tileFrom(media));
          }
        } catch (_) {
          if (!controller.signal.aborted) for (const {cell} of cells) if (!cell.firstElementChild) cell.textContent = '–';
        }
      })();
    }
    // Timeline positions can include a fractional final millisecond. Drop
    // subtraction noise from their difference without rounding short clips to zero.
    function secondsBetween(from,to) {
      const seconds = to-from;
      return Number(seconds.toFixed(9)) || seconds;
    }
    function render() {
      const [a,b] = values();
      const disabled = locked();
      const valid = Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b <= duration && b > a && b - a <= maxLength + 0.0001;
      lengthInput.disabled = disabled || !Number.isFinite(a) || a < 0 || a >= duration;
      const limit = Math.min(maxLength, secondsBetween(a,duration));
      lengthInput.max = Number.isFinite(limit) ? String(limit) : '';
      if (!editingLength) lengthInput.value = valid ? String(secondsBetween(a,b)) : '';
      const invalidLength = editingLength && !(lengthInput.valueAsNumber > 0 && lengthInput.valueAsNumber <= limit);
      if (lengthInput.getAttribute('aria-invalid') !== String(invalidLength)) {
        lengthInput.setAttribute('aria-invalid', String(invalidLength));
        onLengthValidityChange?.(!invalidLength);
      }
      rangeError.textContent = invalidLength ? '選択の長さは0秒より長く、' + limit + '秒以内で指定してください。' :
        valid ? '' : '開始・終了を確認してください。';
      rangeError.hidden = !rangeError.textContent;
      const left = clamp((a-windowStart)/span,0,1)*100, right = clamp((b-windowStart)/span,0,1)*100;
      range.hidden = !Number.isFinite(left + right) || right <= left;
      range.style.left = left + '%'; range.style.width = (right-left) + '%';
      masks[0].style.left = 0; masks[0].style.width = left + '%';
      masks[1].style.right = 0; masks[1].style.width = (100-right) + '%';
      handles.forEach((handle,i) => {
        const value = i ? b : a;
        handle.style.left = (i ? right : left) + '%';
        handle.hidden = !Number.isFinite(value) || value < windowStart - 0.001 || value > windowStart + span + 0.001;
        handle.disabled = disabled;
        handle.setAttribute('aria-valuemin', String(i ? a : Math.max(0,b-maxLength)));
        handle.setAttribute('aria-valuemax', String(i ? Math.min(duration,a+maxLength) : b));
        handle.setAttribute('aria-valuenow', String(value));
        handle.setAttribute('aria-valuetext', clock(value,true));
      });
      const canPlay = !!(decoder || previewUrl() || fileForPreview());
      screen.disabled = action('play').disabled = disabled || !valid || invalidLength || !canPlay;
      action('play').title = canPlay ? '選んだ区間をプレビューで再生' : 'この配信では場面画像と時刻で区間を選べます';
      action('prev').disabled = disabled || windowStart <= 0;
      action('next').disabled = disabled || windowStart + span >= duration - 0.001;
      action('zoomIn').disabled = disabled || span <= Math.min(1,duration);
      action('zoomOut').disabled = action('all').disabled = disabled || span >= duration;
      if (!disabled) paintStrip();
      updateThumbHint();
    }
    function viewport(start, width) {
      span = clamp(width, Math.min(1,duration), duration);
      windowStart = clamp(start, 0, duration-span);
      render();
    }
    function refresh(rebuildRenderer = false) {
      if (disposed) return;
      const selected = getSource();
      const available = selected && Number.isFinite(selected.duration) && selected.duration > 0;
      const changed = (available && duration === 0) || source !== selected || sourceUrl !== selected?.currentSrc || sourceObject !== selected?.srcObject;
      root.hidden = !available;
      if (changed || !available) {
        stopPreview(); clearThumbs(); clearScene();
        unload(decoder); unload(thumbVideo); decoder = thumbVideo = null;
        renderer?.dispose(); renderer = null;
        capturedFrames = new Map(); thumbReport = ''; thumbKey = null; drag = null; editingLength = false;
        source = selected; sourceUrl = selected?.currentSrc; sourceObject = selected?.srcObject;
        if (!available) { duration = 0; return; }
        if (isLocalSource(source)) { decoder = newDecoder(); thumbVideo = newDecoder(); }
        else capturedFrames = framesFor(source,clipSession);
        duration = source.duration;
        const [a,b] = values();
        initialSpan = span = Math.min(duration, Math.max(Math.min(120, maxLength), (b-a) || 0));
        windowStart = clamp((a||0) - span/4, 0, duration-span);
        setTime(clamp(Number.isFinite(a) ? a : 0,0,duration));
        rebuildRenderer = true;
      }
      if (!available) return;
      duration = selected.duration;
      if (locked()) { stopPreview(); if (thumbnails) { clearThumbs(); thumbKey = null; } }
      if (rebuildRenderer) {
        stopPreview();
        renderer?.dispose(); renderer = null;
        try {
          rendererError = null;
          try { renderer = getPreviewRenderer?.(decoder || source) || null; }
          catch (error) { rendererError = error; throw error; }
          if (!locked()) {
            if (decoder) preview(time);
            else if (!changed || !draw(source)) showSelection(time);
          }
        } catch (error) { showMessage(error.message); }
      }
      render();
    }
    // Numeric range controls use milliseconds. Round inside each legal interval:
    // a media duration such as 120.1237 must never become an end time of 120.124.
    const lastMillisecond = limit => {
      const ms = Math.round(limit * 1000);
      return ms/1000 > limit ? ms-1 : ms;
    };
    const snap = (value, min, max) => {
      const last = lastMillisecond(max);
      const roundedMin = Math.round(min * 1000);
      const first = roundedMin/1000 < min ? roundedMin+1 : roundedMin;
      if (first > last) return clamp(value,min,max);
      return clamp(Math.round(value * 1000),first,last)/1000;
    };
    function write(a,b) {
      editingLength = false;
      writing = true;
      try {
        const changed = [[startInput,a],[endInput,b]].filter(([input,value]) => input.valueAsNumber !== value);
        for (const [input,value] of changed) input.value = value;
        for (const [input] of changed) input.dispatchEvent(new Event('input',{bubbles:true}));
      } finally { writing = false; }
      render();
    }
    const gap = () => Math.min(0.01, duration);
    function moveEdge(edge, value) {
      const [a,b] = values();
      if (edge === 'start') {
        const start = snap(value, Math.max(0,b-maxLength), Math.max(0,b-gap()));
        write(start,b); return start;
      }
      const end = snap(value, Math.min(duration,a+gap()), Math.min(duration,a+maxLength));
      write(a,end); return end;
    }
    function moveBlock(value, length) {
      const last = lastMillisecond(duration);
      if (!last) { write(0,duration); return 0; }
      const width = clamp(Math.round(length*1000),1,Math.min(last,lastMillisecond(maxLength)));
      const start = clamp(Math.round(value*1000),0,last-width);
      write(start/1000,(start+width)/1000);
      return start/1000;
    }
    function at(event) {
      const box = rail.getBoundingClientRect();
      return windowStart + clamp((event.clientX-box.left)/box.width,0,1)*span;
    }
    // The live player is shared with normal viewing. Editing uses storyboard
    // images. Playback and thumbnail collection use a separate decoder.
    function showSelection(seconds, moving = false) {
      if (locked()) return;
      setTime(seconds);
      if (decoder) { preview(seconds); return; }
      clearScene();
      scene.hidden = false;
      showMessage('');
      const nearest = [...frames.children].filter(cell => cell.querySelector('canvas')).sort((a,b) =>
        Math.abs(Number(a.dataset.seconds)-seconds) - Math.abs(Number(b.dataset.seconds)-seconds))[0];
      if (nearest && Math.abs(Number(nearest.dataset.seconds)-seconds) <= span/8 &&
        (moving || capturedFrames.has(Number(nearest.dataset.seconds)))) {
        scene.append(displayFrame(capturedFrames.get(Number(nearest.dataset.seconds)) || nearest.querySelector('canvas')));
        return;
      }
      scene.textContent = previewUrl() || fileForPreview() ? '「区間を再生」で映像を確認できます。' : '開始・終了時刻で区間を選べます。';
      if (!moving) {
        try {
          const release = getThumbnail?.(scene,seconds);
          if (typeof release === 'function') releaseScene = release;
        } catch (_) { /* The range remains editable even without a storyboard. */ }
      }
    }
    function updateDrag(event) {
      if (!drag || event.pointerId !== drag.id) return;
      const t = at(event);
      const selected = drag.edge ? moveEdge(drag.edge, t) : moveBlock(drag.a + t - drag.origin, drag.length);
      setTime(selected);
      drag.time = selected;
      if (!dragTimer) dragTimer = setTimeout(() => {
        dragTimer = null;
        if (!drag || locked()) return;
        showSelection(drag.time,true);
      },100);
    }
    on(rail,'pointerdown',event => {
      if (locked() || event.button !== 0) return;
      event.preventDefault();
      stopPreview();
      const [a,b] = values(), origin = at(event);
      if (!Number.isFinite(a+b)) return;
      const handle = event.target.closest('[data-edge]');
      const length = clamp(b-a, gap(), Math.min(duration,maxLength));
      const inside = origin >= a && origin <= b;
      drag = {id:event.pointerId, edge:handle?.dataset.edge, a:inside ? a : origin-length/2, origin, length};
      if (handle) handle.focus({preventScroll:true});
      rail.setPointerCapture(event.pointerId);
      updateDrag(event);
    });
    on(rail,'pointermove',updateDrag);
    const endDrag = event => {
      if (!drag || event.pointerId !== drag.id) return;
      if (event.type === 'pointerup') updateDrag(event);
      const selected = drag.time;
      drag = null;
      if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
      clearTimeout(dragTimer); dragTimer = null;
      if (event.type === 'pointerup' && Number.isFinite(selected)) previewSelection(selected); else stopPreview();
    };
    on(rail,'pointerup', endDrag); on(rail,'pointercancel',endDrag);
    for (const handle of handles) on(handle,'keydown',event => {
      if (locked()) return;
      const edge = handle.dataset.edge;
      const v = edge === 'start' ? startInput.valueAsNumber : endInput.valueAsNumber;
      const step = event.shiftKey ? 1 : 0.1;
      const keys = {ArrowLeft:v-step, ArrowDown:v-step, ArrowRight:v+step, ArrowUp:v+step,
        PageDown:v-5,PageUp:v+5,Home:0,End:duration};
      if (!Object.hasOwn(keys,event.key)) return;
      event.preventDefault(); event.stopPropagation();
      stopPreview();
      const next = moveEdge(edge,keys[event.key]);
      if (next < windowStart || next > windowStart+span) viewport(next-span/2,span);
      previewSelection(next);
    });
    for (const input of [startInput,endInput]) {
      on(input,'input',() => {
        if (writing || !sameSource()) return;
        editingLength = false;
        stopPreview();
        const value = input.valueAsNumber;
        if (!Number.isFinite(value)) { render(); return; }
        if (value < windowStart || value > windowStart+span) viewport(value-span/2,span); else render();
        setTime(value);
      });
      on(input,'change',() => {
        if (writing || !sameSource()) return;
        editingLength = false;
        render();
        previewSelection(input.valueAsNumber);
      });
    }
    on(lengthInput,'input',() => {
      editingLength = true;
      stopPreview();
      render();
    });
    function commitLength() {
      if (locked() || lengthInput.disabled) return;
      if (!editingLength && lengthInput.valueAsNumber === secondsBetween(...values())) return;
      editingLength = true;
      render();
      if (lengthInput.getAttribute('aria-invalid') === 'true') return;
      const start = startInput.valueAsNumber;
      const end = Math.min(duration, Number((start + lengthInput.valueAsNumber).toPrecision(15)));
      write(start,end);
      if (end < windowStart || end > windowStart+span) viewport(end-span/2,span);
      previewSelection(start);
    }
    on(lengthInput,'change',commitLength);
    on(lengthInput,'keydown',event => {
      if (event.key === 'Enter') {
        event.preventDefault(); event.stopPropagation();
        commitLength();
      } else if (event.key === 'Escape' && editingLength) {
        event.preventDefault(); event.stopPropagation();
        editingLength = false; render();
      }
    });
    function canPreviewNow() {
      return !locked() && !document.hidden && !root.closest('[hidden]') && isPreviewActive();
    }
    function previewSelection(editedTime) {
      stopPreview();
      if (!canPreviewNow()) return;
      if (!action('play').disabled) preview(startInput.valueAsNumber,true);
      else if (Number.isFinite(editedTime)) showSelection(editedTime);
    }
    function togglePreview() {
      if (!canPreviewNow() || action('play').disabled) return;
      if (session?.playing) {
        const position = session.media.paused ? time : session.media.currentTime;
        stopPreview();
        resumeTime = position;
      } else {
        const [start,end] = values();
        preview(resumeTime != null && resumeTime >= start && resumeTime < end ? resumeTime : start,true);
      }
    }
    on(action('play'),'click',togglePreview);
    on(screen,'click',togglePreview);
    on(action('prev'),'click',() => viewport(windowStart-span/2,span));
    on(action('next'),'click',() => viewport(windowStart+span/2,span));
    const zoom = factor => {
      const next = clamp(span*factor, Math.min(1,duration), duration);
      const center = clamp(time,windowStart,windowStart+span);
      viewport(center - next * (center-windowStart)/span, next);
    };
    on(action('zoomIn'),'click',() => zoom(0.5)); on(action('zoomOut'),'click',() => zoom(2));
    on(action('all'),'click',() => viewport(0,duration));
    on(document,'visibilitychange',() => { if (document.hidden) stopPreview(); });
    refresh();
    function qualityChanged(kind) {
      if (disposed || !source) return;
      if (kind === 'preview') {
        if (!session?.collecting) stopPreview();
        showSelection(time);
      } else if (kind === 'scene') {
        if (session?.collecting) stopPreview();
        clearThumbs();
        capturedFrames.clear(); thumbKey = null;
        if (!locked()) render();
      }
    }
    function startPreview() {
      if (session || !canPreviewNow() || action('play').disabled || source.readyState < 2) return false;
      void preview(startInput.valueAsNumber,true);
      return true;
    }
    return {refresh, stopPreview, startPreview, qualityChanged, dispose() {
      if (disposed) return;
      disposed = true;
      stopPreview(); clearThumbs(); clearScene(); thumbObserver.disconnect(); listeners.abort();
      renderer?.dispose(); capturedFrames = new Map(); unload(decoder); unload(thumbVideo); root.remove();
    }};
  }
  return {mount, prepareHlsPreview};
})();
//===END===
export {ShareClipTimeline};
