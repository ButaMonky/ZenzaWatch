const assert = require('assert');
const lodash = require('lodash');
const {beginSection, createContext, run} = require('../helpers/extractSource');

describe('CacheStorage recovery (ZW-039 / ZW-040)', function() {
  const PREFIX = 'RecoveryTest_cache_';
  const NOW = 100000;
  let caches;
  beforeEach(function() { caches = []; });
  afterEach(function() { caches.forEach(cache => cache.gc.cancel()); });

  function make(initial = {}, failWrite) {
    const backing = Object.assign({}, initial);
    const writes = [];
    Object.defineProperty(backing, 'removeItem', {
      value: key => { delete backing[key]; }, enumerable: false
    });
    const storage = new Proxy(backing, {
      set(target, key, value) {
        writes.push({key, value});
        const error = failWrite && failWrite({key, value, target, attempts: writes.length});
        if (error) { throw error; }
        target[key] = value;
        return true;
      }
    });
    const context = createContext({PRODUCT: 'RecoveryTest', _: lodash, Date: {now: () => NOW}});
    run(`${beginSection('packages/lib/src/infra/CacheStorage.js')}; globalThis.Subject = CacheStorage;`, context);
    const cache = new context.Subject(storage);
    caches.push(cache);
    return {cache, backing, writes};
  }
  const entry = (data, expiredAt = '') => JSON.stringify({data, expiredAt});
  const quota = name => Object.assign(new Error('full'), {name: name || 'QuotaExceededError'});
  const invalid = ['{', 'null', '[]', '{}', '{"expiredAt":""}',
    '{"data":1}', '{"data":1,"expiredAt":null}', '{"data":1,"expiredAt":"100001"}',
    '{"data":1,"expiredAt":{}}', '{"data":1,"expiredAt":1e400}'];

  invalid.forEach(raw => {
    it(`invalid cache is a harmless miss and removed: ${raw}`, function() {
      const {cache, backing} = make({[PREFIX + 'bad']: raw, unrelated: raw});
      assert.strictEqual(cache.getItem('bad'), null);
      assert.strictEqual(backing[PREFIX + 'bad'], undefined);
      assert.strictEqual(backing.unrelated, raw);
    });
    it(`gc continues after invalid cache: ${raw}`, function() {
      const {cache, backing} = make({[PREFIX + 'bad']: raw,
        [PREFIX + 'expired']: entry(1, NOW - 1), [PREFIX + 'good']: entry(2), unrelated: raw});
      cache.gc();
      cache.gc.flush();
      assert.strictEqual(backing[PREFIX + 'bad'], undefined);
      assert.strictEqual(backing[PREFIX + 'expired'], undefined);
      assert.strictEqual(cache.getItem('good'), 2);
      assert.strictEqual(backing.unrelated, raw);
    });
  });

  it('preserves permanent, future, falsy and structured data without requiring legacy type metadata', function() {
    const values = [null, false, 0, '', [], {x: 'y'}];
    const {cache, backing} = make();
    values.forEach((data, index) => {
      backing[PREFIX + index] = entry(data, index % 2 ? NOW + 1 : '');
      assert.deepStrictEqual(cache.getItem(String(index)), data);
    });
    backing[PREFIX + 'type'] = JSON.stringify({data: 7, type: 'old-unused-metadata', expiredAt: ''});
    assert.strictEqual(cache.getItem('type'), 7);
    cache.gc(); cache.gc.flush();
    assert.strictEqual(Object.keys(backing).length, values.length + 1);
  });

  it('expiration boundary is a miss and GC removes only cache entries', function() {
    const {cache, backing} = make({[PREFIX + 'now']: entry(1, NOW),
      [PREFIX + 'past']: entry(2, NOW - 1), unrelated: entry(3, NOW - 1)});
    assert.strictEqual(cache.getItem('missing'), null);
    assert.strictEqual(cache.getItem('now'), null);
    assert.strictEqual(cache.getItem('past'), null);
    cache.gc(); cache.gc.flush();
    assert.deepStrictEqual(Object.keys(backing), ['unrelated']);
  });

  it('normal property-set storage round trips data and schedules ordinary GC', function() {
    const {cache, writes} = make();
    cache.setItem('value', {a: 1}, 50);
    assert.strictEqual(writes.length, 1);
    assert.deepStrictEqual(cache.getItem('value'), {a: 1});
    assert.strictEqual(JSON.parse(writes[0].value).expiredAt, NOW + 50);
    cache.gc.flush();
  });

  ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].forEach(name => {
    it(`synchronously collects using current time then retries once: ${name}`, function() {
      const oldKey = PREFIX + 'expired';
      const {cache, backing, writes} = make({[oldKey]: entry('old', NOW - 1),
        [PREFIX + 'permanent']: entry('keep'), [PREFIX + 'future']: entry('keep', NOW + 1),
        unrelated: 'keep'}, ({target}) => oldKey in target ? quota(name) : null);
      // A pending debounce must not delay the emergency collection/retry.
      cache.gc();
      cache.setItem('new', 'saved', 100);
      assert.strictEqual(writes.length, 2);
      assert.strictEqual(cache.getItem('new'), 'saved');
      assert.strictEqual(backing[oldKey], undefined);
      assert.strictEqual(cache.getItem('permanent'), 'keep');
      assert.strictEqual(cache.getItem('future'), 'keep');
      assert.strictEqual(backing.unrelated, 'keep');
      cache.gc.flush();
      assert.strictEqual(writes.length, 2);
    });
  });

  it('persistent quota remains bounded and never evicts unrelated or valid entries', function() {
    const {cache, backing, writes} = make({unrelated: 'keep', [PREFIX + 'valid']: entry('keep'),
      [PREFIX + 'bad']: 'null'}, () => quota());
    assert.doesNotThrow(() => cache.setItem('new', 1));
    assert.strictEqual(writes.length, 2);
    assert.strictEqual(cache.getItem('new'), null);
    assert.strictEqual(backing[PREFIX + 'bad'], undefined);
    assert.strictEqual(cache.getItem('valid'), 'keep');
    assert.strictEqual(backing.unrelated, 'keep');
    cache.gc.flush();
    assert.strictEqual(writes.length, 2);
  });

  it('other write errors retain the existing swallowed failure contract, without retry or eviction', function() {
    const old = entry(1, NOW - 1);
    const {cache, backing, writes} = make({[PREFIX + 'old']: old},
      () => Object.assign(new Error('denied'), {name: 'SecurityError'}));
    assert.doesNotThrow(() => cache.setItem('new', 1));
    assert.strictEqual(writes.length, 1);
    assert.strictEqual(backing[PREFIX + 'old'], old);
  });

  it('serialization errors remain swallowed and do not write or collect', function() {
    const {cache, writes} = make();
    const circular = {}; circular.self = circular;
    assert.doesNotThrow(() => cache.setItem('new', circular));
    assert.strictEqual(writes.length, 0);
  });
});
