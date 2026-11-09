'use strict';
const assert = require('assert');
const {createContext, extract, run} = require('../helpers/extractSource');

function createWorkerGetFixture(record) {
  const context = createContext({});
  run('globalThis.subject = (' +
      extract('packages/lib/src/infra/IndexedDbStorage.js', 'workerFunc', 'var') +
      ')(self);', context);
  const controller = context.subject;
  controller.getStore = async () => ({
    store: {get() {
      const request = {onsuccess: null, onerror: null};
      queueMicrotask(() => request.onsuccess({target: {result: record}}));
      return request;
    }}
  });
  return controller;
}

function createWorkerUpdateFixture(record) {
  const controller = createWorkerGetFixture(record);
  let persisted = structuredClone(record);
  controller._write = async (_scope, operation) => new Promise((resolve, reject) => {
    const store = {
      get() {
        const request = {result: structuredClone(persisted), onsuccess: null, onerror: null};
        queueMicrotask(() => request.onsuccess());
        return request;
      },
      put(value) {
        const request = {onsuccess: null, onerror: null};
        queueMicrotask(() => {
          persisted = structuredClone(value);
          request.onsuccess();
        });
        return request;
      }
    };
    try { operation(store, resolve, reject); } catch (error) { reject(error); }
  });
  return {controller, get persisted() { return persisted; }};
}

describe('Issue #286 bridge privacy: readonly worker get before migration', function() {
  it('projects only public videoInfo fields before returning the bridge reply', async function() {
    const raw = {
      watchId: 'TEST_ONLY_sm286', updatedAt: 123, watchCount: 4,
      resume: [{time: 15}], comment: [{text: 'TEST_ONLY_COMMENT'}],
      videoInfo: {
        videoId: 'TEST_ONLY_sm286', title: 'TEST_ONLY_TITLE',
        csrfToken: 'demo1', watchAuthKey: 'demo1',
        owner: {name: 'TEST_ONLY_OWNER', token: 'demo1'},
        count: {view: 3, secret: 'demo1'},
        genre: {key: 'test', label: 'TEST_ONLY_GENRE', keySecret: 'demo1'}
      }
    };
    const controller = createWorkerGetFixture(raw);
    const reply = await controller.get({
      name: 'watch-info', storeName: 'cache', data: {key: 'TEST_ONLY_sm286'}
    });
    assert(!JSON.stringify(reply).includes('demo1'));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(reply.videoInfo)), {
      videoId: 'TEST_ONLY_sm286', title: 'TEST_ONLY_TITLE',
      count: {view: 3}, owner: {name: 'TEST_ONLY_OWNER'},
      genre: {key: 'test', label: 'TEST_ONLY_GENRE'}
    });
    assert.deepStrictEqual(JSON.parse(JSON.stringify(reply.resume)), [{time: 15}]);
    assert.strictEqual(reply.watchCount, 4);
    assert.strictEqual(raw.videoInfo.csrfToken, 'demo1',
      'readonly access must never modify disk state');
  });

  it('does not change unrelated IndexedDB stores or a missing row', async function() {
    const raw = {watchId: 'TEST_ONLY_sm287', videoInfo: {token: 'demo1'}};
    const controller = createWorkerGetFixture(raw);
    const unrelated = await controller.get({
      name: 'unrelated', storeName: 'cache', data: {key: 'TEST_ONLY_sm287'}
    });
    assert.strictEqual(unrelated.videoInfo.token, 'demo1');
    const nullWorker = createWorkerGetFixture(null);
    const empty = await nullWorker.get({
      name: 'watch-info', storeName: 'cache', data: {key: 'TEST_ONLY_none'}
    });
    assert.strictEqual(empty, null);
  });

  it('redacts update and updateTime replies without changing the persisted legacy snapshot',
    async function() {
      const raw = {
        watchId: 'TEST_ONLY_sm288', updatedAt: 123, watchCount: 4,
        resume: [{time: 17}], comment: [{text: 'TEST_ONLY_COMMENT'}],
        videoInfo: {
          videoId: 'TEST_ONLY_sm288', title: 'TEST_ONLY_TITLE',
          csrfToken: 'demo1', owner: {name: 'TEST_ONLY_OWNER', token: 'demo1'}
        }
      };
      const h = createWorkerUpdateFixture(raw);
      const updated = await h.controller.update({
        name: 'watch-info', storeName: 'cache',
        data: {key: 'TEST_ONLY_sm288', patch: {watchCount: 5}}
      });
      assert(!JSON.stringify(updated).includes('demo1'));
      assert.strictEqual(updated.watchCount, 5);
      assert.strictEqual(updated.videoInfo.title, 'TEST_ONLY_TITLE');
      assert.deepStrictEqual(updated.resume, [{time: 17}]);
      assert.strictEqual(h.persisted.videoInfo.csrfToken, 'demo1',
        'update response projection must not rewrite the stored row');

      const touched = await h.controller.updateTime({
        name: 'watch-info', storeName: 'cache', data: {key: 'TEST_ONLY_sm288'}
      });
      assert(!JSON.stringify(touched).includes('demo1'));
      assert.strictEqual(touched.watchCount, 5);
      assert.strictEqual(touched.updatedAt, h.persisted.updatedAt);
      assert.strictEqual(h.persisted.videoInfo.csrfToken, 'demo1',
        'updateTime response projection must not rewrite the stored row');

      const unrelated = await h.controller.update({
        name: 'other-db', storeName: 'cache',
        data: {key: 'TEST_ONLY_sm288', patch: {watchCount: 6}}
      });
      assert.strictEqual(unrelated.videoInfo.csrfToken, 'demo1');
    });
});
