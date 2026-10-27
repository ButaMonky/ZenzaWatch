/**
 * Canonical TypeScript source for packages/components/src/element/BaseCommandElement.js (Task965).
 */
/**
 * Values that come from raw API/DOM records or from modules that are still JS; this one
 * documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
// legacy-to-ts: names provided by other bundled modules
declare const dll: Loose;
declare const util: Loose;


class BaseCommandElement extends HTMLElement {
  declare _boundOnCommand: Loose;
  declare _boundOnUIEvent: Loose;
  declare _idleCallbackId: Loose;
  declare _idleRenderCallback: Loose;
  declare _isConnected: Loose;
  declare _root: Loose;
  declare events: Loose;
  declare props: Loose;
  declare state: Loose;

  static toAttributeName(camel?: Loose) {
    return 'data-' + camel.replace(/([A-Z])/g, (s?: Loose) =>  '-' + s.toLowerCase());
  }

  static toPropName(snake?: Loose) {
    return snake.replace(/^data-/, '').replace(/(-.)/g, (s?: Loose) =>  s.charAt(1).toUpperCase());
  }

  static async importLit() {
    if (dll.lit) {
      return dll.lit;
    }
    // Task 088（監査v2 ZW-010 と同じ趣旨）: 版の指定なしだと lit の最新（3.x）になり、本体が読む lit@2.0.2 と混ざり得た。
    dll.lit = await util.dimport('https://esm.run/lit@2.0.2');
    return dll.lit;
  }

  static get observedAttributes(): Loose[] {
    return [];
  }

  static get propTypes() {
    return {};
  }

  static get defaultProps() {
    return {};
  }

  static get defaultState() {
    return {};
  }

  static async getTemplate(state = {}, props = {}, events = {}) {
    const {html} = dll.lit || await this.importLit();
    return html`<div id="root" data-state="${JSON.stringify(state)}"
      data-props="${JSON.stringify(props)}" @click=${(events as Loose).onClick}></div>`;
  }

  constructor() {
    super();
    this._isConnected = false;
    this.props = Object.assign({}, (this.constructor as Loose).defaultProps, this._initialProps);
    this.state = Object.assign({}, (this.constructor as Loose).defaultState);
    this._boundOnUIEvent = this.onUIEvent.bind(this);
    this._boundOnCommand = this.onCommand.bind(this);
    this.events = {
      onClick: this._boundOnUIEvent
    };

    this._idleRenderCallback = async () => {
      this._idleCallbackId = null;
      return await this.render();
    };
  }

  get _initialProps() {
    const props = {};
    for (const key of Object.keys((this.constructor as Loose).propTypes)) {
      if (!this.dataset[key]) { continue; }
      const type = typeof (this.constructor as Loose).propTypes[key];
      (props as Loose)[key] = type !== 'string' ? JSON.parse(this.dataset[key]) : this.dataset[key];
    }
    return props;
  }

  async render() {
    const {render} = dll.lit || await (this.constructor as Loose).importLit();
    if (!this.shadowRoot) {
      this.attachShadow({mode: 'open'});
    }
    const tmpl = await (this.constructor as Loose).getTemplate(this.state, this.props, this.events);
    render(tmpl, this.shadowRoot, { isConnected: this._isConnected });

    if (!this._root) {
      const root = this.shadowRoot.querySelector('#root');
      if (!root) {
        return;
      }
      this._root = root;
      this._root.addEventListener('command', this._boundOnCommand);
    }
  }

  requestRender(isImmediate: Loose = false) {
    if (this._idleCallbackId) {
      clearTimeout(this._idleCallbackId);
    }
    if (isImmediate) {
      this._idleRenderCallback();
    } else {
      this._idleCallbackId = setTimeout(this._idleRenderCallback, 0);
    }
  }

  async connectedCallback() {
    this._isConnected = true;
    await this.render();
  }

  async disconnectedCallback() {
    this._isConnected = false;
    if (this._root) {
      this._root.removeEventListener('click', this._boundOnUIEvent);
      this._root.removeEventListener('command', this._boundOnCommand);
      this._root = null;
    }
    const {render} = dll.lit || await (this.constructor as Loose).importLit();
    render('', this.shadowRoot, { isConnected: this._isConnected });
  }

  attributeChangedCallback(attr?: Loose, oldValue?: Loose, newValue?: Loose) {
    attr = attr.startsWith('data-') ? (this.constructor as Loose).toPropName(attr) : attr;
    // const defProp = this.constructor.defaultProps[attr];
    const type = typeof (this.constructor as Loose).propTypes[attr];
    if (type !== 'string') {
      newValue = JSON.parse(newValue);
    }
    if (this.props[attr] === newValue) {
      return;
    }
    this.props[attr] = newValue;
    this.requestRender();
  }

  setProp(prop?: Loose, value?: Loose) {
    this.setAttribute(prop, value);
  }

  setState(key?: Loose, value?: Loose) {
    if (this._setState(key, value)) {
      this.requestRender();
      return true;
    }
    return false;
  }

  _setState(key?: Loose, value?: Loose): Loose {
    if (typeof key !== 'string') { return this._setStates(key); }
    if (!this.state.hasOwnProperty(key)) { return false; }
    if (this.state[key] === value) { return false; }
    this.state[key] = value;
    return true;
  }

  _setStates(states?: Loose): Loose {
    return Object.keys(states).filter(key => this._setState(key, states[key])).length > 0;
  }

  onUIEvent(e?: Loose) {
    const target = e.target.closest('[data-command]');
    if (!target) {
      return;
    }
    let {command, param, type} = target.dataset;
    if (['number', 'boolean', 'json'].includes(type)) {
      param = JSON.parse(param);
    }
    e.preventDefault();
    e.stopPropagation();
    return this.dispatchCommand(command, param, e, target);
  }

  dispatchCommand(command?: Loose, param?: Loose, originalEvent: Loose = null, target: Loose = null) {
    (target || this).dispatchEvent(new CustomEvent('command', {detail: {command, param, originalEvent}, bubbles: true, composed: true}));
  }

  onCommand(e?: Loose) {
    //console.log('on-command', e.detail.command, e.detail.param);
  }

  get propset() {
    return Object.assign({}, this.props);
  }

  set propset(props: Loose) {
    const keys = Object.keys(props).filter(key => this.props.hasOwnProperty(key));
    const changed = keys.filter(key => {
      if (this.props[key] === props[key]) {
        return false;
      }
      this.props[key] = props[key];
      return true;
    }).length > 0;

    if (changed) {
      this.requestRender();
    }
  }
}

export { BaseCommandElement };
