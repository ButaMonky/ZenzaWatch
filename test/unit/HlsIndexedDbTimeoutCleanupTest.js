'use strict';

const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

function harness(file = 'src/_hls.js') {
  let nextId = 0;
  const pending = new Map();
  const context = createContext({
    setTimeout(fn, delay) {
      const id = ++nextId;
      pending.set(id, {fn, delay});
      return id;
    },
    clearTimeout(id) { pending.delete(id); }
  });
  const Subject = loadClass(file, 'IndexDBStorage', context);
  const db = new Subject();

  function start(method, timeout = 3000, index = undefined) {
    const request = {};
    const entry = {get: () => request, count: () => request};
    const store = {...entry, index: () => entry};
    return {request, promise: db[method](store, 'key', {index, timeout})};
  }
  return {pending, start};
}

describe('AUD-13 HLS IndexedDB read timer ownership', () => {
  for (const method of ['getRecord', 'getCount']) {
    for (const index of [undefined, 'hash']) {
      const label = index ? 'indexed' : 'direct';

      it(method + ': releases ' + label + ' success timer', async () => {
        const {pending, start} = harness();
        const {request, promise} = start(method, 3000, index);
        assert.strictEqual(pending.size, 1);
        request.result = 3;
        request.onsuccess({target: {result: 3}});
        assert.strictEqual(await promise, 3);
        assert.strictEqual(pending.size, 0, 'successful requests must not hold a 3s timeout');
      });

      it(method + ': releases ' + label + ' error timer', async () => {
        const {pending, start} = harness();
        const {request, promise} = start(method, 3000, index);
        assert.strictEqual(pending.size, 1);
        const error = new Error('IDB request failed');
        request.onerror(error);
        await assert.rejects(promise, e => e === error);
        assert.strictEqual(pending.size, 0, 'failed requests must not hold a 3s timeout');
      });
    }

    it(method + ': still rejects when an IDB request times out', async () => {
      const {pending, start} = harness();
      const {promise} = start(method);
      assert.strictEqual(pending.size, 1);
      const [[id, timer]] = pending;
      assert.strictEqual(timer.delay, 3000);
      pending.delete(id); // A fired timeout is no longer pending in the timer queue.
      timer.fn();
      await assert.rejects(promise, error => String(error) === 'timeout: keykey');
      assert.strictEqual(pending.size, 0);
    });

    it(method + ': no timeout requested means no timer', async () => {
      const {pending, start} = harness();
      const {request, promise} = start(method, 0);
      request.result = 1;
      request.onsuccess({target: {result: 1}});
      assert.strictEqual(await promise, 1);
      assert.strictEqual(pending.size, 0);
    });

    it(method + ': 200 completed reads retain no timeout callbacks', async () => {
      const {pending, start} = harness();
      for (let i = 0; i < 200; i++) {
        const {request, promise} = start(method);
        request.result = i;
        request.onsuccess({target: {result: i}});
        assert.strictEqual(await promise, i);
      }
      assert.strictEqual(pending.size, 0);
    });
  }
});

describe('AUD-13 generated HLS userscript timer parity', () => {
  for (const method of ['getRecord', 'getCount']) {
    it(method + ': generated success clears its timer', async () => {
      const {pending, start} = harness('dist/ZenzaHLS.user.js');
      const {request, promise} = start(method);
      assert.strictEqual(pending.size, 1);
      request.result = 7;
      request.onsuccess({target: {result: 7}});
      assert.strictEqual(await promise, 7);
      assert.strictEqual(pending.size, 0);
    });

    it(method + ': generated error clears its timer', async () => {
      const {pending, start} = harness('dist/ZenzaHLS.user.js');
      const {request, promise} = start(method);
      const error = new Error('IDB failure');
      request.onerror(error);
      await assert.rejects(promise, e => e === error);
      assert.strictEqual(pending.size, 0);
    });
  }
});
