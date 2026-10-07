'use strict';

const assert = require('assert');
const {extract, beginSection, createContext, run} = require('../helpers/extractSource');

function makeElement(tag = 'div') {
  const children = [];
  const attrs = new Map();
  const classes = new Set();
  return {
    tagName: tag.toUpperCase(),
    children,
    dataset: {},
    className: '',
    textContent: '',
    innerHTML: '',
    width: 0,
    height: 0,
    classList: {
      add(...names) { names.forEach(name => classes.add(name)); },
      remove(...names) { names.forEach(name => classes.delete(name)); },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { attrs.set(name, String(value)); },
    append(...nodes) { children.push(...nodes); },
    getContext() {
      return {fillStyle: '', fillRect() {}, drawImage() {}};
    }
  };
}

function loadUaaView({loader, capture, timers, rel = 'src/VideoInfoPanel.js'}) {
  class BaseViewComponent {
    setState(next) { Object.assign(this._state, next); }
    _onCommand() {}
  }
  const document = {
    createElement: makeElement,
    createDocumentFragment: () => makeElement('fragment')
  };
  const window = {
    console,
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout
  };
  const context = createContext({
    BaseViewComponent,
    Config: {namespace: () => ({props: {enable: true}})},
    ZenzaWatch: {debug: {}, util: {VideoCaptureUtil: {capture}}},
    UaaLoader: loader,
    textUtil: {secToTime: sec => String(sec)},
    document,
    window,
    AbortController
  });
  run(`${extract(rel, 'UaaView')}; globalThis.Subject = UaaView;`, context);
  return context.Subject;
}

function fakeTimers() {
  let nextId = 1;
  const entries = new Map();
  return {
    setTimeout(fn) {
      const id = nextId++;
      entries.set(id, fn);
      return id;
    },
    clearTimeout(id) { entries.delete(id); },
    runAll() {
      const current = [...entries.entries()];
      entries.clear();
      current.forEach(([, fn]) => fn());
    },
    get size() { return entries.size; }
  };
}

function makeView(UaaView) {
  const view = Object.create(UaaView.prototype);
  view._shadow = {};
  view._config = {props: {enable: true}};
  view._elm = {body: makeElement('div')};
  view._state = {isUpdating: false, isExist: false, isSpeaking: false};
  view._props = {};
  return view;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('Task261 UAA stale work cancellation', () => {
  it('clear cancels the old delayed load so only the new video loads', () => {
    const timers = fakeTimers();
    const loads = [];
    const UaaView = loadUaaView({
      loader: {load: () => Promise.resolve({data: {sponsors: []}})},
      capture: () => Promise.resolve({width: 1, height: 1}),
      timers
    });
    const view = makeView(UaaView);
    view.load = videoInfo => loads.push(videoInfo.videoId);

    view.update({videoId: 'smA'});
    assert.strictEqual(timers.size, 1);
    view.clear();
    view.update({videoId: 'smB'});
    assert.strictEqual(timers.size, 1);
    timers.runAll();

    assert.deepStrictEqual(loads, ['smB']);
  });

  it('clear aborts an already-started UAA request and the next video gets a fresh signal', async () => {
    const timers = fakeTimers();
    const signals = [];
    const loader = {
      load(videoId, options = {}) {
        signals.push({videoId, signal: options.signal});
        return new Promise(() => {});
      }
    };
    const UaaView = loadUaaView({
      loader,
      capture: () => Promise.resolve({width: 1, height: 1}),
      timers
    });
    const view = makeView(UaaView);

    view.update({videoId: 'smA'});
    timers.runAll();
    assert.strictEqual(signals.length, 1);
    const first = signals[0].signal;
    assert.ok(first, 'UAA loader did not receive an AbortSignal');
    assert.strictEqual(first.aborted, false);

    view.clear();
    assert.strictEqual(first.aborted, true);

    view.update({videoId: 'smB'});
    timers.runAll();
    assert.strictEqual(signals.length, 2);
    assert.ok(signals[1].signal);
    assert.notStrictEqual(signals[1].signal, first);
    assert.strictEqual(signals[1].signal.aborted, false);
  });

  it('passes the active generation signal into screenshot capture', async () => {
    const timers = fakeTimers();
    let captureSignal;
    const capture = (url, sec, options = {}) => {
      captureSignal = options.signal;
      return Promise.resolve({width: 1, height: 1});
    };
    const UaaView = loadUaaView({
      loader: {load: () => Promise.resolve({data: {sponsors: []}})},
      capture,
      timers
    });
    const view = makeView(UaaView);
    const controller = new AbortController();
    view._generation = 7;
    view._abortController = controller;
    view._props.videoInfo = {getCurrentVideo: () => Promise.resolve('https://example.invalid/video.mp4')};
    view._props.videoId = 'smA';

    view._createItem({
      advertiserName: 'x',
      message: 'm',
      auxiliary: {bgVideoPosition: '10'}
    }, 0, 7, controller.signal);
    await flush();

    assert.strictEqual(captureSignal, controller.signal);
    view.clear();
    assert.strictEqual(controller.signal.aborted, true);
  });

  it('UaaLoader forwards a caller AbortSignal to netUtil.fetch', async () => {
    let received;
    const context = createContext({
      netUtil: {
        fetch: async (url, options) => {
          received = options;
          return {json: async () => ({data: {sponsors: []}})};
        }
      }
    });
    const UaaLoader = run(beginSection('packages/lib/src/nico/UaaLoader.js') + ';UaaLoader;', context);
    const controller = new AbortController();

    await UaaLoader.load('sm9', {limit: 12, signal: controller.signal});

    assert.strictEqual(received.signal, controller.signal);
    assert.strictEqual(received.credentials, 'include');
  });

  it('keeps generated dev dist timer cancellation in parity with source', () => {
    const timers = fakeTimers();
    const loads = [];
    const UaaView = loadUaaView({
      loader: {load: () => Promise.resolve({data: {sponsors: []}})},
      capture: () => Promise.resolve({width: 1, height: 1}),
      timers,
      rel: 'dist/ZenzaWatch-dev.user.js'
    });
    const view = makeView(UaaView);
    view.load = videoInfo => loads.push(videoInfo.videoId);

    view.update({videoId: 'smA'});
    view.clear();
    view.update({videoId: 'smB'});
    timers.runAll();

    assert.deepStrictEqual(loads, ['smB']);
  });

  it('keeps generated dev dist UaaLoader signal propagation in parity with source', async () => {
    let received;
    const context = createContext({
      netUtil: {
        fetch: async (url, options) => {
          received = options;
          return {json: async () => ({data: {sponsors: []}})};
        }
      }
    });
    const loaderInit = extract('dist/ZenzaWatch-dev.user.js', 'UaaLoader', 'var');
    const UaaLoader = run(`globalThis.Subject = (${loaderInit}); Subject;`, context);
    const controller = new AbortController();

    await UaaLoader.load('sm9', {limit: 12, signal: controller.signal});

    assert.strictEqual(received.signal, controller.signal);
    assert.strictEqual(received.credentials, 'include');
  });
});
