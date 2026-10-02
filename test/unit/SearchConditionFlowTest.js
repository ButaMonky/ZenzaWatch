// Task189 (Search audit 2026-10-01, Q01): search conditions travel from the URL / query
// string through NicoQuery, the search parameters and buildQuery to the request, the
// count request and the playlist notice. Only values confirmed by official code or
// capture are sent; anything else (kind) is reported as not applied, never passed through.
// Network is a mock; items are synthetic.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function load() {
  const calls = [];
  const c = createContext({console: {log() {}, info() {}, warn() {}},
    textUtil: {dateToString: d => d.toISOString(), convertKansuEi: x => x,
      parseQuery: s => Object.fromEntries(new URLSearchParams(s))}});
  run(`const Subject=${extract('packages/lib/src/nico/VideoSearch.js', 'NicoSearchNvapi', 'var')};globalThis.Subject=Subject;
    ${extract('packages/lib/src/nico/NicoQuery.js', 'NicoQuery')};globalThis.Query=NicoQuery;`, c);
  c.window = {console: c.console};
  const reply = f => { c.netUtil = {fetch: async u => {
    const q = Object.fromEntries(new URL(u).searchParams); calls.push(q);
    return {status: 200, json: async () => ({meta: {status: 200}, data: await f(Number(q.page))})};
  }}; };
  return {api: c.Subject, Query: c.Query, calls, reply};
}
const plain = x => JSON.parse(JSON.stringify(x));
const item = n => ({id: 'sm' + n, title: 'fixture', duration: 30, registeredAt: '2026-10-01T00:00:00Z',
  count: {view: 1, comment: 1, mylist: 1, like: 1}, thumbnail: {url: 'https://example.invalid/a.jpg'}, owner: {type: 'user', id: '1'}});

describe('Task189 search conditions end to end (Search audit Q01)', () => {
  it('long/short and the channel listing context survive buildQuery (S01-S03)', () => {
    const {api} = load();
    assert.strictEqual(api.buildQuery('sm', {selectContentType: 'long'}).selectContentType, 'long');
    assert.strictEqual(api.buildQuery('sm', {selectContentType: 'short'}).selectContentType, 'short');
    assert.strictEqual(api.buildQuery('sm', {channelVideoListingStatus: 'included'}).channelVideoListingStatus, 'included');
  });

  it('unconfirmed values are not passed through; kind is reported, not silently dropped (S04)', () => {
    const {api} = load();
    const q = plain(api.buildQuery('sm', {selectContentType: 'medium', channelVideoListingStatus: 'excluded', kind: 'user', foo: 'bar'}));
    assert.deepStrictEqual(Object.keys(q).sort(), ['keyword', 'sensitiveContents', 'sortKey', 'sortOrder']);
    assert.deepStrictEqual(plain(api.normalizeConditions({kind: 'user'}).unapplied), ['kind']);
    assert.deepStrictEqual(plain(api.normalizeConditions({kind: 'any'}).unapplied), []);
  });

  it('NicoQuery carries page/genre/content/listing/kind to the search stage (S05)', () => {
    const {Query} = load();
    const q = new Query({type: 'search', id: 'sm', params: {sort: '-h', page: 2, genre: 'anime', selectContentType: 'short', channelVideoListingStatus: 'included', kind: 'user', fRange: 5, lRange: 2}});
    const x = plain(q.searchParams);
    assert.strictEqual(x.page, 2);
    assert.strictEqual(x.genre, 'anime');
    assert.strictEqual(x.selectContentType, 'short');
    assert.strictEqual(x.channelVideoListingStatus, 'included');
    assert.strictEqual(x.kind, 'user');
    assert.strictEqual(x.f_range, 5);
    assert.strictEqual(x.l_range, 2);
  });

  it('a query string reaches the request with the same conditions and 32-item page offset', async () => {
    const {api, Query, calls, reply} = load();
    reply(() => ({totalCount: 100, hasNext: false, items: Array.from({length: 100}, (_, i) => item(i + 1))}));
    const q = new Query('search/sm?genre=%22anime%22&page=2&selectContentType=%22long%22&channelVideoListingStatus=%22included%22&kind=%22user%22&sort=%22-f%22');
    const r = await api.search(q.searchWord, q.searchParams, 10);
    assert.strictEqual(calls.length, 1);
    const sent = calls[0];
    assert.strictEqual(sent.genres, 'anime');
    assert.strictEqual(sent.selectContentType, 'long');
    assert.strictEqual(sent.channelVideoListingStatus, 'included');
    assert.strictEqual(sent.sortKey, 'registeredAt');
    assert.strictEqual(sent.sensitiveContents, 'mask');
    assert.strictEqual(sent.kind, undefined, 'kind is not sent');
    assert.strictEqual(r.list[0].id, 'sm33', 'official page 2 starts at item 33');
    assert.deepStrictEqual(plain(r.unappliedConditions), ['kind']);
  });

  it('existing hot, one-year, length, date and mask behaviour is unchanged (S06/S07)', () => {
    const {api} = load();
    const q = plain(api.buildQuery('sm', {sort: 'hotLikeAndMylist', f_range: 5, l_range: 1, _now: '2026-10-01T00:00:00Z'}));
    assert.deepStrictEqual(q, {sortKey: 'hot', sortOrder: 'none', keyword: 'sm', maxDuration: 300,
      minRegisteredAt: '2025-10-01T00:00:00.000Z', sensitiveContents: 'mask'});
    const d = plain(api.buildQuery('x', {searchType: 'tag', start: '2026-01-02', end: '2026-01-03'}));
    assert.strictEqual(d.tag, 'x');
    assert.strictEqual(d.minRegisteredAt, '2026-01-02T00:00:00+09:00');
    assert.strictEqual(d.maxRegisteredAt, '2026-01-03T23:59:59+09:00');
    assert.deepStrictEqual(plain(api.buildQuery('sm', {})), {sortKey: 'hot', sortOrder: 'none', keyword: 'sm', sensitiveContents: 'mask'});
  });

  it('a normal two-page search keeps page order and legacy fields (S11)', async () => {
    const {api, reply, calls} = load();
    reply(pg => ({totalCount: 200, hasNext: pg === 1, items: Array.from({length: 100}, (_, i) => item((pg - 1) * 100 + i + 1))}));
    const r = await api.search('sm', {}, 200);
    assert.strictEqual(r.list.length, 200);
    assert.strictEqual(r.list[100].id, 'sm101');
    assert.strictEqual(r.list[0].like_counter, 1);
    assert.strictEqual(calls.length, 2);
    assert.deepStrictEqual(plain(r.unappliedConditions), []);
  });

  it('the count request and the playlist notice use the same condition model', () => {
    const fs = require('fs'), path = require('path');
    const panel = fs.readFileSync(path.join(__dirname, '../../src/VideoInfoPanel.js'), 'utf-8');
    assert(panel.includes('nvapi.buildQuery(word, params)'), 'count reuses buildQuery');
    const c = createContext({});
    run(`${extract('packages/zenza/src/Playlist/PlayList.js', 'PlayList')};globalThis.P=PlayList;`, Object.assign(c, {VideoList: class {}}));
    assert.strictEqual(c.P.searchNotice({unappliedConditions: []}), '');
    assert(c.P.searchNotice({unappliedConditions: ['kind']}).includes('kind'));
  });
});
