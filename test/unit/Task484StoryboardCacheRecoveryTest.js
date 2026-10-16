// Task484 NICOCOMPAT-04: stale/corrupted storyboard caches never poison video
// previews or leak thumbnails from another video. Offline synthetic fixtures.
'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

const workerFile = 'packages/lib/src/nico/VideoSessionWorker.js';
const validCache = () => ({
  status: 'ok', watchId: 'sm9', format: 'domand', duration: 120,
  storyboard: {
    version: '1', interval: 10000, count: 12, rows: 2, columns: 3,
    thumbnail: {width: 160, height: 90},
    images: [
      {url: 'https://example.invalid/one.jpg', buffer: new ArrayBuffer(8)},
      {url: 'https://example.invalid/two.jpg', buffer: new ArrayBuffer(8)}
    ]
  }
});
const liveResult = () => ({
  status: 'ok', watchId: 'sm9', format: 'domand', duration: 120,
  storyboard: {
    interval: 10000, count: 12, rows: 2, columns: 3,
    thumbnail: {width: 160, height: 90},
    images: [{url: 'https://example.invalid/live.jpg'}]
  }
});

function fixture(cacheData, {deleteThrows = false, getThrows = false, imageResponse = {status: 'fail'}} = {}) {
  const lookups = [], deletes = [], posts = [], puts = [], warnings = [];
  const db = {
    async get(key) {lookups.push(key); if (getThrows) throw new Error('fixture cache down'); return cacheData;},
    async delete(key) {deletes.push(key); if (deleteThrows) throw new Error('fixture delete down');},
    async put(key, value) {puts.push({key, value});}
  };
  const ctx = createContext({
    StoryboardCacheDb: db,
    workerUtil: {createCrossMessageWorker: () => ({
      async post({command, params}) {
        posts.push({command, params});
        if (command === 'storyboard') return liveResult();
        if (command === 'storyboardImages') return imageResponse;
        throw new Error('unexpected command ' + command);
      }
    })},
    console: {log() {}, warn: (...a) => warnings.push(a), error() {}},
    URL, setTimeout, clearTimeout
  });
  run(
    'const createStoryboardClasses = ' + extract(workerFile, 'createStoryboardClasses', 'var') + ';\n' +
    'const VideoSessionWorker = ' + extract(workerFile, 'VideoSessionWorker', 'var') + ';\n' +
    'globalThis.__videoSessionWorker = VideoSessionWorker;', ctx);
  const info = {toJSON: () => ({watchId: 'sm9', duration: 120})};
  return {
    load: () => ctx.__videoSessionWorker.storyboard({type: 'domand', info}),
    lookups, deletes, posts, puts, warnings
  };
}
async function flush() {
  await Promise.resolve();await Promise.resolve();await Promise.resolve();
}

describe('Task484 StoryboardCacheDb validation and automatic recovery', () => {
  it('returns a valid cached storyboard without requesting a new worker session', async () => {
    const h = fixture(validCache());
    const result = await h.load(); await flush();
    assert.strictEqual(result.fromCache, true);
    assert.strictEqual(result.storyboard.images.length, 2);
    assert.deepStrictEqual(h.lookups, ['sm9_domand']);
    assert.deepStrictEqual(h.deletes, []);
    assert.strictEqual(h.posts.length, 0);
  });
  it('rejects cache data associated with another video and refetches', async () => {
    const poisoned = validCache(); poisoned.watchId = 'sm10';
    const h = fixture(poisoned);
    const result = await h.load();await flush();
    assert.strictEqual(result.fromCache, undefined);
    assert.strictEqual(result.watchId, 'sm9');
    assert.deepStrictEqual(h.lookups, ['sm9_domand']);
    assert.deepStrictEqual(h.deletes, ['sm9_domand']);
    assert.strictEqual(h.posts[0].command, 'storyboard');
  });
  it('rejects a storyboard for the wrong transport format', async () => {
    const poisoned = validCache(); poisoned.format = 'dmc';
    const h = fixture(poisoned);
    const result = await h.load();await flush();
    assert.strictEqual(result.fromCache, undefined);
    assert.strictEqual(h.deletes.length, 1);
  });
  it('rejects stored ok envelopes lacking real complete image pages', async () => {
    const variants = [
      d => {delete d.storyboard;},
      d => {d.storyboard = null;},
      d => {d.storyboard.images = null;},
      d => {d.storyboard.images = [];},
      d => {d.storyboard.images[0] = null;},
      d => {d.storyboard.images[0].url = 'javascript:alert(1)';},
      d => {d.storyboard.images[0].buffer = null;},
      d => {d.storyboard.thumbnail.width = 0;},
      d => {d.storyboard.rows = -1;},
      d => {d.storyboard.interval = -1;},
      d => {d.storyboard.count = 13;},
      d => {d.duration = NaN;},
      d => {d.storyboard.images = Array.from({length: 513},
        (_, i) => ({url: 'https://example.invalid/' + i, buffer: new ArrayBuffer(8)}));}
    ];
    for (const alter of variants) {
      const data = validCache(); alter(data);
      const h = fixture(data);
      const result = await h.load(); await flush();
      assert.strictEqual(result.fromCache, undefined, 'corrupted cache was returned');
      assert.strictEqual(h.deletes.length, 1, 'corrupted cache should be evicted');
      assert.strictEqual(h.posts[0]?.command, 'storyboard', 'fresh metadata must be loaded');
    }
  });
  it('returns a fresh worker response even when IndexedDB delete fails', async () => {
    const poisoned = validCache(); poisoned.watchId = 'wrong';
    const h = fixture(poisoned, {deleteThrows: true});
    const result = await h.load(); await flush();
    assert.strictEqual(result.watchId, 'sm9');
    assert.strictEqual(result.fromCache, undefined);
    assert.strictEqual(h.posts[0]?.command, 'storyboard');
  });
  it('returns a fresh worker response when the optional DB is unavailable', async () => {
    const h = fixture(null, {getThrows: true});
    const result = await h.load(); await flush();
    assert.strictEqual(result.watchId, 'sm9');
    assert.strictEqual(h.deletes.length, 0);
    assert.strictEqual(h.posts[0]?.command, 'storyboard');
  });
  it('does not evict a normal cache miss or failed storyboard status', async () => {
    for (const data of [null, {status: 'fail'}]) {
      const h = fixture(data); await h.load(); await flush();
      assert.strictEqual(h.deletes.length, 0);
      assert.strictEqual(h.posts[0]?.command, 'storyboard');
    }
  });
  it('cache buffers can be zero-length ArrayBuffers without triggering network', async () => {
    const cached = validCache(); cached.storyboard.images[0].buffer = new ArrayBuffer(0);
    const h = fixture(cached);
    const result = await h.load(); await flush();
    assert.strictEqual(result.fromCache, true);
    assert.strictEqual(h.posts.length, 0);
  });
});

describe('Task484 asynchronous cache write boundary', () => {
  it('does not persist invalid background worker responses', async () => {
    for (const change of [
      d => {d.watchId = 'other-video';},
      d => {d.format = 'dmc';},
      d => {d.storyboard.images[0].buffer = null;},
      d => {d.storyboard.count = 999;}
    ]) {
      const data = validCache();change(data);
      const h = fixture(null, {imageResponse: data});
      const result = await h.load();await flush();
      assert.strictEqual(result.status, 'ok');
      assert.strictEqual(h.posts[0]?.command, 'storyboard');
      assert.strictEqual(h.posts[1]?.command, 'storyboardImages');
      assert.strictEqual(h.puts.length, 0, 'malformed async response must not be cached');
    }
  });
  it('still persists a complete valid storyboard in background', async () => {
    const data = validCache();
    const h = fixture(null, {imageResponse: data});
    await h.load();await flush();
    assert.strictEqual(h.puts.length, 1);
    assert.strictEqual(h.puts[0].key, 'sm9_domand');
    assert.strictEqual(h.puts[0].value, data);
  });
});
