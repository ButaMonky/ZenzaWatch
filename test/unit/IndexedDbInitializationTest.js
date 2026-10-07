const fs = require('fs');
const path = require('path');
const {assert, ticks, observe, deferred, controllerFixture, gateFixture,
  quiet, eventTarget, extract, beginSection, createContext, run} = require('../helpers/idbRecoveryFixture');

describe('IndexedDB initialization and exception propagation (ZW-083)', function() {
  it('shares an in-flight open and releases failed initialization for retry', async function() {
    const f = controllerFixture();
    const args = {name: 'fixture', ver: 2, stores: []};
    const first = observe(f.controller.init(args));
    const second = observe(f.controller.init(args));
    assert.strictEqual(f.opens.length, 1);
    const failure = new Error('open failed');
    f.opens[0].req.error = failure;
    f.opens[0].req.fire('error');
    await ticks();
    assert.strictEqual(first.status, 'rejected');
    assert.strictEqual(second.status, 'rejected');
    const retry = observe(f.controller.init(args));
    assert.strictEqual(f.opens.length, 2);
    const database = {};
    f.opens[1].req.result = database; f.opens[1].req.fire('success');
    await ticks();
    assert.strictEqual(retry.status, 'resolved');
    assert.strictEqual(retry.value, database);
  });

  ['transaction', 'objectStore'].forEach(boundary => {
    it(`rejects synchronous ${boundary} failure instead of remaining pending`, async function() {
      const error = new Error(boundary + ' unavailable');
      const f = controllerFixture();
      const controller = await f.ready({transaction() {
        if (boundary === 'transaction') { throw error; }
        return {objectStore() { throw error; }};
      }});
      const state = observe(controller.getStore({name: 'fixture', storeName: 'missing'}));
      await ticks();
      assert.strictEqual(state.status, 'rejected');
      assert.strictEqual(state.error, error);
      assert.strictEqual(f.lostExecutorErrors.length, 0);
    });
  });

  it('upgrade callback failure rejects initialization and aborts upgrade', async function() {
    const f = controllerFixture();
    const state = observe(f.controller.init({name: 'fixture', ver: 2, stores: [{name: 'cache'}]}));
    let aborted = 0;
    const error = new Error('create store failed');
    const req = f.opens[0].req;
    req.transaction = {abort() { aborted++; }};
    req.result = {objectStoreNames: {contains: () => false}, createObjectStore() { throw error; }};
    assert.doesNotThrow(() => req.fire('upgradeneeded'));
    await ticks();
    assert.strictEqual(state.status, 'rejected');
    assert.strictEqual(state.error, error);
    assert.strictEqual(aborted, 1);
  });

  [false, true].forEach(fail => {
    it(`facade waits for the worker init ${fail ? 'failure' : 'success'}`, async function() {
      const init = deferred();
      const context = createContext({workerUtil: {createCrossMessageWorker: () => ({post: () => init.promise})}});
      run(`${beginSection('packages/lib/src/infra/IndexedDbStorage.js')}; globalThis.api = IndexedDbStorage;`, context);
      const state = observe(context.api.open({name: 'fixture', ver: 2, stores: [{name: 'cache'}]}));
      await ticks(); assert.strictEqual(state.status, 'pending');
      const error = new Error('init failed');
      fail ? init.reject(error) : init.resolve('ok');
      await ticks();
      assert.strictEqual(state.status, fail ? 'rejected' : 'resolved');
      if (fail) { assert.strictEqual(state.error, error); }
      else { assert.strictEqual(typeof state.value.cache.put, 'function'); }
    });
  });

  it('bridge init failure replies to the original session without exposing error data', async function() {
    const f = gateFixture({open: async () => { throw new Error('private-record-data'); }});
    // Observe handler promise too so the known negative case cannot leak a rejection globally.
    observe(f.send({command: 'open', params: {name: 'fixture', ver: 2, stores: []}}));
    await ticks();
    assert.strictEqual(f.posts.length, 1);
    assert.strictEqual(f.posts[0].body.status, 'fail');
    assert.strictEqual(f.posts[0].options.sessionId, 'request-7');
    assert.ok(!JSON.stringify(f.posts).includes('private-record-data'));
  });

  it('optional cache initialization failure does not prevent player worker initialization', async function() {
    const context = createContext({console: quiet, window: {console: quiet},
      location: {host: 'www.nicovideo.jp'}, CommentLayoutWorker: {getInstance() {}},
      ThumbInfoLoader: {load: async () => {}}, StoryboardWorker: {initWorker: async () => {}},
      VideoSessionWorker: {initWorker: async () => {}},
      StoryboardCacheDb: {initWorker: async () => { throw new Error('DB unavailable'); }},
      WatchInfoCacheDb: {initWorker: async () => { throw new Error('DB unavailable'); }}
    });
    run(`globalThis.initialize = ${extract('src/initializer.js', 'initWorker', 'var')};`, context);
    const state = observe(context.initialize());
    await ticks(); assert.strictEqual(state.status, 'resolved');
  });

  it('consumes optional thumb-info warm-up failure instead of leaking a rejection', async function() {
    let catchCount = 0;
    const context = createContext({console: quiet, window: {console: quiet},
      location: {host: 'www.nicovideo.jp'}, CommentLayoutWorker: {getInstance() {}},
      ThumbInfoLoader: {load() {
        return {catch(handler) {
          catchCount++;
          handler(new Error('warm-up unavailable'));
          return Promise.resolve();
        }};
      }},
      StoryboardWorker: {initWorker: async () => {}},
      VideoSessionWorker: {initWorker: async () => {}},
      StoryboardCacheDb: {initWorker: async () => {}},
      WatchInfoCacheDb: {initWorker: async () => {}}
    });
    run(`globalThis.initialize = ${extract('src/initializer.js', 'initWorker', 'var')};`, context);
    const state = observe(context.initialize());
    await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(catchCount, 1);
  });

  it('keeps generated dev dist thumb-info warm-up failure isolation in parity with source', async function() {
    let catchCount = 0;
    const context = createContext({console: quiet, window: {console: quiet},
      location: {host: 'www.nicovideo.jp'}, CommentLayoutWorker: {getInstance() {}},
      ThumbInfoLoader: {load() {
        return {catch(handler) {
          catchCount++;
          handler(new Error('dist warm-up unavailable'));
          return Promise.resolve();
        }};
      }},
      StoryboardWorker: {initWorker: async () => {}},
      VideoSessionWorker: {initWorker: async () => {}},
      StoryboardCacheDb: {initWorker: async () => {}},
      WatchInfoCacheDb: {initWorker: async () => {}}
    });
    const dist = fs.readFileSync(path.join(__dirname, '../../dist/ZenzaWatch-dev.user.js'), 'utf8');
    const anchor = dist.indexOf("void ThumbInfoLoader.load('sm9').catch(");
    assert.ok(anchor >= 0, 'initializer warm-up anchor missing from generated dev dist');
    const start = dist.lastIndexOf('const initWorker =', anchor);
    const end = dist.indexOf('\n\t};', anchor);
    assert.ok(start >= 0 && end > start, 'initializer initWorker block missing from generated dev dist');
    run(`${dist.slice(start, end + 4)}\nglobalThis.initialize = initWorker;`, context);
    const state = observe(context.initialize());
    await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(catchCount, 1);
  });

  it('thumbnail gate serves the network result when its optional DB cannot initialize', async function() {
    let handler;
    const posts = [];
    const context = createContext({PRODUCT: 'Test', console: quiet,
      location: {host: 'ext.nicovideo.jp'},
      window: {ZenzaLib: {parseThumbInfo: () => ({status: 'ok', v: 'sm9'})}},
      ThumbInfoCacheDb: {open: async () => { throw new Error('unavailable'); }},
      gate: () => ({init: () => ({TOKEN: 'test', port: {
        addEventListener: (name, callback) => { handler = callback; }
      }}), parseUrl: url => new URL(url), uFetch: async () => ({text: async () => '<fixture/>'}),
      post: (body, options) => posts.push({body, options})})
    });
    run(`${beginSection('packages/lib/src/nico/GateAPI.js')}; globalThis.start = GateAPI.thumbInfo;`, context);
    const state = observe(context.start());
    await ticks(); assert.strictEqual(state.status, 'resolved');
    await handler({data: {token: 'test', sessionId: 'thumb-1', body: {command: 'fetch',
      params: {url: 'https://ext.nicovideo.jp/api/getthumbinfo/sm9', options: {}}}}});
    assert.strictEqual(posts.length, 1);
    assert.strictEqual(posts[0].body.params.v, 'sm9');
    assert.strictEqual(posts[0].options.sessionId, 'thumb-1');
  });
});

describe('Task291 generated dist IndexedDB initialization parity', function() {
  it('rejects an open failure and permits a successful retry in generated dev dist', async function() {
    this.timeout(10000);
    const requests = [];
    const context = createContext({
      console: quiet,
      performance: {now: () => 1},
      indexedDB: {
        open(name, version) {
          const req = eventTarget();
          requests.push({name, version, req});
          return req;
        }
      },
      IDBKeyRange: {only: value => value, upperBound: value => value}
    });
    run(`globalThis.controller = (${extract('dist/ZenzaWatch-dev.user.js', 'workerFunc', 'var')})(self);`, context);
    const args = {name: 'fixture', ver: 2, stores: []};
    const initial = observe(context.controller.init(args));
    assert.strictEqual(requests.length, 1);
    const failure = new Error('dist indexeddb open failed');
    requests[0].req.error = failure;
    requests[0].req.fire('error');
    await ticks();
    assert.strictEqual(initial.status, 'rejected');
    assert.strictEqual(initial.error, failure);

    const retry = observe(context.controller.init(args));
    assert.strictEqual(requests.length, 2);
    const db = {};
    requests[1].req.result = db;
    requests[1].req.fire('success');
    await ticks();
    assert.strictEqual(retry.status, 'resolved');
    assert.strictEqual(retry.value, db);
  });
});
