/**
 * Canonical TypeScript source for packages/lib/src/dom/Fullscreen.js (Task785).
 * Vendor-prefixed Fullscreen API wrapper; mirrors the state to `body.is-fullscreen`
 * and the `fullscreenStatusChange` global event.
 */
/** Legacy vendor-prefixed members that lib.dom does not declare. */
type PrefixedDocument = Document & Record<string, unknown>;
type PrefixedElement = Element & Record<string, unknown>;
type FullscreenCall = (this: unknown) => Promise<void> | void;
/** Set on first request; not declared on the object so its keys stay as before. */
type EventsFlag = {_eventsAttached?: boolean};

/** The part of the global object (src/ZenzaWatchIndex.js) used here. */
declare const global: {emitter: {emit(name: string, ...args: unknown[]): unknown}};
declare const ClassList: (element: Element) => DOMTokenList;

const Fullscreen = {
  now(): boolean {
    return !!(this.get() || (document as PrefixedDocument).mozFullScreen || (document as PrefixedDocument).webkitIsFullScreen);
  },
  get(): Element | null {
    return (document.fullscreenElement || (document as PrefixedDocument).fullScreenElement ||
      (document as PrefixedDocument).webkitFullscreenElement || (document as PrefixedDocument).mozFullScreenElement ||
      (document as PrefixedDocument).msFullscreenElement || null) as Element | null;
  },
  request(target: string | Element): Promise<void> | void {
    const elm = (typeof target === 'string' ? document.getElementById(target) : target) as PrefixedElement | null;
    if (!elm) {
      return;
    }
    const request = elm.requestFullscreen || elm.requestFullScreen ||
      elm.webkitRequestFullscreen || elm.webkitRequestFullScreen ||
      elm.mozRequestFullScreen || elm.msRequestFullscreen;
    if (typeof request !== 'function') {
      return;
    }
    this._handleEvents();
    return (request as FullscreenCall).call(elm);
  },
  cancel(): Promise<void> | void {
    if (!this.now()) {
      return;
    }
    const exit = document.exitFullscreen || (document as PrefixedDocument).cancelFullScreen ||
      (document as PrefixedDocument).webkitExitFullscreen || (document as PrefixedDocument).webkitCancelFullScreen ||
      (document as PrefixedDocument).mozCancelFullScreen || (document as PrefixedDocument).msExitFullscreen;
    if (typeof exit === 'function') {
      return (exit as FullscreenCall).call(document);
    }
  },
  _handleEvents(): void {
    // A fullscreen request may happen repeatedly. Keep one event handler per page.
    if ((this as EventsFlag)._eventsAttached) {
      return;
    }
    (this as EventsFlag)._eventsAttached = true;
    const cl = ClassList(document.body);
    const handle = () => {
      // Do not swallow native fullscreenchange events needed by other listeners.
      const isFull = this.now();
      cl.toggle('is-fullscreen', isFull);
      global.emitter.emit('fullscreenStatusChange', isFull);
    };
    document.addEventListener('webkitfullscreenchange', handle, true);
    document.addEventListener('mozfullscreenchange', handle, true);
    document.addEventListener('MSFullscreenChange', handle, true);
    document.addEventListener('fullscreenchange', handle, true);
  }
};

export {Fullscreen};
