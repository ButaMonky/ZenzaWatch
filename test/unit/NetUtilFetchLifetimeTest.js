const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const {AbortController} = global;
function subject() {
  const timers = new Map(), calls = [];
  let seq = 0, resolveFetch, rejectFetch, syncError;
  const c = createContext({AbortController,
    location: {origin: 'https://www.nicovideo.jp', href: 'https://www.nicovideo.jp/watch/sm9'},
    console: {warn() {}},
    isWhiteHost: () => true, isNicoServiceHost: () => true,
    setTimeout: (fn, ms) => { timers.set(++seq, {fn, ms}); return seq; },
    clearTimeout: id => timers.delete(id),
    fetch: (url, options) => {
      calls.push({url, options});
      if (syncError) { throw syncError; }
      return new Promise((resolve, reject) => {
        resolveFetch = resolve; rejectFetch = reject;
        if (options.signal) {
          const rejectAbort = () => reject(options.signal.reason || Object.assign(new Error('aborted'), {name: 'AbortError'}));
          if (options.signal.aborted) { rejectAbort(); }
          else { options.signal.addEventListener('abort', rejectAbort, {once: true}); }
        }
      });
    }});
  run('globalThis.subject = ' + extract('packages/lib/src/infra/netUtil.js', 'netUtil', 'var'), c);
  return {c, timers, calls, call: options => c.subject.abortableFetch('https://www.nicovideo.jp/api', options),
    resolve: value => resolveFetch(value), reject: error => rejectFetch(error),
    syncThrow: error => { syncError = error; },
    fireTimeout: () => { const [id, timer] = timers.entries().next().value; timers.delete(id); timer.fn(); }};
}
function caller() {
  const controller = new AbortController(), signal = controller.signal, listeners = new Set();
  const add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal);
  signal.addEventListener = (name, listener, options) => { if (name === 'abort') { listeners.add(listener); } return add(name, listener, options); };
  signal.removeEventListener = (name, listener, options) => { if (name === 'abort') { listeners.delete(listener); } return remove(name, listener, options); };
  return {controller, signal, listeners};
}
async function rejected(promise) {
  try { await promise; } catch (error) { return error; }
  assert.fail('expected rejection');
}
function clean(h, c) {
  assert.strictEqual(h.timers.size, 0, 'owned timeout removed');
  assert.strictEqual(c.listeners.size, 0, 'caller abort listener removed');
}

describe('issue032net fetch lifetime', () => {
  it('preserves frozen options and clears timeout/listener on success', async () => {
    const h = subject(), c = caller(), headers = {Accept: 'application/json'};
    const options = Object.freeze({signal: c.signal, timeout: 23, credentials: 'include', method: 'POST', body: 'body', headers});
    const p = h.call(options), response = {status: 200};
    assert.strictEqual(h.calls.length, 1);
    const actual = h.calls[0].options;
    assert.notStrictEqual(actual, options); assert.strictEqual(options.signal, c.signal);
    assert.strictEqual(actual.headers, headers); assert.strictEqual(actual.body, 'body');
    assert.strictEqual(actual.credentials, 'include'); assert.strictEqual(actual.method, 'POST');
    assert.strictEqual(Array.from(h.timers.values())[0].ms, 23);
    h.resolve(response); assert.strictEqual(await p, response); clean(h, c);
    c.controller.abort(); assert.strictEqual(actual.signal.aborted, false, 'no abort relay retained after success');
  });
  it('preserves network failure contract and clears resources', async () => {
    const h = subject(), c = caller(), error = new TypeError('network failure');
    const p = h.call({signal: c.signal}); h.reject(error);
    const result = await rejected(p); assert.strictEqual(result, error);
    clean(h, c);
  });
  it('cleans resources after synchronous fetch failure', async () => {
    const h = subject(), c = caller(), error = new TypeError('invalid URL'); h.syncThrow(error);
    const result = await rejected(h.call({signal: c.signal})); assert.strictEqual(result, error);
    clean(h, c);
  });
  it('handles caller abort before fetch without dispatch', async () => {
    const h = subject(), c = caller(), error = Object.assign(new Error('cancel'), {name: 'AbortError'});
    c.controller.abort(error);
    const result = await rejected(h.call({signal: c.signal})); assert.strictEqual(result, error);
    assert.strictEqual(h.calls.length, 0); clean(h, c);
  });
  it('relays caller abort during fetch and removes resources', async () => {
    const h = subject(), c = caller(), error = Object.assign(new Error('cancel'), {name: 'AbortError'});
    const p = h.call({signal: c.signal}); c.controller.abort(error);
    const result = await rejected(p); assert.strictEqual(result, error);
    assert.strictEqual(h.calls[0].options.signal.aborted, true);
    assert.strictEqual(h.calls[0].options.signal.reason, error); clean(h, c);
  });
  it('timeout aborts the actual fetch and clears the caller relay', async () => {
    const h = subject(), c = caller();
    const p = h.call({signal: c.signal, timeout: 5}); h.fireTimeout();
    const result = await rejected(p); assert(result instanceof Error); assert.strictEqual(result.name, 'timeout');
    assert.strictEqual(h.calls[0].options.signal.aborted, true); clean(h, c);
  });
  it('zero timeout schedules nothing but caller cancellation still works', async () => {
    const h = subject(), c = caller(), error = Object.assign(new Error('cancel'), {name: 'AbortError'});
    const p = h.call({signal: c.signal, timeout: 0}); assert.strictEqual(h.timers.size, 0);
    c.controller.abort(error); const result = await rejected(p); assert.strictEqual(result, error);
    clean(h, c);
  });
});
