// Task190 (Search audit 2026-10-01, Q02): hasNext=false ends the search, a later-page failure
// keeps the contiguous pages but is marked partial, and a response without items or with a
// broken total is an error, not a valid empty result. Synthetic responses on a mock network;
// these failures are artificial and are not claimed to happen in production.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function load() {
  const calls = [];
  const c = createContext({console: {log() {}, info() {}, warn() {}},
    textUtil: {dateToString: d => d.toISOString(), convertKansuEi: x => x}});
  run(`const Subject=${extract('packages/lib/src/nico/VideoSearch.js', 'NicoSearchNvapi', 'var')};globalThis.Subject=Subject;`, c);
  c.window = {console: c.console};
  const reply = f => { c.netUtil = {fetch: async u => {
    const pg = Number(new URL(u).searchParams.get('page')); calls.push(pg);
    return {status: 200, json: async () => ({meta: {status: 200}, data: await f(pg)})};
  }}; };
  return {api: c.Subject, calls, reply, c};
}
const item = n => ({id: 'sm' + n, title: 'fixture', duration: 30, registeredAt: '2026-10-01T00:00:00Z',
  count: {view: 1, comment: 1, mylist: 1, like: 1}, thumbnail: {url: 'https://example.invalid/a.jpg'}});
const page = (pg, n = 100) => Array.from({length: n}, (_, i) => item((pg - 1) * 100 + i + 1));

describe('Task190 search end, partial and broken responses (Search audit Q02)', () => {
  it('hasNext=false stops even when totalCount is larger (S08)', async () => {
    const {api, calls, reply} = load();
    reply(pg => ({totalCount: 200, hasNext: false, items: page(pg)}));
    const r = await api.search('sm', {}, 200);
    assert.deepStrictEqual(calls, [1]);
    assert.strictEqual(r.resultState, 'complete');
    assert.strictEqual(r.stopReason, 'end');
  });

  it('a later-page failure keeps the good pages and is marked partial (S09)', async () => {
    const {api, reply} = load();
    reply(pg => { if (pg === 2) { throw Error('fixture page failure'); } return {totalCount: 300, hasNext: true, items: page(pg)}; });
    const r = await api.search('sm', {}, 300);
    assert.strictEqual(r.status, 'ok', 'existing status contract is kept');
    assert.strictEqual(r.list.length, 100, 'only the contiguous successful pages');
    assert.strictEqual(r.partial, true);
    assert.strictEqual(r.complete, false);
    assert.strictEqual(r.resultState, 'partial');
    assert.strictEqual(r.failedPage, 2);
    assert.strictEqual(r.returnedCount, 100);
  });

  it('a later page with a broken schema is a failure, not the end', async () => {
    const {api, reply} = load();
    reply(pg => (pg === 2 ? {totalCount: 300, hasNext: true} : {totalCount: 300, hasNext: true, items: page(pg)}));
    const r = await api.search('sm', {}, 300);
    assert.strictEqual(r.resultState, 'partial');
    assert.strictEqual(r.list.length, 100);
  });

  it('missing items or a broken total on the first page are rejected, not empty (S10)', async () => {
    const {api, reply} = load();
    reply(() => ({totalCount: 100, hasNext: false}));
    await assert.rejects(() => api.search('sm', {}, 100), e => e.kind === 'schema');
    reply(() => ({totalCount: 100, hasNext: false, items: {}}));
    await assert.rejects(() => api.search('sm', {}, 100));
    reply(() => ({totalCount: 'many', hasNext: false, items: []}));
    await assert.rejects(() => api.search('sm', {}, 100));
  });

  it('a real zero-hit result is empty, and a stop at the requested limit is truncated', async () => {
    const {api, reply} = load();
    reply(() => ({totalCount: 0, hasNext: false, items: []}));
    const empty = await api.search('sm', {}, 100);
    assert.strictEqual(empty.resultState, 'empty');
    assert.strictEqual(empty.list.length, 0);
    reply(pg => ({totalCount: 1000, hasNext: true, items: page(pg)}));
    const t = await api.search('sm', {}, 200);
    assert.strictEqual(t.resultState, 'truncated');
    assert.strictEqual(t.stopReason, 'limit');
    assert.strictEqual(t.list.length, 200);
  });

  it('normal multi-page order, parallel limit and the 32-item page offset are unchanged', async () => {
    const {api, reply, calls} = load();
    reply(pg => ({totalCount: 500, hasNext: pg < 5, items: page(pg)}));
    const r = await api.search('sm', {}, 500);
    assert.strictEqual(r.list.length, 500);
    assert.deepStrictEqual(r.list.map(x => x.id).slice(98, 102), ['sm99', 'sm100', 'sm101', 'sm102']);
    assert.strictEqual(r.resultState, 'complete');
    assert.strictEqual(calls.length, 5);
    reply(() => ({totalCount: 100, hasNext: false, items: page(1)}));
    const p2 = await api.search('sm', {page: 2}, 10);
    assert.strictEqual(p2.list[0].id, 'sm33');
  });

  it('the playlist notice tells the user about a partial result', () => {
    const c = createContext({VideoList: class {}});
    run(`${extract('packages/zenza/src/Playlist/PlayList.js', 'PlayList')};globalThis.P=PlayList;`, c);
    assert(c.P.searchNotice({partial: true, returnedCount: 100}).includes('100件'));
    assert.strictEqual(c.P.searchNotice({partial: false, resultState: 'complete'}), '');
  });
});
