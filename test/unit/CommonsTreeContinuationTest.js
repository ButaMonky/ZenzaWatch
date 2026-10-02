// Task191 (Commons audit COM-03): the 300-per-side cap stays, but a capped (or part-failed)
// scan reports total / scanned range / nextOffset, and an explicit second request for the
// same video continues from there, again bounded by the cap. Nothing is fetched
// automatically, and a superseded request leaves no continuation point. Synthetic IDs only.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const {createDialogHarness, flush, deferred} = require('../helpers/dialogHarness');

const item = (n, kind = 'video') => ({globalId: `sm${100000 + n}`, contentKind: kind, visibleStatus: 'visible'});
function loader(page) {
  const calls = [];
  const context = createContext({console: {log() {}, warn() {}, error() {}}, netUtil: {fetch: async url => {
    const u = new URL(url);
    const call = {kind: u.pathname.split('/').pop(), offset: Number(u.searchParams.get('_offset')), limit: Number(u.searchParams.get('_limit'))};
    calls.push(call);
    const r = await page(call);
    const status = r.status ?? 200;
    return {status, ok: status >= 200 && status < 300, json: async () => r.body};
  }}});
  context.window = {console: context.console};
  run(`globalThis.subject=${extract('packages/lib/src/nico/CommonsTreeLoader.js', 'CommonsTreeLoader', 'var')};`, context);
  return {subject: context.subject, calls};
}
const big = total => c => ({body: {meta: {status: 200}, data: {[c.kind]: {total: c.kind === 'parents' ? 1 : total,
  contents: c.kind === 'parents' ? (c.offset === 0 ? [item(0)] : []) :
    Array.from({length: Math.max(0, Math.min(c.limit, total - c.offset))}, (_, i) => item(1 + c.offset + i, (c.offset + i) % 25 === 0 ? 'live' : 'video'))}}}});

describe('Task191 Commons continuation past the cap (COM-03)', () => {
  it('a capped side reports total, scanned range and nextOffset; no more than the cap is requested', async () => {
    const f = loader(big(1060));
    const r = await f.subject.load('sm8628149');
    const ch = r.children;
    assert.strictEqual(ch.total, 1060);
    assert.strictEqual(ch.fetchedCount, 300);
    assert.strictEqual(ch.truncated, true);
    assert.strictEqual(ch.nextOffset, 300);
    assert.strictEqual(ch.scanComplete, false);
    assert.strictEqual(f.calls.filter(c => c.kind === 'children').length, 3);
    assert.strictEqual(r.parents.nextOffset, null, 'a fully scanned side has nothing to continue');
  });

  it('a continuation starts at nextOffset, skips finished sides and is capped again', async () => {
    const f = loader(big(1060));
    const r = await f.subject.load('sm8628149', undefined, {offsets: {parents: null, children: 300}});
    assert.strictEqual(r.parents.skipped, true);
    assert.deepStrictEqual(f.calls.map(c => [c.kind, c.offset]), [['children', 300], ['children', 400], ['children', 500]]);
    assert.strictEqual(r.children.startOffset, 300);
    assert.strictEqual(r.children.nextOffset, 600);
    const last = loader(big(1060));
    const end = await last.subject.load('sm8628149', undefined, {offsets: {parents: null, children: 900}});
    assert.strictEqual(end.children.nextOffset, null);
    assert.strictEqual(end.children.scanComplete, true);
    assert.strictEqual(end.children.fetchedCount, 160);
  });

  it('a 404 in the middle of a continuation is a failure, not "not registered"', async () => {
    const f = loader(c => (c.offset >= 300 ? {status: 404, body: {}} : big(1060)(c)));
    await assert.rejects(f.subject.loadRelatives('sm8628149', 'children', 300, {startOffset: 300}), e => e.status === 404);
    await assert.rejects(f.subject.load('sm8628149', undefined, {offsets: {parents: null, children: 300}}));
  });
});

function dialog(loads) {
  const h = createDialogHarness(), notes = [], adds = [];
  const d = h.dialog;
  Object.assign(d, {_videoInfo: {videoId: 'smA'}, _watchId: 'smA', _requestId: 'rA'});
  d.execCommand = (cmd, text) => notes.push(`${cmd}:${text}`);
  Object.assign(d._playlist, {appendWatchIds: async ids => { adds.push(ids); return ids.length; }, insertCurrentVideo() {}, scrollToActiveItem() {}});
  const calls = [];
  h.context.CommonsTreeLoader = {load: (id, max, opt) => { calls.push(opt || null); return loads.shift()(); }};
  return {h, d, notes, adds, calls};
}
const side = (ids, extra = {}) => ({total: ids.length, works: ids.map(id => ({contentId: id, isVideo: true})), nextOffset: null, startOffset: 0, fetchedCount: ids.length, ...extra});

describe('Task191 explicit continuation from the dialog (COM-03)', () => {
  it('the first request says it stopped at the cap and how to continue; the next click continues', async () => {
    const s = dialog([
      async () => ({parents: side(['smP']), children: side(['smC1'], {total: 1060, fetchedCount: 300, truncated: true, stopReason: 'limit', nextOffset: 300})}),
      async () => ({parents: side([], {skipped: true}), children: side(['smC2'], {total: 1060, startOffset: 300, fetchedCount: 300, truncated: true, stopReason: 'limit', nextOffset: 600})})
    ]);
    await s.d._onPlaylistSetCommonsTree();
    assert(s.notes.some(n => n.includes('全1060件中300件目まで取得') && n.includes('続きを取得')), s.notes.join('|'));
    await s.d._onPlaylistSetCommonsTree();
    // Task197: the dialog now always passes {fullScan, signal, onProgress}; the continuation point is the offsets
    assert.deepStrictEqual(JSON.parse(JSON.stringify(s.calls[1].offsets)), {parents: null, children: 300});
    assert.strictEqual(s.calls[1].fullScan, true);
    assert(s.notes.some(n => n.includes('600件目まで')), s.notes.join('|'));
    assert.deepStrictEqual(s.adds, [['smP', 'smC1'], ['smC2']]);
  });

  it('a failed continuation keeps the continuation point for a retry', async () => {
    const s = dialog([
      async () => ({parents: side([]), children: side(['smC1'], {total: 1060, fetchedCount: 300, truncated: true, stopReason: 'limit', nextOffset: 300})}),
      async () => { throw Error('fixture failure'); }
    ]);
    await s.d._onPlaylistSetCommonsTree();
    await s.d._onPlaylistSetCommonsTree();
    // Task199: the continuation point also names its job (jobId)
    const {jobId, ...point} = JSON.parse(JSON.stringify(s.d._commonsTreeProgress));
    assert.strictEqual(typeof jobId, 'string');
    assert.deepStrictEqual(point, {videoId: 'smA', requestId: 'rA', parents: null, children: 300});
  });

  it('after switching video the old continuation point is not used', async () => {
    const s = dialog([
      async () => ({parents: side([]), children: side(['smC1'], {total: 1060, fetchedCount: 300, truncated: true, stopReason: 'limit', nextOffset: 300})}),
      async () => ({parents: side(['smX']), children: side([])})
    ]);
    await s.d._onPlaylistSetCommonsTree();
    Object.assign(s.d, {_videoInfo: {videoId: 'smB'}, _watchId: 'smB', _requestId: 'rB'});
    await s.d._onPlaylistSetCommonsTree();
    assert.strictEqual(s.calls[1].offsets, undefined, 'a fresh scan from the start (Task197: options always carry fullScan/signal)');
  });

  it('a superseded request leaves no continuation point', async () => {
    const first = deferred();
    const s = dialog([() => first.promise, async () => ({parents: side(['smP']), children: side([])})]);
    const p1 = s.d._onPlaylistSetCommonsTree();
    const p2 = s.d._onPlaylistSetCommonsTree();
    first.resolve({parents: side([]), children: side(['smC'], {total: 1060, fetchedCount: 300, truncated: true, stopReason: 'limit', nextOffset: 300})});
    await Promise.all([p1, p2]); await flush();
    assert.strictEqual(s.d._commonsTreeProgress, null);
  });

  it('a complete small tree has no continuation and keeps the existing message', async () => {
    const s = dialog([async () => ({parents: side(['smP']), children: side(['smC'])})]);
    await s.d._onPlaylistSetCommonsTree();
    assert.strictEqual(s.d._commonsTreeProgress, null);
    assert(s.notes.some(n => n.includes('プレイリストに2件追加しました（親作品1件・子作品1件）')), s.notes.join('|'));
  });
});
