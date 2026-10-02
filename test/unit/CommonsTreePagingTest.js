// Task179 (Commons audit COM-01): a page shorter than the requested size is not
// necessarily the last page. The 2026-10-01 capture of sm8628149 (Bad Apple!!) showed
// 20-slot pages with 19, 19, 16, 18, 20 ... items and an empty page only at offset 1060.
// The page shapes below are anonymised (synthetic IDs); no captured content is used.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

const item = n => ({kind: 'external', id: n, globalId: `sm${100000 + n}`, contentId: 100000 + n, contentKind: 'video', visibleStatus: 'visible'});
const rows = (count, start) => Array.from({length: count}, (_, i) => item(start + i));
function loader(page) {
  const calls = [];
  const context = createContext({console: {log() {}, warn() {}, error() {}}, netUtil: {fetch: async (url, opts) => {
    const u = new URL(url);
    const call = {kind: u.pathname.split('/').pop(), offset: Number(u.searchParams.get('_offset')), limit: Number(u.searchParams.get('_limit')), credentials: opts.credentials};
    calls.push(call);
    const r = await page(call);
    const status = r.status ?? 200;
    return {status, ok: status >= 200 && status < 300, json: async () => r.body};
  }}});
  run(`globalThis.subject=${extract('packages/lib/src/nico/CommonsTreeLoader.js', 'CommonsTreeLoader', 'var')};`, context);
  return {subject: context.subject, calls};
}
const body = (kind, total, contents) => ({body: {meta: {status: 200}, data: {[kind]: {total, contents}}}});

describe('Task179 Commons relatives paging advances by the requested window (COM-01)', () => {
  it('a short first page (99/100) does not end the scan', async () => {
    const f = loader(c => body(c.kind, 240, rows(c.offset === 0 ? 99 : Math.min(100, 240 - c.offset), c.offset)));
    const r = await f.subject.loadRelatives('sm8628149', 'children');
    assert.deepStrictEqual(f.calls.map(c => c.offset), [0, 100, 200]);
    assert.strictEqual(r.works.length, 239);
    assert.strictEqual(r.total, 240);
    assert.strictEqual(r.scanComplete, true);
    assert.strictEqual(r.stopReason, 'end-of-range');
  });

  it('reproduces the captured 20-slot sparse page shape and stops at the reported end', async () => {
    const sizes = [19, 19, 16, 18, 20];
    const f = loader(c => body(c.kind, 100, rows(sizes[c.offset / 20] ?? 0, c.offset)));
    const r = await f.subject.loadRelatives('sm8628149', 'children', 300, {pageSize: 20});
    assert.deepStrictEqual(f.calls.map(c => [c.offset, c.limit]), [[0, 20], [20, 20], [40, 20], [60, 20], [80, 20]]);
    assert.strictEqual(r.works.length, 92);
    assert.strictEqual(r.total, 100, 'reported total is kept apart from the returned count');
    assert.strictEqual(r.scanComplete, true);
  });

  it('an empty page before the reported end stops the scan and says why', async () => {
    const f = loader(c => body(c.kind, 500, c.offset === 0 ? rows(100, 0) : []));
    const r = await f.subject.loadRelatives('sm8628149', 'children');
    assert.deepStrictEqual(f.calls.map(c => c.offset), [0, 100]);
    assert.strictEqual(r.works.length, 100);
    assert.strictEqual(r.stopReason, 'empty-page');
    assert.strictEqual(r.scanComplete, false);
  });

  it('keeps the per-direction cap and reports where to continue', async () => {
    const f = loader(c => body(c.kind, 1060, rows(c.limit, c.offset)));
    const r = await f.subject.loadRelatives('sm8628149', 'children');
    assert.deepStrictEqual(f.calls.map(c => c.offset), [0, 100, 200]);
    assert.strictEqual(r.works.length, 300);
    assert.strictEqual(r.total, 1060);
    assert.strictEqual(r.stopReason, 'limit');
    assert.strictEqual(r.nextOffset, 300);
    assert.strictEqual(r.scanComplete, false);
  });

  it('never loops without bound, even if pages keep coming back short', async () => {
    const f = loader(c => body(c.kind, 100000, rows(1, c.offset)));
    const r = await f.subject.loadRelatives('sm8628149', 'children');
    assert.strictEqual(f.calls.length, 3, 'requests are bounded by the cap / page size');
    assert.strictEqual(r.works.length, 3);
  });

  it('a normal 250-item tree keeps offsets, credentials omit and global IDs', async () => {
    const f = loader(c => body(c.kind, 250, rows(Math.min(c.limit, 250 - c.offset), c.offset)));
    const r = await f.subject.loadRelatives('sm8628149', 'children');
    assert.deepStrictEqual(f.calls.map(c => c.offset), [0, 100, 200]);
    assert(f.calls.every(c => c.credentials === 'omit'));
    assert.strictEqual(r.works.length, 250);
    assert.strictEqual(r.works[0].contentId, 'sm100000');
    assert.strictEqual(r.nextOffset, null);
  });

  it('an unregistered video (first page 404) is still reported as not found', async () => {
    const f = loader(() => ({status: 404, body: {}}));
    const r = await f.subject.loadRelatives('sm9', 'parents');
    assert.strictEqual(r.notFound, true);
    assert.strictEqual(r.works.length, 0);
    assert.strictEqual(f.calls.length, 1);
  });
});
