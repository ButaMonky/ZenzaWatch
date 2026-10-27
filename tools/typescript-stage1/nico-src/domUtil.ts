/**
 * Canonical TypeScript source for packages/lib/src/dom/domUtil.js (Task785).
 * Element creation and guarded custom element registration.
 */
export type CreateOptions = Record<string, unknown> & {
  dataset?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
};

class domUtil {
  static create(name: string, options: CreateOptions = {}): HTMLElement {
    const {dataset, style, ...props} = options;
    const element = Object.assign(document.createElement(name), props || {});
    dataset && Object.assign(element.dataset, dataset);
    style && Object.assign(element.style, style);
    return element;
  }
  static define(name: string, classDefinition: CustomElementConstructor): boolean {
    if (!(self as Partial<typeof globalThis>).customElements) {
      return false;
    }
    if (customElements.get(name)) {
      return true;
    }
    customElements.define(name, classDefinition);
    return true;
  }
}

export {domUtil};
