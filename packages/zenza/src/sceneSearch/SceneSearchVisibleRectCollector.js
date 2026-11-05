// GENERATED FROM tools/typescript-stage1/nico-src/SceneSearchVisibleRectCollector.ts
//===BEGIN===
class SceneSearchVisibleRectCollector {
    /** Read-only bridge seek geometry, with the old unclipped UI01 contract. */
    static seekGeometry({ seekElement, container, document, pointerClientX = null, unclipped = false }) {
        const seek = seekElement.getBoundingClientRect?.();
        const frame = container.getBoundingClientRect?.();
        if (!seek || !frame || !Number.isFinite(seek.left) ||
            !Number.isFinite(seek.width) || seek.width <= 0 ||
            !Number.isFinite(frame.left) || !Number.isFinite(frame.width) ||
            frame.width <= 0) {
            return null;
        }
        const width = container.offsetWidth || frame.width;
        const scale = width / frame.width;
        const viewportWidth = document.defaultView?.innerWidth;
        // UI01 alone uses unclipped screen bounds for a full-width seekRange.
        // Layouts 02..10 retain their old video-box clamps.
        const visibleLeft = Number.isFinite(viewportWidth) ?
            (unclipped ? -frame.left * scale : Math.max(0, -frame.left * scale)) : 0;
        const visibleRight = Number.isFinite(viewportWidth) ?
            (unclipped ? (viewportWidth - frame.left) * scale :
                Math.min(width, (viewportWidth - frame.left) * scale)) : width;
        return {
            seekLeft: (seek.left - frame.left) * scale,
            seekWidth: seek.width * scale,
            pointerX: Number.isFinite(pointerClientX) ?
                (pointerClientX - frame.left) * scale : null,
            visibleLeft, visibleRight
        };
    }
    static collect({ root = null, comment = null, twin = null, document }) {
        const nodes = [
            root,
            root?.querySelector('.zenzaSceneActions'),
            root?.querySelector('.zenzaSceneRemoteControls'),
            comment, twin
        ].filter((node) => Boolean(node));
        const regions = [];
        for (const node of new Set(nodes)) {
            if (node.hidden || node.closest('[hidden],.is-idle-suppressed'))
                continue;
            if (node.classList.contains('zenzaSceneCommentAttached') &&
                !node.classList.contains('is-scui-active'))
                continue;
            const css = document?.defaultView?.getComputedStyle?.(node);
            if (css && (css.display === 'none' || css.visibility === 'hidden' || css.opacity === '0'))
                continue;
            const rect = node.getBoundingClientRect?.();
            if (rect?.width > 0 && rect.height > 0)
                regions.push(rect);
        }
        return regions;
    }
}
//===END===
export {SceneSearchVisibleRectCollector};
