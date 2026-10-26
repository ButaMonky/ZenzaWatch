'use strict';
const assert = require('assert');
const {createContext, extract, run} = require('../helpers/extractSource');

const flush = () => new Promise(resolve => setImmediate(resolve));
function fakeIndexedDb() {
  const records = new Map();
  let initialized = false;
  const db = {
    objectStoreNames: {contains: () => initialized},
    createObjectStore() {
      initialized = true;
      return {createIndex() {}};
    },
    transaction() {
      const tx = {oncomplete: null, onerror: null, onabort: null};
      const ready = callback => Promise.resolve().then(callback);
      const store = {
        put(value) {
          ready(() => { records.set(value.id, value); tx.oncomplete?.(); });
          return {};
        },
        getAll() {
          const request = {};
          ready(() => {
            request.result = Array.from(records.values());
            request.onsuccess?.();
          });
          return request;
        },
        clear() {
          ready(() => { records.clear(); tx.oncomplete?.(); });
          return {};
        },
        index() {
          return {openCursor() {
            const request = {};
            ready(() => { request.result = null; request.onsuccess?.(); });
            return request;
          }};
        }
      };
      tx.objectStore = () => store;
      return tx;
    },
    close() {}
  };
  return {
    open() {
      const request = {result: db};
      Promise.resolve().then(() => {
        if (!initialized) { request.onupgradeneeded?.(); }
        request.onsuccess?.();
      });
      return request;
    },
    records
  };
}
function journal(indexedDB) {
  const context = createContext({indexedDB});
  run('const NotificationJournal = ' +
    extract('src/NotificationJournal.js', 'NotificationJournal', 'var') +
    ';globalThis.__journal=NotificationJournal;', context);
  return context.__journal;
}
describe('NotificationJournal IndexedDB contract (synthetic)', () => {
  it('persists an event across journal instances without leaking auth metadata', async () => {
    const db = fakeIndexedDb();
    const first = journal(db);
    first.record({
      category: 'network', level: 'error', message: 'HTTP 400',
      videoId: 'sm19', details: {statusCode: 400, token: 'SYNTHETIC_SECRET'}
    });
    await flush();
    const second = journal(db);
    const rows = await second.list();
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].videoId, 'sm19');
    assert.strictEqual(rows[0].details.statusCode, 400);
    assert.strictEqual(JSON.stringify(rows).includes('SYNTHETIC_SECRET'), false);
    assert.strictEqual(db.records.size, 1);
  });
  it('clears stored events and removes memory shadow after persistence', async () => {
    const db = fakeIndexedDb();
    const first = journal(db);
    first.record({category: 'like', message: 'ありがとうございます', videoId: 'sm9'});
    await flush();
    const second = journal(db);
    assert.strictEqual((await second.list()).length, 1);
    assert.strictEqual(await second.clear(), true);
    assert.strictEqual((await second.list()).length, 0);
    assert.strictEqual((await first.list()).length, 0,
      'committed entries must not linger in a stale session mirror');
  });
});
