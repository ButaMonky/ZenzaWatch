'use strict';

// Only the ordinary page-realm injection uses this scheduler. Gate frames and the
// external player have separate boot protocols and run as soon as the host loads.
function startOrdinaryRuntime(w, start) {
  const doc = w.document;
  const paint = 'first-contentful-paint';
  if (w !== w.top || w.location.hostname !== 'www.nicovideo.jp' || w.name ||
      doc.visibilityState !== 'visible' || !w.PerformanceObserver?.supportedEntryTypes?.includes('paint')) {
    start();
    return;
  }
  let immediate = true;
  try {
    const setting = key => w.localStorage.getItem('ZenzaWatch_' + key);
    // Match Config's mobile default for link interception. Invalid or inaccessible storage starts immediately.
    const links = setting('overrideWatchLink');
    immediate = JSON.parse(setting('overrideGinza')) ||
        (links === null ? /(Android|iPad;|CriOS)/i.test(w.navigator.userAgent) : JSON.parse(links)) ||
        w.sessionStorage.getItem('ZenzaWatch_PlayingStatus') !== null ||
        w.location.hash || (/^\/(watch|shorts)\//.test(w.location.pathname) && w.location.search) ||
        [...new URLSearchParams(w.location.search).keys()].some(key => /^(zenza|playlist|continuous|shuffle)/i.test(key)) ||
        w.performance.getEntriesByName(paint, 'paint').length > 0;
  } catch (_) { /* Leave startup immediate when the platform cannot be inspected. */ }
  if (immediate) {
    start();
    return;
  }

  let started = false, observer;
  const inputs = ['pointerdown', 'pointermove', 'keydown', 'click', 'touchstart', 'wheel'];
  const launch = () => {
    if (started) return;
    started = true;
    w.clearTimeout(timer);
    observer?.disconnect();
    doc.removeEventListener('visibilitychange', launch);
    for (const type of inputs) w.removeEventListener(type, launch, true);
    start();
  };
  const timer = w.setTimeout(launch, 1200);
  doc.addEventListener('visibilitychange', launch);
  for (const type of inputs) w.addEventListener(type, launch, {capture:true, passive:true});
  try {
    observer = new w.PerformanceObserver(list => {
      if (list.getEntriesByName(paint).length) launch();
    });
    observer.observe({type:'paint', buffered:true});
  } catch (_) { launch(); }
}

module.exports = {startOrdinaryRuntime};
