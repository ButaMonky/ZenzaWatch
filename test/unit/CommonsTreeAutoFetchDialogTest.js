// Task197 (Commons auto-fetch A/D/E): one normal "parents/children -> playlist" operation scans the
// whole direct range (Task194 loader, real code with a mock server), adds all video candidates in one
// step without detail loads (Task196), never asks for a manual "continue" when the scan succeeded,
// aborts the running HTTP job on a newer click / switch / close, fills display info in pages of <=100,
// and keeps overflow IDs for a JSON export. Synthetic IDs; no real request.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {extract, createContext, run} = require('../helpers/extractSource');
const {createDialogHarness, flush} = require('../helpers/dialogHarness');

const row = (n, kind = 'video') => ({globalId: `sm${n}`, contentKind: kind, visibleStatus: 'visible'});
function realLoader(handler) {
  const calls = [];
  const c = createContext({console: {log() {}, warn() {}, error() {}}, AbortController,
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)), clearTimeout,
    netUtil: {fetch: async (url, opts) => {
      const u = new URL(url);
      const call = {kind: u.pathname.split('/').pop(), offset: +u.searchParams.get('_offset'), limit: +u.searchParams.get('_limit'),
        withMeta: u.searchParams.get('with_meta'), signal: opts.signal};
      calls.push(call);
      if (opts.signal && opts.signal.aborted) { throw Object.assign(new Error('aborted'), {name: 'AbortError'}); }
      const r = await handler(call);
      return {status: r.status ?? 200, ok: (r.status ?? 200) < 300, headers: {get: () => null}, json: async () => r.body};
    }}});
  c.window = {console: c.console};
  run(`globalThis.subject=${extract('packages/lib/src/nico/CommonsTreeLoader.js', 'CommonsTreeLoader', 'var')};`, c);
  return {loader: c.subject, calls};
}
// Bad Apple!! shape: 1 parent video, 1,060 children (996 video, 50 live, 12 illust, 2 commons)
const kindOf = i => (i < 50 ? 'live' : i < 62 ? 'illust' : i < 64 ? 'commons' : 'video');
const badApple = c => {
  if (c.kind === 'parents') {
    return {body: {meta: {status: 200}, data: {parents: {total: 1, contents: c.offset === 0 ? [{...row(3601701), globalId: 'nm3601701', title: c.withMeta ? 'parent' : undefined}] : []}}}};
  }
  const n = Math.max(0, Math.min(c.limit, 1060 - c.offset));
  return {body: {meta: {status: 200}, data: {children: {total: 1060,
    contents: Array.from({length: n}, (_, i) => ({...row(500000 + c.offset + i, kindOf(c.offset + i)), ...(c.withMeta ? {title: `meta ${c.offset + i}`} : {})}))}}}};
};
function dialog(loader, {appendResult} = {}) {
  const h = createDialogHarness(), notes = [], adds = [], hints = [];
  const d = h.dialog;
  Object.assign(d, {_videoInfo: {videoId: 'sm8628149'}, _watchId: 'sm8628149', _requestId: 'r1'});
  d.execCommand = (cmd, text) => notes.push(`${cmd}:${text}`);
  Object.assign(d._playlist, {
    isEnable: false,
    appendWatchIds: async (ids, options) => {
      adds.push({ids: Array.from(ids), options});
      if (appendResult) { return appendResult(ids, options); }
      options.report && Object.assign(options.report, {existing: 0, overflow: [], capacity: 10000});
      return ids.length;
    },
    applyHints: map => { hints.push(map.size); return map.size; },
    insertCurrentVideo() {}, scrollToActiveItem() {}
  });
  h.context.CommonsTreeLoader = loader;
  h.context.AbortController = AbortController;
  return {h, d, notes, adds, hints};
}

describe('Task197 one operation fetches the whole parent/child range', () => {
  it('Bad Apple!!: 300/300/300/160 children + parent, 997 candidates added once, no manual continue', async () => {
    const f = realLoader(badApple);
    const s = dialog(f.loader);
    await s.d._onPlaylistSetCommonsTree();
    await flush(30);
    const idCalls = f.calls.filter(c => !c.withMeta);
    assert.deepStrictEqual(idCalls.filter(c => c.kind === 'children').map(c => [c.offset, c.limit]), [[0, 300], [300, 300], [600, 300], [900, 160]]);
    assert.strictEqual(s.adds.length, 1, 'added once (stable order)');
    const ids = s.adds[0].ids;
    assert.strictEqual(ids.length, 997);
    assert.strictEqual(ids[0], 'nm3601701', 'parent first');
    assert.strictEqual(ids[1], 'sm500064', 'then children in API order');
    assert.strictEqual(s.adds[0].options.deferDetails, true);
    const msg = s.notes.find(n => n.includes('プレイリストに997件追加しました'));
    assert(msg && msg.includes('親作品1件・子作品996件') && msg.includes('動画以外64件は除外'), s.notes.join('|'));
    assert(!s.notes.some(n => n.includes('もう一度')), 'no manual continuation after a successful scan');
    assert.strictEqual(s.d._commonsTreeProgress, null);
    const metaCalls = f.calls.filter(c => c.withMeta);
    assert(metaCalls.length >= 11 && metaCalls.every(c => c.limit <= 100), 'display info in pages of <=100');
    assert(s.hints.reduce((a, b) => a + b, 0) > 900);
    assert(s.notes.some(n => n.includes('表示情報を補完しました')), s.notes.join('|'));
    const exported = s.d._commonsTreeLastResult;
    assert.strictEqual(exported.parents.length + exported.children.length, 997);
  });

  it('a newer click / switch aborts the running HTTP request and nothing from the old job is added', async () => {
    let release;
    const f = realLoader(c => (c.kind === 'children' && c.offset === 300 ? new Promise(r => { release = r; }) : badApple(c)));
    const s = dialog(f.loader);
    const p = s.d._onPlaylistSetCommonsTree();
    for (let i = 0; i < 50 && !f.calls.some(c => c.kind === 'children' && c.offset === 300); i++) { await flush(2); }
    const pending = f.calls.find(c => c.kind === 'children' && c.offset === 300);
    s.d._abortCommonsTreeJob();               // what open()/close() call (Task197)
    await p; await flush(5);
    assert.strictEqual(pending.signal.aborted, true, 'the HTTP request itself is aborted');
    assert.strictEqual(s.adds.length, 0);
    release && release(badApple({kind: 'children', offset: 300, limit: 300}));
    const src = fs.readFileSync(path.join(__dirname, '../../src/NicoVideoPlayerDialog.js'), 'utf-8');
    assert((src.match(/this\._abortCommonsTreeJob\(\);\s+\/\/ Task197/g) || []).length >= 2, 'wired into video switch and close');
  });

  it('overflow beyond the playlist capacity is reported without offering the removed export', async () => {
    const f = realLoader(badApple);
    const s = dialog(f.loader, {appendResult: (ids, options) => {
      Object.assign(options.report, {existing: 3, overflow: ids.slice(100), capacity: 10000});
      return 97;
    }});
    await s.d._onPlaylistSetCommonsTree();
    await flush(30);
    const msg = s.notes.find(n => n.includes('プレイリストに97件追加しました'));
    assert(msg && msg.includes('上限（10000件）のため897件は未追加') && !msg.includes('一覧を保存'), s.notes.join('|'));
    assert(!msg.includes('全件追加'), 'not reported as all added');
    assert.strictEqual(s.d._commonsTreeLastResult.overflow.length, 897);
  });

  it('a mid-scan failure keeps fetched IDs and offers a resume from the failed offset', async () => {
    const f = realLoader(c => (c.kind === 'children' && c.offset === 600 ? {status: 500, body: {}} : badApple(c)));
    const s = dialog(f.loader);
    await s.d._onPlaylistSetCommonsTree();
    await flush(30);
    assert.strictEqual(s.adds[0].ids.length, 1 + 600 - 64);
    assert(s.notes.some(n => n.includes('途中で取得に失敗') && n.includes('もう一度')), s.notes.join('|'));
    // Task199: the continuation point also names its job (jobId) so a resume merges into the same result
    const {jobId, ...point} = JSON.parse(JSON.stringify(s.d._commonsTreeProgress));
    assert.strictEqual(typeof jobId, 'string');
    assert.deepStrictEqual(point, {videoId: 'sm8628149', requestId: 'r1', parents: null, children: 600});
  });

  it('the rejected export is absent while related-tree actions remain', () => {
    const panel = fs.readFileSync(path.join(__dirname, '../../src/VideoInfoPanel.js'), 'utf-8');
    assert(!panel.includes('data-command="commonsTreeExport"'));
    assert(panel.includes('data-command="playlistSetCommonsTree"'));
    assert(panel.includes('data-command="open-parent-video"'));
    const src = fs.readFileSync(path.join(__dirname, '../../src/NicoVideoPlayerDialog.js'), 'utf-8');
    assert(!src.includes("case 'commonsTreeExport':"));
    assert(!src.includes('_onCommonsTreeExport()'));
  });
});
