// Task199 (Task194-197 review R01/R03): the saved result keeps every work of the job (videos and
// non-videos, with kind/visibility and relation) apart from the video candidates / added / existing /
// overflow sets, and a resume after a mid-scan failure merges into the same job instead of replacing it.
// The resumed batch is inserted after the previous batch in the real playlist model. Synthetic IDs only.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const {createDialogHarness, flush} = require('../helpers/dialogHarness');
const {createPlaylistContext} = require('../helpers/playlistHarness');

const work = (id, kind = 'video') => ({contentId: id, isVideo: kind === 'video', contentKind: kind, visibleStatus: 'visible'});
const side = (works = [], extra = {}) => ({kind: 'children', total: works.length, works, rows: works.length, fetchedCount: works.length,
  nextOffset: null, startOffset: 0, complete: true, scanComplete: true, stopReason: 'end-of-range', ...extra});
function dialog(loads, {playlist} = {}) {
  const h = createDialogHarness(), notes = [], adds = [];
  const d = h.dialog;
  Object.assign(d, {_videoInfo: {videoId: 'sm9'}, _watchId: 'sm9', _requestId: 'r9'});
  d.execCommand = (cmd, text) => notes.push(String(text));
  if (playlist) {
    d._playlist = playlist;
  } else {
    Object.assign(d._playlist, {isEnable: false, applyHints: () => 0, insertCurrentVideo() {}, scrollToActiveItem() {},
      appendWatchIds: async (ids, o) => {
        adds.push(Array.from(ids));
        const over = o.__overflow || [];
        const addedIds = Array.from(ids).filter(id => !over.includes(id));
        Object.assign(o.report, {existing: 0, existingIds: [], overflow: over, addedIds, capacity: 10000});
        return addedIds.length;
      }});
  }
  h.context.AbortController = AbortController;
  h.context.CommonsTreeLoader = {load: async () => { const r = loads.shift(); return typeof r === 'function' ? r() : r; }};
  return {h, d, notes, adds};
}
const plain = x => JSON.parse(JSON.stringify(x));

function realLoader(handler) {
  const c = createContext({console: {log() {}, warn() {}, error() {}}, AbortController,
    setTimeout: (f, ms) => setTimeout(f, Math.min(ms, 5)), clearTimeout,
    netUtil: {fetch: async url => {
      const u = new URL(url);
      const r = await handler({kind: u.pathname.split('/').pop(), offset: +u.searchParams.get('_offset'), limit: +u.searchParams.get('_limit'), withMeta: u.searchParams.get('with_meta')});
      return {status: r.status ?? 200, ok: (r.status ?? 200) < 300, headers: {get: () => null}, json: async () => r.body};
    }}});
  c.window = {console: c.console};
  run(`globalThis.subject=${extract('packages/lib/src/nico/CommonsTreeLoader.js', 'CommonsTreeLoader', 'var')};`, c);
  return c.subject;
}
const kindOf = i => (i < 50 ? 'live' : i < 62 ? 'illust' : i < 64 ? 'commons' : 'video');
const badApple = c => {
  if (c.kind === 'parents') {
    return {body: {meta: {status: 200}, data: {parents: {total: 1, contents: c.offset === 0 ? [{globalId: 'nm3601701', contentKind: 'video', visibleStatus: 'visible'}] : []}}}};
  }
  const n = Math.max(0, Math.min(c.limit, 1060 - c.offset));
  return {body: {meta: {status: 200}, data: {children: {total: 1060,
    contents: Array.from({length: n}, (_, i) => ({globalId: `sm${500000 + c.offset + i}`, contentKind: kindOf(c.offset + i), visibleStatus: 'visible'}))}}}};
};

describe('Task199 commons export keeps all works and resumes accumulate', () => {
  it('R01: video, live and illust IDs are all saved; video candidates are separate', async () => {
    const s = dialog([{parents: side([], {kind: 'parents'}), children: side([work('sm1'), work('lv2', 'live'), work('im3', 'illust')]), complete: true}]);
    await s.d._onPlaylistSetCommonsTree();
    const r = plain(s.d._commonsTreeLastResult);
    assert.deepStrictEqual(r.allWorks.children.map(w => w.globalId), ['sm1', 'lv2', 'im3']);
    assert.deepStrictEqual(r.allWorks.children.map(w => w.contentKind), ['video', 'live', 'illust']);
    assert.deepStrictEqual(r.children, ['sm1'], 'revision-1 field: video candidates');
    assert.strictEqual(r.formatRevision, 2);
    assert.deepStrictEqual(r.counts, {allWorks: 3, parents: 0, children: 3, videoCandidates: 1, nonVideo: 2, added: 1, existing: 0, overflow: 0});
    assert.deepStrictEqual(Object.keys(r.allWorks.children[0]).sort(), ['contentKind', 'globalId', 'visibleStatus'], 'IDs and kinds only');
  });

  it('R01: Bad Apple!! shape through the real loader: 1,061 works, 997 video candidates, 64 non-video', async () => {
    const h = dialog([]);
    h.h.context.CommonsTreeLoader = realLoader(badApple);
    await h.d._onPlaylistSetCommonsTree();
    await flush(30);
    const r = plain(h.d._commonsTreeLastResult);
    assert.strictEqual(r.counts.allWorks, 1061);
    assert.strictEqual(r.allWorks.parents.length, 1);
    assert.strictEqual(r.allWorks.children.length, 1060);
    assert.strictEqual(r.counts.videoCandidates, 997);
    assert.strictEqual(r.counts.nonVideo, 64);
    assert.strictEqual(r.parents.length + r.children.length, 997);
    assert.strictEqual(r.complete, true);
  });

  it('R03: a resume after a mid-scan failure merges into the same job (no loss of the first half or parents)', async () => {
    const s = dialog([
      {parents: side([work('sm1')], {kind: 'parents'}),
        children: side([work('sm2'), work('lv5', 'live')], {total: 600, partial: true, failed: true, complete: false, nextOffset: 300, stopReason: 'failed'}), complete: false},
      {parents: side([], {kind: 'parents', skipped: true, stopReason: 'skipped'}),
        children: side([work('sm3'), work('sm2')], {total: 600, startOffset: 300}), complete: true}
    ]);
    await s.d._onPlaylistSetCommonsTree();
    const first = plain(s.d._commonsTreeLastResult);
    assert.strictEqual(first.complete, false);
    await s.d._onPlaylistSetCommonsTree();
    const r = plain(s.d._commonsTreeLastResult);
    assert.strictEqual(r.jobId, first.jobId, 'same job');
    assert.deepStrictEqual(r.parents, ['sm1']);
    assert.deepStrictEqual(r.children, ['sm2', 'sm3'], 'no duplicate, first half kept');
    assert.deepStrictEqual(r.allWorks.children.map(w => w.globalId), ['sm2', 'lv5', 'sm3']);
    assert.deepStrictEqual(r.addedIds, ['sm1', 'sm2', 'sm3']);
    assert.strictEqual(r.complete, true);
    assert.strictEqual(s.d._commonsTreeProgress, null);
  });

  it('R03: failure + resume + overflow keep the overflow and added sets consistent', async () => {
    const loads = [
      {parents: side([], {kind: 'parents'}), children: side([work('sm1'), work('sm2')], {total: 4, failed: true, partial: true, complete: false, nextOffset: 2, stopReason: 'failed'}), complete: false},
      {parents: side([], {kind: 'parents', skipped: true}), children: side([work('sm3'), work('sm4')], {total: 4, startOffset: 2}), complete: true}
    ];
    const s = dialog(loads);
    const orig = s.d._playlist.appendWatchIds;
    let call = 0;
    s.d._playlist.appendWatchIds = (ids, o) => { o.__overflow = call++ === 0 ? ['sm2'] : ['sm4']; return orig(ids, o); };
    await s.d._onPlaylistSetCommonsTree();
    await s.d._onPlaylistSetCommonsTree();
    const r = plain(s.d._commonsTreeLastResult);
    assert.deepStrictEqual(r.addedIds, ['sm1', 'sm3']);
    assert.deepStrictEqual(r.overflow, ['sm2', 'sm4']);
    assert.strictEqual(r.counts.videoCandidates, 4);
  });

  it('a different video or a fresh scan starts a new job (nothing is mixed)', async () => {
    const s = dialog([
      {parents: side([], {kind: 'parents'}), children: side([work('sm1')], {total: 2, failed: true, partial: true, complete: false, nextOffset: 1, stopReason: 'failed'}), complete: false},
      {parents: side([], {kind: 'parents'}), children: side([work('sm7')]), complete: true}
    ]);
    await s.d._onPlaylistSetCommonsTree();
    const jobA = s.d._commonsTreeLastResult.jobId;
    Object.assign(s.d, {_videoInfo: {videoId: 'sm8'}, _watchId: 'sm8', _requestId: 'r8'});
    await s.d._onPlaylistSetCommonsTree();
    const r = plain(s.d._commonsTreeLastResult);
    assert.notStrictEqual(r.jobId, jobA);
    assert.strictEqual(r.videoId, 'sm8');
    assert.deepStrictEqual(r.children, ['sm7']);
  });

  it('the resumed batch is inserted after the first batch in the real playlist (insert mode)', async () => {
    const ctx = createPlaylistContext();
    const p = ctx.createPlaylist();
    p.model.setItem([ctx.item('smX'), ctx.item('smY')]);
    p.setIndex(0);
    p.model.items[0].isActive = true;
    p._isEnable = true;
    p.insertCurrentVideo = () => {};
    p.scrollToActiveItem = () => {};
    const s = dialog([
      {parents: side([work('sm1')], {kind: 'parents'}),
        children: side([work('sm2')], {total: 2, failed: true, partial: true, complete: false, nextOffset: 1, stopReason: 'failed'}), complete: false},
      {parents: side([], {kind: 'parents', skipped: true}), children: side([work('sm3')], {total: 2, startOffset: 1}), complete: true}
    ], {playlist: p});
    await s.d._onPlaylistSetCommonsTree();
    assert.deepStrictEqual(Array.from(p.model.items, i => i.watchId), ['smX', 'sm1', 'sm2', 'smY']);
    await s.d._onPlaylistSetCommonsTree();
    assert.deepStrictEqual(Array.from(p.model.items, i => i.watchId), ['smX', 'sm1', 'sm2', 'sm3', 'smY'], 'second half after the first half');
  });
});
