'use strict';
const assert = require('assert');
const {createContext, loadClass, loadSearchDependencies} = require('../helpers/extractSource');

// Only synthetic pages and snapshot IDs: no NicoNico network or user account data.
function harness(source, videos) {
  const batches = [];
  const c = createContext({
    NicoSearchApiV2Version: class {},
    API_BASE_URL: 'https://search.example.invalid/v2',
    initializeCrossDomainGate() {},
    console: {log() {}, warn() {}, info() {}},
    netUtil: {fetch: async () => ({
      status: 200,
      json: async () => ({
        meta: {status: 200},
        data: {totalCount: videos.length, items: videos.map(essential => ({essential}))}
      })
    })},
    gate: {fetch: async url => {
      const ids = Array.from(new URL(url).searchParams.entries())
        .filter(([key]) => /^filters\[contentId\]\[\d+\]$/.test(key))
        .map(([, id]) => id);
      batches.push(ids);
      return {text: async () => JSON.stringify({
        meta: {status: 200}, data: ids.map(contentId => ({contentId}))
      })};
    }}
  });
  loadSearchDependencies(source, c);
  c.window = c;
  const Loader = loadClass(source, 'NicoSearchApiV2Loader', c);
  c.NicoSearchApiV2Loader = Loader;
  Loader.nvapi = {toLegacyItem: item => ({id: item.id})};
  return {Loader, batches};
}
const vid = (n, date, comments, views = n) => ({
  id: 'sm' + n,
  registeredAt: date,
  duration: 200,
  count: {comment: comments, view: views, mylist: n, like: n}
});
const dates = [
  vid(1, '2026-11-01T00:00:00Z', 120, 20),
  vid(2, '2026-11-07T14:59:59Z', 110, 30),
  vid(3, '2026-11-07T15:00:00Z', 130, 40),
  vid(4, '2026-10-31T14:59:59Z', 200, 50),
  vid(5, '2026-11-03T00:00:00Z', 99, 60)
];
const idList = r => Array.from(r.list, x => x.id);

for (const source of ['packages/lib/src/nico/VideoSearch.js', 'dist/ZenzaWatch-dev.user.js']) {
  describe('audit #269 owner-search filters, parity: ' + source, () => {
    it('applies inclusive JST calendar dates, comment count and requested view sorting', async () => {
      const h = harness(source, dates);
      const r = await h.Loader.searchByOwner('fixture', {
        userId: 42, dateFrom: '2026-11-01', dateTo: '2026-11-07',
        commentCount: 100, sort: 'v', order: 'd'
      });
      assert.deepStrictEqual(idList(r), ['sm2', 'sm1']);
      assert.strictEqual(r.count, 2);
      assert.deepStrictEqual(Array.from(r.unappliedConditions || []), []);
      assert.strictEqual(h.batches.length, 1);
    });
    it('supports direct start/end day boundaries and Unix timestamp bounds', async () => {
      const h = harness(source, dates);
      const calendar = await h.Loader.searchByOwner('fixture', {
        userId: 42, start: '2026-11-07', end: '2026-11-07'
      });
      assert.deepStrictEqual(idList(calendar), ['sm2']);
      const epoch = await h.Loader.searchByOwner('fixture', {
        userId: 42, utimeFrom: String(Date.parse('2026-11-07T14:59:59Z') / 1000),
        utimeTo: String(Date.parse('2026-11-07T14:59:59Z') / 1000)
      });
      assert.deepStrictEqual(idList(epoch), ['sm2']);
    });
    it('honors the official search UI 32-item page offset after sorting', async () => {
      const videos = Array.from({length: 40}, (_, i) =>
        vid(i + 1, '2026-10-01T00:00:00Z', i + 1, i + 1));
      const h = harness(source, videos);
      const r = await h.Loader.searchByOwner('fixture', {
        userId: 42, page: 2, sort: 'v', order: 'a'
      }, 5);
      assert.deepStrictEqual(idList(r), ['sm33', 'sm34', 'sm35', 'sm36', 'sm37']);
      assert.strictEqual(r.count, 40);
      assert.deepStrictEqual(Array.from(r.unappliedConditions || []), []);
    });
    it('warns instead of pretending unsupported hot/last-comment/genre/kind conditions applied', async () => {
      const h = harness(source, dates);
      const r = await h.Loader.searchByOwner('fixture', {
        userId: 42, sort: 'n', order: 'd', genre: 'anime', kind: 'user',
        selectContentType: 'short', channelVideoListingStatus: 'included'
      });
      assert.deepStrictEqual(Array.from(r.unappliedConditions),
        ['sort', 'genre', 'selectContentType', 'channelVideoListingStatus', 'kind']);
      const hot = await h.Loader.searchByOwner('fixture', {userId: 42, sort: 'h'});
      assert.deepStrictEqual(Array.from(hot.unappliedConditions), ['sort']);
    });
    it('reports invalid input without silently applying a different range, page or order', async () => {
      const h = harness(source, dates);
      const r = await h.Loader.searchByOwner('fixture', {
        userId: 42, dateFrom: 'not-a-date', commentCount: 'abc',
        page: 'bad', order: 'unsupported', l_range: 9
      });
      assert.deepStrictEqual(Array.from(r.unappliedConditions).sort(),
        ['commentCount', 'dateFrom', 'l_range', 'order', 'page']);
      assert.strictEqual(r.count, 5);
    });
  });
}
