/**
 * Canonical TypeScript source for packages/zenza/src/videoPlayer/createVideoElement.js (Task851).
 */
/** ZenzaHLS (optional userscript) or the debug hook may supply the element. */
type VideoFactory = (...args: unknown[]) => HTMLVideoElement;
/** Module-local view of window with the optional ZenzaHLS hook (no runtime output). */
declare const window: Window & typeof globalThis & {ZenzaHLS?: {createVideoElement?: VideoFactory}};
declare const ZenzaWatch: {debug: {createVideoElement?: VideoFactory}};

const createVideoElement = (...args: unknown[]): HTMLVideoElement => {
  if (window.ZenzaHLS && window.ZenzaHLS.createVideoElement) {
    return window.ZenzaHLS.createVideoElement(...args);
  } else
  if (ZenzaWatch.debug.createVideoElement) {
    return ZenzaWatch.debug.createVideoElement!(...args);
  }
  return document.createElement('video');
};

export {createVideoElement};
