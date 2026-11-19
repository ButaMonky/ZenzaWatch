import {ShareClipTimeline} from './ShareClipTimeline';
import {ShareFastClip} from './ShareFastClip';
//===BEGIN===
//@require ShareClipTimeline
//@require ShareFastClip
const ShareLocalClip = {
  mount(container, {title = '', startTime = 0, getCurrentVideo, seekCurrentVideo, getShareText,
    createFrameRenderer, getThumbnail, onSelectionChange, getCurrentFile} = {}) {
    const root = document.createElement('section');
    root.className = 'zenzaLocalClip';
    root.innerHTML = `
      <style>
        .zenzaLocalClip .clipSources,.zenzaLocalClip .clipActions,.zenzaLocalClip .clipLayers,.zenzaLocalClip .clipRange {display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
        .zenzaLocalClip .clipSources {margin-bottom:.6rem}
        .zenzaLocalClip .clipSources [aria-pressed=true] {border-color:#83caff;color:#c4e6ff}
        .zenzaLocalClip .clipFile {position:relative;overflow:hidden;cursor:pointer}
        .zenzaLocalClip .clipFile:focus-within {outline:2px solid #85d2ff;outline-offset:2px}
        .zenzaLocalClip .clipFile input {position:absolute;inset:0;width:100%;opacity:0;cursor:pointer}
        .zenzaLocalClip .clipSourceName {overflow-wrap:anywhere;font-size:.9em}
        .zenzaLocalClip .clipLayers {border:0;padding:0;margin:.6rem 0}
        .zenzaLocalClip .clipLayers label {display:inline-flex;align-items:center;gap:.3rem}
        .zenzaLocalClip .clipRange {margin-top:.5rem}
        .zenzaLocalClip .clipActions {margin:.65rem 0}
        .zenzaLocalClip video[data-role=preview] {display:block;width:100%;max-height:min(45vh,380px);object-fit:contain;background:#080b0e;border-radius:6px}
        .zenzaLocalClip .clipActions [data-action=create],.zenzaLocalClip .clipActions a[download] {background:#b8deff;border:1px solid #b8deff;color:#11263c;font-weight:650}
        .zenzaLocalClip .clipHint {color:#bac6d5;font-size:.9em}
      </style>
      <video data-role="source" playsinline hidden aria-label="元ファイル"></video>
      <div data-role="timeline"></div>
      <div class="clipRange" role="group" aria-label="秒数を直接指定">
        <label>開始 <input type="number" name="start" min="0" step="any" disabled> 秒</label>
        <label>終了 <input type="number" name="end" min="0" step="any" disabled> 秒</label>
      </div>
      <p class="clipHint" data-role="lengthHint" hidden>Xで添付できる動画の長さは、アカウントにより異なります。</p>
      <div class="clipLayers" role="group" aria-label="書き出しに含めるもの">
        <label><input type="checkbox" name="comments"> <span data-role="commentsLabel">コメント</span></label>
        <label><input type="checkbox" name="effects"> 画面エフェクト</label>
      </div>
      <p class="clipHint" data-role="layerHint"></p>
      <div class="clipActions"><button type="button" data-action="create" disabled>クリップを作成</button>
      <button type="button" data-action="cancel" hidden>キャンセル</button></div>
      <p class="clipHint">元ファイルを直接処理できない場合は、このタブで区間を再生して最大フルHD・30fpsで書き出します。</p>
      <p role="status" aria-live="polite"></p>
      <div data-role="result" hidden>
        <video data-role="preview" controls playsinline preload="metadata" aria-label="作成したクリップ"></video>
        <div class="clipActions"><a class="shareAction" download>動画を保存</a>
        <a class="shareAction" data-action="post-x" target="_blank" rel="noopener noreferrer">Xの投稿画面を開く</a>
        <button type="button" data-action="share" hidden>アプリで共有</button></div>
        <p class="clipHint">「動画を保存」で保存したファイルを、Xの投稿画面に添付してください。</p>
      </div>
      <details data-role="fileOptions"><summary>動画ファイルを使う</summary><div class="clipSources">
        <label class="shareAction clipFile">ファイルを選ぶ<input type="file" accept="video/*,.mp4,.webm,.mov,.m4v" aria-label="動画ファイルを選ぶ"></label>
        <span class="clipSourceName" data-role="sourceName"></span>
        <button type="button" data-action="current" hidden>再生中の動画に戻る</button>
      </div></details>`;
    container.append(root);
    const find = selector => root.querySelector(selector);
    const fileInput = find('[type=file]');
    const localVideo = find('[data-role=source]');
    const current = find('[data-action=current]');
    current.hidden = typeof getCurrentVideo !== 'function';
    const comments = find('[name=comments]');
    const effects = find('[name=effects]');
    const commentsLabel = find('[data-role=commentsLabel]');
    const layerHint = find('[data-role=layerHint]');
    const preview = find('[data-role=preview]');
    const start = find('[name=start]');
    const end = find('[name=end]');
    const create = find('[data-action=create]');
    const cancel = find('[data-action=cancel]');
    const result = find('[data-role=result]');
    const download = find('a[download]');
    const postX = find('[data-action=post-x]');
    const share = find('[data-action=share]');
    const status = find('[role=status]');
    const recorderTypes = [
      'video/mp4;codecs=avc1.42001e,mp4a.40.2',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus'
    ];
    const types = recorderTypes.filter(type => window.MediaRecorder?.isTypeSupported(type));
    const available = types.length && HTMLCanvasElement.prototype.captureStream && (localVideo.captureStream || localVideo.mozCaptureStream);
    let source = localVideo;
    let selectedSrc, selectedObject;
    let sourceUrl, outputUrl, outputFile, job, timeline;
    const editorEvents = new AbortController();
    let pickedSource = false;

    function currentSelection() {
      return source === localVideo || (getCurrentVideo() === source && source.currentSrc === selectedSrc && source.srcObject === selectedObject);
    }
    function seek(seconds) {
      if (source !== localVideo && seekCurrentVideo) return seekCurrentVideo(source, seconds);
      source.currentTime = seconds;
      return true;
    }
    function rangeError() {
      const from = start.valueAsNumber, to = end.valueAsNumber;
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to <= from || to > source.duration) {
        return '開始・終了を動画の範囲内で指定してください。終了は開始より後にします。';
      }
      return '';
    }
    function refresh(layersChanged = false) {
      const ready = (source !== localVideo || !!sourceUrl) && !source.error && Number.isFinite(source.duration) && source.duration > 0 && source.videoWidth > 0;
      fileInput.disabled = current.disabled = !!job;
      const local = source === localVideo;
      current.setAttribute('aria-pressed', String(!local));
      find('[data-role=sourceName]').textContent = local && sourceUrl ? fileInput.files[0]?.name || '' : '';
      const canExport = available || local && !!sourceUrl || !local && !!getCurrentFile;
      comments.disabled = effects.disabled = !ready || !!job || !canExport || typeof createFrameRenderer !== 'function';
      commentsLabel.textContent = local && sourceUrl ? '視聴中の' + (title ? '「' + title + '」' : '動画') + 'のコメントを重ねる' : 'コメント';
      layerHint.textContent = local && sourceUrl
        ? 'コメントは元ファイルの0秒を視聴中の動画の0秒に合わせて表示します。画面エフェクトにはZenzaWatchの現在の設定を使います。'
        : typeof createFrameRenderer !== 'function' ? 'このプレイヤーでは画面合成を利用できません。' : '';
      layerHint.hidden = !layerHint.textContent;
      start.disabled = end.disabled = !ready || !!job;
      create.disabled = !canExport || !ready || !!job || !!rangeError();
      find('[data-role=lengthHint]').hidden = !(ready && end.valueAsNumber - start.valueAsNumber > 140);
      cancel.hidden = !job;
      timeline?.refresh(layersChanged);
      onSelectionChange?.({start:start.valueAsNumber, end:end.valueAsNumber, isCurrent:!local && currentSelection(), isFile:local && !!sourceUrl,
        comments:comments.checked, effects:effects.checked, recording:!!job});
    }
    function unload(video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    function clearResult() {
      result.hidden = true;
      share.hidden = true;
      download.removeAttribute('href');
      postX.removeAttribute('href');
      unload(preview);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = outputFile = null;
    }
    function finish(message, restorePlayback = true) {
      const active = job;
      job = null;
      if (active) {
        active.events.abort();
        clearInterval(active.clock);
        clearInterval(active.frames);
        if (active.recorder && active.recorder.state !== 'inactive') active.recorder.stop();
        active.stream?.getTracks().forEach(track => track.stop());
        active.sourceStream?.getTracks().forEach(track => track.stop());
        try { active.renderer?.dispose?.(); }
        catch (_) { message += ' 画面合成の終了処理に失敗しました。'; }
        if (!active.fast && !active.replaced && currentSelection()) {
          source.pause();
          if (restorePlayback && active.restore) {
            source.loop = active.restore.loop;
            source.playbackRate = active.restore.rate;
            if (seek(active.restore.time) && !active.restore.paused) source.play().catch(() => {});
          }
        }
      }
      status.textContent = message;
      refresh();
    }
    function present(active, blob, from, to) {
      if (!currentSelection()) return finish('再生中の動画が変わったため中断しました。');
      const mp4 = blob.type.startsWith('video/mp4');
      const sourceName = source === localVideo ? fileInput.files[0]?.name.replace(/\.[^.]+$/, '') : title;
      const base = (sourceName || 'clip').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 100);
      outputFile = new File([blob], base + '_' + from + '-' + to + (mp4 ? '.mp4' : '.webm'),
        {type:mp4 ? 'video/mp4' : 'video/webm'});
      outputUrl = URL.createObjectURL(outputFile);
      const options = {once:true, signal:active.events.signal};
      const failed = timingMismatch => {
        if (job !== active) return;
        clearResult();
        if (active.fast) return useRecorder(active, from, to);
        if (mp4 && !active.webm && currentSelection() && !document.hidden && types.some(type => type.startsWith('video/webm'))) {
          finish('', false);
          startRecording(from, to, true, active.restore);
        } else {
          finish(timingMismatch === true ? '書き出した動画の長さが指定した範囲と一致しませんでした。もう一度お試しください。'
            : '映像を読み出せませんでした。範囲または元のファイルを変えてお試しください。');
        }
      };
      preview.addEventListener('error', failed, options);
      preview.addEventListener('loadedmetadata', () => {
        if (!currentSelection() || (active.sameSource && !active.sameSource())) {
          clearResult();
          return finish('再生中の動画が変わったため中断しました。');
        }
        if (!preview.videoWidth) return failed();
        const tolerance = active.fast ? 0.15 : Math.min(0.6, Math.max(0.35, (to - from) * 0.005));
        if (Number.isFinite(preview.duration) && Math.abs(preview.duration - (to - from)) > tolerance) return failed(true);
        download.href = outputUrl;
        download.download = outputFile.name;
        updatePostLink();
        result.hidden = false;
        share.hidden = !navigator.canShare?.({files:[outputFile]});
        finish(active.fast ? '元ファイルからMP4を作成しました。保存した動画をXの投稿に添付できます。'
          : mp4 ? 'MP4を作成しました。プレビューで確認し、保存した動画をXの投稿に添付できます。'
          : 'WebMを作成しました。Xで添付できない場合はH.264/AACのMP4へ変換してください。');
      }, options);
      active.clock = setTimeout(failed, 10000);
      preview.src = outputUrl;
    }
    function updatePostLink() {
      const intent = new URL('https://twitter.com/intent/tweet');
      const text = source === localVideo ? fileInput.files[0]?.name.replace(/\.[^.]+$/, '') : getShareText?.() || title;
      if (text) intent.searchParams.set('text', text);
      postX.href = intent.href;
    }
    postX.onclick = updatePostLink;
    async function record(active, from, to) {
      const options = {signal:active.events.signal};
      try {
        if (!currentSelection()) return finish('再生中の動画が変わったため中断しました。');
        if (source.seeking || Math.abs(source.currentTime - from) > 0.06) {
          return finish('指定した開始位置を確認できませんでした。もう一度お試しください。');
        }
        source.addEventListener('seeking', () => finish('作成中に再生位置が変わったため中断しました。'), options);
        if (source.mediaKeys) return finish('保護された動画は書き出せません。');
        const sourceStream = active.sourceStream = (source.captureStream || source.mozCaptureStream).call(source);
        const canvas = document.createElement('canvas');
        const {videoWidth:w, videoHeight:h} = source;
        const scale = Math.min(1, 1920 / Math.max(w, h), 1080 / Math.min(w, h));
        canvas.width = Math.max(2, 2 * Math.floor(w * scale / 2));
        canvas.height = Math.max(2, 2 * Math.floor(h * scale / 2));
        const ctx = canvas.getContext('2d', {alpha:false, willReadFrequently:true});
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
        ctx.getImageData(0, 0, 1, 1);
        if (comments.checked || effects.checked) {
          active.renderer = createFrameRenderer({comments:comments.checked, effects:effects.checked, video:source});
          if (typeof active.renderer?.draw !== 'function' || typeof active.renderer?.dispose !== 'function') {
            throw Error('選択したレイヤーを取得できませんでした。');
          }
        }
        active.clock = setInterval(() => finish('元の動画を再生できませんでした。'), 10000);
        source.playbackRate = 1;
        await source.play();
        if (job !== active) return;
        if (!currentSelection()) return finish('再生中の動画が変わったため中断しました。');
        if (source.seeking || Math.abs(source.currentTime - from) > 0.25) return finish('指定した開始位置から録画できませんでした。');
        if (source.playbackRate !== 1) return finish('等速で再生できません。再生速度を1倍にしてからお試しください。');
        clearInterval(active.clock);
        const draw = () => {
          if (!currentSelection()) throw Error('再生中の動画が変わったため中断しました。');
          if (active.renderer) {
            if (active.renderer.draw(ctx, canvas.width, canvas.height) !== true) {
              throw Error('選択したレイヤーの映像を描画できませんでした。');
            }
          } else {
            ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
          }
        };
        draw();
        ctx.getImageData(0, 0, 1, 1);
        const stream = active.stream = canvas.captureStream(30);
        const videoTrack = stream.getVideoTracks()[0];
        const audioTracks = sourceStream.getAudioTracks();
        for (const audio of audioTracks) stream.addTrack(audio);
        const lostAudio = () => {
          const attached = sourceStream.getAudioTracks();
          if (!audioTracks.length) {
            return attached.length > 0 || source.audioTracks?.length > 0 || source.mozHasAudio === true || source.webkitAudioDecodedByteCount > 0;
          }
          if (audioTracks.some(audio => !audio.enabled)) return true;
          if (source.ended || (to === source.duration && source.currentTime >= to - 0.05)) return false;
          return audioTracks.some(audio => audio.readyState !== 'live' || audio.muted || !attached.includes(audio));
        };
        if (lostAudio()) return finish('元の音声を取得できないため録画を開始できませんでした。');
        let recorder;
        for (const mimeType of types) {
          if (active.webm && !mimeType.startsWith('video/webm')) continue;
          try {
            recorder = new MediaRecorder(stream, {mimeType, videoBitsPerSecond:5000000, audioBitsPerSecond:128000});
            recorder.start(250);
            break;
          } catch (_) { recorder = null; }
        }
        if (!recorder) throw Error('この動画をエンコードできませんでした。');
        active.recorder = recorder;
        const recordOrigin = source.currentTime;
        const recordStart = performance.now();
        const timingLost = () => Math.abs((performance.now() - recordStart) / 1000 - (source.currentTime - recordOrigin)) > 0.75;
        const interrupted = () => {
          if (!currentSelection()) return finish('再生中の動画が変わったため中断しました。');
          if (!active.completed && !source.ended) finish('元の動画の再生が止まったため作成を中断しました。');
        };
        source.addEventListener('waiting', interrupted, options);
        source.addEventListener('pause', () => { if (source.paused) interrupted(); }, options);
        draw();
        videoTrack.requestFrame?.();
        active.frames = setInterval(() => {
          try {
            draw();
            videoTrack.requestFrame?.();
          } catch (error) {
            finish('作成できませんでした。' + error.message);
          }
        }, 1000 / 30);
        source.addEventListener('ratechange', () => {
          if (source.playbackRate !== 1) finish('作成中に再生速度が変わったため中断しました。');
        }, options);
        const chunks = [];
        let bytes = 0;
        recorder.addEventListener('dataavailable', event => {
          bytes += event.data.size;
          if (event.data.size) chunks.push(event.data);
        }, options);
        recorder.addEventListener('error', event => finish(event.error?.name === 'QuotaExceededError'
          ? '録画を保存できる容量が不足しています。端末の空き容量を確認してください。'
          : 'エンコードに失敗しました。範囲を短くするか、別の動画でお試しください。'), options);
        recorder.addEventListener('stop', () => {
          if (!active.completed || !bytes) return finish('最後まで記録できませんでした。もう一度お試しください。');
          try {
            present(active, new Blob(chunks, {type:recorder.mimeType}), from, to);
          } catch (_) { finish('動画ファイルを準備できませんでした。端末の空き容量を確認するか、範囲を短くしてください。'); }
        }, options);
        function complete() {
          if (recorder.state === 'inactive') return;
          if (!currentSelection()) return finish('再生中の動画が変わったため中断しました。');
          if (lostAudio()) return finish('録画中に元の音声を取得できなくなったため中断しました。');
          if (timingLost()) return finish('元動画と録画の時間がずれたため作成を中断しました。');
          active.completed = true;
          clearInterval(active.frames);
          try { ctx.getImageData(0, 0, 1, 1); }
          catch (_) { return finish('ブラウザーが録画した映像の読み取りを許可していません。'); }
          recorder.stop();
          source.pause();
          clearInterval(active.clock);
        }
        active.onEnd = complete;
        source.addEventListener('ended', complete, options);
        const deadline = performance.now() + (to - from + 12) * 1000;
        active.clock = setInterval(() => {
          if (!currentSelection()) return finish('再生中の動画が変わったため中断しました。');
          if (lostAudio()) return finish('録画中に元の音声を取得できなくなったため中断しました。');
          if (timingLost()) return finish('元動画と録画の時間がずれたため作成を中断しました。');
          if (source.playbackRate !== 1) return finish('再生速度が変わったため作成を中断しました。');
          if (source.currentTime >= to) return complete();
          if (performance.now() >= deadline) return finish('再生が止まったため作成を中断しました。');
          const remaining = Math.ceil(to - source.currentTime);
          const message = (active.webm ? 'WebMで再試行中' : '作成中') + ' · 残り約' + remaining + '秒';
          if (status.textContent !== message) status.textContent = message;
        }, 25);
      } catch (error) {
        if (job === active) finish(error.name === 'SecurityError'
          ? 'ブラウザーがこの動画の映像または音声の取得を許可していません。元の動画ファイルを選んでください。'
          : '作成できませんでした。' + error.message);
      }
    }
    fileInput.onchange = () => {
      find('[data-role=fileOptions]').open = true;
      pickedSource = true;
      timeline?.stopPreview();
      finish('');
      clearResult();
      source = localVideo;
      comments.checked = effects.checked = false;
      unload(source);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      const file = fileInput.files[0];
      sourceUrl = file ? URL.createObjectURL(file) : null;
      source.hidden = true;
      start.value = end.value = '';
      if (file) {
        source.src = sourceUrl;
        status.textContent = '動画を読み込んでいます。';
      }
      refresh();
    };
    function prepareRange() {
      const duration = source.duration;
      if (!Number.isFinite(duration) || duration <= 0 || !source.videoWidth) {
        status.textContent = '動画の長さを読み取れませんでした。長さが記録された動画ファイルを選んでください。';
        return refresh();
      }
      const from = source !== localVideo && startTime >= 0 && startTime < duration ? Number(startTime) : 0;
      start.value = from;
      end.value = Math.min(duration, from + 30);
      start.max = end.max = duration;
      status.textContent = '';
      refresh(true);
    }
    localVideo.onloadedmetadata = () => { if (source === localVideo) prepareRange(); };
    localVideo.onerror = () => {
      if (source === localVideo) finish('元の動画を再生できません。このブラウザーで再生できる動画を選んでください。');
    };
    function selectCurrent(automatic = false) {
      const video = getCurrentVideo?.();
      if (!(video instanceof HTMLVideoElement) || !video.videoWidth || video.mediaKeys) {
        if (video?.mediaKeys) status.textContent = 'この動画は保護されているため、ブラウザーで映像を取得できません。手元の元ファイルを選ぶこともできます。';
        else if (automatic && video) status.textContent = '再生中の映像を読み込んでいます。';
        else status.textContent = 'プレイヤーから映像を取得できません。動画ファイルを選んで編集できます。';
        return;
      }
      if (source === video && currentSelection()) return;
      pickedSource = true;
      timeline?.stopPreview();
      clearResult();
      source = video;
      comments.checked = effects.checked = false;
      selectedSrc = video.currentSrc;
      selectedObject = video.srcObject;
      unload(localVideo);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      sourceUrl = null;
      localVideo.hidden = true;
      fileInput.value = '';
      find('[data-role=fileOptions]').open = false;
      prepareRange();
    }
    current.onclick = () => selectCurrent();
    comments.onchange = effects.onchange = () => {
      clearResult();
      status.textContent = '';
      refresh(true);
    };
    start.oninput = end.oninput = () => {
      clearResult();
      status.textContent = rangeError();
      refresh();
    };
    function startRecording(from, to, webm, restore, fallback = false) {
      if (!available) return finish('このブラウザーではこの動画を書き出せません。PC版のChromeまたはEdgeでお試しください。');
      if (!currentSelection()) return finish('再生中の動画が変わりました。もう一度動画を選んでください。');
      const previewOrigin = timeline?.stopPreview({forRecording:true});
      clearResult();
      const active = job = {events:new AbortController(), webm};
      const options = {signal:active.events.signal};
      if (source !== localVideo) {
        active.restore = restore || (previewOrigin?.video === source ? previewOrigin : null) ||
          {time:source.currentTime, rate:source.playbackRate, paused:source.paused, loop:source.loop};
        source.loop = false;
        const clipVideo = source;
        clipVideo.getRootNode().addEventListener('ended', event => {
          if (event.target !== clipVideo || !currentSelection()) return;
          event.stopImmediatePropagation();
          if (active.onEnd) active.onEnd();
          else finish('指定した範囲を再生できませんでした。');
        }, {capture:true, ...options});
      }
      source.pause();
      source.addEventListener('emptied', () => {
        active.replaced = true;
        finish('元の動画が切り替わったため中断しました。');
      }, options);
      source.addEventListener('encrypted', () => finish('保護された動画は書き出せません。'), options);
      refresh();
      status.textContent = webm ? 'MP4が正しく書き出せなかったため、同じ範囲をWebMで再試行中です。'
        : fallback ? '元ファイルを直接処理できないため、このタブで再生して作成します。' : '作成を開始しています。';
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) finish('タブが非表示になったため作成を中断しました。');
      }, options);
      const begin = () => {
        clearInterval(active.clock);
        record(active, from, to);
      };
      if (!previewOrigin && Math.abs(source.currentTime - from) < 0.001 && !source.seeking && source.readyState >= 2) return begin();
      source.addEventListener('seeked', begin, {once:true, ...options});
      active.clock = setInterval(() => finish('開始位置を読み込めませんでした。'), 10000);
      if (!seek(from)) {
        active.replaced = true;
        finish('再生中の動画が変わったため中断しました。');
      }
    }
    function useRecorder(active, from, to) {
      if (job !== active) return;
      if (!currentSelection() || source.mediaKeys) return finish('元の動画が切り替わったか保護されているため中断しました。');
      finish('', false);
      startRecording(from, to, false, undefined, true);
    }
    async function createClip(from, to) {
      const local = source === localVideo;
      if (!local && !getCurrentFile) return startRecording(from, to, false);
      if (!currentSelection() || source.mediaKeys) return finish('元の動画を確認できません。もう一度動画を選んでください。');
      timeline.stopPreview();
      clearResult();
      const active = job = {fast:true, events:new AbortController()};
      const signal = active.events.signal;
      const selected = source;
      const file = local ? fileInput.files[0] : null;
      const sameSource = active.sameSource = () => job === active && selected === source && currentSelection() &&
        !selected.mediaKeys && (!local || file === fileInput.files[0]);
      selected.addEventListener('emptied', () => finish('元の動画が切り替わったため中断しました。'), {signal});
      selected.addEventListener('encrypted', () => finish('保護された動画は書き出せません。'), {signal});
      refresh();
      status.textContent = '元ファイルを確認しています。';
      try {
        const blob = local ? file : await getCurrentFile(selected, signal);
        if (!sameSource()) { if (job === active) finish('元の動画が切り替わったため中断しました。'); return; }
        if (!(blob instanceof Blob)) return useRecorder(active, from, to);
        let drawFrame;
        if (comments.checked || effects.checked) {
          active.renderer = createFrameRenderer({video:selected, comments:comments.checked, effects:effects.checked});
          if (typeof active.renderer?.drawFrame !== 'function') return useRecorder(active, from, to);
          drawFrame = active.renderer.drawFrame.bind(active.renderer);
        }
        status.textContent = '元ファイルから直接書き出しています。';
        const clip = await ShareFastClip.convert({blob, from, to, signal, drawFrame, onProgress(fraction) {
          if (job === active) status.textContent = '元ファイルから直接書き出しています · ' + Math.round(fraction * 100) + '%';
        }});
        if (sameSource()) present(active, clip, from, to);
        else if (job === active) finish('元の動画が切り替わったため中断しました。');
      } catch (_) {
        if (sameSource()) useRecorder(active, from, to);
        else if (job === active) finish('元の動画が切り替わったため中断しました。');
      }
    }
    create.onclick = () => { if (!create.disabled) createClip(start.valueAsNumber, end.valueAsNumber); };
    cancel.onclick = () => {
      finish('作成をキャンセルしました。');
      clearResult();
    };
    share.onclick = async () => {
      const file = outputFile;
      try {
        const files = [file];
        const text = source !== localVideo && getShareText?.();
        const withText = {files, text};
        await navigator.share(text && navigator.canShare(withText) ? withText : {files});
      }
      catch (error) {
        if (error.name !== 'AbortError' && file === outputFile) status.textContent = '共有できませんでした。「動画を保存」から保存してください。';
      }
    };
    timeline = ShareClipTimeline.mount(find('[data-role=timeline]'), {
      startInput:start, endInput:end,
      getSource:() => (source !== localVideo || sourceUrl) && currentSelection() ? source : null,
      isLocalSource:video => video === localVideo,
      getThumbnail:(host, seconds) => source !== localVideo && currentSelection() ? getThumbnail?.(host, seconds) : undefined,
      seekSource:seconds => !job && currentSelection() && seek(seconds),
      getPreviewRenderer:video => (comments.checked || effects.checked) && createFrameRenderer
        ? createFrameRenderer({video, comments:comments.checked, effects:effects.checked}) : null
    });
    const candidate = getCurrentVideo?.();
    if (candidate instanceof HTMLVideoElement) {
      selectCurrent(true);
      if (!pickedSource) candidate.addEventListener('loadeddata', () => {
        if (!pickedSource && getCurrentVideo?.() === candidate) selectCurrent(true);
      }, {once:true, signal:editorEvents.signal});
    }
    if (!candidate && getCurrentVideo) status.textContent = '映像の読み込み後に「再生中の動画」を押すか、動画ファイルを選んでください。';
    find('[data-role=fileOptions]').open = source === localVideo;
    refresh();
    const cleanup = () => {
      onSelectionChange = undefined;
      editorEvents.abort();
      timeline.dispose();
      timeline = null;
      finish('');
      localVideo.onerror = localVideo.onloadedmetadata = null;
      unload(localVideo);
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      sourceUrl = null;
      clearResult();
      root.remove();
    };
    cleanup.setRange = ({start:from, end:to}) => {
      if (job || !Number.isFinite(from) || !Number.isFinite(to)) return false;
      start.value = from;
      end.value = to;
      end.dispatchEvent(new Event('input', {bubbles:true}));
      return !rangeError();
    };
    cleanup.stopPreview = () => {
      timeline?.stopPreview();
      if (!preview.paused) preview.pause();
    };
    return cleanup;
  }
};
//===END===
export {ShareLocalClip};
