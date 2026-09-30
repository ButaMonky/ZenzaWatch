const assert = require('assert');
const {beginSection, extract, createContext, run} = require('../helpers/extractSource');

describe('Pocket CacheStorage recovery (ZW-039 / ZW-040 duplicate)', function() {
  const PREFIX = 'RecoveryTest_cache_';
  const NOW = 100000;
  let caches;
  beforeEach(function() { caches = []; });
  afterEach(function() { caches.forEach(cache => cache.cancelTimers()); });

  function make(initial = {}, failWrite, constructorGc = false) {
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
    // Exercise the real Pocket class and real bounce implementation, with deterministic timers.
    const timers = new Map();
    let nextTimer = 0;
    const context = createContext({PRODUCT: 'RecoveryTest', PREFIX,
      Date: {now: () => NOW},
      setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; },
      clearTimeout: id => { timers.delete(id); }
    });
    run(`${beginSection('packages/lib/src/Emitter.js')};
      ${beginSection('packages/lib/src/infra/bounce.js')};
      ${extract('src/_pocket.js', 'CacheStorage')}; globalThis.Subject = CacheStorage;`, context);
    const cache = new context.Subject(storage, constructorGc);
    cache.flushTimers = () => {
      const pending = [...timers.values()]; timers.clear();
      pending.forEach(callback => callback());
      assert.strictEqual(timers.size, 0);
    };
    cache.cancelTimers = () => timers.clear();
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
      cache.flushTimers();
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
    cache.gc(); cache.flushTimers();
    assert.strictEqual(Object.keys(backing).length, values.length + 1);
  });

  it('expiration boundary is a miss and GC removes only cache entries', function() {
    const {cache, backing} = make({[PREFIX + 'now']: entry(1, NOW),
      [PREFIX + 'past']: entry(2, NOW - 1), unrelated: entry(3, NOW - 1)});
    assert.strictEqual(cache.getItem('missing'), null);
    assert.strictEqual(cache.getItem('now'), null);
    assert.strictEqual(cache.getItem('past'), null);
    cache.gc(); cache.flushTimers();
    assert.deepStrictEqual(Object.keys(backing), ['unrelated']);
  });

  it('normal property-set storage round trips data and schedules ordinary GC', function() {
    const {cache, writes} = make();
    cache.setItem('value', {a: 1}, 50);
    assert.strictEqual(writes.length, 1);
    assert.deepStrictEqual(cache.getItem('value'), {a: 1});
    assert.strictEqual(JSON.parse(writes[0].value).expiredAt, NOW + 50);
    cache.flushTimers();
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
      cache.flushTimers();
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
    cache.flushTimers();
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

  it('constructor GC removes corrupt/expired entries before populating memory', function() {
    const good = entry('good');
    const {cache, backing} = make({[PREFIX + 'bad']: 'null',
      [PREFIX + 'old']: entry('old', NOW - 1), [PREFIX + 'good']: good, unrelated: 'keep'}, null, true);
    assert.strictEqual(cache._memory[PREFIX + 'good'], good);
    assert.strictEqual(cache._memory[PREFIX + 'bad'], undefined);
    assert.strictEqual(cache._memory[PREFIX + 'old'], undefined);
    assert.strictEqual(backing.unrelated, 'keep');
  });

  it('invalid reads and GC remove matching memory entries but preserve valid memory', function() {
    const {cache, backing} = make({[PREFIX + 'bad']: 'null',
      [PREFIX + 'old']: entry('old', NOW - 1), [PREFIX + 'good']: entry('good')});
    assert.strictEqual(cache.getItem('bad'), null);
    assert.strictEqual(cache._memory[PREFIX + 'bad'], undefined);
    cache.gc(); cache.flushTimers();
    assert.strictEqual(cache._memory[PREFIX + 'old'], undefined);
    assert.strictEqual(cache._memory[PREFIX + 'good'], backing[PREFIX + 'good']);
  });

  it('setItem keeps the existing memory envelope even if persistence fails', function() {
    const {cache} = make({}, () => quota());
    cache.setItem('new', {a: 1});
    assert.strictEqual(cache._memory[PREFIX + 'new'].data.a, 1);
    assert.strictEqual(cache.getItem('new'), null); // memory is not a read fallback
  });

  it('removeItem and clear discard the corresponding prefixed memory entries', function() {
    const {cache, backing} = make({[PREFIX + 'one']: entry(1),
      [PREFIX + 'two']: entry(2), unrelated: 'keep'});
    cache.removeItem('one');
    assert.strictEqual(cache._memory[PREFIX + 'one'], undefined);
    assert.strictEqual(backing[PREFIX + 'one'], undefined);
    assert.notStrictEqual(cache._memory[PREFIX + 'two'], undefined);
    cache.clear();
    assert.deepStrictEqual(Object.keys(cache._memory), []);
    assert.deepStrictEqual(Object.keys(backing), ['unrelated']);
  });
});
