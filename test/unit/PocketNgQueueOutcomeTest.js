'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const paths = ['src/_pocket.js', 'dist/MylistPocket.user.js'];
function fixture(path) {
  const requests = [], attrs = {}, classes = new Set();
  const ctx = createContext({
    ThumbInfoLoader: {
      load(id) {
        let resolve, reject;
        const promise = new Promise((ok, fail) => {resolve = ok; reject = fail;});
        requests.push({id, resolve, reject});
        return promise;
      }
    },
    util: {getSleepPromise: () => value => Promise.resolve(value)}
  });
  run('globalThis.TestQueue=' + extract(path, 'QueueLoader', 'var'), ctx);
  const node = {
    setAttribute(k, v) {attrs[k] = v;},
    classList: {add(k) {classes.add(k);}}
  };
  return {load: ctx.TestQueue.load, requests, attrs, classes, node,
    info: id => ({status: 'ok', watchId: id, fromCache: true})};
}
for (const path of paths) {
  describe('AUD-19 real QueueLoader cancellation contract ' + path, () => {
    it('does not update card attributes after its request becomes obsolete', async () => {
      const f = fixture(path);
      let obsolete = false;
      const work = f.load('smA', f.node, () => obsolete);
      assert.strictEqual(f.requests.length, 1);
      obsolete = true;
      f.requests[0].resolve(f.info('smA'));
      const result = await work;
      assert.strictEqual(result.status, 'cancelled');
      assert.deepStrictEqual(f.attrs, {});
    });
    it('keeps ordinary active success and cached card metadata behavior', async () => {
      const f = fixture(path);
      const work = f.load('smB', f.node, () => false);
      f.requests[0].resolve(f.info('smB'));
      const result = await work;
      assert.strictEqual(result.watchId, 'smB');
      assert.strictEqual(f.attrs['data-watch-id'], 'smB');
      assert.strictEqual(JSON.parse(f.attrs['data-thumb-info']).watchId, 'smB');
    });
    it('preserves Error-as-value queue behavior for non-NG callers', async () => {
      const f = fixture(path);
      const work = f.load('smC');
      const problem = new Error('isolated simulated failure');
      f.requests[0].reject(problem);
      const result = await work;
      assert.strictEqual(result, problem);
    });
  });
}
