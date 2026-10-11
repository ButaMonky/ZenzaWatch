'use strict';
const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

function fixture(path, failCounts = {}) {
  const attempts = new Map();
  const requests = [];
  const batches = [];
  const pageItems = page => Array.from({length: 100}, (_, i) => ({
    essential: {id: 'sm' + ((page - 1) * 100 + i + 1),
      registeredAt: '2026-10-01T00:00:00Z', duration: 100}
  }));
  const c = createContext({
    NicoSearchApiV2Version: class {},
    API_BASE_URL: 'https://search.example.invalid/v2',
    initializeCrossDomainGate() {},
    console: {log() {}, warn() {}, info() {}},
    netUtil: {fetch: async url => {
      const page = Number(new URL(url).searchParams.get('page'));
      requests.push(page);
      const attempt = (attempts.get(page) || 0) + 1;
      attempts.set(page, attempt);
      if (attempt <= (failCounts[page] || 0)) {
        throw new Error('fixture page failure');
      }
      return {status: 200, json: async () => ({meta: {status: 200},
        data: {totalCount: 500, items: pageItems(page)}})};
    }},
    gate: {fetch: async url => {
      const entries = Array.from(new URL(url).searchParams.entries())
        .filter(([key]) => /^filters\[contentId\]\[\d+\]$/.test(key))
        .map(([, id]) => id);
      batches.push(entries);
      return {text: async () => JSON.stringify({meta: {status: 200},
        data: entries.map(contentId => ({contentId}))})};
    }}
  });
  c.window = c;
  const Loader = loadClass(path, 'NicoSearchApiV2Loader', c);
  c.NicoSearchApiV2Loader = Loader;
  Loader.nvapi = {toLegacyItem: data => ({id: data.id})};
  return {Loader, requests, attempts, batches};
}

for (const path of ['packages/lib/src/nico/VideoSearch.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task366 AUD-40 owner-page retry and completeness: ' + path, () => {
    it('retries a transient page failure once and returns complete results', async () => {
      const f = fixture(path, {3: 1});
      const r = await f.Loader.searchByOwner('test', {userId: 42}, 5000);
      assert.strictEqual(f.attempts.get(3), 2);
      assert.strictEqual(r.status, 'ok');
      assert.strictEqual(r.count, 500);
      assert.ok(r.list.some(v => v.id === 'sm201'));
      assert.strictEqual(r.isPartial, undefined);
      assert.strictEqual(r.missingOwnerPages, undefined);
      assert.strictEqual(f.batches.flat().length, 500);
    });
    it('marks results incomplete when a page still fails after one retry', async () => {
      const f = fixture(path, {3: 100});
      const r = await f.Loader.searchByOwner('test', {userId: 42}, 5000);
      assert.strictEqual(f.attempts.get(3), 2, 'only one retry allowed');
      assert.strictEqual(r.count, 400);
      assert.strictEqual(r.isPartial, true);
      assert.deepStrictEqual(Array.from(r.missingOwnerPages), [3]);
      assert.ok(r.list.some(v => v.id === 'sm301'), 'preserve page4');
      assert.ok(r.list.some(v => v.id === 'sm401'), 'preserve page5');
      assert.ok(!r.list.some(v => v.id === 'sm201'));
    });
    it('reports every missing page in ascending order without dropping siblings', async () => {
      const f = fixture(path, {2: 100, 4: 100});
      const r = await f.Loader.searchByOwner('test', {userId: 42}, 5000);
      assert.strictEqual(f.attempts.get(2), 2);
      assert.strictEqual(f.attempts.get(4), 2);
      assert.deepStrictEqual(Array.from(r.missingOwnerPages), [2, 4]);
      assert.strictEqual(r.isPartial, true);
      assert.strictEqual(r.count, 300);
      assert.ok(r.list.some(v => v.id === 'sm201'), 'page3 survives');
      assert.ok(r.list.some(v => v.id === 'sm401'), 'page5 survives');
    });
    it('preserves first-page failure as rejection', async () => {
      const f = fixture(path, {1: 100});
      await assert.rejects(f.Loader.searchByOwner('test', {userId: 42}, 5000),
        /fixture page failure/);
      assert.strictEqual(f.attempts.get(1), 1);
      assert.strictEqual(f.batches.length, 0);
    });
  });
}
