import {NotificationJournal} from './NotificationJournal';
//===BEGIN===
//@require NotificationJournal
const PlaybackInterruptionTrace = (() => {
  const waitMs = 15000;
  let sequence = 0;

  // HlsVideoElement reports its own fatal errors on the wrapper. Only compare
  // known codes and detail strings here; the underlying message may contain a URL.
  function classifyError(error, dataStage) {
    switch (error?.code) {
      case 2: return {reason:'media-network', stage:dataStage};
      case 3: return {reason:'media-decode', stage:'decode'};
      case 4: return {reason:'media-format', stage:'decode'};
      case 1002:
        switch (error.message) {
          case 'HLS playback could not be started': return {reason:'hls-library', stage:'hls-library'};
          case 'manifestLoadError':
          case 'manifestLoadTimeOut': return {reason:'hls-manifest', stage:'manifest'};
          case 'fragLoadError':
          case 'fragLoadTimeOut': return {reason:'hls-fragment', stage:'hls-buffer'};
          default: return {reason:'hls-network', stage:dataStage};
        }
      case 1003: return {reason:'hls-decode', stage:'hls-decode'};
      case 1004: return {reason:'hls-error', stage:'hls-process'};
    }
  }

  function observe(wrapper) {
    const video = wrapper.drawableElement || wrapper;
    let observedPlaying = false, progressed = false;
    let previousTime = video.currentTime, wait, timer;

    const playable = () => !video.paused && !video.ended && !video.seeking && video.playbackRate !== 0;
    const dataStage = () => /^HLS-/.test(wrapper.playerMode || '') ? 'hls-buffer' : 'media-buffer';
    const waitingStage = () => {
      const position = video.currentTime, ranges = video.buffered;
      for (let i = 0; i < ranges.length; i++) {
        if (ranges.start(i) <= position && ranges.end(i) > position + 0.25) return 'advance';
      }
      return dataStage();
    };
    const begin = () => {
      const started = Date.now();
      return {started, position:video.currentTime,
        key:'diag-interruption-' + started.toString(36) + '-' + (++sequence).toString(36)};
    };
    const record = (reason, stage, outcome) => {
      const recovered = outcome === 'recovered';
      if (!recovered) wait.details = {operation:'playback-interruption',phase:'playback',reason,
        lastStage:'progress',nextStage:stage,elapsedMs:Math.max(0, Date.now() - wait.started)};
      try {
        NotificationJournal.recordDiagnostic(wait.key, {
          category:'player',source:'playback-interruption',
          level:recovered ? 'success' : reason === 'playback-wait' ? 'warning' : 'error',
          message:recovered ? '動画の再生時刻が再び進みました' : '再生途中の修復レポート',
          details:{...wait.details,outcome}
        });
      } catch (_) { /* Diagnostics must not interrupt playback. */ }
    };
    const clearWait = () => {
      clearTimeout(timer);
      timer = undefined;
      wait = undefined;
    };
    const resume = () => {
      if (wait?.details) record(wait.details.reason, wait.details.nextStage, 'recovered');
      clearWait();
    };
    const onTimeout = () => {
      timer = undefined;
      if (!wait || document.hidden || !playable()) return;
      if (video.currentTime > wait.position) { resume(); return; }
      record('playback-wait', waitingStage(), 'failed');
    };
    const onWaiting = () => {
      if (!progressed || !observedPlaying || !playable() || wait) return;
      wait = begin();
      if (!document.hidden) timer = setTimeout(onTimeout, waitMs);
    };
    const onTime = () => {
      if (!observedPlaying || !playable()) return;
      const current = video.currentTime;
      if (current > previousTime) {
        progressed = true;
        if (wait && current > wait.position) resume();
      }
      previousTime = current;
    };
    const onPlaying = () => {
      if (!observedPlaying) previousTime = video.currentTime;
      observedPlaying = true;
    };
    const onPause = () => {
      clearWait();
      observedPlaying = false;
    };
    const onReset = () => {
      onPause();
      progressed = false;
      previousTime = video.currentTime;
    };
    const onVisibility = () => {
      if (!wait || wait.details) return;
      clearTimeout(timer);
      if (document.hidden) return;
      wait.started = Date.now();
      wait.position = video.currentTime;
      timer = setTimeout(onTimeout, waitMs);
    };
    const onError = event => {
      if (!progressed) return;
      const failure = classifyError(event.currentTarget.error, dataStage());
      if (!failure || wait?.details?.reason === failure.reason) return;
      clearTimeout(timer);
      wait = wait || begin();
      record(failure.reason, failure.stage, 'failed');
    };
    const events = {playing:onPlaying,timeupdate:onTime,waiting:onWaiting,stalled:onWaiting,
      pause:onPause,seeking:onReset,seeked:() => { if (playable()) onPlaying(); },
      ended:onReset,emptied:onReset,error:onError};
    for (const [event, handler] of Object.entries(events)) video.addEventListener(event, handler);
    if (wrapper !== video) wrapper.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      onReset();
      for (const [event, handler] of Object.entries(events)) video.removeEventListener(event, handler);
      if (wrapper !== video) wrapper.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }
  return {observe, classifyError};
})();
//===END===
export {PlaybackInterruptionTrace};
