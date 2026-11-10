'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const {describe, it} = typeof global.describe === 'function' ? global : require('node:test');

// Execute the canonical class, without emitting files or constructing its UI.
function canonical(relative, name, extra = {}) {
  const text = stripTypeScriptTypes(fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8'));
  const start = text.indexOf('class ' + name + ' ');
  assert(start >= 0, name + ' declaration exists');
  const indent = text.slice(text.lastIndexOf('\n', start) + 1, start);
  const end = text.indexOf('\n' + indent + '}', start);
  assert(end > start, name + ' declaration is closed');
  const context = {console, setTimeout, clearTimeout, Date, Emitter: class {}, ...extra};
  context.window = context;
  return vm.runInNewContext(text.slice(start, end + indent.length + 2) + '\n' + name, context);
}

describe('Issue41 (AUD-81) comment change log boundaries', () => {
  for (const [name, method] of [
    ['NicoChatGroup', 'onChange'], ['NicoChatGroupViewModel', '_onChange'],
    ['NicoComment', '_onChange'], ['NicoCommentViewModel', '_onChange']
  ]) {
    for (const runtime of [false, true]) {
    it(name + (runtime ? ' runtime JS' : ' canonical TS') + ' keeps its change side effects without logging the event graph', () => {
      const logged = [], emitted = [], calls = [];
      const file = runtime ? 'packages/zenza/src/commentLayer/' + name + '.js' :
        'tools/typescript-stage1/comment-src/' + name + '.ts';
      const Subject = canonical(file, name, {
        console: {log: (...args) => logged.push(args), time() {}, timeEnd() {}}
      });
      const object = Object.create(Subject.prototype);
      const member = {text: 'private-comment-sentinel', userId: 'private-user-sentinel'};
      const event = {chat: member, group: {members: [member]}, secret: new Error('private-error-sentinel')};
      object._nicoChatFilter = {};
      object._nicoChatGroup = {members: [member]};
      object.emit = (...args) => emitted.push(args);
      object.reset = () => calls.push('reset');
      object.addChatArray = value => calls.push(value);
      object._updateSlotLayout = () => calls.push('layout');
      object[method](event);
      assert.deepEqual(logged, [[name + '.onChange']]);
      if (name === 'NicoChatGroup') {
        assert.equal(object._filteredMembersValid, false);
        assert.equal(emitted[0][0], 'change');
        assert.equal(emitted[0][1].chat, event);
        assert.equal(emitted[0][1].group, object);
      } else if (name === 'NicoChatGroupViewModel') {
        assert.deepEqual(calls, ['reset', object._nicoChatGroup.members]);
      } else if (name === 'NicoComment') {
        assert.equal(emitted[0][0], 'change');
        assert.equal(emitted[0][1].nicoComment, object);
        assert.equal(emitted[0][1].chat, member);
        assert.equal(emitted[0][1].group, event.group);
      } else {
        assert.deepEqual(calls, ['layout']);
        assert.equal(typeof object._lastUpdate, 'number');
      }
    });
    }
  }
});

describe('Issue86 (AUD-45) video row update timer ownership (canonical TS)', () => {
  for (const method of ['_onPlaylistAppend', '_onDeflistAdd']) {
    it(method + ' lets the newest action own the row indicator', () => {
      const timers = [], commands = [];
      const Subject = canonical('tools/typescript-stage1/nico-src/VideoList.ts', 'VideoList', {
        setTimeout: fn => { timers.push(fn); return timers.length; }
      });
      const row = {isUpdating: false};
      const model = {findByItemId: () => row};
      const object = Object.create(Subject.prototype);
      object.model = model;
      object.emit = (...args) => commands.push(args);
      object[method]('sm1', 'row');
      object[method]('sm1', 'row');
      timers[0]();
      assert.equal(row.isUpdating, true, 'an older action must not end the new indicator');
      timers[1]();
      assert.equal(row.isUpdating, false);
      assert.equal(commands.length, 2, 'both requested actions still dispatch');
    });
    it(method + ' does not mutate a detached model row', () => {
      const timers = [];
      const Subject = canonical('tools/typescript-stage1/nico-src/VideoList.ts', 'VideoList', {
        setTimeout: fn => { timers.push(fn); return timers.length; }
      });
      const row = {isUpdating: false};
      const object = Object.create(Subject.prototype);
      object.model = {findByItemId: () => row};
      object.emit = () => {};
      object[method]('sm1', 'row');
      object.model = {findByItemId: () => null};
      timers[0]();
      assert.equal(row.isUpdating, true, 'detached rows are no longer owned by this list');
    });
  }
});

function cacheClass(extra = {}) {
  return canonical('tools/typescript-stage1/hls-src/HlsStorage.ts', 'IndexDBStorage', {
    Config: {cache_expire_time: 1000},
    console: {warn() {}, error() {}, time() {}, timeEnd() {}},
    IDBKeyRange: {upperBound: value => ({upper: value}), only: value => ({only: value})},
    ...extra
  });
}
async function upgradedCache() {
  let request, schema, deleted = 0;
  const indexes = new Map();
  const db = {
    objectStoreNames: {contains: name => name === 'ts-data'},
    deleteObjectStore: () => { deleted++; },
    createObjectStore(name, options) {
      schema = {name, ...options};
      return {createIndex(name, keyPath, options) { indexes.set(name, {keyPath, ...options}); }};
    },
    close() { this.closed = true; }
  };
  const Subject = cacheClass({indexedDB: {open(name, version) {
    request = {name, version}; return request;
  }}});
  const pending = Subject.init();
  request.onupgradeneeded({target: {result: db}});
  request.onsuccess({target: {result: db}});
  await pending;
  return {Subject, db, schema, indexes, deleted, request};
}
const flush = () => new Promise(resolve => setImmediate(resolve));

describe('AUD-13 HLS cache record and transaction integrity (canonical TS)', () => {
  it('upgrades the disposable v4 cache to hash identity and a nonunique expiry index', async () => {
    const h = await upgradedCache();
    assert.equal(h.request.version, 5);
    assert.equal(h.deleted, 1);
    assert.equal(h.schema.keyPath, 'hash');
    assert.deepEqual(h.indexes.get('expiresAt'), {keyPath: 'expiresAt', unique: false});
  });
  it('keeps every different hash saved in the same clock tick', async () => {
    const h = await upgradedCache(), cache = new h.Subject(), records = new Map();
    const clock = Date.now;
    Date.now = () => 1000;
    try {
      cache.deleteRecord = async () => true;
      cache.getStore = async () => {
        const transaction = {commit() { queueMicrotask(() => transaction.oncomplete?.()); }, abort() {}};
        const store = {put(record) {
          const request = {};
          queueMicrotask(() => {
            records.set(record[h.schema.keyPath], record);
            request.result = record[h.schema.keyPath];
            request.onsuccess?.({target: request});
            // IDB auto-commits after the request queue drains, including with no commit().
            setImmediate(() => transaction.oncomplete?.());
          });
          return request;
        }};
        return {transaction, store};
      };
      const results = await Promise.all(Array.from({length: 32}, (_, i) =>
        cache.save({hash: 'fragment-' + i, videoId: 'video', meta: {i}}, new Uint8Array([i]))));
      assert(results.every(Boolean));
      assert.equal(records.size, 32, 'same expiry time must not overwrite another hash');
      assert.equal(records.get('fragment-31').buffer[0], 31);
    } finally { Date.now = clock; }
  });
  for (const abort of [false, true]) {
    it('does not acknowledge a put until its transaction ' + (abort ? 'aborts' : 'commits'), async () => {
      const Subject = cacheClass(), cache = new Subject();
      const request = {}, transaction = {commit() {}, abort() {}};
      cache.getStore = async () => ({transaction, store: {put: () => request}});
      cache.deleteRecord = async () => true;
      let settled = false;
      const result = cache.save({hash: 'fragment', videoId: 'video', meta: {}}, new Uint8Array([1]));
      result.then(() => { settled = true; });
      await flush();
      request.result = 'fragment';
      request.onsuccess?.({target: request});
      await flush();
      assert.equal(settled, false, 'request success is not a committed write');
      if (abort) transaction.onabort({target: {error: new Error('aborted')}});
      else transaction.oncomplete();
      assert.equal(await result, abort ? false : 'fragment');
    });
  }
  it('collects expired entries through the expiry index, preserving unexpired siblings', async () => {
    const Subject = cacheClass(), cache = new Subject();
    const records = new Map([['old-a', 0], ['old-b', 0], ['live', Date.now() + 100000]]);
    let transaction, request, keys, index;
    const emit = () => queueMicrotask(() => {
      const key = keys.shift();
      request.onsuccess({target: {result: key === undefined ? null : {
        delete: () => records.delete(key), continue: emit
      }}});
      if (key === undefined) setImmediate(() => transaction.oncomplete?.());
    });
    cache.getStore = async () => {
      transaction = {commit() {}, abort() {}};
      return {transaction, store: {index(name) {
        index = name;
        return {openCursor(range) {
          keys = [...records].filter(([, expiry]) => expiry <= range.upper).map(([key]) => key);
          request = {}; emit(); return request;
        }};
      }}};
    };
    await cache.gc();
    assert.equal(index, 'expiresAt');
    assert.deepEqual([...records.keys()], ['live']);
    assert.equal(cache.isBusy, false);
  });
  it('releases an owned connection on versionchange', async () => {
    const h = await upgradedCache();
    assert.equal(typeof h.db.onversionchange, 'function');
    h.db.onversionchange();
    assert.equal(h.db.closed, true);
    assert.equal(h.Subject.db, null);
  });
  it('fails a blocked upgrade promptly and closes its abandoned late connection', async () => {
    const requests = [];
    const Subject = cacheClass({indexedDB: {open() { const request = {}; requests.push(request); return request; }}});
    const pending = Subject.init();
    assert.equal(typeof requests[0].onblocked, 'function');
    requests[0].onblocked();
    await assert.rejects(pending, /HLS cache upgrade blocked/);
    const old = {close() { this.closed = true; }};
    requests[0].onsuccess({target: {result: old}});
    assert.equal(old.closed, true);
    assert.equal(Subject.db, undefined);
    const retry = Subject.init();
    const fresh = {close() {}};
    requests[1].onsuccess({target: {result: fresh}});
    assert.equal(await retry, fresh);
  });
});
