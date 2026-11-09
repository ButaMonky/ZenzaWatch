import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const input = 'tools/typescript-stage1/test/fixtures/PocketCardMetadataLoader.before-task210.js';
const emitted = 'tools/typescript-stage1/.generated/pocket-metadata/PocketCardMetadataLoader.js';
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

function load(pathName, generated = false) {
  let code = read(pathName);
  if (!generated) {
    code = code.slice(code.indexOf('//===BEGIN===') + '//===BEGIN==='.length,
      code.indexOf('//===END==='));
  }
  code = code.replace(/export\s*\{\s*PocketCardMetadataLoader\s*\}\s*;?\s*$/, '');
  const sandbox = {URL, Date, Promise, Map, encodeURIComponent, fetch: async () => null};
  vm.runInNewContext(code + '\nthis.module = PocketCardMetadataLoader;', sandbox, {
    filename: 'PocketCardMetadataLoader.js'
  });
  return sandbox.module;
}

const fixture = {
  meta: {status: 200},
  data: {items: [{watchId: 'sm9', video: {
    id: 'sm9', count: {like: 12},
    owner: {ownerType: 'user', id: '42', name: 'user', iconUrl: 'http://img.test/icon'},
    thumbnail: {ogp: 'https://img.test/thumb', normal: 'ftp://bad.test/thumb'}
  }}]}
};
const asJson = value => JSON.parse(JSON.stringify(value));

test('ported metadata parser preserves success, invalid IDs and null fallback', () => {
  const old = load(input), next = load(emitted, true);
  for (const payload of [fixture, {meta: {status: 403}}, null, {}, {
    meta: {status: 200}, data: {items: [{watchId: 'sm9', video: {id: 'sm10'}}]}
  }]) {
    assert.deepEqual(asJson(old.parse(payload, 'sm9')),
      asJson(next.parse(payload, 'sm9')));
  }
  for (const n of [null, -2, 0, 3.5, 10, '10', Number.NaN]) {
    assert.equal(old.validLike(n), next.validLike(n));
  }
});

test('ported metadata loader preserves fetch count, headers and in-flight reuse', async () => {
  for (const [pathName, generated] of [[input, false], [emitted, true]]) {
    const metadata = load(pathName, generated);
    const calls = [];
    const fetcher = async (url, opts) => {
      calls.push({url, opts});
      return {ok: true, json: async () => fixture};
    };
    const [first, concurrent] = await Promise.all([
      metadata.load('sm9', fetcher),
      metadata.load('sm9', fetcher)
    ]);
    assert.deepEqual(asJson(first), asJson(concurrent));
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].opts.credentials, 'omit');
    assert.equal(calls[0].opts.timeout, 6000);
    assert.equal(calls[0].opts.headers['X-Frontend-Id'], '6');
    assert.deepEqual(asJson(await metadata.load('sm9', fetcher)), asJson(first));
    assert.equal(calls.length, 1, 'cached result');
    assert.equal(await metadata.load('bogus/watch', fetcher), null);
    assert.equal(calls.length, 1, 'invalid ID must not fetch');
  }
});

test('ported owner and thumbnail normalization match legacy for untrusted inputs', () => {
  const old = load(input), next = load(emitted, true);
  const owners = [
    null, {}, {ownerType: 'user', id: '../../', name: 'unknown'},
    {ownerType: 'user', visibility: 'hidden', id: '123', name: 'private'},
    {ownerType: 'channel', id: 'ch345', name: '公式', iconUrl: 'http://img.test/icon'},
    {ownerType: 'user', id: '12', name: '', iconUrl: 'javascript:invalid'}
  ];
  for (const owner of owners) {
    assert.deepEqual(asJson(old.normalizeOwner(owner)),
      asJson(next.normalizeOwner(owner)));
  }
  const thumbnails = [
    null, [], {ogp: 'https://img.test/ok', normal: 'ftp://bad.test/no'},
    {url: 'https://user:pass@invalid.test/img'},
    {player: 'http://img.test/player', large: 'not a url'}
  ];
  for (const thumbnail of thumbnails) {
    const packet = {meta: {status: 200}, data: {items: [
      {watchId: 'sm9', video: {id: 'sm9', count: {like: 0}, thumbnail}}
    ]}};
    assert.deepEqual(asJson(old.parse(packet, 'sm9')),
      asJson(next.parse(packet, 'sm9')));
  }
});

test('ported loader preserves null recovery for failed and malformed responses', async () => {
  const cases = [
    {id: 'sm11', response: () => {throw new Error('synthetic offline');}},
    {id: 'sm12', response: async () => ({ok: false})},
    {id: 'sm13', response: async () => ({ok: true, json: async () => ({data: {items: []}})})}
  ];
  for (const [file, generated] of [[input, false], [emitted, true]]) {
    const loader = load(file, generated);
    let requests = 0;
    for (const {id, response} of cases) {
      assert.equal(await loader.load(id, async () => {requests++; return response();}), null);
      assert.equal(await loader.load(id, async () => {requests++; return response();}), null);
    }
    assert.equal(requests, cases.length, 'negative results must be cached as before');
  }
});
