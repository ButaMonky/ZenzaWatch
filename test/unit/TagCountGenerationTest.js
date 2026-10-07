'use strict';

const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return {promise, resolve, reject};
}

function makeCountElm() {
  const classes = new Set();
  return {
    textContent: '',
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); },
      toggle(name, on) { on ? classes.add(name) : classes.delete(name); }
    }
  };
}

function setup(rel = 'src/VideoInfoPanel.js') {
  const requests = [];
  const context = createContext({
    Emitter: class {},
    window: {
      clearTimeout() {},
      setTimeout(callback) {
        callback();
        return 1;
      }
    }
  });
  context.window = Object.assign(context, context.window);
  run(
    `${extract(rel, 'VideoSearchForm')}; globalThis.Subject = VideoSearchForm;`,
    context
  );
  const VideoSearchForm = context.Subject;
  VideoSearchForm.WORD_COUNT_DELAY_MS = 0;
  VideoSearchForm.WORD_COUNT_CACHE_SIZE = 100;
  VideoSearchForm.fetchWordCount = (word, mode, options) => {
    const d = deferred();
    requests.push({word, mode, options: Object.assign({}, options), d});
    return d.promise;
  };

  const view = Object.create(VideoSearchForm.prototype);
  view._wordCountCache = new Map();
  view._form = {
    mode: {value: 'tag'},
    f_range: {value: 0},
    l_range: {value: 0},
    genre: {value: 'a'},
    elements: {namedItem() { return null; }}
  };
  return {view, requests};
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('Task253 tag-count request generation', () => {
  it('does not let an older success overwrite a newer result', async () => {
    const {view, requests} = setup();
    const countElm = makeCountElm();
    const li = {querySelector() { return countElm; }};

    view._requestTagCount(li, 'term');
    view._form.genre.value = 'b';
    view._requestTagCount(li, 'term');

    requests[1].d.resolve(222);
    await flush();
    assert.strictEqual(countElm.textContent, '222件');

    requests[0].d.resolve(111);
    await flush();
    assert.strictEqual(countElm.textContent, '222件');
  });

  it('does not let an older rejection clear a newer result', async () => {
    const {view, requests} = setup();
    const countElm = makeCountElm();
    const li = {querySelector() { return countElm; }};

    view._requestTagCount(li, 'term');
    view._form.genre.value = 'b';
    view._requestTagCount(li, 'term');

    requests[1].d.resolve(222);
    await flush();
    requests[0].d.reject(new Error('old request failed'));
    await flush();

    assert.strictEqual(countElm.textContent, '222件');
  });

  it('still renders an ordinary current-generation success', async () => {
    const {view, requests} = setup();
    const countElm = makeCountElm();
    const li = {querySelector() { return countElm; }};

    view._requestTagCount(li, 'term');
    requests[0].d.resolve(111);
    await flush();

    assert.strictEqual(countElm.textContent, '111件');
  });

  it('a newer cache hit invalidates an older in-flight request', async () => {
    const {view, requests} = setup();
    const countElm = makeCountElm();
    const li = {querySelector() { return countElm; }};

    view._requestTagCount(li, 'term');
    view._form.genre.value = 'b';
    view._wordCountCache.set(view._wordCountCacheKey('term', 'tag'), 333);
    view._requestTagCount(li, 'term');
    assert.strictEqual(countElm.textContent, '333件');

    requests[0].d.resolve(111);
    await flush();
    assert.strictEqual(countElm.textContent, '333件');
  });

  it('keeps generated dev dist stale-success ownership in parity with source', async () => {
    const {view, requests} = setup('dist/ZenzaWatch-dev.user.js');
    const countElm = makeCountElm();
    const li = {querySelector() { return countElm; }};

    view._requestTagCount(li, 'term');
    view._form.genre.value = 'b';
    view._requestTagCount(li, 'term');

    requests[1].d.resolve(222);
    await flush();
    assert.strictEqual(countElm.textContent, '222件');

    requests[0].d.resolve(111);
    await flush();
    assert.strictEqual(countElm.textContent, '222件');
  });
});
