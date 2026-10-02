// Task194 (Commons auto-fetch 2026-10-02): one call scans the whole direct parent/child range.
// API facts (2026-10-02, public GET): _limit max 300 per request (301 -> 400 "max: 300"); Bad Apple!!
// children 1,060 = 300/300/300/160 without with_meta. A short page is not the end; the range is fixed
// by the first total; repeated/no-progress/empty-before-end/total-change/invalid totals stop as partial.
// Cancellation reaches the HTTP call, the body read and retry waits. Mock network, synthetic IDs only.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

const row = (n, kind = 'video') => ({globalId: `sm${100000 + n}`, contentKind: kind, visibleStatus: 'visible'});
function loader(handler, {fastTimers = true} = {}) {
  const calls = [];
  const context = createContext({
    console: {log() {}, warn() {}, error() {}},
    AbortController,
    setTimeout: fastTimers ? (f, ms) => setTimeout(f, Math.min(ms, 5)) : setTimeout,
    clearTimeout,
    netUtil: {fetch: async (url, opts) => {
      const u = new URL(url);
      const call = {kind: u.pathname.split('/').pop(), offset: +u.searchParams.get('_offset'), limit: +u.searchParams.get('_limit'),
        withMeta: u.searchParams.get('with_meta'), credentials: opts.credentials, signal: opts.signal};
      calls.push(call);
      if (opts.signal && opts.signal.aborted) { throw Object.assign(new Error('aborted'), {name: 'AbortError'}); }
      const r = await handler(call);
      const status = r.status ?? 200;
      return {status, ok: status >= 200 && status < 300, headers: {get: k => (r.headers || {})[k] ?? null},
        json: r.json || (async () => r.body)};
    }}
  });
  context.window = {console: context.console};
  run(`globalThis.subject=${extract('packages/lib/src/nico/CommonsTreeLoader.js', 'CommonsTreeLoader', 'var')};`, context);
  return {subject: context.subject, calls};
}
// a server with `total` children (1 parent), returning `sizeAt(offset, limit)` rows per page
const server = (total, {sizeAt = (o, l) => Math.max(0, Math.min(l, total - o)), kindAt = () => 'video', parents = 1} = {}) => c => {
  const t = c.kind === 'parents' ? parents : total;
  const n = c.kind === 'parents' ? Math.max(0, Math.min(c.limit, t - c.offset)) : sizeAt(c.offset, c.limit);
  const base = c.kind === 'parents' ? 900000 : 0;
  return {body: {meta: {status: 200}, data: {[c.kind]: {total: t, contents: Array.from({length: n}, (_, i) => row(base + c.offset + i, c.kind === 'parents' ? 'video' : kindAt(c.offset + i)))}}}};
};
const until = async cond => { for (let i = 0; i < 400 && !cond(); i++) { await new Promise(r => setTimeout(r, 5)); } assert(cond(), 'condition reached'); };
const childCalls = calls => calls.filter(c => c.kind === 'children').map(c => [c.offset, c.limit]);

describe('Task194 Commons full scan in one operation', () => {
  it('Bad Apple!! shape: 1,060 children in 300/300/300/160 and the parent, all IDs, no manual continuation', async () => {
    const kinds = i => (i % 21 === 0 ? 'live' : (i === 5 || i === 7 ? 'commons' : 'video'));
    const f = loader(server(1060, {kindAt: kinds}));
    const r = await f.subject.load('sm8628149', undefined, {fullScan: true});
    assert.deepStrictEqual(childCalls(f.calls), [[0, 300], [300, 300], [600, 300], [900, 160]]);
    assert(f.calls.every(c => c.limit <= 300 && c.withMeta === null && c.credentials === 'omit'));
    assert.strictEqual(r.children.works.length, 1060);
    assert.strictEqual(r.parents.works.length, 1);
    assert.strictEqual(r.complete, true);
    assert.strictEqual(r.children.nextOffset, null);
    assert.strictEqual(r.stats.unique, 1061);
    assert.strictEqual(r.stats.requests, 5);
    assert.strictEqual(r.stats.videoCandidates, r.parents.works.length + r.children.works.filter(w => w.isVideo).length);
  });

  for (const [total, expected] of [[0, [[0, 300]]], [299, [[0, 300]]], [300, [[0, 300]]], [301, [[0, 300], [300, 1]]]]) {
    it(`total ${total}: requests ${JSON.stringify(expected)}`, async () => {
      const f = loader(server(total));
      const r = await f.subject.scanSide('sm1', 'children');
      assert.deepStrictEqual(childCalls(f.calls), expected);
      assert.strictEqual(r.works.length, total);
      assert.strictEqual(r.complete, true);
    });
  }

  it('total 10,001: 34 requests of at most 300, finite and complete', async () => {
    const f = loader(server(10001));
    const r = await f.subject.scanSide('sm1', 'children');
    assert.strictEqual(f.calls.length, 34);
    assert.deepStrictEqual(f.calls[33].limit, 101);
    assert.strictEqual(r.works.length, 10001);
    assert.strictEqual(r.complete, true);
  });

  it('short pages in the middle (19/20, 92/100 shapes) do not end the scan', async () => {
    const f = loader(server(1060, {sizeAt: (o, l) => Math.max(0, Math.min(l, 1060 - o) - (o < 900 ? 8 : 0))}));
    const r = await f.subject.scanSide('sm1', 'children');
    assert.deepStrictEqual(childCalls(f.calls), [[0, 300], [300, 300], [600, 300], [900, 160]]);
    assert.strictEqual(r.works.length, 1060 - 24);
    assert.strictEqual(r.complete, true, 'fewer rows than requested is not an error');
  });

  it('an empty page before the reported total is partial, not complete', async () => {
    const f = loader(server(1060, {sizeAt: (o, l) => (o >= 600 ? 0 : Math.min(l, 1060 - o))}));
    const r = await f.subject.scanSide('sm1', 'children');
    assert.strictEqual(r.stopReason, 'empty-before-end');
    assert.strictEqual(r.complete, false);
    assert.strictEqual(r.works.length, 600);
  });

  it('the same page repeated stops (no infinite loop) as partial', async () => {
    const f = loader(c => ({body: {meta: {status: 200}, data: {children: {total: 1060, contents: Array.from({length: 300}, (_, i) => row(i))}}}}));
    const r = await f.subject.scanSide('sm1', 'children');
    assert.strictEqual(r.stopReason, 'repeated-page');
    assert.strictEqual(f.calls.length, 2);
    assert.strictEqual(r.complete, false);
  });

  it('a page with only already-seen IDs is no progress and stops', async () => {
    const f = loader(c => ({body: {meta: {status: 200}, data: {children: {total: 900,
      contents: Array.from({length: 300}, (_, i) => row(c.offset === 300 ? 299 - i : c.offset + i))}}}}));
    const r = await f.subject.scanSide('sm1', 'children');
    assert.strictEqual(r.stopReason, 'no-progress');
    assert.strictEqual(r.works.length, 300);
  });

  it('a changed total is recorded and makes the result partial; the range stays the first total', async () => {
    const f = loader(c => ({body: {meta: {status: 200}, data: {children: {total: c.offset === 0 ? 600 : 1200,
      contents: Array.from({length: 300}, (_, i) => row(c.offset + i))}}}}));
    const r = await f.subject.scanSide('sm1', 'children');
    assert.strictEqual(f.calls.length, 2);
    assert.strictEqual(r.total, 600);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(r.totalChanges)), [{offset: 300, total: 1200}]);
    assert.strictEqual(r.complete, false);
  });

  for (const bad of [NaN, -1, 1.5, '1060', null]) {
    it(`invalid total ${String(bad)} is a failure, not an empty tree`, async () => {
      const f = loader(c => ({body: {meta: {status: 200}, data: {children: {total: bad, contents: []}}}}));
      const r = await f.subject.scanSide('sm1', 'children');
      assert.strictEqual(r.failed, true);
      assert.strictEqual(r.failure.kind, 'invalid-total');
    });
  }

  it('invalid JSON and a 404 in the middle keep fetched pages and a resume offset', async () => {
    let f = loader(c => (c.offset === 300 ? {json: async () => { throw new SyntaxError('bad'); }} : server(1060)(c)));
    let r = await f.subject.scanSide('sm1', 'children');
    assert.strictEqual(r.failure.kind, 'schema');
    assert.strictEqual(r.works.length, 300);
    assert.strictEqual(r.nextOffset, 300);
    f = loader(c => (c.offset === 600 ? {status: 404} : server(1060)(c)));
    r = await f.subject.scanSide('sm1', 'children');
    assert.strictEqual(r.failure.kind, 'not-found-mid');
    assert.strictEqual(r.notFound, false);
    assert.strictEqual(r.works.length, 600);
  });

  it('429 honours Retry-After and retries a finite number of times; 503 likewise', async () => {
    let n = 0;
    let f = loader(c => (c.offset === 300 && n++ < 1 ? {status: 429, headers: {'Retry-After': '1'}} : server(1060)(c)));
    let r = await f.subject.scanSide('sm1', 'children');
    assert.strictEqual(r.complete, true);
    assert.strictEqual(f.calls.filter(c => c.offset === 300).length, 2);
    f = loader(c => (c.offset === 300 ? {status: 503} : server(1060)(c)));
    r = await f.subject.scanSide('sm1', 'children');
    assert.strictEqual(f.calls.filter(c => c.offset === 300).length, 3, 'one try plus two retries');
    assert.strictEqual(r.failed, true);
    assert.strictEqual(r.works.length, 300);
    assert.strictEqual(r.nextOffset, 300);
    f = loader(c => (c.offset === 0 ? {status: 429, headers: {'Retry-After': '3600'}} : server(10)(c)));
    r = await f.subject.scanSide('sm1', 'children');
    assert.strictEqual(r.failure.kind, 'rate-limited', 'a very long Retry-After is not waited out silently');
    assert.strictEqual(f.calls.length, 1);
    assert.strictEqual(f.subject.retryAfterMs('2'), 2000);
  });

  it('an already-aborted signal makes no request', async () => {
    const f = loader(server(1060));
    const ac = new AbortController(); ac.abort();
    const r = await f.subject.load('sm1', undefined, {fullScan: true, signal: ac.signal});
    assert.strictEqual(f.calls.length, 0);
    assert.strictEqual(r.cancelled, true);
  });

  it('abort during a request, during the body read and during a retry wait stops the scan', async () => {
    // during request: the HTTP call receives the signal and the scan stops
    let ac = new AbortController();
    let f = loader(c => (c.offset === 300 ? new Promise(() => {}) : server(1060)(c)), {fastTimers: false});
    let p = f.subject.scanSide('sm1', 'children', {signal: ac.signal});
    await until(() => f.calls.length >= 2);
    assert(f.calls[1].signal && !f.calls[1].signal.aborted);
    ac.abort();
    let r = await p;
    assert.strictEqual(r.stopReason, 'cancelled');
    assert.strictEqual(f.calls[1].signal.aborted, true, 'the HTTP request itself is aborted');
    assert.strictEqual(r.works.length, 300);
    // during body
    ac = new AbortController();
    f = loader(c => (c.offset === 0 ? {json: () => new Promise(() => {})} : server(10)(c)), {fastTimers: false});
    p = f.subject.scanSide('sm1', 'children', {signal: ac.signal});
    await until(() => f.calls.length >= 1);
    await new Promise(r => setTimeout(r, 5));
    ac.abort();
    r = await p;
    assert.strictEqual(r.stopReason, 'cancelled');
    // during retry wait (Retry-After 30s, real timers): abort ends promptly
    ac = new AbortController();
    f = loader(c => ({status: 429, headers: {'Retry-After': '30'}}), {fastTimers: false});
    const t0 = Date.now();
    p = f.subject.scanSide('sm1', 'children', {signal: ac.signal});
    await until(() => f.calls.length >= 1);
    await new Promise(r => setTimeout(r, 5));
    ac.abort();
    r = await p;
    assert.strictEqual(r.stopReason, 'cancelled');
    assert(Date.now() - t0 < 10000, 'not the 30s Retry-After');
    assert.strictEqual(f.calls.length, 1);
  });

  it('a stalled body hits the per-request deadline and is retried finitely', async () => {
    const f = loader(c => ({json: () => new Promise(() => {})}));
    const r = await f.subject.scanSide('sm1', 'children', {timeoutMs: 20});
    assert.strictEqual(r.failed, true);
    assert.strictEqual(r.failure.kind, 'timeout');
    assert.strictEqual(f.calls.length, 3);
  });

  it('IDs are deduplicated across the whole job (a child that is also a parent counts once)', async () => {
    const f = loader(c => ({body: {meta: {status: 200}, data: {[c.kind]: {total: 2, contents: [row(1), row(c.kind === 'parents' ? 2 : 3)]}}}}));
    const r = await f.subject.scanAll('sm1');
    assert.deepStrictEqual(Array.from(r.parents.works, w => w.contentId), ['sm100001', 'sm100002']);
    assert.deepStrictEqual(Array.from(r.children.works, w => w.contentId), ['sm100003']);
    assert.strictEqual(r.children.crossDuplicateCount, 1);
  });

  it('with_meta is fetched separately in pages of at most 100 and missing rows do not lose IDs', async () => {
    const f = loader(c => {
      if (c.withMeta) {
        const n = Math.min(c.limit, 1060 - c.offset);
        return {body: {meta: {status: 200}, data: {children: {total: 1060,
          contents: Array.from({length: n}, (_, i) => ({...row(c.offset + i), title: `t${c.offset + i}`})).filter((_, i) => i % 12 !== 0)}}}};
      }
      return server(1060)(c);
    });
    const ids = await f.subject.scanSide('sm1', 'children');
    const meta = await f.subject.scanMeta('sm1', 'children', ids.total);
    assert(f.calls.filter(c => c.withMeta).every(c => c.limit <= 100));
    assert.strictEqual(f.calls.filter(c => c.withMeta).length, 11);
    assert.strictEqual(ids.works.length, 1060, 'ID list is independent of meta rows');
    assert(meta.metas.size < 1060 && meta.metas.size > 900);
  });

  it('the existing limited load() keeps its old behaviour', async () => {
    const f = loader(server(1060));
    const r = await f.subject.load('sm1');
    assert.strictEqual(r.children.works.length, 300);
    assert.strictEqual(r.children.nextOffset, 300);
  });
});
