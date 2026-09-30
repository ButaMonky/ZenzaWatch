const assert = require('assert');
const {JSDOM} = require('jsdom');
const {beginSection, createContext, run} = require('../helpers/extractSource');
const documents = [];
afterEach(() => { documents.splice(0).forEach(dom => dom.window.close()); });
async function subject(overrides = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="normal"></div></body>'); documents.push(dom);
  const c = createContext({window: dom.window, document: dom.window.document});
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(beginSection('packages/zenza/src/ShortcutActions.js'), c);
  run(beginSection('packages/zenza/src/ShortcutKeyEmitter.js'), c);
  c.overrides = overrides;
  run(`globalThis.config = new Emitter(); config.props = {};
    SHORTCUT_ACTIONS.forEach(action => { config.props['KEY_' + action.id] = 0; });
    Object.assign(config.props, {KEY_TOGGLE_PLAY: 32, KEY_SHIFT_RESET: 82, playbackRate: 1.75}, overrides);
    globalThis.external = new Emitter(); external.emitResolve('init');
    globalThis.keys = ShortcutKeyEmitter.create(config, document.body, external);`, c);
  const events = [];
  c.keys.on('keyDown', (name, event, param) => events.push([name, param]));
  await new Promise(resolve => setImmediate(resolve));
  return {c, dom, events, doc: dom.window.document,
    send(target = dom.window.document.body, keyCode = 32, options = {}) {
      const event = new dom.window.KeyboardEvent('keydown', Object.assign({keyCode, bubbles: true, composed: true, cancelable: true}, options));
      target.dispatchEvent(event); return event;
    },
    update(key, value) { c.config.props[key] = value; c.config.emit('update', key, value); }};
}

describe('ZW-067 configured seek bindings', () => {
  it('honors plain, Shift, Ctrl and Alt bindings without extra modifiers', async () => {
    for (const [modifier, offset] of [[null, 0], ['shiftKey', 0x1000], ['ctrlKey', 0x10000], ['altKey', 0x100000]]) {
      const h = await subject({KEY_SEEK_LEFT: 65 + offset, KEY_SEEK_RIGHT: 68 + offset});
      const options = modifier ? {[modifier]: true} : {};
      h.send(undefined, 65, options); h.send(undefined, 68, options);
      assert.deepStrictEqual(h.events, [['SEEK_BY', -5], ['SEEK_BY', 5]]);
    }
  });
  it('requires the exact modifier combination', async () => {
    const h = await subject({KEY_SEEK_LEFT: 65 + 0x10000});
    h.send(undefined, 65); h.send(undefined, 65, {shiftKey: true}); h.send(undefined, 65, {ctrlKey: true, altKey: true});
    assert.deepStrictEqual(h.events, []);
  });
  it('updates and disables a binding without reload', async () => {
    const h = await subject({KEY_SEEK_LEFT: 65}); h.send(undefined, 65);
    h.update('KEY_SEEK_LEFT', 66); h.send(undefined, 65); h.send(undefined, 66);
    h.update('KEY_SEEK_LEFT', 0); h.send(undefined, 66);
    assert.deepStrictEqual(h.events, [['SEEK_BY', -5], ['SEEK_BY', -5]]);
  });
  it('retains deterministic legacy priority for conflicting bindings', async () => {
    const h = await subject({KEY_SEEK_LEFT: 65, KEY_SEEK_RIGHT: 65}); h.send(undefined, 65);
    assert.deepStrictEqual(h.events, [['SEEK_BY', -5]]);
  });
  it('uses an unassigned raw arrow only during slow hold', async () => {
    const h = await subject(); h.send(undefined, 37); h.send(undefined, 39);
    assert.deepStrictEqual(h.events, []);
    h.send(undefined, 82); h.events.length = 0;
    h.send(undefined, 37); h.send(undefined, 39);
    assert.deepStrictEqual(h.events, [['SEEK_BY', -0.5], ['SEEK_BY', 0.5]]);
  });
  it('does not let raw-arrow fallback swallow a configured legacy action', async () => {
    const h = await subject({KEY_TOGGLE_PLAY: 37}); h.send(undefined, 37);
    assert.deepStrictEqual(h.events, [['TOGGLE_PLAY', '']]);
  });
  it('does not let raw-arrow fallback swallow a configured dynamic action', async () => {
    const h = await subject({KEY_CUSTOM_SEEK_1: 39, PARAM_CUSTOM_SEEK_1: 12}); h.send(undefined, 39);
    assert.deepStrictEqual(h.events, [['CUSTOM_SEEK_1', 12]]);
  });
});
