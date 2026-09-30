const {assert, ticks, observe, deferred, eventTarget, controllerFixture,
  adapterFixture, quiet} = require('../helpers/idbRecoveryFixture');

describe('IndexedDB GC failure preserves the store (ZW-042 bounded)', function() {
  ['index', 'request', 'continue'].forEach(boundary => {
    it(`rejects ${boundary} failure without clearing unrelated records`, async function() {
      const records = ['keep-one', 'keep-two'];
      const error = new Error('cursor unavailable');
      const request = eventTarget();
      const transaction = eventTarget();
      transaction.abort = () => {};
      const store = {
        clear() { records.length = 0; return eventTarget(); },
        index() {
          if (boundary === 'index') { throw error; }
          return {openCursor() { return request; }};
        }
      };
      transaction.objectStore = () => store;
      const f = controllerFixture();
      await f.ready({transaction: () => transaction});
      const state = observe(f.controller.gc({name: 'fixture', storeName: 'cache', data: {expireTime: 100}}));
      await ticks();
      if (boundary === 'request') {
        request.error = error; request.fire('error');
      } else if (boundary === 'continue') {
        request.result = {delete() {}, continue() { throw error; }};
        assert.doesNotThrow(() => request.fire('success'));
      }
      await ticks();
      assert.strictEqual(state.status, 'rejected');
      assert.deepStrictEqual(records, ['keep-one', 'keep-two']);
    });
  });

  it('successful cleanup still deletes expired records and reports the count', async function() {
    const request = eventTarget(), transaction = eventTarget();
    transaction.commit = () => {};
    let deleted = 0;
    const store = {index: () => ({openCursor: () => request})};
    transaction.objectStore = () => store;
    const f = controllerFixture();
    await f.ready({transaction: () => transaction});
    const state = observe(f.controller.gc({name: 'fixture', storeName: 'cache', data: {expireTime: 100}}));
    await ticks();
    request.result = {delete() { deleted++; }, continue() {}};
    request.fire('success');
    request.result = null; request.fire('success');
    transaction.fire('complete');
    await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(state.value.count, 1);
    assert.strictEqual(deleted, 1);
  });

  ['StoryboardCacheDb', 'ThumbInfoCacheDb'].forEach(name => {
    it(`${name} reports background cleanup failure but still opens`, async function() {
      const cleanup = deferred();
      // Locally handle the fake boundary promise even on the negative implementation;
      // the observable production contract is a warning plus a usable opened cache.
      observe(cleanup.promise);
      const warnings = [];
      const adapter = adapterFixture(name, {gc: () => cleanup.promise}, {
        console: Object.assign({}, quiet, {warn: (...args) => warnings.push(args)})
      });
      const opened = observe(adapter.open());
      await ticks();
      assert.strictEqual(opened.status, 'resolved');
      cleanup.reject(new Error('private-record-data'));
      await ticks();
      assert.strictEqual(warnings.length, 1);
      assert.ok(!JSON.stringify(warnings).includes('private-record-data'));
      assert.strictEqual(typeof opened.value.get, 'function');
    });
  });
});
