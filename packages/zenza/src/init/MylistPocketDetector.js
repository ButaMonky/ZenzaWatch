// GENERATED FROM tools/typescript-stage1/nico-src/MylistPocketDetector.ts (Task851). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const MylistPocketDetector = (() => {
    const promise = (window.MylistPocket && window.MylistPocket.isReady) ?
        Promise.resolve(window.MylistPocket) :
        new Promise(resolve => {
            [window, (document.body || document.documentElement)]
                .forEach(e => e.addEventListener('MylistPocketInitialized', () => {
                resolve(window.MylistPocket);
            }, { once: true }));
        });
    return { detect: () => promise };
})();
//===END===
export {MylistPocketDetector};
