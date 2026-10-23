// GENERATED FROM tools/typescript-stage1/nico-src/sleep.ts (Task726). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/**
 * Canonical TypeScript source for packages/lib/src/infra/sleep.js (Task726).
 * Promise based waits.
 * SLEEP-IDLE-001 (Task787): `sleep.idle` used to be the factory itself, so
 * `await sleep.idle()` resolved to a function without waiting. It is now the waiting
 * function (as every caller and test stub assumes). The idle wait is capped at
 * IDLE_TIMEOUT ms so start-up never stalls while the page is busy (video decoding).
 */
const sleep = Object.assign(function (time = 0) {
    return new Promise(res => setTimeout(res, time));
}, {
    idle: (() => {
        const IDLE_TIMEOUT = 100;
        if (window.requestIdleCallback) {
            return () => new Promise(res => requestIdleCallback(res, { timeout: IDLE_TIMEOUT }));
        }
        return () => new Promise(res => setTimeout(res, 0));
    })(),
    raf: () => new Promise(res => requestAnimationFrame(res)),
    promise: () => Promise.resolve(),
    resolve: Promise.resolve()
});
//===END===
export {
  sleep
};
