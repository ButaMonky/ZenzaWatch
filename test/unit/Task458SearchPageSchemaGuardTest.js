// NICOCOMPAT-04 Task458: fail closed for malformed nvapi video search pages.
// Offline synthetic fixtures only; never fetches actual NicoNico.
'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function item(n) {
  return {id: 'sm' + n, title: 'synthetic', duration: 30,
    count: {view: 0, comment: 0, mylist: 0, like: 0},
    thumbnail: {url: 'https://example.invalid/a.png'}};
}
const makePage = (n = 3, page = 1) =>
  Array.from({length: n}, (_, i) => item((page - 1) * 100 + i + 1));

function harness(handler) {
  const requests = [], warnings = [];
  const c = createContext({
    console: {log() {}, info() {}, warn(...args) {warnings.push(args);}},
    textUtil: {dateToString: x => x.toISOString()}
  });
  run('const API=' + extract('packages/lib/src/nico/VideoSearch.js',
    'NicoSearchNvapi', 'var') + ';globalThis.API=API;', c);
  c.window = {console: c.console};
  c.netUtil = {fetch: async url => {
    const page = Number(new URL(url).searchParams.get('page'));
    requests.push(page);
    const response = await handler(page);
    return {status: response.httpStatus ?? 200,
      json: async () => ({
        meta: {status: response.metaStatus ?? 200},
        data: response.data
      })};
  }};
  return {api: c.API, requests, warnings};
}
const pass = data => ({data});
const schemaFailure = e => e && e.kind === 'schema' && e.status === 'schema';

describe('Task458: NicoSearchNvapi page response validation', () => {
  it('keeps a normal sparse result and optional title/thumbnail/count absent', async () => {
    const h = harness(() => pass({totalCount: 2, hasNext: false,
      items: [item(1), {id: 'so123', duration: 1}]}));
    const result = await h.api.search('fixture', {}, 10);
    assert.equal(result.status, 'ok');
    assert.deepStrictEqual(Array.from(result.list, v => v.id), ['sm1', 'so123']);
    assert.equal(result.resultState, 'complete');
    assert.deepStrictEqual(h.requests, [1]);
  });
  it('normal totalCount zero with an empty array remains empty', async () => {
    const h = harness(() => pass({totalCount: 0, items: []}));
    const r = await h.api.search('fixture');
    assert.equal(r.resultState, 'empty');
    assert.equal(r.returnedCount, 0);
  });
  it('rejects fractional and out-of-range totals as schema, not valid result', async () => {
    for (const total of [0.5, -1, Number.MAX_SAFE_INTEGER + 1]) {
      const h = harness(() => pass({totalCount: total, items: makePage(1)}));
      await assert.rejects(h.api.search('fixture'), schemaFailure);
    }
  });
  it('rejects missing/null and primitive video entries without throwing raw TypeError', async () => {
    for (const bad of [null, false, 42, 'sm1', []]) {
      const h = harness(() => pass({totalCount: 1, items: [bad]}));
      await assert.rejects(h.api.search('fixture'), schemaFailure);
    }
  });
  it('does not silently accept blank or non-string IDs in search results', async () => {
    for (const badId of ['', '  ', 123, null]) {
      const h = harness(() => pass({totalCount: 1, items: [{...item(1), id: badId}]}));
      await assert.rejects(h.api.search('fixture'), schemaFailure);
    }
  });
  it('rejects invalid optional field shapes, accepts missing optionals', async () => {
    const changes = [
      x => {x.duration = -1;},
      x => {x.duration = NaN;},
      x => {x.title = {unsafe: true};},
      x => {x.count = '123';},
      x => {x.thumbnail = ['bad'];}
    ];
    for (const change of changes) {
      const x = item(1); change(x);
      const h = harness(() => pass({totalCount: 1, items: [x]}));
      await assert.rejects(h.api.search('fixture'), schemaFailure);
    }
  });
  it('malformed suggestedVideo never produces a phantom result', async () => {
    for (const suggested of ['not a video', {id: ''}, {id: 42}]) {
      const h = harness(() => pass({totalCount: 1, items: makePage(1),
        additionals: {suggestedVideo: suggested}}));
      await assert.rejects(h.api.search('fixture'), schemaFailure);
    }
  });
  it('hasNext must be boolean if supplied (including a full page)', async () => {
    const h = harness(() => pass({totalCount: 200, hasNext: 'false', items: makePage(100)}));
    await assert.rejects(h.api.search('fixture', {}, 200), schemaFailure);
    assert.deepStrictEqual(h.requests, [1], 'do not request guessed next pages');
  });
  it('HTTP error cannot be hidden by a misleading successful JSON meta status', async () => {
    const h = harness(() => ({httpStatus: 503, metaStatus: 200,
      data: {totalCount: 1, items: makePage(1)}}));
    await assert.rejects(h.api.search('fixture'), e => e && e.status === 503);
    assert.deepStrictEqual(h.requests, [1]);
  });
  it('a later malformed page remains partial, never includes broken items', async () => {
    const h = harness(pg => pass({
      totalCount: 300, hasNext: true,
      items: pg === 2 ? [{id: null}] : makePage(100, pg)
    }));
    const result = await h.api.search('fixture', {}, 300);
    assert.equal(result.resultState, 'partial');
    assert.equal(result.failedPage, 2);
    assert.equal(result.returnedCount, 100);
    assert.deepStrictEqual(result.list.slice(0, 2).map(x => x.id), ['sm1', 'sm2']);
  });
  it('valid suggestedVideo keeps the legacy recommendation deduplication', async () => {
    const suggested = {...item(1), title: 'recommended'};
    const h = harness(() => pass({
      totalCount: 2, hasNext: false, items: makePage(2),
      additionals: {suggestedVideo: suggested}
    }));
    const result = await h.api.search('fixture', {}, 2);
    assert.deepStrictEqual(Array.from(result.list, x => x.id), ['sm1', 'sm2']);
    assert.equal(result.list[0].title, 'recommended');
  });
});
