// Task478: byte-exact pre-migration vs generated TypeScript transport parity.
// No network traffic, cookies, comment bodies or credentials leave these fakes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico, read, loadLegacy, snapshot, settle} from './nico-api-harness.mjs';

emitNico();
const spec = NICO_API_BY_NAME.CommentPostWire;
const original = read(spec.fixture);
const generated = read(spec.runtime);
const endpoint = 'https://comments.invalid/v1/threads/123/comments';

function environment(mode) {
  const calls = [];
  const signals = [];
  const timers = new Map();
  let nextTimer = 0;
  const setTimeout = (fn, ms) => {
    const id = ++nextTimer;
    timers.set(id, {fn, ms});
    return id;
  };
  const clearTimeout = id => timers.delete(id);
  const netUtil = {fetch: async (url, options) => {
    calls.push({url: String(url), method: options.method,
      timeout: options.timeout, credentials: options.credentials,
      body: options.body, hasSignal: !!options.signal});
    signals.push(options.signal);
    if (mode === 'network-error') { throw new TypeError('offline'); }
    if (mode === 'header-timeout') { return new Promise(() => {}); }
    if (mode === 'body-timeout') {
      return {status: 503, json: () => new Promise(() => {})};
    }
    if (mode === 'bad-json') {
      return {status: 502, json: async () => { throw new SyntaxError('invalid-json'); }};
    }
    if (mode === 'api-rejected') {
      return {status: 400, json: async () => ({meta: {status: 400,
        errorCode: 'INVALID_PARAMETER'}})};
    }
    return {status: 200, json: async () => ({meta: {status: 200},
      data: {no: 19, id: 'fixture'}})};
  }};
  const globals = {netUtil, setTimeout, clearTimeout, AbortController,
    Promise, Error, TypeError, SyntaxError, URL};
  const fire = () => {
    for (const item of [...timers.values()]) { item.fn(); }
  };
  return {globals, calls, signals, timers, fire};
}
async function resultOf(source, mode) {
  const env = environment(mode);
  const subject = loadLegacy(source, 'CommentPostWire', env.globals);
  const promise = settle(() => subject.fetchJsonWithin(endpoint,
    {method: 'POST', credentials: 'include', body: '{"fixture":true}'}, 30000));
  for (let i = 0; i < 12; i++) { await Promise.resolve(); }
  if (mode.includes('timeout')) { env.fire(); }
  const outcome = await promise;
  return {
    ok: outcome.ok,
    value: outcome.ok ? snapshot(outcome.value) : undefined,
    error: outcome.ok ? undefined : {
      name: outcome.error?.name, kind: outcome.error?.kind,
      message: outcome.error?.message, httpStatus: outcome.error?.httpStatus
    },
    calls: env.calls,
    signalAborted: env.signals.map(signal => !!signal?.aborted),
    timersLeft: env.timers.size
  };
}

for (const mode of ['accepted', 'api-rejected', 'network-error',
  'header-timeout', 'body-timeout', 'bad-json']) {
  test('CommentPostWire TypeScript/legacy parity: ' + mode, async () => {
    const before = await resultOf(original, mode);
    const after = await resultOf(generated, mode);
    assert.deepEqual(after, before);
    assert.equal(after.calls.length, 1, 'transport never retries a POST');
    assert.equal(after.calls[0].timeout, 30000);
    assert.equal(after.calls[0].method, 'POST');
    assert.equal(after.timersLeft, 0);
  });
}
