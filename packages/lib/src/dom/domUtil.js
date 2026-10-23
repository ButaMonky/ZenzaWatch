// GENERATED FROM tools/typescript-stage1/nico-src/domUtil.ts (Task785). Edit the .ts and run npm run nico:sync.
//===BEGIN===
class domUtil {
    static create(name, options = {}) {
        const { dataset, style, ...props } = options;
        const element = Object.assign(document.createElement(name), props || {});
        dataset && Object.assign(element.dataset, dataset);
        style && Object.assign(element.style, style);
        return element;
    }
    static define(name, classDefinition) {
        if (!self.customElements) {
            return false;
        }
        if (customElements.get(name)) {
            return true;
        }
        customElements.define(name, classDefinition);
        return true;
    }
}
//===END===
export {domUtil};
