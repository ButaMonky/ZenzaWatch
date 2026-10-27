/**
 * Canonical TypeScript source for packages/lib/src/infra/sleep.js (Task726).
 * Promise based waits.
 * SLEEP-IDLE-001 (Task787): `sleep.idle` used to be the factory itself, so
 * `await sleep.idle()` resolved to a function without waiting. It is now the waiting
 * function (as every caller and test stub assumes). The idle wait is capped at
 * IDLE_TIMEOUT ms so start-up never stalls while the page is busy (video decoding).
 */
const sleep = Object.assign(function (time = 0): Promise<void> {
  return new Promise<void>(res => setTimeout(res, time));
}, {
  idle: ((): (() => Promise<unknown>) => {
    const IDLE_TIMEOUT = 100;
    if ((window as Partial<Window>).requestIdleCallback) {
      return () => new Promise(res => requestIdleCallback(res, {timeout: IDLE_TIMEOUT}));
    }
    return () => new Promise(res => setTimeout(res, 0));
  })(),
  raf: (): Promise<number> => new Promise(res => requestAnimationFrame(res)),
  promise: (): Promise<void> => Promise.resolve(),
  resolve: Promise.resolve()
});

export {sleep};
