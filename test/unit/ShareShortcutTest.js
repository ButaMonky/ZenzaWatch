'use strict';
const assert = require('node:assert/strict');
const {beginSection, createContext, run} = require('../helpers/extractSource');

describe('quick-share keyboard shortcuts', () => {
  // The browser owns KeyboardEvent.isTrusted. Use an isolated input source to
  // exercise both values, with the same event object throughout dispatch.
  async function setup() {
    class KeyboardEvent {
      constructor(fields) {
        Object.assign(this, {type: 'keydown', eventPhase: 3, keyCode: 89, isTrusted: true}, fields);
      }
    }
    let settingsOpen = false;
    const window = {KeyboardEvent};
    const document = {body: {addEventListener() {}}, querySelector: () => settingsOpen};
    const ctx = createContext({window, document});
    for (const file of ['packages/lib/src/Emitter.js', 'packages/zenza/src/ShortcutActions.js',
      'packages/zenza/src/ShortcutKeyEmitter.js']) {
      run(beginSection(file), ctx);
    }
    run(`globalThis.config = new Emitter();
      config.props = buildDefaultKeyConfig();
      globalThis.external = new Emitter();
      external.emitResolve('init');
      globalThis.keys = ShortcutKeyEmitter.create(config, document.body, external);
      globalThis.consume = ShortcutKeyEmitter.consumeSharePress;`, ctx);
    await new Promise(resolve => setImmediate(resolve));
    const log = [];
    ctx.keys.on('keyDown', (name, event, param) => {
      log.push(name);
      const command = {SHARE_NICO_NEXT30: 'shareNicoNext30', SHARE_ZENZA_FULL: 'shareZenzaFull'}[name];
      if (!command) return;
      assert.equal(param, event);
      assert.equal(ctx.consume(event, 'wrong-command'), false);
      assert.equal(ctx.consume(event, command), true);
      assert.equal(ctx.consume(event, command), false);
    });
    return {
      log, defaults: ctx.config.props,
      set(key, value) { ctx.config.props[key] = value; ctx.config.emit('update', key); },
      press(fields) { ctx.external.emit('keydown', new KeyboardEvent(fields)); },
      settings(open) { settingsOpen = open; }
    };
  }

  it('requires a live trusted press on an assigned key, with no repeats while held or edited', async () => {
    const h = await setup();
    assert.equal(h.defaults.KEY_SHARE_NICO_NEXT30, 0);
    assert.equal(h.defaults.KEY_SHARE_ZENZA_FULL, 0);
    h.press();
    h.set('KEY_SHARE_NICO_NEXT30', 89);
    h.set('KEY_SHARE_ZENZA_FULL', 90);
    h.press();
    h.press({repeat: true});
    h.press({isTrusted: false});
    h.press({eventPhase: 0});
    h.press({isComposing: true});
    h.press({target: {tagName: 'TEXTAREA'}});
    h.press({composedPath: () => [{isContentEditable: true}]});
    h.settings(true);
    h.press();
    h.settings(false);
    h.press({keyCode: 90});
    h.set('KEY_SHARE_NICO_NEXT30', 0);
    h.press();
    assert.deepEqual(h.log, ['SHARE_NICO_NEXT30', 'SHARE_ZENZA_FULL']);
  });

  it('gives other bindings priority and suppresses both share actions on a duplicate', async () => {
    const h = await setup();
    h.set('KEY_SHARE_NICO_NEXT30', 89);
    h.set('KEY_SHARE_ZENZA_FULL', 89);
    h.press();
    h.set('KEY_SHARE_ZENZA_FULL', 0);
    h.set('KEY_TOGGLE_PLAY', 89);
    h.press();
    h.set('KEY_TOGGLE_PLAY', 0);
    h.set('KEY_TOGGLE_NOTIFICATION_HISTORY', 89);
    h.press();
    h.set('KEY_TOGGLE_NOTIFICATION_HISTORY', 0);
    h.set('relatedMenu.customLinks', [{id: 'link', shortcutKey: 89}]);
    h.press();
    h.set('relatedMenu.customLinks', []);
    h.press();
    assert.deepEqual(h.log, ['TOGGLE_PLAY', 'TOGGLE_NOTIFICATION_HISTORY', 'RELATED_MENU_LINKS', 'SHARE_NICO_NEXT30']);
  });
});
