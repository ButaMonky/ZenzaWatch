/**
 * @typedef registerPropertyDefinition
 * @property {string} name
 * @property {string} syntax
 * @property {string} initialValue
 * @property {boolean?} inherits
 * Canonical TypeScript source for packages/lib/src/css/css.js (Task786).
 */
export interface RegisterPropertyDefinition extends PropertyDefinition {window?: {CSS: {registerProperty(definition: PropertyDefinition): void}}}
/** [element, property, value] applied with style.setProperty on the next frame. */
export type SetPropsTask = [ElementCSSInlineStyle, string, unknown];
type PaintModule = (...args: unknown[]) => unknown;
/** CSS Typed OM factories that lib.dom does not declare everywhere. */
type TypedCss = Record<string, ((value: unknown) => unknown) | undefined> & {
  escape?: (value: string) => string;
  paintWorklet?: {addModule(url: string): Promise<void>};
  registerProperty?: (definition: PropertyDefinition) => void;
};

/** The parts of global and throttle used here. */
declare const global: {PRODUCT: string};
declare const throttle: {raf(func: () => void): (() => Promise<unknown> | void) & {cancel(): void}};

const css = (() => {
  const setPropsTask: SetPropsTask[] = [];
  // let applyCount = 0;
  const applySetProps = throttle.raf(
    () => {
    const tasks = setPropsTask.concat();
    setPropsTask.length = 0;
    // performance.mark(`applySetProps:${applyCount}`);
    // if (applyCount > 0) {
    //   performance.measure(
    //     'applySetProps',
    //     `applySetProps:${applyCount - 1}`, `applySetProps:${applyCount}`);
    // }
    // applyCount++;
    for (const [element, prop, value] of tasks) {
      try {
        element.style.setProperty(prop, value as string);
      } catch (error) {
        console.warn('element.style.setProperty fail', {element, prop, value, error});
      }
    }
  });
  const css = {
    addStyle: (styles: unknown, option?: string | Record<string, unknown> | null, document = window.document): HTMLStyleElement => {
      const elm = Object.assign(document.createElement('style'), {
        type: 'text/css'
      }, typeof option === 'string' ? {id: option} : (option || {}));
      if (typeof option === 'string') {
        elm.id = option;
      } else if (option) {
        Object.assign(elm, option);
      }
      elm.classList.add(global.PRODUCT);
      elm.append((styles as {toString(): string}).toString());
      (document.head || document.body || document.documentElement).append(elm);
      elm.disabled = (option && (option as Record<string, unknown>).disabled) as boolean;
      elm.dataset.switch = elm.disabled ? 'off' : 'on';
      return elm;
    },
    /**
     * @param  {...registerPropertyDefinition} definitions
     */
    registerProps(...args: RegisterPropertyDefinition[]): void {
      if (!CSS || !('registerProperty' in CSS)) {
        return;
      }
      /** @type registerPropertyDefinition */
      for (const definition of args) {
        try {
          (definition.window || window as unknown as {CSS: {registerProperty(definition: PropertyDefinition): void}}).CSS.registerProperty(definition);
        } catch (err) { console.warn('CSS.registerProperty fail', definition, err); }
      }
    },
    /**
     * @param {...{[{Element} element, {string} property, {any} value]}} tasks
     */
    setProps(...tasks: SetPropsTask[]): Promise<unknown> | void {
      setPropsTask.push(...tasks);
      return setPropsTask.length ? applySetProps() : Promise.resolve();
    },
    addModule: async function(this: {modules: WeakMap<PaintModule, Promise<boolean>>}, func: PaintModule, options: {config?: unknown} = {}): Promise<boolean | undefined> {
      if (!CSS || !('paintWorklet' in CSS)) { return; }
      if (this.modules.has(func)) { return this.modules.get(func); }
      const pending = (async () => {
        let url;
        try {
          const src = `(${func.toString()})(this, registerPaint,
            ${JSON.stringify(options.config || {}, null, 2)});`;
          const blob = new Blob([src], {type: 'text/javascript'});
          url = URL.createObjectURL(blob);
          await (CSS as unknown as TypedCss).paintWorklet!.addModule(url);
          return true;
        } finally {
          if (url !== undefined) { URL.revokeObjectURL(url); }
        }
      })();
      this.modules.set(func, pending);
      try { return await pending; }
      catch (error) { this.modules.delete(func); throw error; }
    }.bind({modules: new WeakMap}),
    escape:  (value: string) => CSS.escape  ? CSS.escape(value) : value.replace(/([\.#()[\]])/g, '\\$1'),
    number:  (value: number) => (CSS as unknown as TypedCss).number  ? (CSS as unknown as TypedCss).number!(value) : value,
    s:       (value: number) => (CSS as unknown as TypedCss).s       ? (CSS as unknown as TypedCss).s!(value) :  `${value}s`,
    ms:      (value: number) => (CSS as unknown as TypedCss).ms      ? (CSS as unknown as TypedCss).ms!(value) : `${value}ms`,
    pt:      (value: number) => (CSS as unknown as TypedCss).pt      ? (CSS as unknown as TypedCss).pt!(value) : `${value}pt`,
    px:      (value: number) => (CSS as unknown as TypedCss).px      ? (CSS as unknown as TypedCss).px!(value) : `${value}px`,
    percent: (value: number) => (CSS as unknown as TypedCss).percent ? (CSS as unknown as TypedCss).percent!(value) : `${value}%`,
    vh:      (value: number) => (CSS as unknown as TypedCss).vh      ? (CSS as unknown as TypedCss).vh!(value) : `${value}vh`,
    vw:      (value: number) => (CSS as unknown as TypedCss).vw      ? (CSS as unknown as TypedCss).vw!(value) : `${value}vw`,
    trans:   (value: string) => (self as Partial<typeof globalThis>).CSSStyleValue ? CSSStyleValue.parse('transform', value) : value,
    word:    (value: string) => (self as Partial<typeof globalThis>).CSSKeywordValue ? new CSSKeywordValue(value) : value,
    image:   (value: string) => (self as Partial<typeof globalThis>).CSSStyleValue ? CSSStyleValue.parse('background-image', value) : value,
  };
  return css;
})();

const cssUtil = css;

export {css, cssUtil};
