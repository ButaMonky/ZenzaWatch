'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');
const {createNgHarness} = require('../helpers/ngRegexHarness');

describe('Task205 NG master switch settings synchronization', () => {
  it('updates the settings checkbox view when enableFilter changes outside the panel', async () => {
    class FakeDialogElement {
      constructor() {
        this.props = {};
        this.state = {isOpen: false, revision: 0};
        this.events = {};
        this._isConnected = false;
        this.renderRequests = 0;
      }
      async connectedCallback() { this._isConnected = true; }
      async disconnectedCallback() { this._isConnected = false; }
      requestRender() { this.renderRequests++; }
      get isOpen() { return !!this.state.isOpen; }
      onUIEvent() {}
      onChange() {}
      onOpen() {}
    }
    const c = createContext({
      DialogElement: FakeDialogElement,
      domEvent: {},
      customElements: {get() { return true; }, define() {}},
      confirm() { return true; },
      alert() {},
      FileReader: class {}
    });
    const Panel = loadClass(
      'packages/components/src/element/SettingPanelElement.js',
      'SettingPanelElement',
      c
    );
    const listeners = new Set();
    const config = {
      props: {enableFilter: true},
      onkey(key, fn) { if (key === 'enableFilter') listeners.add(fn); },
      offkey(key, fn) { if (key === 'enableFilter') listeners.delete(fn); }
    };
    const panel = new Panel();
    panel.config = config;
    assert.strictEqual(listeners.size, 0, 'disconnected panel must not retain config listeners');

    await panel.connectedCallback();
    assert.strictEqual(listeners.size, 1);
    panel.state.isOpen = true;
    const beforeRevision = panel.state.revision;
    for (const fn of listeners) fn(false);
    assert.strictEqual(panel.state.revision, beforeRevision + 1);
    assert.strictEqual(panel.renderRequests, 1);

    await panel.disconnectedCallback();
    assert.strictEqual(listeners.size, 0, 'disconnect must release the config listener');
    for (const fn of listeners) fn(true);
    assert.strictEqual(panel.renderRequests, 1);

    await panel.connectedCallback();
    assert.strictEqual(listeners.size, 1, 'reconnect must restore exactly one listener');
  });

  it('keeps enableFilter as the master bypass for word, regex, user, command and shared NG', () => {
    const h = createNgHarness(false, {
      enableFilter: true,
      sharedNgLevel: 'MID',
      wordFilter: 'plain-block',
      wordRegFilter: '^regex-block$',
      wordRegFilterFlags: 'i',
      userIdFilter: 'blocked-user',
      commandFilter: 'red'
    });
    const cases = [
      Object.assign(h.chat('plain-block'), {score: 0}),
      Object.assign(h.chat('REGEX-BLOCK'), {score: 0}),
      Object.assign(h.chat('safe'), {score: 0, userId: 'blocked-user'}),
      Object.assign(h.chat('safe'), {score: 0, cmd: 'red big'}),
      Object.assign(h.chat('safe'), {score: -100000})
    ];
    assert(cases.some(chat => !h.filter.isSafe(chat)), 'enabled filter should block configured cases');
    h.filter.isEnable = false;
    for (const chat of cases) {
      assert.strictEqual(h.filter.isSafe(chat), true);
    }
  });
});
