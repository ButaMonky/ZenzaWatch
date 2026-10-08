'use strict';
const assert = require('assert');
const {read, extract, createContext, run} = require('../helpers/extractSource');
function storage() {
  const source = read('src/_hls.js');
  const start = source.indexOf('    const Storage = {', source.indexOf('    const createWebWorker'));
  const end = source.indexOf('\n    try {\n      Storage.worker =', start);
  const timers = new Map(); let sequence = 0;
  const c = createContext({performance: {now: () => sequence++},
    setTimeout: fn => { timers.set(++sequence, fn); return sequence; },
    clearTimeout: id => timers.delete(id)});
  run(source.slice(start, end) + ';globalThis.subject = Storage;', c);
  const sent = []; c.subject.worker = {postMessage: data => sent.push(data)};
  return {s: c.subject, sent, timers};
}
async function rejection(p) { let error; try { await p; } catch (e) { error = e; } assert(error); }
describe('Task301 HLS cache RPC failure contracts', () => {
  it('rejects failed responses and releases pending requests', async () => {
    const {s, sent, timers} = storage(); const p = s.load({hash: 'x'}); const checked = rejection(p);
    s.onMessage({data: {id: sent[0].id, status: 'fail', result: 'failed'}});
    await checked; assert.strictEqual(Object.keys(s.request).length, 0); assert.strictEqual(timers.size, 0);
  });
  it('returns boolean cache presence', async () => {
    const {s, sent} = storage(); const p = s.hasData({hash: 'x'});
    s.onMessage({data: {id: sent[0].id, status: 'ok', result: {result: false}}});
    assert.strictEqual(await p, false);
  });
  it('times out silent requests and clears their entries', async () => {
    const {s, timers} = storage(); const p = s.load({hash: 'x'}); const checked = rejection(p);
    assert.strictEqual(timers.size, 1);
    for (const fn of [...timers.values()]) { fn(); }
    await checked; assert.strictEqual(Object.keys(s.request).length, 0); assert.strictEqual(timers.size, 0);
  });
  it('cleans up synchronous postMessage failures', async () => {
    const {s, timers} = storage(); s.worker.postMessage = () => { throw new Error('clone failed'); };
    await rejection(s.load({hash: 'x'}));
    assert.strictEqual(Object.keys(s.request).length, 0); assert.strictEqual(timers.size, 0);
  });
  it('rejects all pending calls after worker failure', async () => {
    const {s, timers} = storage(); const calls = [rejection(s.load({hash: 'a'})), rejection(s.hasData({hash: 'b'}))];
    s.onError(); await Promise.all(calls);
    assert.strictEqual(Object.keys(s.request).length, 0); assert.strictEqual(timers.size, 0);
  });
  it('preserves successful cached payloads', async () => {
    const {s, sent, timers} = storage(); const p = s.load({hash: 'x'}); const buffer = new ArrayBuffer(4);
    s.onMessage({data: {id: sent[0].id, result: {url: 'x'}, buffer}});
    const [meta, data] = await p; assert.strictEqual(meta.url, 'x'); assert.strictEqual(data, buffer);
    assert.strictEqual(timers.size, 0);
  });
});
function loader(cacheLoad) {
  const loads = [];
  class Base { load(...args) { loads.push(args); } abort() {} destroy() {} }
  const c = createContext({Hls: {DefaultConfig: {loader: Base}},
    Storage: {load: cacheLoad, save: () => Promise.resolve(), gc() {}},
    Config: {get: key => key === 'enable_db_cache'}, XMLHttpRequest: class {},
    performance: {now: () => 10000}});
  run(`let FragmentLoaderClass; globalThis.Loader = (${extract('src/_hls.js', 'createFragmentLoader', 'var')})(Hls);`, c);
  return {instance: new c.Loader({fragLoadingMaxRetry: 3}), loads};
}
const context = () => ({url: 'https://example.invalid/nicovideo-sm9_a/0/ts/1.ts',
  frag: {url: 'https://example.invalid/nicovideo-sm9_a/0/ts/1.ts', level: 0, sn: 1}});
describe('Task301 HLS cache failure network fallback', () => {
  for (const [name, load] of [['miss', async () => [null, null]],
    ['failure', async () => { throw new Error('cache unavailable'); }],
    ['malformed hit', async () => [{url: 'x'}, null]]]) {
    it(`uses the network after ${name}`, async () => {
      const {instance, loads} = loader(load);
      await instance.load(context(), {}, {onSuccess() {}, onError() {}});
      assert.strictEqual(loads.length, 1);
    });
  }
  it('serves a valid cache hit without network', async () => {
    const buffer = new ArrayBuffer(4); let received;
    const {instance, loads} = loader(async () => [{url: 'cached', stats: {}}, buffer]);
    await instance.load(context(), {}, {onSuccess: resp => { received = resp.data; }, onError() {}});
    assert.strictEqual(received, buffer); assert.strictEqual(loads.length, 0);
  });
  it('does not start network after abort while waiting for cache', async () => {
    let finish; const {instance, loads} = loader(() => new Promise(resolve => { finish = resolve; }));
    const p = instance.load(context(), {}, {onSuccess() {}, onError() {}});
    instance.abort(); finish([null, null]); await p; assert.strictEqual(loads.length, 0);
  });
  it('propagates database initialization failure from getStore', async () => {
    const c = createContext();
    run(extract('src/_hls.js', 'IndexDBStorage') + ';globalThis.Subject = IndexDBStorage;', c);
    c.Subject.init = async () => { throw new Error('open failed'); };
    await rejection(new c.Subject().getStore());
  });
});
describe('Task301 HLS optional worker startup', () => {
  it('falls back to network when Worker construction is denied', async () => {
    const source = read('src/_hls.js');
    const start = source.indexOf('    const Storage = {', source.indexOf('    const createWebWorker'));
    const end = source.indexOf('    const ZenzaVideoElement', start);
    const c = createContext({createWebWorker() { throw new Error('Worker denied'); }, StorageWorker() {},
      Config: {get: () => false}, debounce: fn => fn, console: {warn() {}}});
    run(source.slice(start, end) + ';globalThis.subject = Storage;', c);
    const {instance, loads} = loader(() => c.subject.load({hash: 'x'}));
    await instance.load(context(), {}, {onSuccess() {}, onError() {}});
    assert.strictEqual(loads.length, 1); assert.strictEqual(Object.keys(c.subject.request).length, 0);
  });
  it('releases the worker script URL even if construction throws', () => {
    const revoked = [];
    const c = createContext({Blob: class {}, Worker: class {constructor() { throw new Error('denied'); }},
      URL: {createObjectURL: () => 'blob:worker', revokeObjectURL: url => revoked.push(url)}});
    run(`globalThis.create = ${extract('src/_hls.js', 'createWebWorker', 'var')}`, c);
    assert.throws(() => c.create(function() {}), /denied/);
    assert.deepStrictEqual(revoked, ['blob:worker']);
  });
});

describe('Task301 HLS prefetch cache metadata', () => {
  it('stores fetched bytes with metadata when cache is absent', async () => {
    const saved = [], bytes = new ArrayBuffer(8);
    const c = createContext({Hls: {DefaultConfig: {loader: class {}}},
      Storage: {hasData: async () => false, save: async (...args) => saved.push(args)},
      AbortController: class {constructor() { this.signal = {}; } abort() {}},
      Request: class {}, fetch: async () => ({ok: true, status: 200, arrayBuffer: async () => bytes}),
      debounce: () => { const fn = () => {}; fn.cancel = () => {}; return fn; }});
    run(`let FragmentLoaderClass; globalThis.Loader = (${extract('src/_hls.js', 'createFragmentLoader', 'var')})(Hls);`, c);
    const frag = context().frag;
    assert.strictEqual(await c.Loader.preloadFragment(frag, frag.url), true);
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0][0].meta.contentLength, 8);
    assert.strictEqual(saved[0][0].meta.total, 8);
    assert.strictEqual(saved[0][0].meta.url, frag.url);
    assert.strictEqual(saved[0][1].byteLength, 8);
  });
});
