import {NotificationJournal} from './NotificationJournal';
//===BEGIN===
//@require NotificationJournal
const PlaybackStartupTrace = (() => {
  const nico = 'tools/typescript-stage1/nico-src/';
  const media = 'tools/typescript-stage1/hls-src/HlsVideoElement.ts';
  // Only these public identifiers may be copied into a repair report.
  const stages = new Map([
    ['open', ['再生操作の受付', nico + 'HoverMenu.ts']],
    ['player', ['プレイヤーの準備', nico + 'initializer.ts']],
    ['dialog', ['再生画面の準備', nico + 'NicoVideoPlayerDialogView.ts']],
    ['watch', ['視聴ページの動画データ取得', nico + 'VideoInfoLoader.ts']],
    ['info', ['補助情報・動画情報の確定', nico + 'VideoInfoLoader.ts']],
    ['session', ['再生セッションの作成', nico + 'VideoSessionWorker.ts']],
    ['delivery', ['配信許可・配信URLの取得', nico + 'VideoSessionWorker.ts']],
    ['source', ['映像ソースの設定', nico + 'NicoVideoPlayer.ts']],
    ['manifest', ['HLS配信リストの解析', media]],
    ['metadata', ['映像メタデータの受信', media]],
    ['frame', ['最初の映像フレームの表示', media]],
    ['decoded', ['最初の映像データのデコード', media]],
    ['play', ['ブラウザでの再生開始', nico + 'NicoVideoPlayer.ts']]
  ]);
  const next = {
    info: 'session', session: 'delivery', delivery: 'source',
    source: 'metadata', manifest: 'metadata', metadata: 'frame'
  };
  const waitMs = 15000;
  const describe = id => {
    const row = stages.get(id);
    if (row) return {label:row[0],file:row[1]};
  };
  const pending = new WeakMap();
  let sequence = 0;
  function create() {
    const started = Date.now(), key = 'diag-startup-' + started.toString(36) + '-' + (++sequence).toString(36);
    let last = 'open', waiting = 'player', timer, removeMedia, closed = false, reported = false;
    let pageReceived = false, previousWait;
    const details = () => ({lastStage:last, nextStage:waiting, elapsedMs:Math.max(0,Date.now()-started)});
    const write = (reason, outcome, recoveryMessage = '最初の映像を確認しました') => {
      const checkpoint = outcome === 'recovered' ? previousWait : details();
      if (outcome !== 'recovered') previousWait = checkpoint;
      try {
        NotificationJournal.recordDiagnostic(key,{category:'player',source:'playback-start',level:
          outcome === 'recovered' ? 'success' : reason === 'startup-wait' ? 'warning' : 'error',
          message:outcome === 'recovered' ? recoveryMessage :
            '再生開始の修復レポート：' + describe(waiting).label,
          details:{operation:'playback-start',phase:'startup',reason,outcome,...checkpoint}});
      } catch (_) { /* Diagnostics must not affect the player. */ }
    };
    const onWait = () => {
      if (closed) return;
      if (document.hidden) {
        document.addEventListener('visibilitychange', onVisible);
        return;
      }
      reported = true;
      write('startup-wait','failed');
    };
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(onWait, waitMs);
    };
    const onVisible = () => {
      if (document.hidden) return;
      document.removeEventListener('visibilitychange', onVisible);
      arm();
    };
    const cancel = () => {
      closed = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange',onVisible);
      removeMedia?.();
      removeMedia = undefined;
    };
    const mark = stage => {
      if (closed || !stages.has(stage)) return;
      if (stage === 'frame' || stage === 'decoded') {
        // Preserve the failed checkpoint in the journal's recovery entry.
        if (reported) write('startup-wait','recovered');
        cancel();
        return;
      }
      if (stage === 'watch') {
        if (pageReceived || !['player','dialog','watch'].includes(waiting)) return;
        pageReceived = true;
        if (waiting === 'watch') waiting = 'info';
      } else if (stage === 'player') waiting = 'dialog';
      else if (stage === 'dialog') waiting = pageReceived ? 'info' : 'watch';
      else if (stage === 'manifest' && waiting !== 'manifest') return;
      else if (stage === 'metadata' && !['manifest','metadata'].includes(waiting)) return;
      else waiting = next[stage] || waiting;
      last = stage;
      if (reported) arm();
    };
    const fail = (reason = 'startup-error', at) => {
      if (closed) return;
      if (stages.has(at)) waiting = at;
      const checkpoint = details();
      write(reason,'failed');
      cancel();
      return {...checkpoint, phase:'startup', reason};
    };
    const observeMedia = (wrapper, expectPlayback = true) => {
      if (closed || !wrapper) return;
      removeMedia?.();
      mark('source');
      if (wrapper.playerMode === 'HLS-JS') waiting = 'manifest';
      const video = wrapper.drawableElement || wrapper;
      if (typeof video.addEventListener !== 'function') return;
      let frame;
      let canObserveFrame = typeof video.requestVideoFrameCallback === 'function';
      const metadata = () => {
        if (video.readyState < 1) return;
        mark('metadata');
        if (!expectPlayback && video.paused) {
          if (reported) write('startup-wait', 'recovered', '動画の準備ができました（手動再生待ち）');
          cancel();
        }
      };
      const decoded = () => {
        if (!canObserveFrame && video.readyState >= 2 && video.videoWidth > 0) mark('decoded');
      };
      const readiness = event => {if (event.detail?.stage === 'manifestReady') mark('manifest');};
      wrapper.addEventListener('zenza-readiness',readiness);
      video.addEventListener('loadedmetadata',metadata);
      video.addEventListener('loadeddata',decoded);
      removeMedia = () => {
        wrapper.removeEventListener('zenza-readiness',readiness);
        video.removeEventListener('loadedmetadata',metadata);
        video.removeEventListener('loadeddata',decoded);
        if (frame !== undefined) video.cancelVideoFrameCallback?.(frame);
      };
      if (canObserveFrame) {
        try { frame = video.requestVideoFrameCallback(() => mark('frame')); }
        catch (_) { canObserveFrame = false; }
      }
    };
    arm();
    return {mark,fail,cancel,observeMedia};
  }
  const reserve = intent => {
    pending.get(intent)?.cancel();
    const trace = create();
    pending.set(intent, trace);
    return trace;
  };
  const abandon = (intent, failed = false) => {
    const trace=pending.get(intent);
    pending.delete(intent);
    if (failed) trace?.fail(); else trace?.cancel();
  };
  const adopt = intent => {
    const trace=pending.get(intent) || create();
    pending.delete(intent);
    trace.mark('player');
    return trace;
  };
  return {reserve,adopt,abandon,describe};
})();
//===END===
export {PlaybackStartupTrace};
