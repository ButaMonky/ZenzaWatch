const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

const flush = async () => {
  for (let i = 0; i < 8; i++) { await Promise.resolve(); }
};

function make({cache = null, getToken = () => Promise.resolve('token'), sourcePath = 'src/_pocket.js'} = {}) {
  const timers = new Map();
  const cleared = [];
  const writes = [];
  let nextTimer = 0;
  const cacheStorage = {
    getItem() { return cache; },
    setItem(key, value, ttl) { writes.push({key, value, ttl}); }
  };
  const window = {
    setTimeout(callback, ms) {
      const id = ++nextTimer;
      timers.set(id, {callback, ms});
      return id;
    },
    clearTimeout(id) {
      cleared.push(id);
      timers.delete(id);
    }
  };
  const context = createContext({cacheStorage, window});
  run(`const cacheStorage = globalThis.cacheStorage;
    const TIMEOUT = 10 * 1000;
    const CACHE_EXPIRE_TIME = 60 * 30 * 1000;
    ${extract(sourcePath, 'CsrfTokenLoader', 'class')};
    globalThis.Subject = CsrfTokenLoader;`, context);
  context.Subject._getToken = getToken;
  return {Subject: context.Subject, timers, cleared, writes};
}

describe('CsrfTokenLoader failure lifetime (AUD-26 / Task246)', function() {
  it('propagates an immediate token-load rejection instead of waiting for the 10s timeout', async function() {
    const failure = new Error('network-down');
    const {Subject, timers, cleared} = make({
      getToken: () => Promise.reject(failure)
    });
    let outcome;
    Subject.load().then(
      value => { outcome = {ok: true, value}; },
      error => { outcome = {ok: false, error}; }
    );

    await flush();

    assert.ok(outcome, 'load() must settle when _getToken() already rejected');
    assert.equal(outcome.ok, false);
    assert.strictEqual(outcome.error, failure);
    assert.equal(cleared.length, 1, 'the 10s timer must be cleared on failure');
    assert.equal(timers.size, 0, 'no stale timeout may remain after failure');
  });

  it('keeps the successful token path and clears its timeout', async function() {
    const {Subject, timers, cleared, writes} = make({
      getToken: () => Promise.resolve('csrf-ok')
    });
    const token = await Subject.load();

    assert.equal(token, 'csrf-ok');
    assert.equal(cleared.length, 1);
    assert.equal(timers.size, 0);
    assert.deepEqual(writes, [{key: 'csrfToken', value: 'csrf-ok', ttl: 60 * 30 * 1000}]);
  });

  it('returns a cached token without scheduling network timeout work', async function() {
    const {Subject, timers, writes} = make({
      cache: 'cached-token',
      getToken: () => { throw new Error('must not fetch'); }
    });
    const token = await Subject.load();

    assert.equal(token, 'cached-token');
    assert.equal(timers.size, 0);
    assert.equal(writes.length, 0);
  });
});

describe('Task295 recovered CsrfTokenLoader generated dist parity', () => {
  it('rejects immediately, clears the timer, and does not cache on failure', async function() {
    this.timeout(10000);
    const failure = new Error('dist-token-network-failure');
    const {Subject, timers, cleared, writes} = make({
      sourcePath: 'dist/MylistPocket.user.js',
      getToken: () => Promise.reject(failure)
    });
    let outcome;
    Subject.load().then(
      value => { outcome = {ok: true, value}; },
      error => { outcome = {ok: false, error}; }
    );
    await flush();
    assert.ok(outcome, 'generated dist should settle after rejected token load');
    assert.strictEqual(outcome.ok, false);
    assert.strictEqual(outcome.error, failure);
    assert.strictEqual(cleared.length, 1);
    assert.strictEqual(timers.size, 0);
    assert.strictEqual(writes.length, 0);
  });
});
