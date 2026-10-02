// Task198 (Task194-197 review R02): the loader's classification reaches the dialog message. A normal
// empty tree, a first-page 404 (not registered), a mid-scan failure, and inconsistent incomplete results
// (empty page before the total, repeated page, changed total) are told apart; non-video-only trees keep
// their message. Real Task194 loader on a mock server -> real dialog method. Synthetic IDs only.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const {createDialogHarness, flush} = require('../helpers/dialogHarness');

function realLoader(handler) {
  const c = createContext({console: {log() {}, warn() {}, error() {}}, AbortController,
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)), clearTimeout,
    netUtil: {fetch: async url => {
      const u = new URL(url);
      const call = {kind: u.pathname.split('/').pop(), offset: +u.searchParams.get('_offset'), limit: +u.searchParams.get('_limit'), withMeta: u.searchParams.get('with_meta')};
      const r = await handler(call);
      return {status: r.status ?? 200, ok: (r.status ?? 200) < 300, headers: {get: () => null}, json: async () => r.body};
    }}});
  c.window = {console: c.console};
  run(`globalThis.subject=${extract('packages/lib/src/nico/CommonsTreeLoader.js', 'CommonsTreeLoader', 'var')};`, c);
  return c.subject;
}
const ok = (kind, total, contents) => ({body: {meta: {status: 200}, data: {[kind]: {total, contents}}}});
const row = (n, kind = 'video') => ({globalId: `sm${n}`, contentKind: kind, visibleStatus: 'visible'});
async function runDialog(handler) {
  const h = createDialogHarness(), notes = [], adds = [];
  const d = h.dialog;
  Object.assign(d, {_videoInfo: {videoId: 'sm9'}, _watchId: 'sm9', _requestId: 'r9'});
  d.execCommand = (cmd, text) => notes.push(String(text));
  Object.assign(d._playlist, {isEnable: false, appendWatchIds: async (ids, o) => { adds.push(Array.from(ids)); Object.assign(o.report, {existing: 0, overflow: [], capacity: 10000}); return ids.length; },
    applyHints: () => 0, insertCurrentVideo() {}, scrollToActiveItem() {}});
  h.context.CommonsTreeLoader = realLoader(handler);
  h.context.AbortController = AbortController;
  await d._onPlaylistSetCommonsTree();
  await flush(20);
  return {notes, adds, last: notes[notes.length - 1], d};
}
const page = n => Array.from({length: n}, (_, i) => row(i + 1));

describe('Task198 Commons outcome classification reaches the dialog', () => {
  it('a normal empty tree is "0件"', async () => {
    const r = await runDialog(c => ok(c.kind, 0, []));
    assert.strictEqual(r.last, '親作品・子作品は0件でした');
  });

  it('first-page 404 on both sides is "not registered"', async () => {
    const r = await runDialog(() => ({status: 404, body: {}}));
    assert(r.last.includes('コンテンツツリーに登録されていません'), r.last);
  });

  it('an empty page before the reported total is not "0件" (review R02)', async () => {
    const r = await runDialog(c => (c.kind === 'parents' ? ok('parents', 0, []) : ok('children', 1060, [])));
    assert(!r.last.includes('0件でした'), r.last);
    assert(r.last.includes('追加できる親作品・子作品はありませんでした') && r.last.includes('矛盾'), r.last);
  });

  it('a mid-scan failure with nothing playable is a failure with a resume hint', async () => {
    const r = await runDialog(c => (c.kind === 'parents' ? ok('parents', 0, []) :
      (c.offset === 0 ? ok('children', 600, page(300).map(w => ({...w, contentKind: 'live'}))) : {status: 500, body: {}})));
    assert(r.last.includes('途中で取得に失敗') && r.last.includes('もう一度'), r.last);
    assert(r.last.includes('動画以外'), r.last);
  });

  it('a repeated page and a changed total are partial', async () => {
    const addMsg = r => r.notes.find(n => n.startsWith('プレイリストに')) || '';
    let r = await runDialog(c => (c.kind === 'parents' ? ok('parents', 0, []) : ok('children', 900, page(300))));
    assert(addMsg(r).includes('矛盾'), r.notes.join('|'));
    r = await runDialog(c => (c.kind === 'parents' ? ok('parents', 0, []) :
      ok('children', c.offset === 0 ? 600 : 700, page(300).map(w => ({...w, globalId: `sm${c.offset + Number(w.globalId.slice(2))}`})))));
    assert(addMsg(r).includes('矛盾'), r.notes.join('|'));
    assert.strictEqual(r.adds[0].length, 600);
  });

  it('non-video-only complete results keep the non-video message', async () => {
    const r = await runDialog(c => (c.kind === 'parents' ? ok('parents', 0, []) : ok('children', 2, [row(1, 'live'), row(2, 'illust')])));
    assert(r.last.includes('動画以外・非公開の作品2件は追加できません'), r.last);
  });

  it('old-style results without "complete" keep their previous meaning', async () => {
    const h = createDialogHarness(), notes = [];
    const d = h.dialog;
    Object.assign(d, {_videoInfo: {videoId: 'sm9'}, _watchId: 'sm9', _requestId: 'r9'});
    d.execCommand = (cmd, text) => notes.push(String(text));
    h.context.CommonsTreeLoader = {load: async () => ({parents: {total: 0, works: []}, children: {total: 0, works: []}})};
    await d._onPlaylistSetCommonsTree();
    assert.strictEqual(notes[notes.length - 1], '親作品・子作品は0件でした');
  });
});
