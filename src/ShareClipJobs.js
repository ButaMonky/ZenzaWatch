import {ShareFastClip} from './ShareFastClip';
//===BEGIN===
//@require ShareFastClip
// The page owns the encoder. Editors subscribe only while mounted.
const ShareClipJobs = (() => {
  const listeners = new Set();
  let latest;
  function publish() {
    for (const listener of listeners) listener(latest);
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
  function start({name, shareText, from, to, hls, getBlob, renderer, comments, maxHeight, owner, onBackgroundFinish}) {
    if (latest?.state === 'running') throw Error('クリップを作成中です。');
    const controller = new AbortController();
    const {signal} = controller;
    const task = latest = {name, shareText, from, to, owner, state:'running', stage:'source', percent:null, hls:!!hls, controller};
    publish();
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
        const file = new File([output], base + '_' + from + '-' + to + '.mp4', {type:'video/mp4'});
        setStage('checking');
        await checkOutput(file, to-from, signal);
        signal.throwIfAborted();
        task.file = file;
        task.state = 'ready';
      } catch (error) {
        task.state = signal.aborted ? 'cancelled' : 'failed';
        // Library errors can include signed media URLs. Show only our own Japanese descriptions.
        task.reason = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(error.message) &&
          !/https?:/i.test(error.message) ? error.message : '配信データまたは変換形式を確認できませんでした。';
      } finally {
        renderer?.dispose?.();
        if (latest === task) {
          publish();
          if (!listeners.size && task.state !== 'cancelled') onBackgroundFinish?.(task.state === 'ready'
            ? 'クリップが完成しました。共有パネルから保存できます。'
            : 'クリップを作成できませんでした。共有パネルで詳細を確認できます。');
        }
      }
    }
    run();
    return task;
  }
  return {
    start,
    cancel() { if (latest?.state === 'running') latest.controller.abort(); },
    get busy() { return latest?.state === 'running'; },
    subscribe(listener) {
      listeners.add(listener);
      if (latest) listener(latest);
      return () => listeners.delete(listener);
    }
  };
})();
//===END===
export {ShareClipJobs};
