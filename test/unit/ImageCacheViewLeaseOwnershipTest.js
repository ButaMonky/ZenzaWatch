'use strict';
const assert = require('assert');
const {extract, createContext, loadClass, run} = require('../helpers/extractSource');
const files = [
  ['source', 'packages/zenza/src/storyboard/StoryboardWorker.js'],
  ['dev-dist', 'dist/ZenzaWatch-dev.user.js']
];
const data = (...urls) => ({
  status: 'ok', format: 'dmc', duration: 120,
  storyboard: {version: '1', thumbnail: {width: 160, height: 90},
    columns: 1, rows: 1, interval: 10000, count: urls.length,
    images: urls.map(url => ({url}))}
});
function fixture(path) {
  const closed = new Map(), loaded = new Map();
  const context = createContext({
    Emitter: class { emit() {} },
    BLANK_IMG: {},
    loadImage: async src => {
      const image = {src, close() {closed.set(src, (closed.get(src) || 0) + 1);}};
      loaded.set(src, image);
      return image;
    }
  });
  const model = path === 'dist/ZenzaWatch-dev.user.js' ?
    path : 'packages/zenza/src/storyboard/StoryboardInfoModel.js';
  context.StoryboardInfoModel = loadClass(model, 'StoryboardInfoModel', context);
  const code = 'var ImageCacheMap = ' +
    extract(path, 'ImageCacheMap', 'var') + ';' +
    extract(path, 'ThumbnailView') +
    ';globalThis.ImageCacheMapTest=ImageCacheMap;' +
    'globalThis.ThumbnailViewTest=ThumbnailView;';
  run(code, context);
  const canvas = () => ({width: 160, height: 90,
    getContext: () => ({clearRect() {}, drawImage() {}})});
  const view = (...urls) => new context.ThumbnailViewTest({
    canvas: canvas(), info: data(...urls), name: 'lease-test'
  });
  return {cache: context.ImageCacheMapTest, view, closed, loaded};
}
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
for (const [label, path] of files) {
  describe('AUD-56 image cache lease ownership ' + label, () => {
    it('keeps a shared bitmap open until the final thumbnail view releases it', async () => {
      const h = fixture(path);
      const a = h.view('P0'), b = h.view('P0');
      await a.setCurrentTime(0);
      await b.setCurrentTime(0);
      assert.strictEqual(h.cache.map.get('P0').ref, 2);
      a.dispose();
      await flush();
      assert.strictEqual(h.closed.get('P0') || 0, 0);
      assert.strictEqual(h.cache.has('P0'), true);
      b.dispose();
      await flush();
      assert.strictEqual(h.closed.get('P0'), 1);
      assert.strictEqual(h.cache.has('P0'), false);
    });
    it('does not overcount repeated same-page acquisition by one view', async () => {
      const h = fixture(path), a = h.view('P0');
      a.prefetch = () => {};
      await a.setCurrentTime(0);
      a.lastPos = {};
      a._currentTime = -1;
      await a.setCurrentTime(1);
      assert.strictEqual(h.cache.map.get('P0').ref, 1);
      a.dispose();
      await flush();
      assert.strictEqual(h.closed.get('P0'), 1);
      assert.strictEqual(h.cache.has('P0'), false);
    });
    it('makes repeated dispose harmless to other active views', async () => {
      const h = fixture(path), a = h.view('P0'), b = h.view('P0');
      await a.setCurrentTime(0);
      await b.setCurrentTime(0);
      a.dispose();
      a.dispose();
      await flush();
      assert.strictEqual(h.cache.has('P0'), true);
      assert.strictEqual(h.closed.get('P0') || 0, 0);
      b.dispose();
      await flush();
      assert.strictEqual(h.closed.get('P0'), 1);
    });
    it('bounds leases to the current storyboard page and its neighbors', async () => {
      const h = fixture(path);
      const urls = Array.from({length: 12}, (_, n) => 'P' + n);
      const a = h.view(...urls);
      for (let i = 0; i < urls.length; i++) {
        await a.setCurrentTime(i * 10);
        await flush();
        assert.ok(h.cache.map.size <= 3, 'too many pinned storyboard pages at seek ' + i);
      }
      assert.ok((h.closed.get('P0') || 0) >= 1, 'old pages should be released');
      a.dispose();
      await flush();
      assert.strictEqual(h.cache.map.size, 0);
    });
    it('does not evict pinned shared images during GC pressure', async () => {
      const h = fixture(path);
      const urls = Array.from({length: 11}, (_, n) => 'G' + n);
      for (const url of urls) { await h.cache.get(url); }
      await flush();
      assert.strictEqual(h.cache.map.size, urls.length);
      assert.strictEqual([...h.closed.values()].reduce((a, b) => a + b, 0), 0);
      urls.forEach(url => h.cache.release(url));
      await flush();
      assert.strictEqual(h.cache.map.size, 0);
      assert.strictEqual([...h.closed.values()].reduce((a, b) => a + b, 0), urls.length);
    });
  });
}
