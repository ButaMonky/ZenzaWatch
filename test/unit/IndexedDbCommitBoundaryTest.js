const {assert, ticks, observe, deferred, eventTarget, controllerFixture, adapterFixture,
  gateFixture, quiet, beginSection, createContext, run} = require('../helpers/idbRecoveryFixture');

describe('IndexedDB persistence waits for transaction completion (ZW-041 bounded)', function() {
  async function mutation(method) {
    const request = eventTarget(), transaction = eventTarget();
    transaction.commit = () => {};
    transaction.abort = () => transaction.fire('abort');
    const store = {put: () => request, clear: () => request, openCursor: () => request,
      index: () => ({openCursor: () => request})};
    transaction.objectStore = () => store;
    const f = controllerFixture();
    await f.ready({transaction: () => transaction});
    const state = observe(f.controller[method]({name: 'fixture', storeName: 'cache',
      data: method === 'put' ? {id: 'key'} : {key: 'key', expireTime: 100}}));
    await ticks();
    return {f, request, transaction, store, state};
  }

  ['put', 'delete', 'clear', 'gc'].forEach(method => {
    [false, true].forEach(abort => {
      it(`${method}: request success waits for transaction ${abort ? 'abort' : 'complete'}`, async function() {
        const f = await mutation(method);
        f.request.result = method === 'put' ? 'key' : null;
        f.request.fire('success');
        await ticks();
        assert.strictEqual(f.state.status, 'pending');
        const error = new Error('transaction aborted after request success');
        f.transaction.error = abort ? error : null;
        f.transaction.fire(abort ? 'abort' : 'complete');
        await ticks();
        assert.strictEqual(f.state.status, abort ? 'rejected' : 'resolved');
        if (abort) { assert.strictEqual(f.state.error, error); }
        else if (method === 'put') { assert.strictEqual(f.state.value, 'key'); }
        else if (method === 'delete') { assert.strictEqual(f.state.value, false); }
        else if (method === 'gc') { assert.strictEqual(f.state.value.count, 0); }
      });
    });

    it(`${method}: request error rejects rather than waiting forever`, async function() {
      const f = await mutation(method);
      const error = new Error('request failed');
      f.request.error = error; f.request.fire('error');
      await ticks();
      assert.strictEqual(f.state.status, 'rejected');
    });
  });

  it('a transaction error with no request success still rejects', async function() {
    const f = await mutation('put');
    const error = new Error('disk error');
    f.transaction.error = error; f.transaction.fire('error');
    await ticks();
    assert.strictEqual(f.state.status, 'rejected');
    assert.strictEqual(f.state.error, error);
  });

  it('cursor deletion reports true only after the transaction completes', async function() {
    const f = await mutation('delete');
    let deleted = 0;
    f.request.result = {delete() { deleted++; }, continue() {}};
    f.request.fire('success');
    f.request.result = null; f.request.fire('success');
    await ticks(); assert.strictEqual(f.state.status, 'pending');
    f.transaction.fire('complete'); await ticks();
    assert.strictEqual(f.state.value, true);
    assert.strictEqual(deleted, 1);
  });

  it('cursor iteration exceptions reject and abort without escaping the callback', async function() {
    const f = await mutation('delete');
    const error = new Error('cursor failure');
    f.request.result = {delete() {}, continue() { throw error; }};
    assert.doesNotThrow(() => f.request.fire('success'));
    await ticks();
    assert.strictEqual(f.state.status, 'rejected');
    assert.strictEqual(f.state.error, error);
  });

  it('synchronous put failure rejects and leaves no active transaction listener', async function() {
    const tx = eventTarget();
    let aborted = 0;
    tx.abort = () => { aborted++; };
    const error = new Error('cannot clone');
    tx.objectStore = () => ({put() { throw error; }});
    const f = controllerFixture(); await f.ready({transaction: () => tx});
    const state = observe(f.controller.put({name: 'fixture', storeName: 'cache', data: {}}));
    await ticks();
    assert.strictEqual(state.status, 'rejected');
    assert.strictEqual(state.error, error);
    assert.strictEqual(aborted, 1);
    tx.fire('complete'); await ticks();
    assert.strictEqual(state.status, 'rejected');
  });

  it('updateTime returns its record only after the follow-up write commits', async function() {
    const read = eventTarget(), write = eventTarget(), readTx = eventTarget(), writeTx = eventTarget();
    readTx.objectStore = () => ({get: () => read});
    writeTx.objectStore = () => ({put: () => write});
    writeTx.abort = () => {};
    writeTx.commit = () => {};
    const f = controllerFixture();
    await f.ready({transaction: (store, mode) => mode === 'readwrite' ? writeTx : readTx});
    const state = observe(f.controller.updateTime({name: 'fixture', storeName: 'cache', data: {key: 'key'}}));
    await ticks(); read.result = {id: 'key', updatedAt: 0}; read.fire('success');
    await ticks(); assert.strictEqual(state.status, 'pending');
    write.result = 'key'; write.fire('success');
    await ticks(); assert.strictEqual(state.status, 'pending');
    writeTx.fire('complete'); await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(state.value.id, 'key');
    assert.ok(state.value.updatedAt > 0);
  });

  ['WatchInfoCacheDb', 'StoryboardCacheDb', 'ThumbInfoCacheDb'].forEach(name => {
    [false, true].forEach(fail => {
      it(`${name} propagates the eventual write ${fail ? 'failure' : 'success'}`, async function() {
        const write = deferred();
        // Keep original code's fire-and-forget negative case local to this test.
        observe(write.promise);
        const adapter = adapterFixture(name, {put: () => write.promise,
          updateTime: async () => null, gc: async () => {}});
        const db = await adapter.open();
        const pending = name === 'ThumbInfoCacheDb' ? db.put('<fixture/>', {
          status: 'ok', v: 'sm9', id: 'sm9', postedAt: '2026-01-01'}) :
          db.put('sm9', name === 'StoryboardCacheDb' ? {status: 'ok'} : {});
        const state = observe(pending);
        await ticks(); assert.strictEqual(state.status, 'pending');
        const error = new Error('commit failed');
        fail ? write.reject(error) : write.resolve('sm9');
        await ticks();
        assert.strictEqual(state.status, fail ? 'rejected' : 'resolved');
        if (fail) { assert.strictEqual(state.error, error); }
        else { assert.strictEqual(state.value.watchId, 'sm9'); }
      });
    });
  });

  it('playback best-effort write handles failure while explicit writes still reject', async function() {
    const warnings = [];
    const adapter = adapterFixture('WatchInfoCacheDb', {put: async () => { throw new Error('private-record'); },
      updateTime: async () => null, gc: async () => {}}, {
      console: Object.assign({}, quiet, {warn: (...args) => warnings.push(args)})
    });
    assert.strictEqual(typeof adapter.putBestEffort, 'function');
    const state = observe(adapter.putBestEffort('sm9'));
    await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(warnings.length, 1);
    assert.ok(!JSON.stringify(warnings).includes('private-record'));
  });

  it('bridge put acknowledgement follows lower persistence completion', async function() {
    const write = deferred();
    const f = gateFixture({open: async () => ({cache: {put: () => write.promise}})});
    await f.send({command: 'open', params: {name: 'fixture', stores: []}});
    assert.strictEqual(f.posts.length, 1);
    const state = observe(f.send({command: 'put', params: {name: 'fixture', storeName: 'cache', data: {id: 1}}}, 'write-1'));
    await ticks(); assert.strictEqual(f.posts.length, 1);
    write.resolve(1); await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(f.posts.length, 2);
    assert.strictEqual(f.posts[1].options.sessionId, 'write-1');
    assert.strictEqual(f.posts[1].body.status, 'ok');
  });

  it('thumbnail network response survives a later best-effort cache write failure', async function() {
    let handler;
    const posts = [], warnings = [], write = deferred();
    observe(write.promise);
    const context = createContext({PRODUCT: 'Test',
      console: Object.assign({}, quiet, {warn: (...args) => warnings.push(args)}),
      location: {host: 'ext.nicovideo.jp'},
      window: {ZenzaLib: {parseThumbInfo: () => ({status: 'ok', v: 'sm9'})}},
      ThumbInfoCacheDb: {open: async () => ({get: async () => null, put: () => write.promise})},
      gate: () => ({init: () => ({TOKEN: 'test', port: {addEventListener: (name, callback) => { handler = callback; }}}),
        parseUrl: url => new URL(url), uFetch: async () => ({text: async () => '<fixture/>'}),
        post: (body, options) => posts.push({body, options})})
    });
    run(`${beginSection('packages/lib/src/nico/GateAPI.js')}; globalThis.start = GateAPI.thumbInfo;`, context);
    await context.start();
    await handler({data: {token: 'test', sessionId: 'thumb-1', body: {command: 'fetch',
      params: {url: 'https://ext.nicovideo.jp/api/getthumbinfo/sm9', options: {}}}}});
    assert.strictEqual(posts.length, 1);
    assert.strictEqual(posts[0].body.params.v, 'sm9');
    write.reject(new Error('private-record')); await ticks();
    assert.strictEqual(posts.length, 1);
    assert.strictEqual(warnings.length, 1);
    assert.ok(!JSON.stringify(warnings).includes('private-record'));
  });
});
