import {RequestDiagnostics} from '../packages/lib/src/infra/RequestDiagnostics';
import {ShareClipClipboard} from './ShareClipClipboard';
import {ShareClipPreferences} from './ShareClipPreferences';
import {ShareClipTimeline} from './ShareClipTimeline';
import {ShareClipQueue} from './ShareClipQueue';
import {ShareClipJobs} from './ShareClipJobs';
import {ShareFastClip} from './ShareFastClip';
//===BEGIN===
//@require RequestDiagnostics
//@require ShareClipClipboard
//@require ShareClipPreferences
//@require ShareClipTimeline
//@require ShareFastClip
//@require ShareClipQueue
//@require ShareClipJobs
const ShareLocalClip = {
  startFull(spec,onBackgroundFinish) {
    const hls = spec.hls && ShareFastClip.acceptsHls(spec.hls.url) ? spec.hls : null;
    return ShareClipJobs.start({...spec,hls,onBackgroundFinish});
  },
  mount(container, {title = '', startTime = 0, getCurrentVideo, seekCurrentVideo, getShareText,
    createFrameRenderer, getThumbnail, clipSession, onSelectionChange, getCurrentFile, getCurrentHlsSource, getCurrentHlsRendition, getFragmentCache, getStoryboardInterval, qualityConfig, onBackgroundFinish, onNotify = onBackgroundFinish, onOpenOfficial} = {}) {
    const root = document.createElement('section');
    root.className = 'zenzaLocalClip';
    root.innerHTML = `
      <style>
        .zenzaLocalClip .clipSources,.zenzaLocalClip .clipActions,.zenzaLocalClip .clipLayers,.zenzaLocalClip .clipRange {display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}
        .zenzaLocalClip .clipSources {margin-bottom:.6rem}
        .zenzaLocalClip [data-role=recordingVideo] {display:block;width:100%;max-height:min(38vh,420px);background:#080b0e}
        .zenzaLocalClip [data-role=timeline]:has([data-role=recordingVideo]) .zwClipTimeline {display:none}
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
        .zenzaLocalClip [data-role=clipQueue] {margin-top:.4rem;font-size:.9em}
        .zenzaLocalClip [data-role=clipQueue] ul {padding-left:1.2rem;margin:.25rem 0;max-height:8rem;overflow:auto}
        .zenzaLocalClip [data-role=clipQueue] li {margin:.2em 0;overflow-wrap:anywhere}
        .zenzaLocalClip .clipResultChoice {grid-column:1/-1;min-width:0}
        .zenzaLocalClip .clipResultChoice select {max-width:100%}
        .zenzaLocalClip .clipHint {color:#bac6d5;font-size:.9em}
        .zenzaLocalClip [data-role=result] .clipHint p {margin:2px 0}
      </style>
      <video data-role="source" playsinline hidden aria-label="元ファイル"></video>
      <div class="clipPages" role="group" aria-label="クリップの編集項目">
        <button type="button" data-editor-page="range" aria-pressed="true">区間</button>
        <button type="button" data-editor-page="quality" aria-pressed="false">画質・合成</button>
        <button type="button" data-editor-page="sources" aria-pressed="false">その他の作成方法</button>
        <button type="button" data-editor-page="result" aria-pressed="false" hidden>完成した動画</button>
      </div>
      <div class="clipWorkspace">
        <div data-role="timeline"></div>
        <div data-editor-pane="range">
      <div data-share-composer-slot></div>
      <div class="clipRange" role="group" aria-label="秒数を直接指定">
        <label>開始 <input type="number" name="start" min="0" step="any" disabled> 秒</label>
        <label>終了 <input type="number" name="end" min="0" step="any" disabled> 秒</label>
      </div>
      <p class="clipHint" data-role="lengthHint" hidden>この区間は2分20秒を超えています。Xの無料アカウントで投稿する場合は区間を短くしてください。MP4には選んだ長さで書き出せます。</p>
      <label><input type="checkbox" name="openXDraft"> 完成後に別タブでXを開いて動画を添付</label>
        </div>
        <div data-editor-pane="quality" hidden><div class="clipRange" data-role="quality"></div>
      <div class="clipLayers" role="group" aria-label="書き出しに含めるもの">
        <label><input type="checkbox" name="comments"> <span data-role="commentsLabel">コメント</span></label>
        <label><input type="checkbox" name="effects"> 画面エフェクト</label>
      </div>
      <p class="clipHint" data-role="layerHint"></p>
      <p class="clipHint">初期設定では、プレビューと保存する動画は視聴中の画質、場面画像は通信量優先です。ここで選んだ画質は次回も使い、上級者設定の「動画クリップ・X共有」にも反映されます。</p></div>
        <div data-editor-pane="sources" hidden>
          <p class="clipHint">「ZenzaでMP4」を押したら、共有画面を閉じて別の動画を視聴できます。書き出しが終わるまで元のタブを残してください。完成した動画は共有画面で保存できます。</p>
          <div data-provider-slot></div>
      <details data-role="fileOptions"><summary>動画ファイルを使う</summary><div class="clipSources">
        <label class="shareAction clipFile">ファイルを選ぶ<input type="file" accept="video/*,.mp4,.webm,.mov,.m4v" aria-label="動画ファイルを選ぶ"></label>
        <span class="clipSourceName" data-role="sourceName"></span>
        <button type="button" data-action="current" hidden>再生中の動画に戻る</button>
      </div></details>
          <p class="clipHint">直接書き出せない配信は「プレビューで録画」で区間と同じ時間をかけて作成できます。録画中はこのタブを表示してください。共有パネルを閉じて別の動画を見られます。</p>
        </div>
      <div data-role="result" hidden>
        <label class="clipResultChoice" hidden>完成した区間 <select data-role="completedClips"></select></label>
        <video data-role="preview" controls playsinline preload="metadata" aria-label="作成したクリップ"></video>
        <div class="clipActions">
        <button type="button" data-action="share" hidden>動画を共有…</button>
        <button type="button" data-action="copy-for-x" hidden>X用に動画をコピー</button>
        <a class="shareAction" data-action="post-x" target="_blank" rel="noopener noreferrer">コピーして別タブでXを開く</a>
        <a class="shareAction" download>動画を保存</a>
        <button type="button" data-action="discard">クリップを削除</button></div>
        <div class="clipHint"><p data-role="draftStatus" aria-live="polite"></p><strong data-role="outputSize" hidden></strong>
          <p>完成動画は最後の操作から${ShareClipJobs.retentionMinutes}分で自動削除します。</p>
          <details><summary>保存とXへの添付方法</summary><p>再生・転送中は保持します。手元に残すには「動画を保存」を押してください。</p><p data-role="attachHint"></p></details></div>
      </div>
      </div>
      <footer class="clipFooter">
        <div class="clipActions" data-role="createActions"><button type="button" data-action="create" disabled>ZenzaでMP4</button>
          <button type="button" data-action="low-quality" hidden>通信量優先の画質で高速作成</button>
          <button type="button" data-action="provider-fallback" hidden>ニコニコ連携の詳細</button>
          <button type="button" data-action="record" hidden>再生しながら作成</button></div>
        <button type="button" data-action="cancel" hidden>実行中の処理をキャンセル</button>
        <p role="status" aria-live="polite"></p>
        <span data-role="clipProgress" hidden><progress aria-label="クリップの書き出し進捗" max="100"></progress> <span aria-hidden="true"></span></span>
      </footer>
      <details data-role="clipQueue" hidden><summary></summary><ul></ul></details>`;
    root.dataset.page = 'range';
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
    const lowQualityFallback = find('[data-action=low-quality]');
    const providerFallback = find('[data-action=provider-fallback]');
    providerFallback.onclick = () => onOpenOfficial?.(providerFallback);
    const recordFallback = find('[data-action=record]');
    const cancel = find('[data-action=cancel]');
    const result = find('[data-role=result]');
    const download = find('a[download]');
    const postX = find('[data-action=post-x]');
    const share = find('[data-action=share]');
    const copyForX = find('[data-action=copy-for-x]');
    const attachHint = find('[data-role=attachHint]');
    const outputSize = find('[data-role=outputSize]');
    const status = find('[role=status]');
    const progress = find('[data-role=clipProgress]');
    const progressBar = progress.querySelector('progress');
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
    let sourceUrl, outputUrl, outputFile, job, timeline, cancelCopy;
    const editorEvents = new AbortController();
    const preference = id => ShareClipPreferences.get(qualityConfig, id);
    const draftSetting = 'shareClip.openXDraft';
    const openXDraft = find('[name=openXDraft]');
    const syncDraftSetting = () => { openXDraft.checked = preference(draftSetting); };
    syncDraftSetting();
    openXDraft.onchange = () => qualityConfig?.setValue(draftSetting, openXDraft.checked);
    qualityConfig?.onkey?.(draftSetting, syncDraftSetting);
    editorEvents.signal.addEventListener('abort', () => qualityConfig?.offkey?.(draftSetting, syncDraftSetting), {once:true});
    function reserveDraft(click) {
      if (!openXDraft.checked) return null;
      return ShareClipClipboard.reserveDraft?.(click?.isTrusted === true, preference('shareClip.backgroundTab')) || {
        complete() { throw Object.assign(Error('Xの下書きを自動で開けませんでした。完成画面から手動で添付できます。'),{stage:'draft-reserve'}); }
      };
    }
    const draftStatus = find('[data-role=draftStatus]');
    const quality = {};
    for (const {kind, id, label} of ShareClipPreferences.qualityFields) {
      const field = document.createElement('label'), select = document.createElement('select');
      for (const option of ShareClipPreferences.qualityOptions) select.add(new Option(option.label, option.value));
      select.name = kind + 'Quality';
      select.value = preference(id);
      const refreshQuality = () => { if (kind !== 'export') timeline?.qualityChanged?.(kind); };
      const sync = () => {
        const value = preference(id);
        if (select.value === value) return;
        select.value = value;
        refreshQuality();
      };
      qualityConfig?.onkey?.(id, sync);
      editorEvents.signal.addEventListener('abort', () => qualityConfig?.offkey?.(id, sync), {once:true});
      select.onchange = () => {
        qualityConfig?.setValue(id, select.value);
        refreshQuality();
      };
      quality[kind] = select;
      field.append(label + ' ',select);
      find('[data-role=quality]').append(field);
    }
    function qualityHeight(kind, video, rendition) {
      const value = quality[kind].value;
      if (value !== 'source') return value === 'low' ? 0 : Number(value);
      const current = rendition ?? (video !== localVideo && getCurrentHlsRendition?.(video));
      return current?.height || video.videoHeight;
    }
    const pageButtons = root.querySelectorAll('[data-editor-page]');
    const completedClips = find('[data-role=completedClips]');
    const queueView = find('[data-role=clipQueue]');
    const locksEditor = () => !!job && !job.independent;
    const rangeButton = find('[data-editor-page=range]');
    const createActions = find('[data-role=createActions]');
    let awaitingPreview = false;
    let canCreateRange = false, validLength = true;
    const isPreviewActive = () => root.dataset.page === 'range' && !root.closest('[hidden]') && !locksEditor();
    function selectEditorPage(page) {
      root.dataset.page = page;
      const reviewing = page === 'result';
      if (reviewing) ShareClipJobs.touch(displayedTask);
      createActions.hidden = reviewing;
      showOutputSize();
      rangeButton.textContent = reviewing ? '編集に戻る' : '区間';
      if (page !== 'range') {
        awaitingPreview = false;
        timeline?.stopPreview();
      }
      if (!reviewing && !preview.paused) preview.pause();
      for (const button of pageButtons) {
        const item = button.dataset.editorPage;
        if (item === 'quality' || item === 'sources') button.hidden = reviewing;
        button.setAttribute('aria-pressed', String(item === page));
      }
      for (const pane of root.querySelectorAll('[data-editor-pane]')) pane.hidden = pane.dataset.editorPane !== page;
    }
    const resultButton = find('[data-editor-page=result]');
    let pickedSource = false, detached = false;
    const owner = Symbol();
    let submitted, displayedTask, releasePlayback;
    const taskLabel = task => (task.name || 'クリップ') +
      (Number.isFinite(task.from) && Number.isFinite(task.to) ? '（' + task.from + '〜' + task.to + '秒）' : '');
    const sameSubmission = task => task && submitted === task && task.owner === owner &&
      task.from === start.valueAsNumber && task.to === end.valueAsNumber &&
      task.shareText === (getShareText?.() ?? task.shareText) && currentSelection();
    // A new edit gives the user control of the page, even if they later select the same values.
    const editing = () => { if (submitted) { submitted = null; refresh(); } };
    root.addEventListener('input', editing);
    root.addEventListener('change', event => { if (event.target !== completedClips) editing(); });
    for (const button of pageButtons) button.onclick = () => {
      editing();
      if (button === resultButton) openResult(displayedTask || ShareClipJobs.results.at(-1));
      else selectEditorPage(button.dataset.editorPage);
    };
    completedClips.onchange = () => { editing(); openResult(ShareClipJobs.results[completedClips.selectedIndex]); };
    function refreshResults() {
      const results = ShareClipJobs.results;
      resultButton.hidden = !results.length;
      resultButton.textContent = results.length > 1 ? '完成した動画（' + results.length + '）' : '完成した動画';
      if (displayedTask && !results.includes(displayedTask)) {
        clearResult();
        if (root.dataset.page === 'result') selectEditorPage('range');
      }
      completedClips.parentElement.hidden = results.length < 2;
      completedClips.replaceChildren(...results.map(task => new Option(taskLabel(task))));
      if (displayedTask) completedClips.selectedIndex = results.indexOf(displayedTask);
    }
    function showQueue(items) {
      queueView.hidden = !items.length;
      const running = items.find(item => item.state === 'running');
      const waiting = items.filter(item => item.state === 'queued');
      cancel.hidden = !running || running.kind === 'official';
      cancel.onclick = () => running?.cancel();
      cancel.setAttribute('aria-label', running ? taskLabel(running) + 'の処理をキャンセル' : '');
      queueView.querySelector('summary').textContent = [
        running && '実行中 · ' + taskLabel(running),
        waiting.length && '待機中 ' + waiting.length + '件' + (!running ? ' · ' + taskLabel(waiting[0]) : '')
      ].filter(Boolean).join('　');
      const rows = items.map(item => {
        const row = document.createElement('li');
        const kind = item.kind === 'official' ? 'ニコニコ投稿' : item.kind === 'recording' ? '録画' : '書き出し';
        row.textContent = (item === running ? '実行中' : '待機中 ' + (waiting.indexOf(item) + 1)) + ' · ' + kind + ' · ' + taskLabel(item) + ' ';
        if (item.state === 'queued') {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.textContent = '予約を取り消す';
          remove.setAttribute('aria-label',taskLabel(item) + 'の予約を取り消す');
          remove.onclick = () => item.cancel();
          row.append(remove);
        }
        return row;
      });
      queueView.querySelector('ul').replaceChildren(...rows);
      refresh();
    }

    function currentSelection() {
      return source === localVideo || (getCurrentVideo() === source && source.currentSrc === selectedSrc && source.srcObject === selectedObject);
    }
    const recordingSourceValid = active => !!active.previewVideo || currentSelection();
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
      if (detached) return;
      const ready = (source !== localVideo || !!sourceUrl) && !source.error && Number.isFinite(source.duration) && source.duration > 0 && source.videoWidth > 0;
      const busy = locksEditor();
      openXDraft.disabled = fileInput.disabled = current.disabled = busy;
      for (const select of Object.values(quality)) select.disabled = busy;
      const local = source === localVideo;
      current.setAttribute('aria-pressed', String(!local));
      find('[data-role=sourceName]').textContent = local && sourceUrl ? fileInput.files[0]?.name || '' : '';
      const canExport = available || local && !!sourceUrl || !local && (!!getCurrentFile || !!getCurrentHlsSource);
      comments.disabled = effects.disabled = !ready || busy || !canExport || typeof createFrameRenderer !== 'function';
      commentsLabel.textContent = local && sourceUrl ? '視聴中の' + (title ? '「' + title + '」' : '動画') + 'のコメントを重ねる' : 'コメント';
      layerHint.textContent = local && sourceUrl
        ? 'コメントは元ファイルの0秒を視聴中の動画の0秒に合わせて表示します。画面エフェクトにはZenzaWatchの現在の設定を使います。'
        : typeof createFrameRenderer !== 'function' ? 'このプレイヤーでは画面合成を利用できません。' : '';
      layerHint.hidden = !layerHint.textContent;
      start.disabled = end.disabled = !ready || busy;
      create.textContent = !local && !getCurrentFile && !getCurrentHlsSource ? '再生しながら作成' : ShareClipQueue.items.length ? 'ZenzaでMP4を予約' : 'ZenzaでMP4';
      const alreadySubmitted = ['queued','running'].includes(submitted?.state) && sameSubmission(submitted);
      canCreateRange = canExport && ready && !busy && !alreadySubmitted && !rangeError();
      create.disabled = !canCreateRange || !validLength;
      find('[data-role=lengthHint]').hidden = !(ready && end.valueAsNumber - start.valueAsNumber > 140);
      status.dataset.busy = String(ShareClipQueue.items.some(item => item.state === 'running'));
      if (!ShareClipJobs.busy) progress.hidden = true;
      timeline?.refresh(layersChanged);
      onSelectionChange?.({start:start.valueAsNumber, end:end.valueAsNumber, isCurrent:!local && currentSelection(), isFile:local && !!sourceUrl,
        comments:comments.checked, effects:effects.checked, recording:busy});
    }
    function unload(video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    function showOutputSize() {
      const visible = root.dataset.page === 'result' && !result.hidden && outputUrl && preview.currentSrc === outputUrl &&
        preview.videoWidth > 0 && preview.videoHeight > 0;
      outputSize.hidden = !visible;
      outputSize.textContent = visible ? '完成動画の解像度 ' + preview.videoWidth + ' × ' + preview.videoHeight + ' px（' + preview.videoHeight + 'p）' : '';
    }
    preview.addEventListener('loadedmetadata', showOutputSize, {signal:editorEvents.signal});
    function endReview() {
      releasePlayback?.();
      releasePlayback = undefined;
    }
    const reviewEvents = {signal:editorEvents.signal};
    preview.addEventListener('play', () => {
      if (!releasePlayback && !preview.paused && displayedTask) releasePlayback = ShareClipJobs.hold(displayedTask);
    }, reviewEvents);
    for (const type of ['pause','ended']) preview.addEventListener(type, () => {
      if (preview.paused || preview.ended) endReview();
    }, reviewEvents);
    for (const type of ['pointerdown','keydown','click','seeked']) result.addEventListener(type,
      () => ShareClipJobs.touch(displayedTask), {...reviewEvents,capture:true});
    function clearResult() {
      cancelCopy?.();
      endReview();
      recordFallback.hidden = true;
      lowQualityFallback.hidden = true;
      providerFallback.hidden = true;
      result.hidden = true;
      if (root.dataset.page === 'result') selectEditorPage('range');
      showOutputSize();
      share.hidden = true;
      download.removeAttribute('href');
      postX.removeAttribute('href');
      unload(preview);
      if (outputUrl) URL.revokeObjectURL(outputUrl);
      outputUrl = outputFile = displayedTask = null;
    }
    find('[data-action=discard]').onclick = () => {
      if (!outputFile || result.hidden || !window.confirm('このタブのクリップを削除しますか？ 保存したファイルは端末に残ります。')) return;
      ShareClipJobs.discard(displayedTask);
      rangeButton.focus({preventScroll:true});
    };
    function finish(message, restorePlayback = true) {
      const active = job;
      job = null;
      if (active) {
        active.draft?.cancel?.();
        active.events.abort();
        clearInterval(active.clock);
        clearInterval(active.frames);
        if (active.recorder && active.recorder.state !== 'inactive') active.recorder.stop();
        active.stream?.getTracks().forEach(track => track.stop());
        active.sourceStream?.getTracks().forEach(track => track.stop());
        try { active.renderer?.dispose?.(); }
        catch (_) { message += ' 画面合成の終了処理に失敗しました。'; }
        if (active.probeUrl) {
          unload(active.probe);
          URL.revokeObjectURL(active.probeUrl);
        }
        if (active.previewVideo) {
          unload(active.previewVideo);
          active.previewVideo.remove();
          if (active.fileUrl) URL.revokeObjectURL(active.fileUrl);
        } else if (!active.replaced && currentSelection()) {
          source.pause();
          if (restorePlayback && active.restore) {
            source.loop = active.restore.loop;
            source.playbackRate = active.restore.rate;
            if (seek(active.restore.time) && !active.restore.paused) source.play().catch(() => {});
          }
        }
      }
      if (!detached && root.dataset.page !== 'result') status.textContent = message;
      refresh();
      active?.settle?.({reason:message});
    }
    function present(active, blob, from, to) {
      if (!recordingSourceValid(active)) return finish('再生中の動画が変わったため中断しました。');
      const mp4 = blob.type.startsWith('video/mp4');
      const sourceName = active.independent?.name ?? (source === localVideo ? fileInput.files[0]?.name.replace(/\.[^.]+$/, '') : title);
      const base = (sourceName || 'clip').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 100);
      const file = new File([blob], base + '_' + from + '-' + to + (mp4 ? '.mp4' : '.webm'),
        {type:mp4 ? 'video/mp4' : 'video/webm'});
      const probe = active.probe = document.createElement('video');
      active.probeUrl = URL.createObjectURL(file);
      const options = {once:true, signal:active.events.signal};
      const failed = timingMismatch => {
        if (job !== active) return;
        if (mp4 && !active.webm && recordingSourceValid(active) && !document.hidden && types.some(type => type.startsWith('video/webm'))) {
          const {draft, independent, settle} = active;
          active.draft = active.settle = null;
          if (independent) active.renderer = null; // The retry uses the original comment/effect snapshot.
          finish('', false);
          startRecording(from, to, true, active.restore, false, active.previewUrl, draft, independent, settle);
        } else {
          finish(timingMismatch === true ? '書き出した動画の長さが指定した範囲と一致しませんでした。もう一度お試しください。'
            : '映像を読み出せませんでした。範囲または元のファイルを変えてお試しください。');
        }
      };
      probe.addEventListener('error', failed, options);
      probe.addEventListener('loadedmetadata', () => {
        if (!recordingSourceValid(active)) {
          return finish('再生中の動画が変わったため中断しました。');
        }
        if (!probe.videoWidth) return failed();
        const tolerance = Math.min(0.6, Math.max(0.35, (to - from) * 0.005));
        if (Number.isFinite(probe.duration) && Math.abs(probe.duration - (to - from)) > tolerance) return failed(true);
        const {draft, settle} = active;
        active.draft = active.settle = null;
        finish('');
        settle({file,draft});
      }, options);
      active.clock = setTimeout(failed, 10000);
      probe.src = active.probeUrl;
    }
    function showAttachmentOptions() {
      share.hidden = !navigator.canShare?.({files:[outputFile]});
      const reason = ShareClipClipboard.copyUnavailableReason(outputFile);
      copyForX.hidden = !!reason;
      postX.textContent = reason || displayedTask?.draftFailureStage ? 'Xの下書きを別タブで開く' : 'コピーして別タブでXを開く';
      attachHint.textContent = reason || '手動で添付するときは、Xで「Zenzaの動画をクリップボードから読み込む」を押してください。';
    }
    const reserveResultDraft = () => ShareClipClipboard.reserveDraft(true,preference('shareClip.backgroundTab'));
    async function copyClipForX(openDraft = false) {
      const file = outputFile;
      if (!file || copyForX.disabled) return;
      copyForX.disabled = true;
      const release = ShareClipJobs.hold(displayedTask);
      const expires = Date.now() + 30000;
      const timeoutMessage = '30秒以内にコピー完了を確認できませんでした。「動画を保存」で保存し、Xのメディアボタンから添付できます。';
      let timer, draft;
      const text = displayedTask?.shareText ?? displayedTask?.name ?? '';
      try {
        // Start the write while this document has focus. Reserve the tab in the same user gesture.
        const writing = ShareClipClipboard.copy(file).then(() => true);
        const interrupted = new Promise((resolve,reject) => {
          cancelCopy = () => { draft?.cancel?.(); resolve(false); };
          timer = setTimeout(() => reject(Error(timeoutMessage)),30000);
        });
        window.addEventListener('pagehide',cancelCopy);
        if (openDraft) draft = reserveResultDraft();
        if (!await Promise.race([writing,interrupted]) || file !== outputFile) return;
        if (Date.now() >= expires) throw Error(timeoutMessage);
        status.textContent = '「' + file.name + '」をコピーしました。';
        if (openDraft && !draft) throw Error('動画をコピーしましたが、Xの下書きを開けませんでした。');
        if (draft) {
          await draft.openText(text);
          onNotify?.('動画をコピーし、Xの下書きを別タブで開きました。','info');
        } else {
          postX.focus({preventScroll:true});
        }
        status.textContent += 'Xの投稿画面で読み込んでください。';
      } catch (error) {
        const message = error.message || '動画をコピーできませんでした。';
        if (file === outputFile) status.textContent = message;
        if (openDraft) onNotify?.(message,'warning');
      } finally {
        clearTimeout(timer);
        window.removeEventListener('pagehide',cancelCopy);
        cancelCopy = null;
        release();
        draft?.cancel?.();
        copyForX.disabled = false;
      }
    }
    copyForX.onclick = () => copyClipForX();
    function updatePostLink() {
      const intent = new URL('https://x.com/intent/tweet');
      const text = displayedTask?.shareText ?? displayedTask?.name;
      if (text) intent.searchParams.set('text', text);
      postX.href = intent.href;
    }
    postX.onclick = async event => {
      event.preventDefault();
      if (!event.isTrusted || copyForX.disabled || !outputFile) return;
      if (!copyForX.hidden && !displayedTask?.draftFailureStage) return copyClipForX(true);
      const draft = reserveResultDraft();
      if (!draft) { status.textContent = 'Xの下書きを開けませんでした。'; return; }
      try { await draft.openText(displayedTask?.shareText ?? displayedTask?.name ?? ''); }
      catch (error) { status.textContent = error.message; onNotify?.(error.message,'warning'); }
      finally { draft.cancel?.(); }
    };
    async function record(active, from, to) {
      const media = active.previewVideo || source;
      const options = {signal:active.events.signal};
      try {
        if (!recordingSourceValid(active)) return finish('再生中の動画が変わったため中断しました。');
        if (media.seeking || Math.abs(media.currentTime - from) > 0.06) {
          return finish('指定した開始位置を確認できませんでした。もう一度お試しください。');
        }
        media.addEventListener('seeking', () => finish('作成中に再生位置が変わったため中断しました。'), options);
        if (media.mediaKeys) return finish('保護された動画は書き出せません。');
        const sourceStream = active.sourceStream = (media.captureStream || media.mozCaptureStream).call(media);
        const canvas = document.createElement('canvas');
        const {videoWidth:w, videoHeight:h} = media;
        const heightCap = active.independent ? active.independent.maxHeight ?? h
          : quality.export.value === 'source' ? h : qualityHeight('export',media) || 144;
        const dimensions = ShareClipPreferences.outputDimensions(w,h,heightCap);
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;
        const ctx = canvas.getContext('2d', {alpha:false});
        ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
        ctx.getImageData(0, 0, 1, 1);
        if (!active.independent && (comments.checked || effects.checked)) {
          const renderer = await createFrameRenderer({comments:comments.checked, effects:effects.checked,
            video:media, from, to, signal:active.events.signal});
          if (job !== active) { renderer?.dispose?.(); return; }
          active.renderer = renderer;
          if (typeof active.renderer?.draw !== 'function' || typeof active.renderer?.dispose !== 'function') {
            throw Error('選択したレイヤーを取得できませんでした。');
          }
        }
        active.clock = setInterval(() => finish('元の動画を再生できませんでした。'), 10000);
        media.playbackRate = 1;
        await media.play();
        if (job !== active) return;
        if (!recordingSourceValid(active)) return finish('再生中の動画が変わったため中断しました。');
        if (media.seeking || Math.abs(media.currentTime - from) > 0.25) return finish('指定した開始位置から録画できませんでした。');
        if (media.playbackRate !== 1) return finish('等速で再生できません。再生速度を1倍にしてからお試しください。');
        clearInterval(active.clock);
        const draw = () => {
          if (!recordingSourceValid(active)) throw Error('再生中の動画が変わったため中断しました。');
          if (active.renderer) {
            const drawn = active.independent && active.renderer.drawFrame
              ? active.renderer.drawFrame(ctx, canvas.width, canvas.height, media, media.currentTime)
              : active.renderer.draw(ctx, canvas.width, canvas.height);
            if (drawn !== true) {
              throw Error('選択したレイヤーの映像を描画できませんでした。');
            }
          } else {
            ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
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
            return attached.length > 0 || media.audioTracks?.length > 0 || media.mozHasAudio === true || media.webkitAudioDecodedByteCount > 0;
          }
          if (audioTracks.some(audio => !audio.enabled)) return true;
          if (media.ended || (to === media.duration && media.currentTime >= to - 0.05)) return false;
          return audioTracks.some(audio => audio.readyState !== 'live' || audio.muted || !attached.includes(audio));
        };
        if (lostAudio()) return finish('元の音声を取得できないため録画を開始できませんでした。');
        let recorder;
        const videoBitsPerSecond = active.renderer ? ShareClipPreferences.compositeVideoBitrate(canvas.width,canvas.height,30,to-from) : 5_000_000;
        for (const mimeType of types) {
          if (active.webm && !mimeType.startsWith('video/webm')) continue;
          try {
            recorder = new MediaRecorder(stream, {mimeType, videoBitsPerSecond, audioBitsPerSecond:128000});
            recorder.start(250);
            break;
          } catch (_) { recorder = null; }
        }
        if (!recorder) throw Error('この動画をエンコードできませんでした。');
        active.recorder = recorder;
        const recordOrigin = media.currentTime;
        const recordStart = performance.now();
        const timingLost = () => Math.abs((performance.now() - recordStart) / 1000 - (media.currentTime - recordOrigin)) > 0.75;
        const interrupted = () => {
          if (!recordingSourceValid(active)) return finish('再生中の動画が変わったため中断しました。');
          if (!active.completed && !media.ended) finish('元の動画の再生が止まったため作成を中断しました。');
        };
        media.addEventListener('waiting', interrupted, options);
        media.addEventListener('pause', () => { if (media.paused) interrupted(); }, options);
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
        media.addEventListener('ratechange', () => {
          if (media.playbackRate !== 1) finish('作成中に再生速度が変わったため中断しました。');
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
          if (!recordingSourceValid(active)) return finish('再生中の動画が変わったため中断しました。');
          if (lostAudio()) return finish('録画中に元の音声を取得できなくなったため中断しました。');
          if (timingLost()) return finish('元動画と録画の時間がずれたため作成を中断しました。');
          active.completed = true;
          clearInterval(active.frames);
          try { ctx.getImageData(0, 0, 1, 1); }
          catch (_) { return finish('ブラウザーが録画した映像の読み取りを許可していません。'); }
          recorder.stop();
          media.pause();
          clearInterval(active.clock);
        }
        active.onEnd = complete;
        media.addEventListener('ended', complete, options);
        const deadline = performance.now() + (to - from + 12) * 1000;
        active.clock = setInterval(() => {
          if (!recordingSourceValid(active)) return finish('再生中の動画が変わったため中断しました。');
          if (lostAudio()) return finish('録画中に元の音声を取得できなくなったため中断しました。');
          if (timingLost()) return finish('元動画と録画の時間がずれたため作成を中断しました。');
          if (media.playbackRate !== 1) return finish('再生速度が変わったため作成を中断しました。');
          if (media.currentTime >= to) return complete();
          if (performance.now() >= deadline) return finish('再生が止まったため作成を中断しました。');
          const remaining = Math.ceil(to - media.currentTime);
          const message = (active.webm ? 'WebMで再試行中' : '作成中') + ' · 残り約' + remaining + '秒';
          if (root.dataset.page !== 'result' && !detached && status.textContent !== message) status.textContent = message;
        }, 25);
      } catch (error) {
        if (job === active) finish(error.name === 'SecurityError'
          ? 'ブラウザーがこの動画の映像または音声の取得を許可していません。元の動画ファイルを選んでください。'
          : '作成できませんでした。' + error.message);
      }
    }
    function applyLayerDefaults() {
      const canRender = typeof createFrameRenderer === 'function';
      comments.checked = canRender && preference('shareClip.includeComments');
      effects.checked = canRender && preference('shareClip.includeEffects');
    }
    fileInput.onchange = () => {
      editing();
      find('[data-role=fileOptions]').open = true;
      pickedSource = true;
      timeline?.stopPreview();
      if (locksEditor()) return;
      clearResult();
      source = localVideo;
      applyLayerDefaults();
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
      end.value = Math.min(duration, from + preference('shareClip.initialDurationSeconds'));
      start.max = end.max = duration;
      status.textContent = '';
      refresh(true);
    }
    localVideo.onloadedmetadata = () => { if (source === localVideo) prepareRange(); };
    localVideo.onerror = () => {
      if (source === localVideo) { status.textContent = '元の動画を再生できません。このブラウザーで再生できる動画を選んでください。'; refresh(); }
    };
    function selectCurrent(automatic = false) {
      editing();
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
      applyLayerDefaults();
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
    function availablePreviewUrl() {
      if (source === localVideo || source.mediaKeys || !currentSelection()) return null;
      const url = getCurrentHlsSource?.(source);
      return url && ShareFastClip.acceptsHls(url) ? url : null;
    }
    function offerRecording() {
      recordFallback.hidden = !available;
      const independent = !!availablePreviewUrl();
      recordFallback.dataset.mode = independent ? 'preview' : 'main';
      recordFallback.textContent = independent ? 'プレビューで録画' : '再生しながら作成';
      recordFallback.title = '選択区間と同じ時間がかかります。' + (independent
        ? '録画中はこのタブを表示してください。共有パネルを閉じて別の動画を見られます。'
        : '録画中はこのタブと共有パネルを開いてください。');
      if (available) status.textContent += ' ' + recordFallback.title;
    }
    async function requestRecording(from, to, previewUrl, click, draft, fallback = false) {
      const file = source === localVideo ? fileInput.files[0] : null;
      const independent = previewUrl || file ? {file, height:qualityHeight('export',source), media:document.createElement('video')} : null;
      if (!available || !currentSelection() || !independent && ShareClipQueue.items.length) {
        draft?.cancel?.();
        status.textContent = !available ? 'このブラウザーではこの動画を書き出せません。PC版のChromeまたはEdgeでお試しください。'
          : !currentSelection() ? '再生中の動画が変わりました。もう一度動画を選んでください。'
          : 'この動画は視聴プレイヤーで録画します。予約済みの処理が終わってから、この画面で録画してください。';
        return;
      }
      const name = (file ? file.name.replace(/\.[^.]+$/, '') : title) || 'clip';
      const shareText = getShareText?.() ?? (file ? '' : title);
      const preparation = new AbortController();
      draft = draft === undefined ? reserveDraft(click) : draft;
      clearResult();
      let settle;
      settle = ShareClipJobs.reserveRecording({name,shareText,from,to,owner,onBackgroundFinish,onCancel() {
        preparation.abort();
        if (settle && job?.settle === settle) finish('作成をキャンセルしました。');
        else { draft?.cancel?.(); independent?.renderer?.dispose?.(); }
      }});
      submitted = settle.task;
      refresh();
      try {
        // Capture layers on submission. A queued recording gets its own decoder when its turn arrives.
        if (independent) {
          independent.media.dataset.role = 'recordingVideo';
          independent.name = name;
          independent.maxHeight = quality.export.value === 'source' ? null : independent.height || (previewUrl ? null : 144);
          if (comments.checked || effects.checked) {
            const renderer = await createFrameRenderer({video:independent.media,comments:comments.checked,effects:effects.checked,
              from,to,signal:preparation.signal});
            if (preparation.signal.aborted) { renderer?.dispose?.(); return; }
            independent.renderer = renderer;
          }
        }
        if (!await settle.started || preparation.signal.aborted) return;
        if ((!independent && (detached || !sameSubmission(settle.task))) || document.hidden) {
          independent?.renderer?.dispose?.();
          draft?.cancel?.();
          settle({reason:document.hidden ? 'タブが非表示になったため作成を中断しました。' : '録画する動画が切り替わりました。'});
          return;
        }
        startRecording(from,to,false,undefined,fallback,previewUrl,draft,independent,settle);
      } catch (error) {
        draft?.cancel?.();
        if (await settle.started) settle({reason:error.message});
      }
    }
    function startRecording(from, to, webm, restore, fallback, previewUrl, draft, independent, settle) {
      const previewOrigin = independent ? null : timeline?.stopPreview({forRecording:true});
      const active = job = {events:new AbortController(), webm, previewUrl, draft, independent, settle, renderer:independent?.renderer};
      const options = {signal:active.events.signal};
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) finish('タブが非表示になったため作成を中断しました。');
      }, options);
      if (independent) {
        const media = active.previewVideo = independent.media;
        media.playsInline = media.muted = media.hidden = true;
        media.style.display = 'none';
        media.preload = 'auto';
        (detached ? document.body : root).append(media);
        if (independent.file) {
          media.addEventListener('error', () => finish('録画用の元ファイルを読み込めませんでした。'),options);
          media.addEventListener('loadeddata', () => {
            const begin = () => { clearTimeout(active.clock); record(active,from,to); };
            if (from === 0) begin();
            else { media.addEventListener('seeked', begin, {once:true,...options}); media.currentTime = from; }
          }, {once:true,...options});
          active.clock = setTimeout(() => finish('開始位置を読み込めませんでした。'),10000);
          media.src = active.fileUrl = URL.createObjectURL(independent.file);
          return;
        }
        const diagnostic = () => typeof RequestDiagnostics !== 'undefined'
          ? RequestDiagnostics.begin('clip-preview', (clipSession ?? 0) + ':recording', 'response')
          : null;
        const failed = (message, detail) => {
          if (job !== active) return;
          if (detail) diagnostic()?.failure(detail);
          finish(message);
        };
        media.addEventListener('encrypted', () => failed('この配信の映像・音声は保護されています。',
          {reason:'not supported', missing:'recording.encrypted'}), options);
        media.addEventListener('error', () => failed('録画用のプレビュー映像を読み込めませんでした。',
          {reason:'not supported', missing:'recording.decoder'}), options);
        refresh();
        status.textContent = '録画用のプレビューを準備しています。共有パネルを閉じても、このタブを表示している間は録画が続きます。';
        ShareClipTimeline.prepareHlsPreview(media, previewUrl, from, active.events.signal, independent.height,
          error => failed(error.message, error)).then(() => {
            if (job !== active) return;
            diagnostic()?.success();
            return record(active, from, to);
          }).catch(error => {
            if (error.name !== 'AbortError') failed('録画用のプレビューを開始位置に移動できませんでした。通知履歴の「クリップの区間プレビュー」を確認してください。',
              {kind:error.name === 'TimeoutError' ? 'timeout' : 'schema', missing:'recording.firstFrame'});
          });
        return;
      }
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
    function showTask(task, releaseMessage) {
      if (!task || task.state === 'ready') refreshResults();
      if (!task || task.state !== 'running') refresh();
      if (!task) {
        if (releaseMessage && !displayedTask) status.textContent = releaseMessage;
        return;
      }
      if (task.state === 'queued') { progress.hidden = true; return; }
      const label = '「' + taskLabel(task) + '」';
      if (task.state === 'running') {
        if (root.dataset.page === 'result' || locksEditor()) return;
        const stages = {comments:'コメントと画面エフェクトを準備中',library:'変換ライブラリを準備中', source:'元動画の区間を確認中',
          encoding:'映像と音声を書き出し中', checking:'完成したMP4を確認中', recording:'プレビューで録画中（このタブを表示してください）'};
        const message = label + ' · ' + stages[task.stage];
        if (status.textContent !== message) status.textContent = message;
        progress.hidden = task.percent === null;
        if (task.percent !== null) {
          progressBar.value = task.percent;
          progress.lastElementChild.textContent = task.percent + '%';
        }
        return;
      }
      if (task.state === 'ready') {
        if (displayedTask === task) {
          draftStatus.textContent = task.draftMessage || '';
          if (task.draftFailureStage) showAttachmentOptions();
        } else if (sameSubmission(task)) {
          openResult(task);
        } else if (root.dataset.page !== 'result') {
          status.textContent = label + ' が完成しました。「完成した動画」から保存できます。';
        }
        return;
      }
      if (root.dataset.page === 'result') return;
      if (task.state === 'cancelled') {
        status.textContent = '作成をキャンセルしました。';
        return;
      }
      if (task.recorded) {
        status.textContent = label + ' の録画を終了しました。' + (task.reason || '');
        return;
      }
      status.textContent = label + ' を直接書き出せませんでした。' + (task.reason || '');
      if (!sameSubmission(task)) return;
      if (source !== localVideo && currentSelection() && onOpenOfficial && task.to - task.from >= 3) {
        providerFallback.textContent = task.to - task.from > 30 ? '先頭30秒でニコニコの公式クリップを利用できるか確認' : 'この区間でニコニコの公式クリップを利用できるか確認';
        providerFallback.hidden = false;
      }
      if (task.clipProtected) return;
      lowQualityFallback.hidden = !(task.hls && task.clipInputUnsupported && !task.lowQuality && currentSelection() && !source.mediaKeys);
      if (!currentSelection() || source.mediaKeys) {
        status.textContent = '元の動画が切り替わったため、元ファイルを確認できませんでした。';
        return;
      }
      if (source === localVideo && !document.hidden) {
        const draft = task.draft;
        task.draft = null;
        requestRecording(task.from, task.to, null, undefined, draft, true);
      } else offerRecording();
    }
    function openResult(task) {
      if (!task?.file) return;
      const label = '「' + taskLabel(task) + '」';
      draftStatus.textContent = task.draftMessage || '';
      if (outputFile !== task.file) {
        clearResult();
        outputFile = task.file;
        outputUrl = URL.createObjectURL(outputFile);
        preview.src = outputUrl;
      }
      displayedTask = task;
      download.href = outputUrl;
      download.download = outputFile.name;
      updatePostLink();
      result.hidden = false;
      selectEditorPage('result');
      completedClips.selectedIndex = ShareClipJobs.results.indexOf(task);
      showAttachmentOptions();
      const kind = outputFile.type.startsWith('video/webm') ? 'WebM' : 'MP4';
      if (task.recorded) {
        status.textContent = label + ' の区間を' + kind + 'で録画しました。' +
          (kind === 'WebM' ? 'Xで添付できない場合はH.264/AACのMP4へ変換してください。' : '');
        return;
      }
      status.textContent = label + (task.hls ? ' の選択区間から' : ' の元ファイルから') + kind + 'を作成しました。'
        + (kind === 'WebM' ? 'このブラウザーはH.264/AACで書き出せないため、WebMにしました。' : '');
    }
    function createClip(from, to, useLowest, click) {
      if (!currentSelection() || source.mediaKeys) { status.textContent = '元の動画を確認できません。もう一度動画を選んでください。'; return; }
      const local = source === localVideo;
      const url = !local && getCurrentHlsSource?.(source);
      const rendition = url && !useLowest && quality.export.value === 'source' ? getCurrentHlsRendition?.(source) : undefined;
      const hls = url && ShareFastClip.acceptsHls(url) ? {url,height:useLowest ? 0 : qualityHeight('export',source,rendition),
        renditionUrl:rendition?.uri,cache:getFragmentCache?.(source)} : null;
      if (!local && !getCurrentFile && !hls) return requestRecording(from, to, null, click);
      timeline.stopPreview();
      clearResult();
      const selected = source;
      const file = local && fileInput.files[0];
      const name = (local ? file?.name.replace(/\.[^.]+$/, '') : title) || 'clip';
      const shareText = getShareText?.() ?? (local ? '' : name);
      const layers = {video:selected, comments:comments.checked, effects:effects.checked, from, to};
      const draft = reserveDraft(click);
      try {
        const prepareRenderer = layers.comments || layers.effects ?
          signal => createFrameRenderer({...layers,signal}) : undefined;
        const maxHeight = quality.export.value === 'source' ? undefined : qualityHeight('export',source) || (hls ? undefined : 144);
        const task = ShareClipJobs.start({name,shareText,from,to,hls,prepareRenderer,maxHeight,comments:layers.comments,owner,onBackgroundFinish,draft,
          getBlob:local ? () => file : signal => getCurrentFile(selected, signal)});
        submitted = task;
        refresh();
      } catch (error) {
        if (local) return requestRecording(from,to,null,click,draft,true);
        draft?.cancel?.();
        status.textContent = error.message;
        offerRecording();
      }
    }
    lowQualityFallback.onclick = event => {
      if (!lowQualityFallback.hidden && !create.disabled && !locksEditor()) {
        createClip(start.valueAsNumber, end.valueAsNumber, true, event);
      }
    };
    recordFallback.onclick = event => {
      if (!recordFallback.hidden && !locksEditor() && !rangeError() && currentSelection() && !source.mediaKeys) {
        const url = availablePreviewUrl();
        if (recordFallback.dataset.mode === 'preview' && !url) {
          status.textContent = '録画用の配信が切り替わりました。もう一度「ZenzaでMP4」を押してください。';
          recordFallback.hidden = true;
          return;
        }
        requestRecording(start.valueAsNumber, end.valueAsNumber, url, event);
      }
    };
    create.onclick = event => { if (!create.disabled) createClip(start.valueAsNumber, end.valueAsNumber, false, event); };
    share.onclick = async () => {
      const file = outputFile;
      const release = ShareClipJobs.hold(displayedTask);
      try {
        const files = [file];
        const text = displayedTask?.shareText;
        const withText = {files, text};
        await navigator.share(text && navigator.canShare(withText) ? withText : {files});
      }
      catch (error) {
        if (error.name !== 'AbortError' && file === outputFile) status.textContent = '共有できませんでした。完成画面で別の添付方法を選べます。';
      } finally { release(); }
    };
    timeline = ShareClipTimeline.mount(find('[data-role=timeline]'), {
      startInput:start, endInput:end, isPreviewActive,
      onLengthValidityChange(valid) {
        validLength = valid;
        create.disabled = !canCreateRange || !valid;
        recordFallback.disabled = !valid;
      },
      getSource:() => (source !== localVideo || sourceUrl) && currentSelection() ? source : null,
      isLocalSource:video => video === localVideo, clipSession,
      getHlsSource:video => getCurrentHlsSource?.(video), getStoryboardInterval,
      getPreviewHeight:video => qualityHeight('preview',video),
      getSceneHeight:video => qualityHeight('scene',video),
      getDetailedFrames(video,times,signal) {
        const url = getCurrentHlsSource?.(video);
        return url && ShareFastClip.acceptsHls(url) ? ShareFastClip.makeThumbnails({url,height:qualityHeight('scene',video),cache:getFragmentCache?.(video)},times,signal) : [];
      },
      getThumbnail:(host, seconds) => source !== localVideo && currentSelection() ? getThumbnail?.(host, seconds) : undefined,
      seekSource:seconds => !locksEditor() && currentSelection() && seek(seconds),
      getPreviewRenderer:video => (comments.checked || effects.checked) && createFrameRenderer
        ? createFrameRenderer({video, comments:comments.checked, effects:effects.checked}) : null
    });
    const candidate = getCurrentVideo?.();
    if (candidate instanceof HTMLVideoElement) {
      selectCurrent(true);
      if (!pickedSource) candidate.addEventListener('loadeddata', () => {
        if (!pickedSource && getCurrentVideo?.() === candidate) {
          selectCurrent(true);
          if (awaitingPreview && isPreviewActive()) timeline?.startPreview?.();
          awaitingPreview = false;
        }
      }, {once:true, signal:editorEvents.signal});
    }
    if (!candidate && getCurrentVideo) status.textContent = '映像の読み込み後に「再生中の動画」を押すか、動画ファイルを選んでください。';
    find('[data-role=fileOptions]').open = source === localVideo;
    refresh();
    const unsubscribeQueue = ShareClipQueue.subscribe(showQueue);
    const unsubscribe = ShareClipJobs.subscribe(showTask);
    refreshResults();
    const cleanup = () => {
      unsubscribeQueue();
      unsubscribe();
      onSelectionChange = undefined;
      editorEvents.abort();
      timeline.dispose();
      timeline = null;
      detached = true;
      if (job?.independent) {
        // Keep the decoder connected when the dialog is removed, including during its initial seek.
        const media = job.previewVideo;
        media.hidden = true;
        if (document.body.moveBefore && media.isConnected) document.body.moveBefore(media,null);
        else document.body.append(media);
      } else if (job) ShareClipJobs.cancel(job.settle.task);
      localVideo.onerror = localVideo.onloadedmetadata = null;
      unload(localVideo);
      fileInput.value = '';
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      sourceUrl = null;
      clearResult();
      root.remove();
    };
    cleanup.setRange = ({start:from, end:to}) => {
      if (locksEditor() || !Number.isFinite(from) || !Number.isFinite(to)) return false;
      start.value = from;
      end.value = to;
      end.dispatchEvent(new Event('input', {bubbles:true}));
      if (rangeError()) return false;
      end.dispatchEvent(new Event('change', {bubbles:true}));
      return true;
    };
    cleanup.startPreview = () => {
      if (!isPreviewActive()) return;
      if (!pickedSource && candidate instanceof HTMLVideoElement) { awaitingPreview = true; return; }
      timeline?.startPreview?.();
    };
    cleanup.stopPreview = () => {
      awaitingPreview = false;
      timeline?.stopPreview();
      if (!preview.paused) preview.pause();
    };
    return cleanup;
  }
};
//===END===
export {ShareLocalClip};
