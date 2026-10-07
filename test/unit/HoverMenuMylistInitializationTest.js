'use strict';

const assert = require('assert');
const {createContext, extract, run} = require('../helpers/extractSource');

function makeSubject({login = true, load = async () => [], rel = 'src/NicoVideoPlayerDialog.js'} = {}) {
  const listeners = [];
  const menuItems = {
    on(name) { listeners.push(name); return this; }
  };
  const container = {
    querySelector(selector) {
      if (selector === '.hoverMenuContainer') { return {}; }
      return null;
    },
    querySelectorAll(selector) {
      assert.strictEqual(selector, '.menuItemContainer');
      return [];
    }
  };
  const util = {
    isLogin: () => login,
    $: value => {
      assert.ok(Array.isArray(value));
      return menuItems;
    }
  };
  util.$.html = () => ({appendTo(target) {
    assert.strictEqual(target, container);
  }});
  const MylistApiLoader = {getMylistList: load};
  const context = createContext({
    util,
    MylistApiLoader,
    global: {emitter: {on(name) { listeners.push(name); }}}
  });
  run(`${extract(rel, 'VideoHoverMenu')};
    globalThis.__subject = VideoHoverMenu;`, context);
  const subject = Object.create(context.__subject.prototype);
  subject._container = container;
  subject._initializeMylistSelectMenuDom = () => {
    subject.mylistDomCalls = (subject.mylistDomCalls || 0) + 1;
  };
  return {subject, listeners};
}

describe('Task237 HoverMenu mylist initialization failure isolation', () => {
  it('keeps ordinary HoverMenu initialization alive when optional mylist loading rejects', async () => {
    const failure = new Error('temporary mylist failure');
    const {subject, listeners} = makeSubject({load: async () => { throw failure; }});
    await assert.doesNotReject(() => subject._initializeDom());
    assert.deepStrictEqual(listeners, ['contextmenu', 'click', 'mousedown', 'hideHover']);
    assert.strictEqual(subject.mylistDomCalls || 0, 0);
  });

  it('still initializes the mylist submenu after a successful logged-in load', async () => {
    const list = [{id: '1', name: 'fixture'}];
    let calls = 0;
    const {subject} = makeSubject({load: async () => { calls++; return list; }});
    await subject._initializeDom();
    assert.strictEqual(calls, 1);
    assert.strictEqual(subject._mylistList, list);
    assert.strictEqual(subject.mylistDomCalls, 1);
  });

  it('does not fetch mylists for guests', async () => {
    let calls = 0;
    const {subject} = makeSubject({
      login: false,
      load: async () => { calls++; return []; }
    });
    await subject._initializeDom();
    assert.strictEqual(calls, 0);
    assert.strictEqual(subject.mylistDomCalls || 0, 0);
  });

  it('keeps generated dev dist optional-mylist failure isolation in parity with source', async () => {
    const {subject, listeners} = makeSubject({
      rel: 'dist/ZenzaWatch-dev.user.js',
      load: async () => { throw new Error('dist mylist failure'); }
    });
    await assert.doesNotReject(() => subject._initializeDom());
    assert.deepStrictEqual(listeners, ['contextmenu', 'click', 'mousedown', 'hideHover']);
    assert.strictEqual(subject.mylistDomCalls || 0, 0);
  });
});
