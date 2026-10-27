/**
 * Canonical TypeScript source for packages/zenza/src/init/MylistPocketDetector.js (Task851).
 */
/** MylistPocket (a separate userscript) announces itself on window. */
declare const window: Window & typeof globalThis & {MylistPocket?: {isReady?: boolean}};

const MylistPocketDetector = (() => {
  const promise =
  (window.MylistPocket && window.MylistPocket.isReady) ?
    Promise.resolve(window.MylistPocket) :
    new Promise<unknown>(resolve => {
      ([window, (document.body || document.documentElement)] as EventTarget[])
        .forEach(e => e.addEventListener('MylistPocketInitialized', () => {
          resolve(window.MylistPocket);
        }, {once: true}));
    });
  return {detect: () => promise};
})();

export {MylistPocketDetector};
