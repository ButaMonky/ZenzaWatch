/**
 * Canonical TypeScript source for packages/lib/src/uQuery.js (Task850).
 * A small jQuery-like wrapper: $Array extends Array, `walk` applies a property or
 * method to every element, `raf` batches DOM writes into the next animation frame.
 */

/**
 * Wrapped items are DOM nodes, strings or arbitrary objects, and `walk` forwards any
 * property; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
type Task = ((...args: unknown[]) => unknown) & {_name?: string};
type Listener = (event: Loose) => unknown;
type FindQuery = string | ((element: Loose, index: number, array: Loose[]) => unknown);

/** The parts of bounce/throttle and Emitter/PromiseHandler used here. */
declare const throttle: {raf<F extends (...args: never[]) => unknown>(func: F): F};
declare class Emitter {
  promise(name: string, callback?: (resolve: () => void) => unknown): Promise<unknown>;
}
declare class PromiseHandler extends Promise<unknown> {
  constructor(callback?: unknown);
  resolve(...args: unknown[]): this;
}

const uQuery = (() => {
  const endMap = new WeakMap<object, unknown>();
  const emptyMap = new Map<string, Set<Listener>>();
  const emptySet = new Set<Listener>();
  const elementsEventMap = new WeakMap<object, Map<string, Set<Listener>>>();
  const HAS_CSSTOM = (window.CSS && (CSS as Loose).number) ? true : false;
  const toCamel = (p: string) => p.replace(/-./g, s => s.charAt(1).toUpperCase());
  // Task850 (UQ-TOSNAKE-001): the match is a single capital letter, so charAt(1) was ''
  // and 'maxWidth' became 'max-idth' (CSSOM set/get and data-* names broke).
  const toSnake = (p: string) => p.replace(/[A-Z]/g, s => `-${s.toLowerCase()}`);
  const isStyleValue = (val: unknown) => ('px' in CSS) && val instanceof CSSStyleValue;
  const emitter = new Emitter();
  const UNDEF = Symbol('undefined');
  const waitForDom = (resolve: () => void) => {
    if (['interactive', 'complete'].includes(document.readyState)) {
      return resolve();
    }
    document.addEventListener('DOMContentLoaded', resolve, {once: true});
  };
  const waitForComplete = (resolve: () => void) => {
    if (['complete'].includes(document.readyState)) {
      return resolve();
    }
    window.addEventListener('load', resolve, {once: true});
  };

  const isTagLiteral = (t: Loose,...args: unknown[]) =>
    Array.isArray(t) &&
    Array.isArray((t as Loose).raw) &&
    t.length === (t as Loose).raw.length &&
    args.length === t.length - 1;

  const templateMap = new WeakMap<object, HTMLTemplateElement>();
  const createDom = (template: Loose, ...args: unknown[]) => {
    const isTL = isTagLiteral(template, ...args);
    if (isTL && templateMap.has(template)) {
      const tpl = templateMap.get(template) as HTMLTemplateElement;
      return document.importNode(tpl.content, true);
    }
    const tpl = document.createElement('template');
    tpl.innerHTML = isTL ? String.raw(template, ...args) : template;
    isTL && templateMap.set(template, tpl);
    return document.importNode(tpl.content, true);
  };

  const walkingHandler: ProxyHandler<Loose[]> = {
    set: function (target, prop, value) {
      for (const elm of target) {
        elm[prop] = value;
      }
      return true;
    },
    get: function (target, prop) {
      const isFunc = target.some(elm => typeof elm[prop] === 'function');

      if (!isFunc) {
        const isObj = target.some(elm => elm[prop] instanceof Object);
        let result: Loose = target.map(elm => typeof elm[prop] === 'function' ? elm[prop].bind(elm) : elm[prop]);
        return isObj ? result.walk : result;
      }
      return (...args: unknown[]) => {
        let result: Loose = target.map((elm, index) => {
          try {
            return (typeof elm[prop] === 'function' ?
              elm[prop].apply(elm, args) : elm[prop]) || elm;
          } catch (error) {
            console.warn('Exception: ', {target, prop, index, error});
          }
        });
        const isObj = result.some((r: unknown) => r instanceof Object);
        return isObj ? result.walk : result;
      };
    }
  };


  const isHTMLElement = (elm: Loose): boolean => {
    return (elm instanceof HTMLElement) ||
      (elm.ownerDocument && elm instanceof elm.ownerDocument.defaultView.HTMLElement);
  };

  const isNode = (elm: Loose): boolean => {
    return (elm instanceof Node) ||
      (elm.ownerDocument && elm instanceof elm.ownerDocument.defaultView.Node);
  };

  const isDocument = (d: Loose): boolean => {
    return (d instanceof Document) || (d && d[Symbol.toStringTag] === 'HTMLDocument') ||
      (d.documentElement && d instanceof d.documentElement.ownerDocument.defaultView.Node);
  };

  const isEventTarget = (e: Loose): boolean => {
    return (e instanceof EventTarget) ||
      (e[Symbol.toStringTag] === 'EventTarget') ||
      (e.addEventListener && e.removeEventListener && e.dispatchEvent);
  };

  const isHTMLCollection = (e: Loose): boolean => {
    return e instanceof HTMLCollection || (e && e[Symbol.toStringTag] === 'HTMLCollection');
  };

  const isNodeList = (e: Loose): boolean => {
    return e instanceof NodeList || (e && e[Symbol.toStringTag] === 'NodeList');
  };


  class RafCaller {
    declare elm: Loose;
    declare static promise: PromiseHandler;
    declare static taskList: [Task, ...unknown[]][];
    declare static exec: () => void;
    constructor(elm: Loose, methods: string[] = []) {
      this.elm = elm;
      methods.forEach(method => {
        const task: Task = elm[method].bind(elm);
        task._name = method;
        (this as Loose)[method] = (...args: unknown[]) => {
          this.enqueue(task, ...args);
          return elm;
        };
      });
    }
    get promise() {
      return (this.constructor as typeof RafCaller).promise;
    }
    enqueue(task: Task, ...args: unknown[]) {
      (this.constructor as typeof RafCaller).taskList.push([task, ...args]);
      (this.constructor as typeof RafCaller).exec();
    }
    cancel() {
      (this.constructor as typeof RafCaller).taskList.length = 0;
    }
  }
  RafCaller.promise = new PromiseHandler();
  RafCaller.taskList = [];
  RafCaller.exec = throttle.raf(function(this: typeof RafCaller) {
    const taskList = this.taskList.concat();
    this.taskList.length = 0;
    for (const [task, ...args] of taskList) {
      try {
        task(...args);
      } catch (err) {
        console.warn('RafCaller task fail', {task, args});
      }
    }
    this.promise.resolve();
    this.promise = new PromiseHandler();
  }.bind(RafCaller));

  class $Array extends Array<Loose> {
    declare _walker?: Loose;
    declare _raf?: RafCaller;

    get [Symbol.toStringTag]() {
      return '$Array';
    }

    get na() /* 先頭の要素にアクセス */ {
      return this[0];
    }

    get nz() /* 末尾の要素にアクセス */ {
      return this[this.length - 1];
    }

    get walk() /* 全要素のメソッド・プロパティにアクセス */ {
      const p = this._walker || new Proxy(this, walkingHandler);
      this._walker = p;
      return p;
    }

    get array() {
      return [...this];
    }

    toArray() {
      return this.array;
    }

    constructor(...args: Loose[]) {
      super();
      const elm = args.length > 1 ? args : args[0];
      if (isHTMLCollection(elm) || isNodeList(elm)) {
        for (const e of elm) {
          super.push(e);
        }
      } else if (typeof elm === 'number') {
        this.length = elm;
      } else {
        this[0] = elm;
      }
    }
    get raf() {
      if (!this._raf) {
        this._raf = new RafCaller(this, [
          'addClass','removeClass','toggleClass','css','setAttribute','attr','data','prop',
          'val','focus','blur','insert','append','appendChild','prepend','after','before',
          'text','appendTo','prependTo','remove','show','hide'
        ]);
      }
      return this._raf as Loose;
    }
    get htmls() {
      return this.filter(isHTMLElement);
    }

    *getHtmls() {
      for (const elm of this) {
        if (isHTMLElement(elm)) { yield elm; }
      }
    }

    get firstElement() {
      for (const elm of this) {
        if (isHTMLElement(elm)) { return elm; }
      }
      return null;
    }

    get nodes() {
      return this.filter(isNode);
    }

    *getNodes() {
      for (const n of this) {
        if (isNode(n)) { yield n; }
      }
    }

    get firstNode() {
      for (const n of this) {
        if (isNode(n)) { return n; }
      }
      return null;
    }

    get independency() {
      const nodes = this.nodes;
      if (nodes.length <= 1) {
        return nodes;
      }
      // 他の要素の子孫じゃないやつを返す
      return this.filter(elm => nodes.every(e => e === elm || !e.contains(elm)));
    }

    get uniq() {
      return (this.constructor as typeof $Array).from([...new Set(this)]);
    }

    clone() {
      return (this.constructor as typeof $Array).from(this.independency.filter(e => e.cloneNode).map(e => e.cloneNode(true)));
    }

    // find() also takes a CSS selector string (Array#find otherwise).
    find(query: FindQuery): Loose {
      if (typeof query !== 'string') {
        return super.find(query);
      }
      return this.query(query);
    }

    query(query: string) {
      const found = this
        .independency
        .filter(elm => elm.querySelectorAll)
        .map(elm => $Array.from(elm.querySelectorAll(query)))
        .flat();
      endMap.set(found, this);
      return found as $Array;
    }

    mapQuery(map: Record<string, string>) {
      const $tmp = this
        .independency
        .filter(elm => elm.querySelectorAll);
      const result: Loose = [], e: Loose = [], $: Loose = {};

      for (const key of Object.keys(map)) {
        const query = map[key];
        const found = $tmp.map(elm => $Array.from(elm.querySelectorAll(query))).flat();
        result[key] = key.match(/^_?\$/) ? found : found[0];
        $[key.replace(/^(_?)/, '$1$')] = found;
        e[key.replace(/^(_?)\$/, '$1')] = found[0];
      }
      return {result, $, e};
    }

    end() {
      return endMap.has(this) ? endMap.get(this) : this;
    }

    each(callback: (this: Loose, index: number, element: Loose) => unknown) {
      this.htmls.forEach((elm, index) => callback.apply(elm, [index, elm]));
    }

    closest(selector: string) {
      // Task 061: 修正前は this.query(elm => elm.closest(selector)) としており、
      // query()が内部でelm.querySelectorAll(query)を呼ぶため、関数をそのまま
      // CSSセレクタ文字列として渡してしまいSyntaxErrorで必ず例外を投げていた
      // （elm.closest()を使うつもりが、elm.querySelectorAll(関数)になっていた）。
      // closest()は祖先方向に辿る処理なので、query()（子孫方向のquerySelectorAll）
      // を流用せず、各要素へ直接 elm.closest(selector) を呼ぶよう修正した。
      const found = this
        .independency
        .filter(elm => elm.closest)
        .map(elm => elm.closest(selector))
        .filter(elm => elm);
      const result = (this.constructor as typeof $Array).from(found) as $Array;
      endMap.set(result, this);
      return result;
    }
    parent() {
      const found = this
        .independency
        .filter(e => e.parentNode).map(e => e.parentNode);
      return found as $Array;
    }
    parents(selector?: string) {
      let h: $Array = selector ? this.parent().closest(selector) : this.parent();
      const found = [h];
      while (h.length) {
        h = selector ? h.parent().closest(selector) : h.parent();
        found.push(h);
      }
      // Task850 (UQ-PARENTS-001): this returned `h.flat()`, i.e. the last (always empty)
      // step of the walk, so parents() was always empty. Return every collected level.
      return $Array.from(found.flat());
    }

    toggleClass(className: string, v?: boolean) {
      if (typeof v === 'boolean') {
        return v ? this.addClass(className) : this.removeClass(className);
      }
      const classes = className.trim().split(/\s+/);
      const htmls = this.getHtmls();
      for (const elm of htmls) {
        for (const c of classes) {
          elm.classList.toggle(c, v);
        }
      }
      return this;
    }

    addClass(className: string) {
      const names = className.split(/\s+/);
      const htmls = this.getHtmls();
      for (const elm of htmls) {
        elm.classList.add(...names);
      }
      return this;
    }

    removeClass(className: string) {
      const names = className.split(/\s+/);
      const htmls = this.getHtmls();
      for (const elm of htmls) {
        elm.classList.remove(...names);
      }
      return this;
    }

    hasClass(className: string) {
      const names = className.trim().split(/[\s]+/);
      const htmls = this.htmls;
      return names.every(
        name => htmls.every(elm => elm.classList.contains(name)));
    }

    _css(props: Map<string, unknown> | Record<string, unknown>) {
      const htmls = this.getHtmls();

      for (const element of htmls) {
        const style = element.style;
        const map = element.attributeStyleMap;
        for (let [key, val] of ((props instanceof Map) ? props : Object.entries(props)) as Iterable<[string, Loose]>) {
          // Task850 (UQ-CSS-CUSTOMPROP-001): custom properties have no camelCase form;
          // `style['-fooBar'] = v` silently did nothing (worked around in Task 030).
          if (key.startsWith('--')) {
            style.setProperty(key, val);
            continue;
          }
          const isNumber = /^[0-9+.]+$/.test(val);
          if (isNumber && /(width|height|top|left)$/i.test(key)) {
            val = HAS_CSSTOM ? (CSS as Loose).px(val) : `${val}px`;
          }
          try {
            if (HAS_CSSTOM && isStyleValue(val)) {
              key = toSnake(key);
              map.set(key, val);
            } else {
              key = toCamel(key);
              style[key] = val;
            }
          } catch (err) {
            console.warn('uQuery.css fail', {key, val, isNumber});
          }
        }
      }
      return this;
    }

    css(key: Loose, val: unknown = UNDEF): Loose {
      if (typeof key === 'string') {
        if (val !== UNDEF) {
          return this._css({[key]: val});
        } else {
          const element = this.firstElement;
          if (HAS_CSSTOM) {
            return element.attributeStyleMap.get(toSnake(key));
          } else {
            return element.style[toCamel(key)];
          }
        }
      } else if (key !== null && typeof key === 'object') {
        return this._css(key);
      }
      return this;
    }

    on(eventName: string, callback: Listener, options?: boolean | AddEventListenerOptions) {
      if (typeof callback !== 'function') {
        return this;
      }
      eventName = eventName.trim();
      const elementEventName = eventName.split('.')[0] as string;
      // window.console.log({eventName, callback, options}, this.concat());
      for (const element of this.filter(isEventTarget)) {
        const elementEvents = elementsEventMap.get(element) || new Map;
        const listenerSet = elementEvents.get(eventName) || new Set;
        elementEvents.set(eventName, listenerSet);
        elementsEventMap.set(element, elementEvents);

        if (!listenerSet.has(callback)) {
          listenerSet.add(callback);
          element.addEventListener(elementEventName, callback, options);
        }
      }
      return this;
    }
    click(...args: Loose[]) {
      // Task850 (UQ-CLICK-ARGS-001): the test was inverted — click(handler) clicked the
      // element instead of binding, and click() bound nothing. No args = trigger.
      if (!args.length) {
        const f = this.firstElement;
        f && f.click();
        return this;
      }
      const callback = args.find(a => typeof a === 'function');
      const data = args[0] !== callback ? args[0] : null;
      return this.on('click', e => {
        data && (e.data = e.data || {}) && Object.assign(e.data, data);
        callback(e);
      });
    }
    dblclick(...args: Loose[]) {
      const callback = args.find(a => typeof a === 'function');
      const data = args[0] !== callback ? args[0] : null;
      return this.on('dblclick', e => {
        data && (e.data = e.data || {}) && Object.assign(e.data, data);
        callback(e);
      });
    }

    off(eventName: string | typeof UNDEF = UNDEF, callback: Listener | typeof UNDEF = UNDEF): this {

      if (eventName === UNDEF) {
        for (const element of this.filter(isEventTarget)) {
          const eventListenerMap = elementsEventMap.get(element) || emptyMap;
          for (const [eventName, listenerSet] of eventListenerMap) {
            for (const listener of listenerSet) {
              element.removeEventListener(eventName, listener);
            }
            listenerSet.clear();
          }
          eventListenerMap.clear();
          elementsEventMap.delete(element);
        }
        return this;
      }

      eventName = eventName.trim();
      const [elementEventName, eventKey] = eventName.split('.') as [string, string | undefined];
      if (callback === UNDEF) {
        for (const element of this.filter(isEventTarget)) {
          const eventListenerMap = elementsEventMap.get(element) || emptyMap;
          const listenerSet = eventListenerMap.get(eventName) || emptySet;
          for (const listener of listenerSet) {
            element.removeEventListener(elementEventName, listener);
          }

          listenerSet.clear();
          eventListenerMap.delete(eventName);

          for (const [key] of eventListenerMap) {
            if (
              (!eventKey && key.startsWith(`${elementEventName}.`)) ||
              (!elementEventName && key.endsWith(`.${eventKey}`))) {
              this.off(key);
            }
          }
        }
        return this;
      }

      for (const element of this.filter(isEventTarget)) {
        const eventListenerMap: Map<string, Set<Listener>> = elementsEventMap.get(element) || new Map;
        eventListenerMap.set(eventName, (eventListenerMap.get(eventName) || new Set));
        for (const [key, listenerSet] of eventListenerMap) {
          if (key !== eventName && !key.startsWith(`${elementEventName}.`)) {
            continue;
          }
          if (!listenerSet.has(callback)) {
            continue;
          }
          listenerSet.delete(callback);
          element.removeEventListener(elementEventName, callback);
        }
      }

      return this;
    }

    _setAttribute(key: string, val: unknown = UNDEF) {
      const htmls = this.getHtmls();
      if (val === null || val === '' || val === UNDEF) {
        for (const e of htmls) {
          e.removeAttribute(key);
        }
      } else {
        for (const e of htmls) {
          e.setAttribute(key, val);
        }
      }
      return this;
    }

    setAttribute(key: string | Record<string, unknown>, val: unknown = UNDEF) {
      if (typeof key === 'string') {
        return this._setAttribute(key, val);
      }
      for (const k of Object.keys(key)) {
        this._setAttribute(k, key[k]);
      }
      return this;
    }

    attr(key: Loose, val: unknown = UNDEF): Loose {
      if (val !== UNDEF || typeof key === 'object') {
        return this.setAttribute(key, val);
      }
      const found = this.find((e: Loose) => e.hasAttribute && e.hasAttribute(key));
      return found ? found.getAttribute(key) : null;
    }

    data(key: Loose, val: unknown = UNDEF): Loose {
      if (typeof key === 'object') {
        for (const k of Object.keys(key)) {
          // Task850 (UQ-DATA-001): pass the raw value; data(k, v) stringifies it once.
          this.data(k, key[k]);
        }
        return this;
      }
      key = `data-${toSnake(key)}`;
      if (val !== UNDEF) {
        return this.setAttribute(key, JSON.stringify(val));
      }
      const found = this.find((e: Loose) => e.hasAttribute && e.hasAttribute(key));
      // Task850 (UQ-DATA-001): no matching element used to throw a TypeError.
      if (!found) {
        return null;
      }
      const attr = found.getAttribute(key);
      try {
        return JSON.parse(attr);
      } catch (e) {
        return attr;
      }
    }

    prop(key: Loose, val: unknown = UNDEF): Loose {
      if (typeof key === 'object') {
        for (const k of Object.keys(key)) {
          this.prop(k, key[k]);
        }
        return this;
      } else if (val !== UNDEF) {
        for (const elm of this) {
          elm[key] = val;
        }
        return this;
      } else {
        const found = this.find((e: Loose) => e.hasOwnProperty(key));
        return found ? found[key] : null;
      }
    }

    val(v: unknown = UNDEF) {
      const htmls = this.getHtmls();
      for (const elm of htmls) {
        if (!('value' in elm)) {
          continue;
        }
        if (v === UNDEF) {
          return elm.value;
        } else {
          elm.value = v;
        }
      }
      return v === UNDEF ? '' : this;
    }

    hasFocus() {
      return this.some(e => e === document.activeElement);
    }
    focus() {
      const fe = this.firstElement;
      if (fe) {
        fe.focus();
      }
      return this;
    }
    blur() {
      const htmls = this.getHtmls();
      for (const elm of htmls) {
        if (elm === document.activeElement) {
          elm.blur();
        }
      }
      return this;
    }

    insert(where: string, ...args: Loose[]) {
      const fn = this.firstNode;
      if (!fn) {
        return this;
      }
      if (args.every(a => typeof a === 'string' || isNode(a))) {
        fn[where](...args);
      } else {
        const $d = uQuery(...(args as [Loose, ...unknown[]]));
        if ($d instanceof $Array) {
          fn[where](...$d.filter(a => typeof a === 'string' || isNode(a)));
        }
      }
      return this;
    }
    append(...args: Loose[]) {
      return this.insert('append', ...args);
    }
    appendChild(...args: Loose[]) {
      return this.append(...args);
    }
    prepend(...args: Loose[]) {
      return this.insert('prepend', ...args);
    }
    after(...args: Loose[]) {
      return this.insert('after', ...args);
    }
    before(...args: Loose[]) {
      return this.insert('before', ...args);
    }

    text(text: unknown = UNDEF) {
      const fn = this.firstNode;
      if (text !== UNDEF) {
        fn && (fn.textContent = text);
      } else {
        // Task 061: 修正前は Array.prototype.find() の戻り値（条件に合致した
        // 要素そのもの）をそのまま返しており、"文字列" ではなく DOM要素が
        // 返っていた。取得したテキストをそのまま別要素へ再設定する処理
        // （例: ボタンのラベルを一時的に変えて後で元に戻す）で使うと、
        // 「[object HTMLButtonElement]」のような文字列に化けてしまうバグだった。
        const elm = this.htmls.find(e => e.textContent);
        return elm ? elm.textContent : '';
      }
      return this;
    }

    appendTo(target: Loose) {
      if (typeof target === 'string') {
        const e = document.querySelector(target);
        e && e.append(...this.nodes);
      } else {
        target.append(...this.nodes);
      }
      return this;
    }
    prependTo(target: Loose) {
      if (typeof target === 'string') {
        const e = document.querySelector(target);
        e && e.prepend(...this.nodes);
      } else {
        target.prepend(...this.nodes);
      }
      return this;
    }

    remove() {
      for (const elm of this) { elm.remove && elm.remove(); }
      return this;
    }

    show() {
      for (const elm of this) { elm.hidden = false; }
      return this;
    }

    hide() {
      for (const elm of this) { elm.hidden = true; }
      return this;
    }

    shadow(...args: Loose[]): Loose {
      const elm = this.firstElement;
      if (!elm) {
        return this;
      }
      if (args.length === 0) {
        elm.shadowRoot || elm.attachShadow({mode: 'open'});
        // Task850 (UQ-SHADOW-NEW-001): a class constructor needs `new`; this threw.
        return new $Array(elm.shadowRoot);
      }
      const $d = uQuery(...(args as [Loose, ...unknown[]]));
      if ($d instanceof $Array) {
        elm.shadowRoot || elm.attachShadow({mode: 'open'});
        $d.appendTo(elm.shadowRoot);
        return $d;
      }
      return this;
    }
  }

  const uQuery = (q: Loose, ...args: unknown[]): Loose => {
    const isTL = isTagLiteral(q, ...args);

    if (isTL || typeof q === 'string') {
      const query = isTL ? String.raw(q, ...args) : q;
      return query.startsWith('<') ?
        new $Array(createDom(q, ...args).children) :
        new $Array(document.querySelectorAll(query));
    } else if (q instanceof Window) {
      return $Array.from(q.document as Loose);
    } else if (q instanceof $Array) {
      return q.concat();
    } else if (q[Symbol.iterator]) {
      return $Array.from(q);
    } else if (isDocument(q)) {
      return $Array.from(q.documentElement);
    } else {
      // console.warn('unknown type q', q);/
      return new $Array(q);
    }
  };

  Object.assign(uQuery, {
    $Array,
    createDom,
    html: (...args: [Loose, ...unknown[]]) => new $Array(createDom(...args).children),
    isTL: isTagLiteral,
    ready: (func = () => {}) => emitter.promise('domReady', waitForDom).then(() => func()),
    complete: (func = () => {}) => emitter.promise('domComplete', waitForComplete).then(() => func()),
    each: (arr: Iterable<Loose> | ArrayLike<Loose>, callback: (this: Loose, index: number, item: Loose) => unknown) => Array.from(arr).forEach((a, i) => callback.apply(a, [i, a])),
    proxy: (func: Loose, ...args: Loose[]) => func.bind(...args),
    fn: {

    }
  });

  return uQuery;
})();
const uq = uQuery;

export {uQuery, uq};
