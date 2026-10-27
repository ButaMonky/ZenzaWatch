/**
 * Canonical TypeScript source for packages/zenza/src/parts/BaseViewComponent.js (Task902).
 */
/**
 * Playlist items wrap raw API/storage records of several formats and are shared with
 * views and other modules that are still JS; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
declare class Emitter {
  constructor(...args: Loose[]);
  on(name: string, callback: (...args: Loose[]) => unknown): this;
  emit(name: string, ...args: unknown[]): unknown;
}
declare const PRODUCT: string;
declare const cssUtil: {addStyle(css: string, id?: string): unknown};
declare const ClassList: (element: Element) => Loose;
export interface BaseViewParams {
  parentNode?: Loose;
  name?: string;
  template?: string;
  shadow?: string;
  css?: string;
}
type TemplateCache = Record<string, HTMLTemplateElement | undefined>;


class BaseViewComponent extends Emitter {
  declare _bound: Loose;
  declare _elm: Loose;
  declare _isDummyShadow: Loose;
  declare _params: Loose;
  declare _parentNode: Loose;
  declare _props: Loose;
  declare _shadow: Loose;
  declare _shadowRoot: Loose;
  declare _state: Loose;
  declare _view: Loose;
  constructor({parentNode = null, name = '', template = '', shadow = '', css = ''}: BaseViewParams) {
    super();

    this._params = {parentNode, name, template, shadow, css};
    this._bound = {};
    this._state = {};
    this._props = {};
    this._elm = {};

    this._initDom({
      parentNode,
      name,
      template,
      shadow,
      css
    });
  }

  _initDom(params: Required<BaseViewParams>) {
    const {parentNode, name, template, css: style, shadow} = params;
    const tplId = `${PRODUCT}${name}Template`;
    let tpl = (BaseViewComponent as unknown as TemplateCache)[tplId];
    if (!tpl) {
      if (style) {
        cssUtil.addStyle(style, `${name}Style`);
      }
      tpl = document.createElement('template');
      tpl.innerHTML = template;
      tpl.id = tplId;
      (BaseViewComponent as unknown as TemplateCache)[tplId] = tpl;
    }
    const onClick = this._bound.onClick = this._onClick.bind(this);

    const view = document.importNode(tpl.content, true);
    this._view = view.querySelector('*') || document.createDocumentFragment();
    this._view.addEventListener('click', onClick);
    this.appendTo(parentNode);

    if (shadow) {
      this._attachShadow({host: this._view, name, shadow});
      if (!this._isDummyShadow) {
        this._shadow.addEventListener('click', onClick);
      }
    }
  }

  _attachShadow({host, shadow, name, mode = 'open'}: {host: Loose; shadow: string; name: string; mode?: ShadowRootMode}) {
    const tplId = `${PRODUCT}${name}Shadow`;
    let tpl = (BaseViewComponent as unknown as TemplateCache)[tplId];
    if (!tpl) {
      tpl = document.createElement('template');
      tpl.innerHTML = shadow;
      tpl.id = tplId;
      (BaseViewComponent as unknown as TemplateCache)[tplId] = tpl;
    }

    if (!host.attachShadow && !host.createShadowRoot) {
      return this._fallbackNoneShadowDom({host, tpl, name});
    }

    const root = host.attachShadow ?
      host.attachShadow({mode}) : host.createShadowRoot();
    const node = document.importNode(tpl.content, true);
    root.append(node);
    this._shadowRoot = root;
    this._shadow = root.querySelector('.root');
    this._isDummyShadow = false;
  }

  _fallbackNoneShadowDom({host, tpl, name}: {host: Loose; tpl: HTMLTemplateElement; name: string}) {
    const node = document.importNode(tpl.content, true);
    const style = node.querySelector('style')!;
    style.remove();
    cssUtil.addStyle(style.innerHTML, `${name}Shadow`);
    host.append(node);
    this._shadow = this._shadowRoot = host.querySelector('.root');
    this._isDummyShadow = true;
  }

  setState(key?: Loose, val?: Loose) {
    if (typeof key === 'string') {
      return this._setState(key, val);
    }
    for (const k of Object.keys(key)) {
      this._setState(k, key[k]);
    }
  }

  _setState(key?: Loose, val?: Loose) {
    let m;
    if (this._state[key] !== val) {
      this._state[key] = val;
      if ((m = (/^is(.*)$/.exec(key))) !== null) {
        this.toggleClass(`is-${m[1]}`, !!val);
      }
      this.emit('update', {key, val});
    }
  }

  _onClick(e?: Loose) {
    const target = e.target.closest('[data-command]');

    if (!target) {
      return;
    }

    let {command, type = 'string', param}: {command?: string; type?: string; param?: Loose} = target.dataset;
    e.stopPropagation();
    e.preventDefault();
    if (type !== 'string') { param = JSON.parse(param); }

    this._onCommand(command, param);
  }

  appendTo(parentNode?: Loose) {
    if (!parentNode) {
      return;
    }
    this._parentNode = parentNode;
    parentNode.appendChild(this._view);
  }

  _onCommand(command?: Loose, param?: Loose) {
    this.dispatchCommand(command, param);
  }

  dispatchCommand(command?: Loose, param?: Loose) {
    this._view.dispatchEvent(new CustomEvent('command',
      {detail: {command, param}, bubbles: true, composed: true}
    ));
  }

  toggleClass(className?: Loose, v?: Loose) {
    const vc = ClassList(this._view);
    const sc = this._shadow ? ClassList(this._shadow) : null;
    (className || '').trim().split(/\s+/).forEach((c: string) => {
      vc.toggle(c, v);
      if (sc) {
        sc.toggle(c, vc.contains(c));
      }
    });
  }

  addClass(name?: Loose) {
    const names = name.trim().split(/[\s]+/);
    ClassList(this._view).add(...names);
    this._shadow && ClassList(this._shadow).add(...names);
  }

  removeClass(name?: Loose) {
    const names = name.trim().split(/[\s]+/);
    ClassList(this._view).remove(...names);
    this._shadow && ClassList(this._shadow).remove(...names);
  }
}

export {BaseViewComponent};
