'use strict';
const assert = require('assert');
const {extract, createContext, loadClass, run} = require('../helpers/extractSource');
const sources = ['packages/zenza/src/storyboard/StoryboardWorker.js',
  'dist/ZenzaWatch-dev.user.js'];
const deferred = () => {
  let resolve;
  const promise = new Promise(done => {resolve = done;});
  return {promise, resolve};
};
const storyboard = () => ({
  status: 'ok', format: 'dmc', duration: 120,
  storyboard: {version: '1', thumbnail: {width: 160, height: 90},
    columns: 1, rows: 1, interval: 10000, count: 1, images: [{url: 'P0'}]}
});
const canvas = (width = 160, height = 90) => ({
  width, height, getContext() {return {
    clearRect() {}, beginPath() {}, drawImage() {}, strokeRect() {}
  };}
});
function harness(source) {
  const first = deferred(), second = deferred();
  let attempts = 0, closed = 0;
  const ctx = createContext({
    Emitter: class {emit() {}}, BLANK_IMG: {},
    getCanvas: canvas,
    console: {time() {}, timeEnd() {}, warn() {}},
    loadImage: src => {
      if (src !== 'P0') {throw new Error('unexpected URL');}
      return ++attempts === 1 ? first.promise : second.promise;
    }
  });
  ctx.StoryboardInfoModel = loadClass(source.startsWith('dist/') ?
    source : 'packages/zenza/src/storyboard/StoryboardInfoModel.js',
  'StoryboardInfoModel', ctx);
  run('var ImageCacheMap=' + extract(source, 'ImageCacheMap', 'var') +
    ';' + extract(source, 'BoardView') +
    ';globalThis.TestCache=ImageCacheMap;globalThis.TestBoard=BoardView;', ctx);
  const a = new ctx.TestBoard({canvas: canvas(), info: null, name: 'old'});
  const b = new ctx.TestBoard({canvas: canvas(), info: null, name: 'new'});
  a.reDraw = b.reDraw = () => {};
  return {a, b, cache: ctx.TestCache, first, second,
    attempts: () => attempts, closed: () => closed};
}
for (const source of sources) {
  describe('AUD-56 BoardView old/new page-cache generation ' + source, () => {
    it('does not let a failed old board release the newer pending cache', async () => {
      const h = harness(source);
      const oldTask = h.a.setInfo(storyboard());
      const oldCache = h.cache.map.get('P0');
      let newTask;
      oldCache.promise.then(() => {
        // Cache eviction callback ran; schedule the new request before old
        // BoardView await resumes and reaches its finally/release.
        newTask = h.b.setInfo(storyboard());
      });
      h.first.resolve(null);
      await oldTask;
      assert.ok(newTask, 'new board must have requested replacement page');
      assert.strictEqual(h.attempts(), 2);
      assert.notStrictEqual(h.cache.map.get('P0'), oldCache);
      assert.strictEqual(h.cache.map.get('P0').ref, 1,
        'old BoardView must not decrement new generation reference');
      h.second.resolve({src: 'P0', close() {}});
      await newTask;
      assert.strictEqual(h.cache.has('P0'), false);
      h.a.dispose();
      h.b.dispose();
    });
  });
}
