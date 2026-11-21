import {ShareClipQueue} from './ShareClipQueue';
import {ShareFastClip} from './ShareFastClip';
//===BEGIN===
//@require ShareFastClip
//@require ShareClipQueue
// The page owns the encoder. Editors subscribe only while mounted.
const ShareClipJobs = (() => {
  const listeners = new Set();
  const retentionMinutes = 5;
  const retained = new Map();
  const pending = new Set();
  let latest;
  function publish(task, message) {
    if (task) latest = task;
    for (const listener of listeners) {
      try { listener(task,message); }
      catch (error) {
        // A broken editor must not interrupt the encoder or draft transfer.
        if (typeof window.reportError === 'function') window.reportError(error);
        else queueMicrotask(() => { throw error; });
      }
    }
  }
  function checkTask(task, entry) {
    clearTimeout(entry.timer);
    if (task.draft || entry.uses.size) return;
    const remaining = entry.expiresAt - Date.now();
    if (remaining > 0) entry.timer = setTimeout(() => checkTask(task,entry),remaining);
    else discard(task,'完成動画の保管期限が過ぎたため、タブのメモリから削除しました。');
  }
  function checkExpiry() {
    for (const [task, entry] of retained) checkTask(task,entry);
  }
  function touch(task) {
    const entry = retained.get(task);
    if (!entry) return;
    entry.expiresAt = Date.now() + retentionMinutes * 60000;
    checkTask(task,entry);
  }
  function hold(task) {
    const entry = retained.get(task);
    if (!entry) return () => {};
    const use = Symbol();
    entry.uses.add(use);
    touch(task);
    return () => { if (entry.uses.delete(use)) touch(task); };
  }
  function retain(task) {
    retained.set(task, {uses:new Set()});
    document.addEventListener('visibilitychange',checkExpiry);
    window.addEventListener('pageshow',checkExpiry);
    touch(task);
  }
  // Zenza handles its own navigation first. For ordinary watch links, keep the
  // encoding document alive and let the viewer continue in the destination tab.
  function openWatchDuringExport(event) {
    if (!event.isTrusted || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const anchor = event.composedPath().find(node => node instanceof HTMLAnchorElement);
    if (!anchor || anchor.hasAttribute('download') || anchor.target && anchor.target !== '_self') return;
    const url = new URL(anchor.href, location.href);
    if (url.origin !== 'https://www.nicovideo.jp' || !/^\/watch\/(?:[a-z]{2})?\d+\/?$/.test(url.pathname)) return;
    const tab = window.open('about:blank', '_blank');
    if (!tab) return;
    tab.opener = null;
    tab.location.replace(url.href);
    event.preventDefault();
  }
  function keepWatchLinksInNewTabs() {
    const click = event => openWatchDuringExport(event);
    window.addEventListener('click', click);
    return () => window.removeEventListener('click', click);
  }
  function notifyResult(task, notify, message, level = 'info', stage, reason, evidence) {
    if (!notify || task.notified) return;
    task.notified = true;
    const title = String(task.name || 'クリップ').slice(0,64);
    notify('「' + title + '」 ' + message, level, stage, reason, evidence);
  }
  async function sendDraft(task, onBackgroundFinish) {
    const draft = task.draft;
    if (!draft) return;
    const releaseLinks = keepWatchLinksInNewTabs();
    const startedAt = Date.now();
    const fileBytes = task.file.size;
    const mib = fileBytes / 1024 ** 2;
    const sizeLabel = mib < 0.1 ? '0.1 MiB未満' : mib.toFixed(1) + ' MiB';
    let receivedAt, handoffStage, uploadPercent, rejectWait, evidence, level = 'info', stage = 'draft-reserve', reason, timer, abort;
    const signal = task.controller?.signal;
    function progress(phase, percent) {
      if (task.draft !== draft) return;
      stage = phase;
      if (receivedAt === undefined && (phase === 'draft-received' || phase === 'draft-prepare')) {
        receivedAt = Date.now();
        handoffStage = phase;
        clearTimeout(timer);
        // The X composer has its own bounded wait. Renew the queue guard only on the first handoff.
        timer = setTimeout(() => rejectWait(Object.assign(Error('Xへの引き渡し後、動画の準備を確認する時間の上限に達しました。開いているXの下書きを確認してください。'),
          {stage,reason:'draft-media-limit'})),21 * 60000);
      }
      if (phase === 'draft-prepare' && Number.isInteger(percent) && percent >= 0 && percent <= 100) {
        uploadPercent = Math.max(uploadPercent ?? 0,percent);
      }
      const message = phase === 'draft-open' ? 'Xの下書きタブを開いています…' :
        phase === 'draft-receive' ? 'Xの下書きが動画を受け取るのを待っています…' :
        phase === 'draft-received' ? 'Xの添付欄にMP4（' + sizeLabel + '）を渡しました。動画の状態を確認しています…' :
        phase === 'draft-prepare' && uploadPercent !== undefined ? 'Xのアップロード' + uploadPercent + '%（' + sizeLabel + '）。下書きで投稿できる状態になるまで待っています…' :
        phase === 'draft-prepare' ? 'Xが動画（' + sizeLabel + '）を準備中です。進まない場合は、Xの下書きタブを一度手前に表示してください。' :
        percent === 100 ? 'MP4のデータを送りました。Xの添付欄での受け取りを待っています…' :
        'Xの下書きに動画を転送しています…' + (Number.isInteger(percent) ? ' ' + percent + '%' : '');
      if (task.draftMessage === message) return;
      task.draftMessage = message;
      publish(task);
    }
    task.draftMessage = 'Xの下書きに動画を添付しています…';
    publish(task);
    try {
      if (task.file.type !== 'video/mp4') throw Object.assign(Error('WebMで完成しました。完成画面で共有方法を選んでください。'),{stage:'draft-format'});
      const deadline = new Promise((_,reject) => {
        rejectWait = reject;
        timer = setTimeout(() => reject(Object.assign(Error('Xの添付欄への受け渡しが10分以内に完了しませんでした。開いているXの下書きを確認してください。完成した動画は保存できます。'),
          {stage,reason:'draft-transfer-timeout'})),10 * 60000);
        abort = () => reject(Object.assign(Error('Xへの自動添付を中止しました。完成した動画は保存できます。'),{stage}));
        signal?.addEventListener('abort',abort,{once:true});
      });
      signal?.throwIfAborted();
      await Promise.race([deadline,draft.complete(task.file, task.shareText ?? task.name ?? '',progress)]);
      stage = 'draft-attached';
      task.draftMessage = 'Xの下書きに動画を添付しました。内容を確認して投稿してください。';
    } catch (error) {
      stage = error?.stage || stage;
      reason = error?.reason;
      level = reason === 'draft-media-rejected' ? 'error' : 'warning';
      if (task.file?.type === 'video/mp4') {
        evidence = {fileBytes,elapsedMs:Math.max(0,Date.now() - (receivedAt ?? startedAt)),
          lastStage:handoffStage || 'draft-reserve'};
        if (uploadPercent !== undefined) evidence.uploadPercent = uploadPercent;
      }
      task.draftFailureStage = stage;
      task.draftMessage = error?.message || 'Xの下書きに添付できませんでした。完成画面から手動で添付できます。';
      if (uploadPercent !== undefined) task.draftMessage += ' 最後に確認したXのアップロード' + uploadPercent + '%（' + sizeLabel + '）。';
    } finally {
      clearTimeout(timer);
      if (abort) signal?.removeEventListener('abort',abort);
      releaseLinks();
      draft.cancel?.();
      if (retained.has(task) && task.draft === draft) {
        task.draft = null;
        touch(task);
        publish(task);
        notifyResult(task, onBackgroundFinish, task.draftMessage, level, stage, reason, evidence);
      }
    }
  }
  function discard(task = latest, message) {
    const entry = retained.get(task);
    if (!entry) return false;
    retained.delete(task);
    clearTimeout(entry.timer);
    entry.uses.clear();
    task.draft?.cancel?.();
    task.draft = null;
    task.state = 'discarded';
    delete task.file;
    if (latest === task) latest = [...pending].at(-1) || [...retained.keys()].at(-1);
    if (!retained.size) {
      window.removeEventListener('pageshow',checkExpiry);
      document.removeEventListener('visibilitychange',checkExpiry);
    }
    publish(undefined,message);
    return true;
  }
  function finishTask(task, file, error, notify) {
    if (!pending.delete(task)) return;
    if (file) {
      task.file = file;
      task.state = 'ready';
      retain(task);
    } else {
      task.state = task.controller.signal.aborted ? 'cancelled' : 'failed';
      task.clipProtected = error?.clipProtected === true;
      task.clipInputUnsupported = error?.clipInputUnsupported === true;
      const message = error?.message || '';
      task.reason = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(message) && !/https?:/i.test(message)
        ? message : '配信データまたは変換形式を確認できませんでした。';
    }
    // A fallback recording may take ownership of the draft in its listener.
    publish(task);
    if (file && task.draft) return sendDraft(task, notify);
    task.draft?.cancel?.();
    task.draft = null;
    if (task.state === 'ready') notifyResult(task, notify, 'クリップが完成しました。共有パネルから保存できます。','info','export-ready');
    else if (task.state === 'failed') notifyResult(task, notify, task.reason,'error','export-' + task.stage);
  }
  // Both conversion and MediaRecorder occupy the shared slot through draft transfer.
  function schedule(task, work, release, notify) {
    const {controller} = task;
    pending.add(task);
    const releaseLinks = keepWatchLinksInNewTabs();
    const cleanup = () => { releaseLinks(); release?.(); };
    const ticket = ShareClipQueue.enqueue({name:task.name, from:task.from, to:task.to, kind:task.kind, allowRunningCancel:true,
      async run(signal) {
        const abort = () => controller.abort();
        signal.addEventListener('abort',abort,{once:true});
        try {
          task.state = 'running';
          publish(task);
          controller.signal.throwIfAborted();
          const file = await work(controller.signal);
          controller.signal.throwIfAborted();
          await finishTask(task,file,undefined,notify);
        } catch (error) {
          finishTask(task,undefined,error,notify);
          throw error;
        } finally {
          signal.removeEventListener('abort',abort);
          cleanup();
        }
      },
      onError(error) { finishTask(task,undefined,error,notify); },
      onCancel() {
        controller.abort();
        finishTask(task,undefined,undefined,notify);
        cleanup();
      }
    });
    task.ticket = ticket;
    if (ticket.state === 'queued') publish(task);
    return task;
  }
  function start({name, shareText, from, to, hls, getBlob, renderer, prepareRenderer, comments, maxHeight, owner, onBackgroundFinish, draft,
    controller = new AbortController()}) {
    const {signal} = controller;
    const task = {name, shareText, from, to, owner, draft, lowQuality:hls?.height === 0, state:'queued',
      stage:prepareRenderer ? 'comments' : 'source', percent:null, hls:!!hls, controller, kind:'zenza'};
    function setStage(stage) {
      if (signal.aborted || task.stage === stage) return;
      task.stage = stage;
      task.percent = null;
      publish(task);
    }
    // Bind the input and comment/effect snapshot to the click, before navigation.
    // An HLS URL and its selected rendition are already captured by the caller.
    async function captureRenderer() {
      if (!prepareRenderer) return;
      const value = await prepareRenderer(signal);
      if (signal.aborted) { value?.dispose?.(); signal.throwIfAborted(); }
      renderer = value;
      if (typeof value?.drawFrame !== 'function') throw Error('選択したコメント・画面エフェクトを準備できませんでした。');
    }
    const readSource = async () => hls ? null : getBlob(signal);
    const captured = Promise.all([readSource(),captureRenderer()]);
    // Either operation may fail while the preceding clip still holds the slot.
    captured.catch(() => {});
    return schedule(task, async () => {
      const [blob] = await captured;
      signal.throwIfAborted();
      if (!hls && !(blob instanceof Blob)) throw Error('元ファイルを取得できませんでした。');
      const output = await ShareFastClip.convert({blob, hls, from, to, signal, comments, maxHeight, onStage:setStage,
        drawFrame:renderer?.drawFrame?.bind(renderer), onProgress(fraction) {
          if (!Number.isFinite(fraction)) return;
          const percent = Math.max(0,Math.min(100,Math.round(fraction * 100)));
          if (signal.aborted || percent === task.percent) return;
          task.percent = percent;
          publish(task);
        }});
      signal.throwIfAborted();
      const base = (name || 'clip').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0,100);
      const webm = String(output.type).startsWith('video/webm');
      const file = new File([output], base + '_' + from + '-' + to + (webm ? '.webm' : '.mp4'), {type:webm ? 'video/webm' : 'video/mp4'});
      setStage('checking');
      await ShareFastClip.checkOutput(file, to-from, signal);
      signal.throwIfAborted();
      return file;
    }, () => {
      controller.abort();
      renderer?.dispose?.();
      renderer = null;
    }, onBackgroundFinish);
  }
  function reserveRecording({name, shareText, from, to, owner, onCancel, onBackgroundFinish}) {
    const controller = new AbortController();
    const task = {name, shareText, from, to, owner, controller, recorded:true, kind:'recording',
      stage:'recording', percent:null, state:'queued'};
    let grant, complete;
    const started = new Promise(resolve => { grant = resolve; });
    const recording = new Promise(resolve => { complete = resolve; });
    const abortRecording = () => {
      grant(false);
      try { onCancel?.(); }
      finally { complete({}); }
    };
    controller.signal.addEventListener('abort',abortRecording,{once:true});
    schedule(task, async () => {
      grant(true);
      const {file, draft, reason} = await recording;
      task.draft = draft;
      if (!file) throw Error(reason);
      return file;
    }, () => controller.signal.removeEventListener('abort',abortRecording), onBackgroundFinish);
    function settle(result) {
      if (task.state === 'queued') {
        task.ticket.cancel();
        result.draft?.cancel?.();
      } else complete(result);
    }
    return Object.assign(settle,{started,task});
  }
  return {
    start, discard, touch, hold, reserveRecording, retentionMinutes, keepWatchLinksInNewTabs,
    // Accept an already recorded file supplied by an existing caller.
    completeRecording({name, shareText, file, owner, draft, onBackgroundFinish}) {
      const task = {name,shareText,file,owner,draft,state:'ready',recorded:true,kind:'recording'};
      retain(task);
      publish(task);
      if (draft) {
        ShareClipQueue.enqueue({name,kind:'recording',run:() => retained.has(task) && sendDraft(task,onBackgroundFinish),
          onCancel:() => { draft.cancel?.(); task.draft = null; touch(task); }});
      } else notifyResult(task,onBackgroundFinish,'クリップが完成しました。共有パネルから保存できます。');
      return true;
    },
    cancel(task = [...pending].find(value => value.state === 'running') || [...pending][0]) {
      if (!task || !pending.has(task)) return false;
      if (task.ticket) return task.ticket.cancel();
      task.controller.abort();
      return true;
    },
    get busy() { return pending.size > 0; },
    get tasks() { return [...pending]; },
    get results() { return [...retained.keys()]; },
    subscribe(listener) {
      checkExpiry();
      listeners.add(listener);
      if (latest) listener(latest);
      return () => listeners.delete(listener);
    }
  };
})();
//===END===
export {ShareClipJobs};
