/**
 * Canonical TypeScript source for packages/lib/src/dom/domEvent.js (Task785).
 * CustomEvent helpers for the `command` event protocol.
 */
/** The part of the global object (src/ZenzaWatchIndex.js) used here. */
declare const global: {emitter: {emitAsync(name: string, ...args: unknown[]): unknown}};

const domEvent = {
  dispatchCustomEvent(elm: EventTarget, name: string, detail: unknown = {}, options: CustomEventInit = {}): void {
    const ev = new CustomEvent(name, Object.assign({detail}, options));
    elm.dispatchEvent(ev);
  },
  dispatchCommand(element: EventTarget, command: string, param?: unknown, originalEvent: Event | null = null): boolean {
    return element.dispatchEvent(new CustomEvent('command',
      {detail: {command, param, originalEvent}, bubbles: true, composed: true}
    ));
  },
  bindCommandDispatcher(element: EventTarget, command: string): void {
    element.addEventListener(command, e => {
      const target = (e.target as Element).closest<HTMLElement>('[data-command]');
      if (!target) {
        global.emitter.emitAsync('hideHover');
        return;
      }
      // DOM-EVENT-DATASET-001 (Task787): a DOMStringMap is not iterable, so the old
      // array destructuring threw on every click; read the named data attributes.
      const {command, type} = target.dataset;
      let param: unknown = target.dataset.param;
      if (['number', 'boolean', 'json'].includes(type as string)) {
        param = JSON.parse(param as string);
      }
      e.preventDefault();
      return this.dispatchCommand(element, command as string, param, e);
    });
  }
};

export {domEvent};
