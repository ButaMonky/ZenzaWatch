import {global} from '../../../../src/ZenzaWatchIndex';
// GENERATED FROM tools/typescript-stage1/nico-src/domEvent.ts (Task785). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const domEvent = {
    dispatchCustomEvent(elm, name, detail = {}, options = {}) {
        const ev = new CustomEvent(name, Object.assign({ detail }, options));
        elm.dispatchEvent(ev);
    },
    dispatchCommand(element, command, param, originalEvent = null) {
        return element.dispatchEvent(new CustomEvent('command', { detail: { command, param, originalEvent }, bubbles: true, composed: true }));
    },
    bindCommandDispatcher(element, command) {
        element.addEventListener(command, e => {
            const target = e.target.closest('[data-command]');
            if (!target) {
                global.emitter.emitAsync('hideHover');
                return;
            }
            // DOM-EVENT-DATASET-001 (Task787): a DOMStringMap is not iterable, so the old
            // array destructuring threw on every click; read the named data attributes.
            const { command, type } = target.dataset;
            let param = target.dataset.param;
            if (['number', 'boolean', 'json'].includes(type)) {
                param = JSON.parse(param);
            }
            e.preventDefault();
            return this.dispatchCommand(element, command, param, e);
        });
    }
};
//===END===
export {domEvent};
