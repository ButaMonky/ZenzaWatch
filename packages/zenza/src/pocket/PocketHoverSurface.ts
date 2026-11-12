/** Floating controls retain the link's native mouse ancestry without layout changes. */
const PocketHoverSurface = {
  hide(view: HTMLElement): void {
    if (view.matches(':popover-open')) { view.hidePopover?.(); }
  },
  attach(view: HTMLElement, target: HTMLElement): void {
    if (view.parentElement !== target) {
      this.hide(view);
      target.appendChild(view);
    }
    view.setAttribute('popover', 'manual');
    Object.assign(view.style, {position:'fixed', inset:'auto', margin:'0', border:'0',
      padding:'0', background:'transparent', overflow:'visible'});
    if (view.isConnected && !view.matches(':popover-open')) { view.showPopover?.(); }
  }
};
export {PocketHoverSurface};
