// Task180 (Watch V4 audit F03 + Commons COM-02/COM-05): parent/child results distinguish
// a real empty tree, an unregistered video, a partial failure and a broken response,
// keep successfully fetched pages, and reject duplicate / missing IDs.
// All responses are synthetic.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const {createDialogHarness, flush} = require('../helpers/dialogHarness');

const item = (n, extra = {}) => ({kind: 'external', id: n, globalId: `sm${100000 + n}`, contentId: 100000 + n, contentKind: 'video', visibleStatus: 'visible', ...extra});
const rows = (count, start = 0) => Array.from({length: count}, (_, i) => item(start + i));
const ok = (kind, total, contents, meta = 200) => ({body: {meta: {status: meta}, data: {[kind]: {total, contents}}}});
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
  run(`globalThis.subject=${extract('packages/lib/src/nico/CommonsTreeLoader.js', 'CommonsTreeLoader', 'var')};`, context);
  return {subject: context.subject, calls};
}

describe('Task180 Commons result classification (F03 / COM-02 / COM-05)', () => {
  it('HTTP 200 with an API failure or a missing box is an error, not an empty tree', async () => {
    await assert.rejects(loader(c => ok(c.kind, 0, [], 500)).subject.loadRelatives('sm9', 'children'));
    await assert.rejects(loader(() => ({body: {meta: {status: 200}, data: {}}})).subject.loadRelatives('sm9', 'children'));
    await assert.rejects(loader(c => ({body: {meta: {status: 200}, data: {[c.kind]: {total: 'x', contents: []}}}})).subject.loadRelatives('sm9', 'children'));
    await assert.rejects(loader(c => ({body: {meta: {status: 200}, data: {[c.kind]: {total: 3, contents: null}}}})).subject.loadRelatives('sm9', 'children'));
  });

  it('a genuinely empty tree stays a normal zero', async () => {
    const r = await loader(c => ok(c.kind, 0, [])).subject.loadRelatives('sm9', 'children');
    assert.strictEqual(r.works.length, 0);
    assert.strictEqual(r.failed, undefined);
    assert.strictEqual(r.scanComplete, true);
  });

  it('a later 503 keeps the successfully fetched works of the same side (COM-02)', async () => {
    const f = loader(c => c.kind === 'parents' ? ok(c.kind, 1, [item(9999)]) : (c.offset === 0 ? ok(c.kind, 240, rows(100)) : {status: 503, body: {}}));
    const r = await f.subject.load('sm8628149');
    assert.strictEqual(r.parents.works.length, 1);
    assert.strictEqual(r.children.works.length, 100);
    assert.strictEqual(r.children.failed, true);
    assert.strictEqual(r.children.partial, true);
    assert.strictEqual(r.children.failedOffset, 100);
    assert.strictEqual(r.children.total, 240);
  });

  it('a later 404 is a failure, not "not registered", and keeps the reported total', async () => {
    const r = await loader(c => c.offset === 0 ? ok(c.kind, 240, rows(100)) : {status: 404, body: {}}).subject.loadRelatives('sm9', 'children');
    assert.strictEqual(r.total, 240);
    assert.strictEqual(r.notFound, false);
    assert.strictEqual(r.failed, true);
    assert.strictEqual(r.works.length, 100);
  });

  it('removes duplicate global IDs and rejects rows without one (COM-05)', async () => {
    const dup = await loader(c => ok(c.kind, 200, rows(100))).subject.loadRelatives('sm9', 'children');
    assert.strictEqual(dup.works.length, 100);
    assert.strictEqual(dup.duplicateCount, 100);
    const missing = await loader(c => ok(c.kind, 2, [{contentKind: 'video', visibleStatus: 'visible'}, item(1, {globalId: 'nm3601701', contentId: 3601701})])).subject.loadRelatives('sm9', 'parents');
    assert.deepStrictEqual(Array.from(missing.works, w => w.contentId), ['nm3601701']);
    assert.strictEqual(missing.invalidCount, 1);
  });

  it('both sides failing is still an explicit failure', async () => {
    await assert.rejects(loader(() => ({status: 503, body: {}})).subject.load('sm9'));
  });
});

describe('Task180 dialog tells partial failures apart from zero results', () => {
  function run(tree) {
    const h = createDialogHarness(), notes = [], adds = [];
    h.context.CommonsTreeLoader = {load: async () => tree};
    Object.assign(h.dialog, {_videoInfo: {videoId: 'sm9'}, _watchId: 'sm9', _requestId: 'r1'});
    h.dialog.execCommand = (cmd, text) => notes.push(`${cmd}:${text}`);
    Object.assign(h.dialog._playlist, {appendWatchIds: async ids => { adds.push(ids); return ids.length; }, insertCurrentVideo() {}, scrollToActiveItem() {}});
    return h.dialog._onPlaylistSetCommonsTree().then(() => ({notes, adds}));
  }
  const side = (works, extra = {}) => ({total: works.length, works: works.map(id => ({contentId: id, isVideo: true})), ...extra});

  it('one side failed and the other is empty: reports the failure, not "0 items"', async () => {
    const {notes, adds} = await run({parents: {total: 0, works: [], failed: true}, children: side([])});
    assert.strictEqual(adds.length, 0);
    assert(notes.some(s => s.includes('失敗')), notes.join('|'));
    assert(!notes.some(s => s.includes('0件でした')), notes.join('|'));
  });

  it('partial children are still added and the shortfall is shown', async () => {
    const {notes, adds} = await run({parents: side(['smP']), children: side(['smC1', 'smC2'], {total: 240, failed: true, partial: true, failedOffset: 100})});
    assert.deepStrictEqual(adds[0], ['smP', 'smC1', 'smC2']);
    assert(notes.some(s => s.includes('子作品') && s.includes('失敗')), notes.join('|'));
  });

  it('a normal empty tree and an unregistered video keep their messages', async () => {
    assert((await run({parents: side([]), children: side([])})).notes.some(s => s.includes('0件でした')));
    assert((await run({parents: side([], {notFound: true}), children: side([], {notFound: true})})).notes.some(s => s.includes('登録されていません')));
  });

  it('stopping at the per-direction cap is shown as a cap, with the reported total', async () => {
    const {notes} = await run({parents: side([]), children: side(['smC1'], {total: 1060, stopReason: 'limit', nextOffset: 300})});
    assert(notes.some(s => s.includes('全1060件') && s.includes('上限')), notes.join('|'));
  });
});
