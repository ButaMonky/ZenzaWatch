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

describe('ZW-066 editable shortcut guard', () => {
  it('keeps ordinary shortcuts while ignoring input, textarea and select', async () => {
    const h = await subject();
    for (const tag of ['input', 'textarea', 'select']) { const node = h.doc.createElement(tag); h.doc.body.append(node); h.send(node); }
    assert.deepStrictEqual(h.events, []);
    h.send(); assert.deepStrictEqual(h.events, [['TOGGLE_PLAY', '']]);
  });
  it('ignores contenteditable descendants including plaintext-only', async () => {
    const h = await subject();
    for (const value of ['', 'true', 'plaintext-only']) {
      const editor = h.doc.createElement('div'), child = h.doc.createElement('span');
      editor.setAttribute('contenteditable', value); editor.append(child); h.doc.body.append(editor); h.send(child);
    }
    assert.deepStrictEqual(h.events, []);
  });
  it('uses the composed path to recognize an input in an open shadow root', async () => {
    const h = await subject(), host = h.doc.createElement('div'); h.doc.body.append(host);
    const root = host.attachShadow({mode: 'open'}), input = h.doc.createElement('input'); root.append(input);
    h.send(input); assert.deepStrictEqual(h.events, []);
  });
  it('respects IME composition and a previously canceled event', async () => {
    const h = await subject(); h.send(undefined, 32, {isComposing: true});
    const node = h.doc.getElementById('normal'); node.addEventListener('keydown', e => e.preventDefault()); h.send(node);
    assert.deepStrictEqual(h.events, []);
  });
  it('respects a cooperating closed-shadow host that prevents default', async () => {
    const h = await subject(), host = h.doc.createElement('div'); h.doc.body.append(host);
    const root = host.attachShadow({mode: 'closed'}), input = h.doc.createElement('input'); root.append(input);
    host.addEventListener('keydown', e => e.preventDefault()); h.send(input);
    assert.deepStrictEqual(h.events, []);
  });
});
