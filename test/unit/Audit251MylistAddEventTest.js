'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function harness(status) {
  const notifications = [];
  const cacheChanges = [];
  const result = {meta: {status}, ...(status >= 400 ? {error: {code: 'DENIED', description: 'rejected'}} : {})};
  class CacheStorage {
    constructor() {}
    getItem() { return null; }
    setItem() {}
    removeItem(key) { cacheChanges.push(key); }
  }
  const c = createContext({
    CacheStorage, sessionStorage: {},
    emitter: {on() {}, emitAsync: (...a) => notifications.push(a)},
    window: {ZenzaWatch: null},
    netUtil: {fetch: async () => ({json: async () => result})},
    console: {log() {}}
  });
  run(beginSection('packages/lib/src/nico/MylistApiLoader.js') +
    '\nglobalThis.subject = MylistApiLoader;', c);
  const loader = c.subject;
  let removals = 0;
  loader.removeDeflistItem = async () => {removals++;};
  return {loader,notifications,cacheChanges,removals:()=>removals};
}

describe('AUD #251 mylist add event ownership', () => {
  it('emits mylistAdd once on confirmed HTTP/meta 201', async () => {
    const h = harness(201);
    const outcome = await h.loader.addMylistItem('sm1', 55, 'memo');
    assert.strictEqual(outcome.status, 'ok');
    assert.deepStrictEqual(h.notifications, [['mylistAdd','sm1',55,'memo']]);
    // #261 removes obsolete account-private storage as a safety migration.
    assert.deepStrictEqual(h.cacheChanges, ['csrfToken','mylistList','mylistItems: 55']);
    assert.strictEqual(h.removals(), 1);
  });
  for (const status of [403, 409, 500]) {
    it('never emits a success event on failed API ' + status, async () => {
      const h = harness(status);
      await assert.rejects(() => h.loader.addMylistItem('sm1', 55, 'memo'));
      assert.deepStrictEqual(h.notifications, []);
      // No mylist item is invalidated on failure; only stale auth caches
      // are cleaned up during construction (#261).
      assert.deepStrictEqual(h.cacheChanges, ['csrfToken','mylistList']);
      assert.strictEqual(h.removals(), 0);
    });
  }
});
