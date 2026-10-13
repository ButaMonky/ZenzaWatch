'use strict';
const assert = require('assert');
const {extract, createContext, loadClass, run} = require('../helpers/extractSource');
const variants = [
  ['source', 'packages/zenza/src/storyboard/StoryboardWorker.js'],
  ['generated dev', 'dist/ZenzaWatch-dev.user.js']
];
function fixture(path, failed = {P0: 1}) {
  const calls = new Map(), draws = [];
  let closedBlank = 0;
  const blank = {src: 'BLANK', close() {closedBlank++;}};
  const context = createContext({
    Emitter: class {emit() {}}, BLANK_IMG: blank,
    loadImage: async src => {
      const n = (calls.get(src) || 0) + 1;
      calls.set(src, n);
      if (n <= (failed[src] || 0)) { return null; }
      return {src, close() {}};
    }
  });
  const modelFile = path.startsWith('dist/') ? path :
    'packages/zenza/src/storyboard/StoryboardInfoModel.js';
  context.StoryboardInfoModel = loadClass(modelFile, 'StoryboardInfoModel', context);
  run('var ImageCacheMap=' + extract(path, 'ImageCacheMap', 'var') +
    ';' + extract(path, 'ThumbnailView') +
    ';globalThis.TestImageCache=ImageCacheMap;' +
    'globalThis.TestThumbnail=ThumbnailView;', context);
  const raw = {
    status: 'ok', format: 'dmc', duration: 120,
    storyboard: {
      version: '1', thumbnail: {width: 160, height: 90},
      columns: 1, rows: 1, interval: 10000, count: 3,
      images: ['P0', 'P1', 'P2'].map(url => ({url}))
    }
  };
  const canvas = {width: 160, height: 90, getContext() {
    return {clearRect() {}, drawImage(img) {draws.push(img.src);}};
  }};
  const view = new context.TestThumbnail({canvas, info: raw, name: 'failed-image-retry'});
  return {view, newView: () => new context.TestThumbnail({
    canvas, info: raw, name: 'second-view'
  }), cache: context.TestImageCache, calls, draws,
    closedBlank: () => closedBlank, count: src => calls.get(src) || 0};
}
const flush = async () => {
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
};
for (const [label, path] of variants) {
  describe('AUD-56 failed thumbnail image lease retry ' + label, () => {
    it('retries a failed page when seeking the exact same time again', async () => {
      const h = fixture(path);
      h.view.prefetch = () => {};
      await h.view.setCurrentTime(0);
      assert.strictEqual(h.count('P0'), 1);
      assert.strictEqual(h.cache.has('P0'), false);
      await h.view.setCurrentTime(0);
      assert.strictEqual(h.count('P0'), 2);
      assert.strictEqual(h.cache.has('P0'), true);
      h.view.dispose();
    });
    it('retries after a one-page round trip without needing a two-page hop', async () => {
      const h = fixture(path);
      h.view.prefetch = () => {};
      await h.view.setCurrentTime(0);
      await h.view.setCurrentTime(10);
      await h.view.setCurrentTime(0);
      assert.strictEqual(h.count('P0'), 2);
      assert.strictEqual(h.cache.has('P0'), true);
      h.view.dispose();
    });
    it('drops a failed prefetch lease before direct seek retries', async () => {
      const h = fixture(path, {P1: 1});
      h.view.prefetch(1);
      await flush();
      assert.strictEqual(h.count('P1'), 1);
      assert.strictEqual(h.cache.has('P1'), false);
      await h.view.setCurrentTime(10);
      assert.strictEqual(h.count('P1'), 2);
      assert.strictEqual(h.cache.has('P1'), true);
      h.view.dispose();
    });
    it('permits repeated user-driven retries without pinning BLANK fallback', async () => {
      const h = fixture(path, {P0: 2});
      h.view.prefetch = () => {};
      await h.view.setCurrentTime(0);
      await h.view.setCurrentTime(0);
      assert.strictEqual(h.count('P0'), 2);
      assert.strictEqual(h.view._imageLeases.has('P0'), false);
      await h.view.setCurrentTime(0);
      assert.strictEqual(h.count('P0'), 3);
      h.view.dispose();
      await flush();
      assert.strictEqual(h.closedBlank(), 0);
    });
    it('never releases a new cache generation with an old identity token', async () => {
      const h = fixture(path);
      h.view.prefetch = () => {};
      const pending = h.view.setCurrentTime(0);
      const oldEntry = h.cache.map.get('P0');
      await pending;
      assert.strictEqual(h.cache.has('P0'), false);
      const b = h.newView(); b.prefetch = () => {};
      await b.setCurrentTime(0);
      assert.strictEqual(h.cache.map.get('P0').ref, 1);
      assert.notStrictEqual(h.cache.map.get('P0'), oldEntry);
      h.cache.release('P0', oldEntry);
      assert.strictEqual(h.cache.map.get('P0').ref, 1);
      h.view.dispose(); b.dispose();
    });
    it('does not let an old view release the replacement image at dispose', async () => {
      const h = fixture(path);
      h.view.prefetch = () => {};
      const pending = h.view.setCurrentTime(0);
      const oldEntry = h.cache.map.get('P0');
      await pending;
      const b = h.newView(); b.prefetch = () => {};
      await b.setCurrentTime(0);
      h.view._imageLeases.set('P0', {
        request: Promise.resolve({src: 'BLANK'}), cache: oldEntry
      });
      h.view.dispose();
      assert.strictEqual(h.cache.has('P0'), true);
      assert.strictEqual(h.cache.map.get('P0').ref, 1);
      b.dispose();
    });
    it('preserves one cached acquisition for repeated successful seeks', async () => {
      const h = fixture(path, {});
      h.view.prefetch = () => {};
      await h.view.setCurrentTime(20);
      await h.view.setCurrentTime(20);
      await h.view.setCurrentTime(21);
      assert.strictEqual(h.count('P2'), 1);
      h.view.dispose();
    });
  });
}
