'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {loadClass, createContext} = require('../helpers/extractSource');
const {REPO_ROOT} = require('../helpers/buildSandbox');

describe('Task310 toolbar display modes and idle timing', () => {
  function viewHarness() {
    const mode = {full: false};
    const ctx = createContext({
      Fullscreen: {now: () => mode.full},
      Emitter: class {},
      global: {innerWidth: 1280, innerHeight: 720}
    });
    const View = loadClass('src/NicoVideoPlayerDialog.js', 'NicoVideoPlayerDialogView', ctx);
    const view = Object.create(View.prototype);
    view._state = {screenMode: 'normal'};
    const calls = [];
    const small = () => calls.push('small:3000');
    small.cancel = () => calls.push('small:cancel');
    const normal = () => calls.push('normal:400');
    normal.cancel = () => calls.push('normal:cancel');
    view._onControlBarIdleDebounced = small;
    view._onControlBarIdleDebouncedDefault = normal;
    return {view, mode, calls, ctx};
  }
  it('keeps 3 seconds only in small mode and uses original 400ms otherwise', () => {
    const h = viewHarness();
    h.view._scheduleControlBarIdle();
    assert.deepStrictEqual(h.calls, ['small:cancel', 'normal:400']);
    h.calls.length = 0;
    h.view._state.screenMode = 'small';
    h.view._scheduleControlBarIdle();
    assert.deepStrictEqual(h.calls, ['normal:cancel', 'small:3000']);
    h.calls.length = 0;
    h.mode.full = true;
    h.view._scheduleControlBarIdle();
    assert.deepStrictEqual(h.calls, ['small:cancel', 'normal:400']);
  });
  it('pause shares the current mode timer and clears the opposite timer', () => {
    const h = viewHarness();
    h.view.addClass = () => {};
    h.view._onVideoPause();
    assert.strictEqual(h.view._isControlBarActive, true);
    assert.deepStrictEqual(h.calls, ['small:cancel', 'normal:400']);
    h.calls.length = 0;
    h.view._state.screenMode = 'small';
    h.view._onVideoPause();
    assert.deepStrictEqual(h.calls, ['normal:cancel', 'small:3000']);
  });
  it('recomputes auto / always-show / always-hide without the vMargin override', () => {
    const h = viewHarness();
    h.mode.full = true;
    h.ctx.global.innerHeight = 1200; // Plenty of spare vertical space.
    h.view._state.isOpen = true;
    h.view._aspectRatio = 9 / 16;
    const cfg = h.view._playerConfig = {props: {fullscreenControlBarMode: 'auto'}};
    h.view._$playerContainer = {find: () => [{offsetHeight: 40}]};
    h.view.varMapper = {videoControlBarHeight: 44};
    h.view.toggleClass = (cls, enabled) => h.calls.push([cls, enabled]);
    for (const [value, expected] of [
      ['auto', false],
      ['always-show', true],
      ['always-hide', false]
    ]) {
      cfg.props.fullscreenControlBarMode = value;
      h.calls.length = 0;
      h.view._updateResponsive({onlyControlBar: true});
      assert.deepStrictEqual(h.calls, [['showVideoControlBar', expected]], value);
    }
  });
  it('applies toolbar selection to body dataset immediately', () => {
    const callbacks = {};
    const pending = [];
    const config = {
      props: {menuScale: 1, commentLayerOpacity: 0.7, fullscreenControlBarMode: 'auto'},
      onkey: (key, handler) => { callbacks[key] = handler; }
    };
    const fakeDebounce = fn => {
      const f = () => pending.push(fn);
      f.cancel = () => { pending.length = 0; };
      return f;
    };
    const element = {dataset: {}};
    const ctx = createContext({
      _: {debounce: fakeDebounce},
      Emitter: class {emit() {}},
      VideoControlBar: {BASE_HEIGHT: 40, BASE_SEEKBAR_HEIGHT: 10},
      cssUtil: {setProps() {}},
      css: {px: value => value},
      document: {body: element}
    });
    const Mapper = loadClass('src/NicoVideoPlayerDialog.js', 'VariablesMapper', ctx);
    new Mapper({config, element});
    config.props.fullscreenControlBarMode = 'always-show';
    callbacks.fullscreenControlBarMode();
    assert.strictEqual(element.dataset.fullscreenControlBarMode, 'always-show');
    assert.strictEqual(pending.length, 0, 'mode changes must not wait 500ms');
  });
  it('the fullscreen CSS respects always-hide while keeping hover/focus recovery', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src/VideoControlBar.js'), 'utf8');
    assert(src.includes('body[data-fullscreen-control-bar-mode="always-hide"] .is-controlBarActive .videoControlBar'));
    assert(src.includes('body[data-fullscreen-control-bar-mode="always-hide"] .videoControlBar:hover'));
    assert(src.includes('body[data-fullscreen-control-bar-mode="always-hide"] .videoControlBar:focus-within'));
    assert(src.includes('body[data-fullscreen-control-bar-mode="always-show"] .fullscreenControlBarModeMenu'));
  });
  it('renders 百 for article-present tags without changing the existing font', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src/TagListView.js'), 'utf8');
    const start = src.indexOf('class TagItemMenu');
    const inner = src.slice(start);
    assert(inner.includes("content: '？';"), 'unknown articles keep the question mark');
    assert(/\.has-nicodic \.toggle::after\s*\{\s*content:\s*'百';/.test(inner));
    assert(inner.includes('font-size: 0.8em;'));
    assert(inner.includes('font-weight: bolder;'));
  });
});
