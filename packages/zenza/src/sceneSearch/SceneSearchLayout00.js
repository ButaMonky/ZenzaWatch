// GENERATED FROM tools/typescript-stage1/nico-src/SceneSearchLayout00.ts
//===BEGIN===
class SceneSearchLayout00 {
    document;
    container;
    settings;
    mode;
    root = null;
    tooltip = null;
    comment = null;
    seekOwner = null;
    track = null;
    style = null;
    onMove = null;
    currentClientX = null;
    listMode = false;
    geometry = null;
    onResize = null;
    lastImage = null;
    constructor({ document, container, mode = 'normal', settings = {} }) {
        this.document = document;
        this.container = container;
        this.mode = mode;
        this.settings = settings;
    }
    mount(state) {
        const tooltip = this.settings.getLegacyTooltip?.() || null;
        const comment = this.settings.getLegacyComment?.() || null;
        const seekOwner = this.settings.getSeekBarContainer?.() || null;
        const thumb = tooltip?.querySelector('.seekBarThumbnailContainer');
        if (!tooltip || !comment || !seekOwner || !thumb ||
            !seekOwner.contains(tooltip) || comment.parentNode !== seekOwner) {
            throw new Error('Native legacy tooltip/comment seekbar owners missing');
        }
        this.tooltip = tooltip;
        this.comment = comment;
        this.seekOwner = seekOwner;
        this.track = seekOwner.querySelector('.seekRange') || seekOwner;
        this.root = tooltip;
        this.container.classList.add('is-scui00-active');
        tooltip.classList.add('is-scui00-root');
        const style = this.document.createElement('style');
        style.dataset.scui00Style = '1';
        style.textContent = SceneSearchLayout00.CSS;
        this.document.head.appendChild(style);
        this.style = style;
        this.onMove = event => this.followPointer(event.clientX);
        this.track.addEventListener('mousemove', this.onMove, true);
        this.onResize = () => {
            this.geometry = null;
            this.lastImage = null;
            this.syncMiniGeometry();
            if (this.currentClientX !== null)
                this.followPointer(this.currentClientX);
        };
        this.document.defaultView?.addEventListener('resize', this.onResize);
        this.syncMiniGeometry();
        this.render(state);
    }
    render(state) {
        // Native VideoControlBar toggles enableCommentPreview on its seekbar and
        // the original CommentPreviewView switches CSS + row behavior.
        // Never move, recreate, or independently toggle the original elements.
        const mode = state?.commentListMode === true;
        const changed = mode !== this.listMode;
        this.listMode = mode;
        // Presentation-only. The VideoControlBar owns the data and the hover/list
        // selector; never reparent comments, toggle enableCommentPreview or change
        // the separate master sceneSearch.commentPreviewVisible setting.
        const mini = this.settings.getMiniCommentMode?.() || 'flow';
        this.container.classList.toggle('is-scui00-mini-static', mini === 'static');
        this.container.classList.toggle('is-scui00-mini-hidden', mini === 'hidden');
        // Unlike modern cards, UI00 reuses the native tooltip and sibling comment
        // view. The native seek:hover CSS ignores controller.shown; suppress both
        // siblings explicitly until the shared idle limiter resumes the preview.
        this.container.classList.toggle('is-scui00-inactive', state?.shown === false);
        const image = this.tooltip?.querySelector('.zenzaSeekThumbnail.is-visible .zenzaSeekThumbnail-image') || null;
        if (image !== this.lastImage)
            this.syncMiniGeometry();
        if (changed && this.currentClientX !== null)
            this.followPointer(this.currentClientX);
    }
    syncMiniGeometry() {
        const seek = this.seekOwner, tip = this.tooltip;
        if (!seek || !tip)
            return;
        const image = tip.querySelector('.zenzaSeekThumbnail.is-visible .zenzaSeekThumbnail-image');
        this.lastImage = image;
        if (!image) {
            seek.style.removeProperty('--scui00-mini-bottom');
            return;
        }
        const origin = seek.getBoundingClientRect(), rect = image.getBoundingClientRect();
        const scale = origin.width / (seek.offsetWidth || origin.width);
        if (!Number.isFinite(scale) || scale <= 0 || rect.height <= 0)
            return;
        const bottom = (origin.bottom - rect.bottom) / scale;
        if (Number.isFinite(bottom)) {
            seek.style.setProperty('--scui00-mini-bottom', Math.round(bottom) + 'px');
        }
    }
    followPointer(clientX) {
        if (!Number.isFinite(clientX))
            return;
        const seek = this.seekOwner, track = this.track, tip = this.tooltip, comment = this.comment;
        const win = this.document.defaultView;
        if (!seek || !track || !tip || !comment || !win)
            return;
        let g = this.geometry;
        if (!g) {
            const origin = seek.getBoundingClientRect();
            const range = track.getBoundingClientRect();
            const scale = origin.width / (seek.offsetWidth || origin.width);
            const viewportWidth = win.innerWidth;
            if (!range.width || !Number.isFinite(scale) || scale <= 0 ||
                !Number.isFinite(viewportWidth) || viewportWidth <= 0)
                return;
            const leftScreen = Math.max(0, range.left);
            const rightScreen = Math.min(viewportWidth, range.right);
            if (rightScreen <= leftScreen)
                return;
            g = this.geometry = {
                originLeft: origin.left, scale, viewportWidth,
                visibleLeft: (leftScreen - origin.left) / scale,
                visibleRight: (rightScreen - origin.left) / scale,
                tooltipWidth: tip.offsetWidth || 180
            };
        }
        this.currentClientX = clientX;
        const { visibleLeft, visibleRight, viewportWidth } = g;
        const pointer = (clientX - g.originLeft) / g.scale;
        const place = (width) => {
            const v = visibleRight - visibleLeft;
            return Math.round(v >= width ?
                Math.max(visibleLeft, Math.min(pointer - width / 2, visibleRight - width)) :
                visibleLeft + (v - width) / 2);
        };
        const tooltipWidth = g.tooltipWidth;
        const commentWidth = this.listMode ? Math.min(350, Math.max(120, viewportWidth - 16)) : 180;
        tip.style.setProperty('--scui00-position', place(tooltipWidth) + 'px');
        seek.style.setProperty('--scui00-comment-x', place(commentWidth) + 'px');
    }
    dispose() {
        if (this.track && this.onMove) {
            this.track.removeEventListener('mousemove', this.onMove, true);
        }
        if (this.onResize)
            this.document.defaultView?.removeEventListener('resize', this.onResize);
        this.onResize = null;
        this.geometry = null;
        this.tooltip?.style.removeProperty('--scui00-position');
        this.tooltip?.classList.remove('is-scui00-root', 'is-idle-suppressed');
        this.seekOwner?.style.removeProperty('--scui00-comment-x');
        this.seekOwner?.style.removeProperty('--scui00-mini-bottom');
        this.lastImage = null;
        this.container.classList.remove('is-scui00-active', 'is-scui00-mini-static', 'is-scui00-mini-hidden', 'is-scui00-inactive');
        this.style?.remove();
        this.track = null;
        this.onMove = null;
        this.style = null;
        this.comment = null;
        this.tooltip = null;
        this.seekOwner = null;
        this.root = null;
        this.currentClientX = null;
    }
    static install(registry) {
        registry.register({ id: '00', label: '00 \u65e7\u5f0f',
            description: '\u5143\u306e\u30b7\u30fc\u30f3\u30b5\u30fc\u30c1\u306e\u8868\u793a\u52d5\u4f5c\u3092\u7dad\u6301',
            factory: options => new SceneSearchLayout00(options) });
    }
    static get CSS() {
        return `
/* Do not replace original CommentPreviewView modes or reparent its DOM. */
.is-scui00-active .seekBarToolTip.is-scui00-root{
  transform:translate(var(--scui00-position,var(--trans-x-pp)),0)!important;
  transition:none!important;
  z-index:150!important;
}
/* Both native seekbar siblings now track the real full-width range. */
.is-scui00-active .seekBarContainer>.zenzaCommentPreview{
  transform:translate(var(--scui00-comment-x,var(--trans-x-pp)),0)!important;
  transition:none!important;
  /* Layering depends on hover/list mode. The original list is BELOW
     SeekBarToolTip (100 vs 150); forcing 320 made the exit button unclickable. */
}
/* Hover flows in its own original view over the native tooltip. */
.is-scui00-active .seekBarContainer:not(.enableCommentPreview)>.zenzaCommentPreview{
  width:180px!important;height:90px!important;
  bottom:var(--scui00-mini-bottom,70px)!important;
  opacity:1!important;
  background:transparent!important;
  z-index:160!important;
  overflow:hidden!important;pointer-events:none!important;
}
.is-scui00-active .seekBarContainer:not(.enableCommentPreview)
  >.zenzaCommentPreview .listContainer .nicoChat .text{
  animation-play-state:running!important;
}
/* Only hide the flowing MINI preview; list mode remains fully operational. */
.is-scui00-active.is-scui00-mini-hidden
  .seekBarContainer:not(.enableCommentPreview)>.zenzaCommentPreview{
  display:none!important;
}
/* Static mini cards use the native virtual rows and timestamps unchanged.
   The original hover text animation starts hidden, so merely pausing it
   would yield a blank preview. Explicitly show text and use 5 fixed rows. */
.is-scui00-active.is-scui00-mini-static
  .seekBarContainer:not(.enableCommentPreview)>.zenzaCommentPreview .listContainer{
  display:flex!important;flex-direction:column!important;
  justify-content:flex-start!important;height:100%!important;
}
.is-scui00-active.is-scui00-mini-static
  .seekBarContainer:not(.enableCommentPreview)>.zenzaCommentPreview .listContainer .nicoChat{
  position:relative!important;top:auto!important;
  transform:none!important;flex:0 0 18px!important;
  height:18px!important;width:100%!important;
}
.is-scui00-active.is-scui00-mini-static
  .seekBarContainer:not(.enableCommentPreview)>.zenzaCommentPreview .listContainer .nicoChat:nth-child(n+6){
  display:none!important;
}
.is-scui00-active.is-scui00-mini-static
  .seekBarContainer:not(.enableCommentPreview)>.zenzaCommentPreview .listContainer .nicoChat .text{
  animation:none!important;transform:none!important;
  visibility:visible!important;
}
/* The native list remains scrollable with its original CSS and click actions. */
.is-scui00-active .seekBarContainer.enableCommentPreview>.zenzaCommentPreview{
  width:min(350px,calc(100vw - 16px))!important;
  height:200px!important;max-height:200px!important;
  /* Original VideoControlBar: bottom:16px plus a 24px transparent
     mouse corridor. Keep the tooltip controls (z-index:150) above list:100. */
  bottom:16px!important;
  border-bottom:24px solid transparent!important;
  z-index:100!important;
  opacity:1!important;display:block!important;
  background:rgba(7,13,24,.94)!important;
  overflow-y:auto!important;overflow-x:hidden!important;
  pointer-events:auto!important;
}
.is-scui00-active .seekBarContainer.enableCommentPreview
  >.zenzaCommentPreview .listContainer{
  pointer-events:auto!important;
}
/* No floating comments without the corresponding Storyboard picture. */
.is-scui00-active .seekBarContainer:not(.enableCommentPreview):not(:has(.zenzaSeekThumbnail.is-visible))
  >.zenzaCommentPreview{display:none!important;}
/* The shared idle limiter controls shown=false. Native VideoControlBar hover
   CSS otherwise keeps the image and list visible forever while the pointer
   stays over the seekbar. Suppress both ORIGINAL sibling nodes, never clone. */
.is-scui00-active.is-scui00-inactive .seekBarToolTip.is-scui00-root{
  opacity:0!important;visibility:hidden!important;pointer-events:none!important;
}
.is-scui00-active.is-scui00-inactive .seekBarContainer>.zenzaCommentPreview{
  display:none!important;visibility:hidden!important;pointer-events:none!important;
}
`;
    }
}
//===END===
export {SceneSearchLayout00};
