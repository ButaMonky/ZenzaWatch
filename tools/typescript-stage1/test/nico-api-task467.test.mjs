// Task467: OwnerSupplement offline parity against the immutable pre-TS fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico, read, loadLegacy, snapshot, settle} from './nico-api-harness.mjs';

emitNico();
const spec = NICO_API_BY_NAME.OwnerSupplement;
const before = read(spec.fixture);
const after = read(spec.runtime);
const clone = v => structuredClone(v);

function makeGlobals(scenario) {
  const log = [];
  const fetcher = async (url, options) => {
    log.push(['fetch', url, options]);
    if (scenario.fetchFails) throw Error('offline');
    if (scenario.nullResponse) return null;
    return {
      ok: scenario.ok !== false,
      json: async () => {
        if (scenario.jsonFails) throw SyntaxError('invalid json');
        return scenario.body;
      }
    };
  };
  const globals = {
    window: {console: {warn: (...args) => log.push(['warn', ...args])}},
    fetch: fetcher
  };
  if (!scenario.fallback) globals.netUtil = {fetch: fetcher};
  return {globals, log};
}

async function compare(label, scenario, operation) {
  const a = makeGlobals(scenario), b = makeGlobals(scenario);
  const oldApi = loadLegacy(before, 'OwnerSupplement', a.globals);
  const newApi = loadLegacy(after, 'OwnerSupplement', b.globals);
  const oldInput = clone(scenario.thumbInfo);
  const newInput = clone(scenario.thumbInfo);
  const oldResult = await settle(() => operation(oldApi, oldInput));
  const newResult = await settle(() => operation(newApi, newInput));
  assert.deepEqual(snapshot(newResult), snapshot(oldResult), label + ' return');
  assert.deepEqual(snapshot(newInput), snapshot(oldInput), label + ' mutation');
  assert.deepEqual(snapshot(b.log), snapshot(a.log), label + ' network and warnings');
  if (operation === supplement && oldResult.ok) {
    assert.strictEqual(oldResult.value, oldInput, label + ' old identity');
    assert.strictEqual(newResult.value, newInput, label + ' new identity');
  }
}
const supplement = (api, info) => api.supplementThumbInfo(info);
const direct = api => api.loadFromNicoad('sm9');
const complete = {data: {id: 'sm9', ownerId: 123, ownerName: 'Alice',
  ownerIcon: 'http://example.invalid/icon.png'}};
const missingOwner = {status: 'ok', videoId: 'sm9', owner: null};

test('OwnerSupplement: direct NICoad response/HTTP/fetch/error/fallback parity', async () => {
  const cases = [
    ['valid owner', {body: complete}],
    ['owner ID number', {body: {data: {id: 'sm9', ownerId: 42}}}],
    ['mismatched video', {body: {data: {id: 'sm8', ownerId: 42}}}],
    ['missing owner ID', {body: {data: {id: 'sm9'}}}],
    ['missing data', {body: {}}],
    ['null body', {body: null}],
    ['HTTP failure', {ok: false, body: complete}],
    ['missing response', {nullResponse: true}],
    ['network failure', {fetchFails: true}],
    ['JSON failure', {jsonFails: true}],
    ['global fetch fallback', {body: complete, fallback: true}]
  ];
  for (const [label, scenario] of cases) await compare(label, scenario, direct);
  assert.equal(cases.length, 11);
});

test('OwnerSupplement: thumbInfo owner mutation and skip/error parity', async () => {
  const cases = [
    ['success + icon protocol upgrade', {thumbInfo: missingOwner, body: complete}],
    ['empty owner name/icon defaults', {thumbInfo: missingOwner,
      body: {data: {id: 'sm9', ownerId: 9}}}],
    ['HTTP 404 owner fallback', {thumbInfo: missingOwner, ok: false, body: complete}],
    ['API ID mismatch fallback', {thumbInfo: missingOwner,
      body: {data: {id: 'sm8', ownerId: 9}}}],
    ['network failure logs warning', {thumbInfo: missingOwner, fetchFails: true}],
    ['JSON parse failure logs warning', {thumbInfo: missingOwner, jsonFails: true}],
    ['channel fallback no API request', {thumbInfo: {...missingOwner, isChannel: true}}],
    ['invalid numeric ID skips API', {thumbInfo: {...missingOwner, videoId: '12345'}}],
    ['invalid alpha ID skips API', {thumbInfo: {...missingOwner, videoId: 'so4'}}],
    ['missing ID skips API', {thumbInfo: {status: 'ok', owner: null}}],
    ['not-ok untouched', {thumbInfo: {status: 'error', videoId: 'sm9', owner: null}}],
    ['preexisting owner untouched', {thumbInfo: {...missingOwner, owner: {id: '5'}}}],
    ['null untouched', {thumbInfo: null}],
    ['undefined untouched', {thumbInfo: undefined}],
    ['id fallback', {thumbInfo: {status: 'ok', id: 'nm5'}, body: {data: {id: 'nm5', ownerId: 7}}}],
    ['global fetch fallback', {thumbInfo: missingOwner, body: complete, fallback: true}],
    ['unexpected icon type throws as before', {thumbInfo: missingOwner,
      body: {data: {id: 'sm9', ownerId: 1, ownerIcon: 123}}}]
  ];
  for (const [label, scenario] of cases) await compare(label, scenario, supplement);
  assert.equal(cases.length, 17);
});
