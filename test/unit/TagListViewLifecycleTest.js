'use strict';

const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function makeSubject(sourcePath = 'src/TagListView.js') {
  const bodyListeners = new Set();
  const timers = new Map();
  let nextTimerId = 1;
  let focusCount = 0;

  const document = {
    body: {
      addEventListener(type, handler) {
        if (type === 'click') { bodyListeners.add(handler); }
      },
      removeEventListener(type, handler) {
        if (type === 'click') { bodyListeners.delete(handler); }
      }
    }
  };

  const window = {
    setTimeout(callback) {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    }
  };

  class BaseViewComponent {
    constructor() {
      this._elm = {};
      this._state = {};
    }
    setState(patch) {
      Object.assign(this._state, patch);
    }
  }
  class TagEditApi {}

  const context = createContext({
    document,
    window,
    BaseViewComponent,
    TagEditApi,
    ZenzaWatch: {emitter: {on() {}}},
    NicodicArticleLoader: {},
    parseVideoSearchSortValue() { return {}; },
    Config: {namespace() { return {getValue() { return null; }}; }},
    textUtil: {},
    nicoUtil: {isLogin() { return true; }}
  });

  const TagListView = loadClass(sourcePath, 'TagListView', context);
  const view = new TagListView({parentNode: null});
  view._elm.tagInput = {
    value: '',
    focus() { focusCount++; },
    blur() {}
  };
  view._update = () => {};

  return {
    view,
    bodyListeners,
    timers,
    runTimers() {
      for (const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
    getFocusCount() { return focusCount; }
  };
}

describe('Task242 TagListView listener lifetime', () => {
  it('removes the owned body click listener when a video update interrupts edit mode', () => {
    const s = makeSubject();

    s.view.update({tagList: [], tagEdit: {isEditable: true}});
    s.view._beginEdit();
    assert.strictEqual(s.bodyListeners.size, 1);

    s.view.update({tagList: [], tagEdit: {isEditable: true}});

    assert.strictEqual(s.bodyListeners.size, 0);
    assert.strictEqual(s.view._state.isEditing, false);
  });

  it('cancels delayed input focus when a video update interrupts input mode', () => {
    const s = makeSubject();

    s.view.update({tagList: [], tagEdit: {isEditable: true}});
    s.view._beginInput();
    assert.strictEqual(s.bodyListeners.size, 1);
    assert.strictEqual(s.timers.size, 1);

    s.view.update({tagList: [], tagEdit: {isEditable: true}});

    assert.strictEqual(s.bodyListeners.size, 0);
    assert.strictEqual(s.timers.size, 0);
    s.runTimers();
    assert.strictEqual(s.getFocusCount(), 0);
    assert.strictEqual(s.view._state.isInputing, false);
  });

  it('keeps one stable body-click handler across ordinary updates', () => {
    const s = makeSubject();

    s.view.update({tagList: [], tagEdit: {isEditable: true}});
    const first = s.view._boundOnBodyClick;
    s.view.update({tagList: [], tagEdit: {isEditable: true}});

    assert.strictEqual(typeof first, 'function');
    assert.strictEqual(s.view._boundOnBodyClick, first);
  });
});

describe('Task288 generated dist TagListView lifecycle parity', () => {
  const distPath = 'dist/ZenzaWatch-dev.user.js';

  it('removes the owned body listener when a video update interrupts edit mode', () => {
    const s = makeSubject(distPath);

    s.view.update({tagList: [], tagEdit: {isEditable: true}});
    s.view._beginEdit();
    assert.strictEqual(s.bodyListeners.size, 1);

    s.view.update({tagList: [], tagEdit: {isEditable: true}});
    assert.strictEqual(s.bodyListeners.size, 0);
    assert.strictEqual(s.view._state.isEditing, false);
  });

  it('cancels pending focus when a video update interrupts input mode', () => {
    const s = makeSubject(distPath);

    s.view.update({tagList: [], tagEdit: {isEditable: true}});
    s.view._beginInput();
    assert.strictEqual(s.bodyListeners.size, 1);
    assert.strictEqual(s.timers.size, 1);

    s.view.update({tagList: [], tagEdit: {isEditable: true}});
    assert.strictEqual(s.bodyListeners.size, 0);
    assert.strictEqual(s.timers.size, 0);
    s.runTimers();
    assert.strictEqual(s.getFocusCount(), 0);
    assert.strictEqual(s.view._state.isInputing, false);
  });
});
