// Task500: A valid cached storyboard remains usable when Worker startup fails.
// Invalid/missing cache must still expose startup failure; no real network calls.
'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

const SOURCE = 'packages/lib/src/nico/VideoSessionWorker.js';
const validCache = () => ({
  status: 'ok', watchId: 'sm9', format: 'domand', duration: 120,
  storyboard: {
    interval: 10000, count: 12, rows: 2, columns: 3,
    thumbnail: {width: 160, height: 90},
    images: [
      {url: 'https://example.invalid/a.jpg', buffer: new ArrayBuffer(8)},
      {url: 'https://example.invalid/b.jpg', buffer: new ArrayBuffer(8)}
    ]
  }
});

function harness({cache = null, startupFailure = false, failFirst = false,
  dbGetFails = false} = {}) {
  const actions = [], removals = [], warnings = [];
  let currentCache = cache;
  let attempts = 0;
  const failure = new Error('Worker constructor disabled (synthetic)');
  const ctx = createContext({
    StoryboardCacheDb: {
      async get(key) {
        actions.push('get:' + key);
        if (dbGetFails) {throw new Error('synthetic IndexedDB unavailable');}
        return currentCache;
      },
      async delete(key) {removals.push(key);},
      async put() {actions.push('cache-put');}
    },
    workerUtil: {createCrossMessageWorker() {
      attempts++;
      if (startupFailure || (failFirst && attempts === 1)) {throw failure;}
      return {
        async post({command}) {
          actions.push('post:' + command);
          if (command === 'storyboard') {
            return {status:'ok', watchId:'sm9', format:'domand',
              storyboard:{images: [{url:'https://example.invalid/new.jpg'}]}};
          }
          if (command === 'storyboardImages') {return {status:'fail'};}
          throw new Error('Unexpected fake worker command');
        }
      };
    }},
    console: {warn: (...args) => warnings.push(args), log() {}, error() {}},
    URL, setTimeout, clearTimeout
  });
  run(
    'const createStoryboardClasses=' +
      extract(SOURCE,'createStoryboardClasses','var') + ';\n' +
    'const VideoSessionWorker=' +
      extract(SOURCE,'VideoSessionWorker','var') + ';\n' +
    'globalThis.__workerSubject=VideoSessionWorker;', ctx
  );
  return {
    load: () => ctx.__workerSubject.storyboard({
      type: 'domand', info: {toJSON: () => ({watchId:'sm9',duration:120})}
    }),
    setCache: value => {currentCache = value;},
    get attempts() {return attempts;},
    failure, actions, removals, warnings
  };
}

describe('Task500 valid storyboard cache survives synchronous Worker failure', () => {
  it('serves valid cached thumbnails when Worker initialization throws', async () => {
    const h = harness({cache: validCache(), startupFailure: true});
    const result = await h.load();
    assert.equal(result.status,'ok');
    assert.equal(result.fromCache,true);
    assert.equal(result.storyboard.images.length,2);
    assert.strictEqual(h.attempts,1);
    assert.deepStrictEqual(h.removals, []);
    assert.deepStrictEqual(h.actions,['get:sm9_domand']);
    assert.deepStrictEqual(h.warnings, []);
  });
  it('preserves the original failure when a cache miss needs the Worker', async () => {
    const h = harness({startupFailure:true});
    await assert.rejects(h.load(),error => error === h.failure);
    assert.deepStrictEqual(h.removals,[]);
    assert.strictEqual(h.attempts,1);
  });
  it('does not return a malformed cache when Worker creation also fails', async () => {
    const wrong = validCache();
    wrong.watchId = 'sm10';
    const h = harness({cache:wrong, startupFailure:true});
    await assert.rejects(h.load(),error => error === h.failure);
    assert.deepStrictEqual(h.removals,['sm9_domand']);
    assert(!h.actions.some(x => x.startsWith('post:')));
  });
  it('keeps cache-db errors independent from Worker start failures', async () => {
    const h = harness({cache: validCache(), startupFailure:true, dbGetFails:true});
    await assert.rejects(h.load(),error => error === h.failure);
    assert.strictEqual(h.attempts,1);
    assert.deepStrictEqual(h.removals,[]);
  });
  it('can retry Worker construction later after a successful cache fallback', async () => {
    const h = harness({cache:validCache(),failFirst:true});
    const hit = await h.load();
    assert.strictEqual(hit.fromCache,true);
    h.setCache(null);
    const fresh = await h.load();
    assert.strictEqual(fresh.status,'ok');
    assert.strictEqual(fresh.fromCache,undefined);
    assert.strictEqual(h.attempts,2);
    assert(h.actions.includes('post:storyboard'));
  });
  it('keeps successful Worker preloading and normal cache-miss behavior', async () => {
    const h = harness();
    const fresh = await h.load();
    assert.strictEqual(fresh.status,'ok');
    assert.strictEqual(fresh.fromCache,undefined);
    assert.strictEqual(h.attempts,1);
    assert(h.actions.includes('post:storyboard'));
  });
  it('does not construct another Worker after initialization already succeeded', async () => {
    const h = harness();
    await h.load();
    h.setCache(validCache());
    const hit = await h.load();
    assert.strictEqual(hit.fromCache,true);
    assert.strictEqual(h.attempts,1);
  });
});
