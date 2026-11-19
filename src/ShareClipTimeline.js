//===BEGIN===
const ShareClipTimeline = (() => {
  const previewInterval = 1000 / 15;
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
  function displayFrame(frame) {
    const canvas = document.createElement('canvas');
    canvas.width = frame.width; canvas.height = frame.height;
    canvas.getContext('2d').drawImage(frame,0,0);
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
    .zwClipTimeline .zwClipScreen {position:relative;background:#0c1015;aspect-ratio:16/9;width:100%;max-height:38vh;overflow:hidden;border-radius:5px}
    .zwClipScreen>canvas,.zwClipScreen>.zwClipScene {display:block;width:100%;height:100%;object-fit:contain}
    .zwClipScreen>.zwClipScene {position:absolute!important;inset:0;background:#0c1015}
    .zwClipScreen .zwClipMessage {position:absolute;inset:0;display:grid;place-items:center;padding:12px;text-align:center;background:#10161ce8}
    .zwClipTimeline [hidden] {display:none!important}
    .zwClipTimeline .zwClipReadout,.zwClipTimeline .zwClipTools {display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0}
    .zwClipTimeline output {font-variant-numeric:tabular-nums}
    .zwClipReadout .zwClipLength {margin-left:auto;color:#c1d0df}
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
    <div class="zwClipScreen"><canvas aria-label="選択した場面"></canvas><div class="zwClipScene" hidden></div><span class="zwClipMessage" hidden></span></div>
    <div class="zwClipReadout"><button type="button" data-clip="play" aria-pressed="false">区間を再生</button><output class="zwClipTime" aria-label="プレビュー時刻"></output><output class="zwClipLength" aria-label="選択した区間の長さ"></output></div>
    <div class="zwClipRailWrap"><div class="zwClipTicks" aria-hidden="true"></div>
      <div class="zwClipRail"><div class="zwClipFrames" aria-hidden="true"></div><div class="zwClipMask"></div><div class="zwClipMask"></div><div class="zwClipRange"></div>
        <button type="button" data-edge="start" role="slider" aria-label="開始位置"></button>
        <button type="button" data-edge="end" role="slider" aria-label="終了位置"></button>
      </div></div>
    <div class="zwClipThumbHint" hidden><small aria-live="polite" aria-atomic="true" tabindex="-1"></small> <button type="button" data-clip="thumbnails">動画からサムネイルを読み込む</button></div>
    <div class="zwClipTools" aria-label="タイムラインの表示範囲"><button type="button" data-clip="prev" aria-label="前の範囲">←</button><button type="button" data-clip="next" aria-label="次の範囲">→</button>
    <button type="button" data-clip="zoomIn">拡大</button><button type="button" data-clip="zoomOut">縮小</button><button type="button" data-clip="all">全体</button></div>`;

  // A seek requested through the HLS adapter may begin after a debounce.
  function waitForFrame(video, time, signal, request, timeoutMs = 6000) {
    return new Promise((resolve, reject) => {
      const done = error => {
        clearTimeout(timeout);
        for (const event of ['loadeddata', 'seeked']) video.removeEventListener(event, check);
        video.removeEventListener('error', failed);
        signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve();
      };
      const check = event => {
        const tolerance = event?.type === 'seeked' ? 0.12 : 0.002;
        if (video.readyState >= 2 && !video.seeking && (time == null || Math.abs(video.currentTime - time) <= tolerance)) done();
      };
      const failed = () => done(Error('この場面を読み込めませんでした。'));
      const abort = () => done(new DOMException('中断', 'AbortError'));
      const timeout = setTimeout(failed, timeoutMs);
      if (signal.aborted) return abort();
      signal.addEventListener('abort', abort, {once:true});
      for (const event of ['loadeddata', 'seeked']) video.addEventListener(event, check);
      video.addEventListener('error', failed, {once:true});
      try {
        if (request && request() === false) return failed();
        check();
      } catch (error) { done(error); }
    });
  }

  function mount(container, {startInput, endInput, getSource, getThumbnail, seekSource, getPreviewRenderer, clipSession,
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
    const timeDisplay = find('.zwClipTime'), lengthDisplay = find('.zwClipLength');
    const listeners = new AbortController();
    let source, sourceUrl, sourceObject, decoder, thumbVideo, renderer, session, thumbnails, releaseScene;
    let windowStart = 0, span = 0, duration = 0, time = 0, drag, disposed = false, writing = false;
    let thumbKey, rendererError, dragTimer, restoring, thumbReport = '';
    const thumbReleases = new Map();
    let capturedFrames = new Map();
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
      const scale = Math.min(1, 480 / Math.max(media.videoWidth, media.videoHeight),
        270 / Math.min(media.videoWidth, media.videoHeight));
      const width = Math.max(1, Math.round(media.videoWidth * scale)), height = Math.max(1, Math.round(media.videoHeight * scale));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('映像プレビューを利用できません。');
      if (rendererError) throw rendererError;
      if (renderer) {
        if (renderer.draw(ctx, width, height) !== true) throw Error('選択したレイヤーを描画できません。');
      } else { ctx.drawImage(media, 0, 0, width, height); }
      clearScene(); showMessage('');
      setTime(media.currentTime);
      return true;
    };
    const seek = (media, seconds) => {
      if (media === source && seekSource) return seekSource(seconds);
      media.currentTime = seconds;
      return true;
    };
    function forgetRestore() {
      if (!restoring) return;
      restoring.controller.abort();
      clearTimeout(restoring.timer);
      restoring = null;
    }
    function stopPreview({forRecording = false} = {}) {
      clearTimeout(dragTimer); dragTimer = null;
      clearScene();
      const active = session;
      let snapshot;
      session = null;
      if (active) {
        active.controller.abort();
        clearTimeout(active.frameTimer);
        const media = active.media;
        if (media === decoder) media.pause();
        if (active.restore && sameSource()) {
          snapshot = active.restore;
          media.pause();
          if (!forRecording) {
            const {time:position,paused,loop,rate} = snapshot;
            media.loop = loop; media.playbackRate = rate;
            forgetRestore();
            // The HLS adapter can defer the seek while the raw element still shows the preview time.
            const controller = new AbortController();
            restoring = {snapshot,controller,timer:setTimeout(forgetRestore,6500)};
            const settled = () => { if (!media.seeking && Math.abs(media.currentTime-position) < 0.12) forgetRestore(); };
            media.addEventListener('seeked', settled, {signal:controller.signal});
            if (seek(media,position) !== false && !paused) media.play().catch(() => {});
            settled();
          }
        }
      }
      if (active?.collecting) {
        const focused = document.activeElement === thumbButton;
        updateThumbHint();
        if (focused && thumbButton.hidden) thumbStatus.focus({preventScroll:true});
      }
      action('play').setAttribute('aria-pressed', 'false');
      action('play').textContent = '区間を再生';
      if (forRecording && sameSource()) {
        snapshot ||= restoring?.snapshot;
        forgetRestore();
        if (snapshot) snapshot.video.pause();
        return snapshot || null;
      }
      return null;
    }
    function beginSession(media) {
      const prior = stopPreview({forRecording:true});
      const active = session = {media, controller:new AbortController()};
      if (media === source) {
        active.restore = prior || {video:media, time:media.currentTime, paused:media.paused, loop:media.loop, rate:media.playbackRate};
        media.pause();
        media.loop = false;
        const signal = active.controller.signal;
        media.addEventListener('emptied', () => { active.restore = null; stopPreview(); }, {signal});
        media.getRootNode().addEventListener('ended', event => {
          if (event.target === media && sameSource()) { event.stopImmediatePropagation(); stopPreview(); }
        }, {capture:true,signal});
      }
      return active;
    }
    async function preview(seconds, play = false) {
      if (locked()) { stopPreview(); return; }
      const media = decoder || source;
      const position = clamp(seconds, 0, duration);
      const active = beginSession(media), controller = active.controller;
      try {
        if (play) {
          action('play').setAttribute('aria-pressed','true');
          action('play').textContent = '確認再生を停止';
          media.playbackRate = 1;
        }
        await waitForFrame(media, null, controller.signal);
        await waitForFrame(media, position, controller.signal, () => seek(media, position));
        if (session !== active) return;
        if (!draw(media)) throw Error('選択した場面を読み込めませんでした。');
        if (!play) { stopPreview(); return; }
        if (media === decoder) media.muted = false;
        let drawnTime = media.currentTime;
        let nextPaint = performance.now() + previewInterval;
        await media.play();
        const step = () => {
          if (session !== active) return;
          const secondsLeft = endInput.valueAsNumber - media.currentTime;
          if (locked() || secondsLeft <= 0 || media.ended || media.paused) { stopPreview(); return; }
          try {
            if (performance.now() >= nextPaint) {
              if (media.currentTime !== drawnTime && draw(media)) drawnTime = media.currentTime;
              nextPaint = performance.now() + previewInterval;
            }
            active.frameTimer = setTimeout(step, Math.max(4, Math.min(secondsLeft*1000, nextPaint-performance.now())));
          } catch (error) { stopPreview(); showMessage(error.message); }
        };
        step();
      } catch (error) {
        if (session === active) { stopPreview(); showMessage(error.message || '選択した場面を表示できません。'); }
      }
    }
    const thumbHint = find('.zwClipThumbHint');
    const thumbButton = action('thumbnails'), thumbStatus = thumbHint.querySelector('small');
    const hasFrame = cell => !!cell.querySelector('canvas') || !!cell.querySelector('img')?.naturalWidth;
    function updateThumbHint() {
      const cells = [...frames.children];
      const missing = cells.filter(cell => !hasFrame(cell) && cell.getAttribute('aria-busy') !== 'true' && cell.textContent !== '読み込み中');
      const collecting = !!session?.collecting;
      const canRead = !decoder && !source?.mediaKeys && !locked();
      thumbHint.hidden = !cells.length || (!collecting && !missing.length && !thumbReport);
      thumbButton.hidden = !collecting && (!missing.length || !canRead);
      thumbButton.textContent = collecting ? '取得を中止' : '動画からサムネイルを読み込む';
      thumbStatus.textContent = collecting ? '場面を取得中（' + cells.filter(hasFrame).length + ' / ' + cells.length + '枚）' :
        thumbReport || (canRead ? '場面一覧にない画像を読み込む間、元の動画を一時停止します。' :
          '場面一覧を取得できません。つまみを動かして選んだ位置の映像を確認できます。');
    }
    function tileFrom(media) {
      const tile = document.createElement('canvas');
      const scale = Math.min(144/media.videoWidth, 96/media.videoHeight);
      tile.width = Math.max(1, Math.round(media.videoWidth*scale));
      tile.height = Math.max(1, Math.round(media.videoHeight*scale));
      tile.getContext('2d').drawImage(media, 0, 0, tile.width, tile.height);
      return tile;
    }
    async function collectFrames() {
      if (session?.collecting) { thumbReport = '取得を中止しました。'; stopPreview(); return; }
      if (locked() || decoder || source.mediaKeys) return;
      const active = beginSession(source), media = source;
      active.collecting = true;
      thumbReport = '';
      updateThumbHint();
      let failures = 0;
      try {
        for (const cell of frames.children) {
          if (session !== active || !sameSource()) return;
          if (hasFrame(cell)) continue;
          const sec = Number(cell.dataset.seconds);
          try {
            await waitForFrame(media, sec, active.controller.signal, () => seek(media,sec), 15000);
            if (session !== active || !sameSource()) return;
            const tile = tileFrom(media);
            const release = thumbReleases.get(cell);
            if (release) { release(); thumbReleases.delete(cell); }
            cell.replaceChildren(displayFrame(tile));
            capturedFrames.set(sec,tile);
            if (capturedFrames.size > 48) capturedFrames.delete(capturedFrames.keys().next().value);
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
      } finally { if (session === active) stopPreview(); }
    }
    on(thumbButton,'click',collectFrames);
    const thumbObserver = new MutationObserver(updateThumbHint);
    thumbObserver.observe(frames,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-busy']});
    function clearThumbs() {
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
          if (tile) { cell.replaceChildren(displayFrame(tile)); continue; }
          try { const release = getThumbnail?.(cell, sec); if (typeof release === 'function') thumbReleases.set(cell, release); }
          catch (_) { cell.textContent = '画像なし'; }
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
    function render() {
      const [a,b] = values();
      const disabled = locked();
      const valid = Number.isFinite(a) && Number.isFinite(b) && a >= 0 && b <= duration && b > a && b - a <= maxLength + 0.0001;
      lengthDisplay.textContent = valid ? '選択 ' + Number((b - a).toFixed(2)) + '秒' : '開始・終了を確認してください';
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
      action('play').disabled = disabled || !valid;
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
        stopPreview(); forgetRestore(); clearThumbs(); clearScene();
        unload(decoder); unload(thumbVideo); decoder = thumbVideo = null;
        renderer?.dispose(); renderer = null;
        capturedFrames = new Map(); thumbReport = ''; thumbKey = null; drag = null;
        source = selected; sourceUrl = selected?.currentSrc; sourceObject = selected?.srcObject;
        if (!available) { duration = 0; return; }
        if (isLocalSource(source)) { decoder = newDecoder(); thumbVideo = newDecoder(); }
        else capturedFrames = framesFor(source,clipSession);
        duration = source.duration;
        const [a,b] = values();
        span = Math.min(duration, Math.max(Math.min(120, maxLength), (b-a) || 0));
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
            if (decoder || !changed) preview(time);
            else if (!draw(source)) showMessage('開始または終了を選ぶと、その場面を表示します。');
          }
        } catch (error) { showMessage(error.message); }
      }
      render();
    }
    function write(a,b) {
      writing = true;
      try {
        const changed = [[startInput,a],[endInput,b]].filter(([input,value]) => Math.abs(input.valueAsNumber-value) > 0.00001);
        for (const [input,value] of changed) input.value = Number(value.toFixed(3));
        for (const [input] of changed) input.dispatchEvent(new Event('input',{bubbles:true}));
      } finally { writing = false; }
      render();
    }
    const gap = () => Math.min(0.01, duration);
    function moveEdge(edge, value) {
      const [a,b] = values();
      if (edge === 'start') {
        const start = clamp(value, Math.max(0,b-maxLength), Math.max(0,b-gap()));
        write(start,b); return start;
      }
      const end = clamp(value, Math.min(duration,a+gap()), Math.min(duration,a+maxLength));
      write(a,end); return end;
    }
    function moveBlock(value, length) {
      const start = clamp(value, 0, duration-length);
      write(start, start+length);
      return start;
    }
    function at(event) {
      const box = rail.getBoundingClientRect();
      return windowStart + clamp((event.clientX-box.left)/box.width,0,1)*span;
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
        const t = drag.time;
        if (decoder) { preview(t); return; }
        // Passive storyboard while dragging. Only the released handle seeks the live player.
        if (getThumbnail && !renderer && !rendererError) {
          clearScene(); scene.hidden = false;
          scene.textContent = '指を離すとこの場面を表示します';
          try {
            const release = getThumbnail(scene,t);
            if (typeof release === 'function') releaseScene = release;
          } catch (_) { scene.textContent = '指を離すとこの場面を表示します'; }
          showMessage('');
        }
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
      const selected = drag.time;
      drag = null;
      if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
      clearTimeout(dragTimer); dragTimer = null;
      if (event.type !== 'pointercancel' && Number.isFinite(selected)) preview(selected); else stopPreview();
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
      const next = moveEdge(edge,keys[event.key]);
      if (next < windowStart || next > windowStart+span) viewport(next-span/2,span);
      setTime(next);
      if (decoder) preview(next);
      else {
        clearTimeout(dragTimer);
        dragTimer = setTimeout(() => preview(next),180);
      }
    });
    for (const input of [startInput,endInput]) {
      on(input,'input',() => {
        if (writing || !sameSource() || !Number.isFinite(input.valueAsNumber)) return;
        stopPreview();
        const value = input.valueAsNumber;
        if (value < windowStart || value > windowStart+span) viewport(value-span/2,span); else render();
      });
      on(input,'change',() => { if (!writing && Number.isFinite(input.valueAsNumber)) preview(input.valueAsNumber); });
    }
    on(action('play'),'click',() => {
      if (action('play').getAttribute('aria-pressed') === 'true') stopPreview();
      else preview(startInput.valueAsNumber, true);
    });
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
    return {refresh, stopPreview, dispose() {
      if (disposed) return;
      disposed = true;
      stopPreview(); forgetRestore(); clearThumbs(); clearScene(); thumbObserver.disconnect(); listeners.abort();
      renderer?.dispose(); capturedFrames = new Map(); unload(decoder); unload(thumbVideo); root.remove();
    }};
  }
  return {mount};
})();
//===END===
export {ShareClipTimeline};
