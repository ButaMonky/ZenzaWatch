// B18 lane-03: owned privacy GREEN regression for synthetic console sinks.
// Does not access real media or network. Historical B17 RED fixture stays immutable.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {read, loadLegacy} from './nico-api-harness.mjs';

const sessionJs = read('packages/lib/src/nico/VideoSessionWorker.js');
const sessionTs = read('tools/typescript-stage1/nico-src/VideoSessionWorker.ts');
const logSafeJs = read('packages/lib/src/infra/logSafe.js');
const logSafeTs = read('tools/typescript-stage1/nico-src/logSafe.ts');
const marker = 'SYNTH_B18_PRIVATE_SENTINEL';

function containsMarker(value, valueToFind = marker, seen = new Set()) {
  if (typeof value === 'string') return value.includes(valueToFind);
  if (value === null || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (desc && Object.hasOwn(desc, 'value') &&
        containsMarker(desc.value, valueToFind, seen)) return true;
  }
  return false;
}

const safeLogger = () => loadLegacy(logSafeJs, 'logSafe',
  {URL, Error, WeakSet, JSON, Object, Array, String});

test('B18 session catch: error and nested cause are never console arguments', () => {
  assert.match(sessionTs, /create api fail/);
  const statements = sessionJs.match(/console\.error\('create api fail'(?:,\s*err)?\);/g);
  assert.equal(statements?.length, 1, 'only one owned session catch sink');
  const calls = [];
  const catcher = runInNewContext('(err => {' + statements[0] + '})',
    {console: {error: (...args) => calls.push(args)}});
  catcher(new Error(marker, {cause: {nested: marker}}));
  assert.equal(calls.length, 1);
  assert.equal(containsMarker(calls), false, 'raw Error/cause must not reach console');
});

test('B18 logSafe masks URL instance query and URL-shaped strings', () => {
  const safe = safeLogger();
  const sample = 'https://example.invalid/synthetic?opaque=' + marker;
  assert.equal(containsMarker(safe.redact(new URL(sample))), false);
  assert.equal(containsMarker(safe.redact(sample)), false);
  assert.equal(containsMarker(safe.redact('failed: ' + sample)), false);
  assert.equal(containsMarker(safe.redact({url: sample})), false);
});

test('B18 logSafe masks Error.message/cause with a safe error kind', () => {
  const safe = safeLogger();
  const result = safe.redact(new Error(marker, {cause: {nested: marker}}));
  assert.equal(containsMarker(result), false);
  assert.equal(result.name, 'Error');
  assert.equal(result.message, safe.MASK);
  assert.equal(result.cause, safe.MASK);
});

test('B18 redaction does not invoke ordinary object, array or Error getters', () => {
  const safe = safeLogger();
  let hits = 0;
  const obj = {phase: 'ready'};
  Object.defineProperty(obj, 'secretGetter', {enumerable: true, get() {hits++; return marker;}});
  const array = ['safe'];
  Object.defineProperty(array, '0', {enumerable: true, get() {hits++; return marker;}});
  const err = new Error('synthetic');
  Object.defineProperty(err, 'name', {get() {hits++; return marker;}});
  Object.defineProperty(err, 'message', {get() {hits++; return marker;}});
  Object.defineProperty(err, 'cause', {get() {hits++; return marker;}});
  const out = [safe.redact(obj), safe.redact(array), safe.redact(err)];
  assert.equal(hits, 0, 'redactor must never execute supplied accessor code');
  assert.equal(containsMarker(out), false);
  assert.equal(out[0].phase, 'ready');
  assert.equal(out[0].secretGetter, safe.MASK);
  assert.equal(out[1][0], safe.MASK);
});

test('B18 non-secret state/codes and legacy keyed/JSON mask remain intact', () => {
  const safe = safeLogger();
  const obj = safe.redact({phase: 'ready', errorCode: 'SYNTHETIC_CODE',
    elapsedMs: 12, token: marker, nested: {cookie: marker}});
  assert.equal(obj.phase, 'ready');
  assert.equal(obj.errorCode, 'SYNTHETIC_CODE');
  assert.equal(obj.elapsedMs, 12);
  assert.equal(obj.token, safe.MASK);
  assert.equal(obj.nested.cookie, safe.MASK);
  assert.equal(containsMarker(obj), false);
  assert.equal(containsMarker(safe.redact('{"token":"' + marker + '"}')), false);
  assert.match(logSafeTs, /const logSafe/);
});

// Session lifecycle failures must preserve rejection behavior without logging raw Error data.
for (const label of ['create domand session fail', 'create dmc session fail', 'delete fail']) {
  test('session lifecycle ' + label + ' never logs the raw error', () => {
    const prefix = "console.error('" + label + "'";
    const begin = sessionJs.indexOf(prefix);
    assert.ok(begin >= 0, 'existing lifecycle catch must be exercised');
    const end = sessionJs.indexOf(')', begin) + 1;
    const statement = sessionJs.slice(begin, end);
    const calls = [];
    const catcher = runInNewContext('(err => {' + statement + ';})', {
      console: {error: (...args) => calls.push(args)}
    });
    catcher(new Error(marker, {cause: {nested: marker}}));
    assert.equal(calls.length, 1);
    assert.equal(containsMarker(calls), false, 'Error message/cause cannot reach console');
  });
}
