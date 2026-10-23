// GENERATED FROM tools/typescript-stage1/nico-src/watchResize.ts (Task785). Edit the .ts and run npm run nico:sync.
//===BEGIN===
/**
 * Canonical TypeScript source for packages/lib/src/dom/watchResize.js (Task785).
 * Calls `callback` when `target` is resized (ResizeObserver, or a hidden iframe's
 * resize event on old browsers).
 */
const watchResize = (target, callback) => {
    if (window.ResizeObserver) {
        const ro = new window.ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === target) {
                    callback();
                    return;
                }
            }
        });
        ro.observe(target);
        return;
    }
    const iframe = document.createElement('iframe');
    iframe.loading = 'eager';
    iframe.className = 'resizeObserver';
    Object.assign(iframe.style, {
        width: '100%',
        height: '100%',
        position: 'absolute',
        pointerEvents: 'none',
        border: 0,
        //transform: 'translate3d(0, 0, 0)',
        opacity: 0
    });
    target.parentElement.append(iframe);
    iframe.contentWindow.addEventListener('resize', () => {
        callback();
    });
};
//===END===
export {
  watchResize
};
