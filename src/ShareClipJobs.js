import {ShareFastClip} from './ShareFastClip';
//===BEGIN===
//@require ShareFastClip
// The page owns the encoder. Editors subscribe only while mounted.
const ShareClipJobs = (() => {
  const listeners = new Set();
  const retentionMinutes = 5;
  const uses = new Set();
  let latest, expiresAt, expiryTimer;
  function publish(message) {
    for (const listener of listeners) {
      try {
        listener(latest,message);
      } catch (error) {
        // Keep the encoder and draft transfer independent of a broken editor view.
        if (typeof window.reportError === 'function') window.reportError(error);
        else queueMicrotask(() => { throw error; });
      }
    }
  }
  function checkExpiry() {
    clearTimeout(expiryTimer);
    if (latest?.state !== 'ready' || latest.draft || uses.size) return;
    const remaining = expiresAt - Date.now();
    if (remaining > 0) expiryTimer = setTimeout(checkExpiry,remaining);
    else discard(latest,'完成動画の保管期限が過ぎたため、タブのメモリから削除しました。');
  }
  function touch(task) {
    if (!task || task !== latest || task.state !== 'ready') return;
    expiresAt = Date.now() + retentionMinutes * 60000;
    document.addEventListener('visibilitychange',checkExpiry);
    window.addEventListener('pageshow',checkExpiry);
    checkExpiry();
  }
  // Playback or an open system share sheet can legitimately outlast the idle interval.
  function hold(task) {
    if (!task || task !== latest || task.state !== 'ready') return () => {};
    const use = Symbol();
    uses.add(use);
    touch(task);
    return () => { if (uses.delete(use)) touch(task); };
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
  async function checkOutput(file, duration, signal) {
    const probe = document.createElement('video');
    const url = URL.createObjectURL(file);
    let timer, stop;
    try {
      await new Promise((resolve, reject) => {
        const fail = () => reject(new Error('作成したMP4の映像と長さを確認できませんでした。'));
        stop = () => reject(signal.reason);
        timer = setTimeout(fail, 15000);
        probe.onloadedmetadata = () => {
          if (probe.videoWidth && Number.isFinite(probe.duration) && Math.abs(probe.duration-duration) <= 0.15) resolve();
          else fail();
        };
        probe.onerror = fail;
        signal.addEventListener('abort', stop, {once:true});
        probe.preload = 'metadata';
        probe.src = url;
      });
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
      probe.onerror = probe.onloadedmetadata = null;
      probe.removeAttribute('src');
      probe.load();
      URL.revokeObjectURL(url);
    }
  }
  async function sendDraft(task, onBackgroundFinish) {
    const draft = task.draft;
    if (!draft) return;
    const releaseLinks = keepWatchLinksInNewTabs();
    task.draftMessage = 'Xの下書きに動画を添付しています…';
    publish();
    try {
      if (task.file.type !== 'video/mp4') throw Error('WebMで完成しました。完成画面で共有方法を選んでください。');
      await draft.complete(task.file, task.shareText || task.name || '');
      task.draftMessage = 'Xの下書きに動画を添付しました。内容を確認して投稿してください。';
    } catch (error) {
      task.draftMessage = error?.message || 'Xの下書きに添付できませんでした。完成画面から手動で添付できます。';
    } finally {
      releaseLinks();
      draft.cancel?.();
      if (latest === task && task.draft === draft) {
        task.draft = null;
        touch(task);
        publish();
        if (!listeners.size) onBackgroundFinish?.(task.draftMessage);
      }
    }
  }
  function discard(task = latest, message) {
    if (!task || task !== latest || task.state !== 'ready') return false;
    task.draft?.cancel?.();
    task.draft = null;
    delete task.file;
    latest = undefined;
    clearTimeout(expiryTimer);
    uses.clear();
    window.removeEventListener('pageshow',checkExpiry);
    document.removeEventListener('visibilitychange',checkExpiry);
    publish(message);
    return true;
  }
  function start({name, shareText, from, to, hls, getBlob, renderer, comments, maxHeight, owner, onBackgroundFinish, draft}) {
    if (latest?.state === 'running') throw Error('クリップを作成中です。');
    if (latest?.state === 'ready') discard();
    const controller = new AbortController();
    const {signal} = controller;
    const task = latest = {name, shareText, from, to, owner, draft, lowQuality:hls?.height === 0, state:'running', stage:'source', percent:null, hls:!!hls, controller};
    publish();
    const releaseLinks = keepWatchLinksInNewTabs();
    function setStage(stage) {
      if (signal.aborted || task.stage === stage) return;
      task.stage = stage;
      task.percent = null;
      publish();
    }
    async function run() {
      try {
        const blob = hls ? null : await getBlob(signal);
        signal.throwIfAborted();
        if (!hls && !(blob instanceof Blob)) throw Error('元ファイルを取得できませんでした。');
        const output = await ShareFastClip.convert({blob, hls, from, to, signal, comments, maxHeight, onStage:setStage,
          drawFrame:renderer?.drawFrame?.bind(renderer), onProgress(fraction) {
            if (!Number.isFinite(fraction)) return;
            const percent = Math.max(0,Math.min(100,Math.round(fraction * 100)));
            if (signal.aborted || percent === task.percent) return;
            task.percent = percent;
            publish();
          }});
        signal.throwIfAborted();
        const base = (name || 'clip').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0,100);
        const webm = String(output.type).startsWith('video/webm');
        const file = new File([output], base + '_' + from + '-' + to + (webm ? '.webm' : '.mp4'), {type:webm ? 'video/webm' : 'video/mp4'});
        setStage('checking');
        await checkOutput(file, to-from, signal);
        signal.throwIfAborted();
        task.file = file;
        task.state = 'ready';
      } catch (error) {
        task.state = signal.aborted ? 'cancelled' : 'failed';
        task.clipProtected = error?.clipProtected === true;
        task.clipInputUnsupported = error?.clipInputUnsupported === true;
        // Library errors can include signed media URLs. Show only our own Japanese descriptions.
        task.reason = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(error.message) &&
          !/https?:/i.test(error.message) ? error.message : '配信データまたは変換形式を確認できませんでした。';
      } finally {
        releaseLinks();
        renderer?.dispose?.();
        if (latest === task) {
          touch(task);
          publish();
          if (task.state === 'ready' && task.draft) {
            void sendDraft(task, onBackgroundFinish);
          } else {
            task.draft?.cancel?.();
            task.draft = null;
            if (!listeners.size && task.state !== 'cancelled') onBackgroundFinish?.(task.state === 'ready'
              ? 'クリップが完成しました。共有パネルから保存できます。'
              : 'クリップを作成できませんでした。共有パネルで詳細を確認できます。');
          }
        }
      }
    }
    run();
    return task;
  }
  return {
    start, discard, touch, hold, retentionMinutes,
    reserveRecording({name, shareText, from, to, owner, onCancel, onBackgroundFinish}) {
      if (latest?.state === 'running') throw Error('クリップを作成中です。');
      const controller = new AbortController();
      const task = latest = {name, shareText, from, to, owner, controller, recorded:true, stage:'recording', percent:null, state:'running'};
      controller.signal.addEventListener('abort', onCancel, {once:true});
      publish();
      return ({file, draft, reason}) => {
        if (latest !== task || task.state !== 'running') return;
        controller.signal.removeEventListener('abort', onCancel);
        task.state = file ? 'ready' : controller.signal.aborted ? 'cancelled' : 'failed';
        Object.assign(task, {file, draft, reason});
        touch(task);
        publish();
        if (file && draft) void sendDraft(task, onBackgroundFinish);
        else if (!listeners.size && task.state !== 'cancelled') onBackgroundFinish?.(file
          ? 'クリップが完成しました。共有パネルから保存できます。' : reason);
      };
    },
    completeRecording({name, shareText, file, owner, draft, onBackgroundFinish}) {
      if (latest?.state === 'running') {
        draft?.cancel?.();
        return false;
      }
      if (latest?.state === 'ready') discard();
      latest = {name, shareText, file, owner, draft, state:'ready', recorded:true};
      touch(latest);
      publish();
      if (draft) void sendDraft(latest, onBackgroundFinish);
      return true;
    },
    cancel() { if (latest?.state === 'running') latest.controller.abort(); },
    get busy() { return latest?.state === 'running'; },
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
