// Task192 (Commons audit COM-04): the display fields that with_meta=1 adds (title,
// thumbnailURL, userId, parent/child counts) are kept as optional hints, used only for an
// item whose full video information cannot be loaded, and never treated as full video
// information or written to a cache. with_meta stays off by default (www origin with
// credentials:'omit' is not verified). Paging is unchanged: a short page never ends the scan.
const assert = require('assert');
const {extract, createContext, run, loadClass} = require('../helpers/extractSource');
const {createPlaylistContext} = require('../helpers/playlistHarness');
const {createDialogHarness} = require('../helpers/dialogHarness');

function loader(page) {
  const urls = [];
  const context = createContext({console: {log() {}, warn() {}, error() {}}, netUtil: {fetch: async url => {
    urls.push(url);
    const u = new URL(url);
    const r = await page({kind: u.pathname.split('/').pop(), offset: Number(u.searchParams.get('_offset')), limit: Number(u.searchParams.get('_limit'))});
    return {status: 200, ok: true, json: async () => r};
  }}});
  context.window = {console: context.console};
  run(`globalThis.subject=${extract('packages/lib/src/nico/CommonsTreeLoader.js', 'CommonsTreeLoader', 'var')};`, context);
  return {subject: context.subject, urls};
}
const metaRow = (n, extra = {}) => ({globalId: `sm${n}`, contentKind: 'video', visibleStatus: 'visible',
  title: ` fixture ${n} `, thumbnailURL: `https://example.invalid/${n}.jpg`, userId: 123, parentsCount: 1, childrenCount: 0,
  isEditable: true, description: 'fixture', ...extra});

describe('Task192 commons with_meta display hints (COM-04)', () => {
  it('with_meta is off by default and only sent when asked', async () => {
    const f = loader(c => ({meta: {status: 200}, data: {[c.kind]: {total: 0, contents: []}}}));
    assert.strictEqual(f.subject.WITH_META_DEFAULT, false);
    await f.subject.loadRelatives('sm1', 'children');
    assert(!f.urls[0].includes('with_meta'));
    await f.subject.loadRelatives('sm1', 'children', 300, {withMeta: true});
    assert(f.urls[1].includes('with_meta=1'));
  });

  it('well-formed hints are kept, malformed ones dropped, permissions never kept', async () => {
    const f = loader(c => ({meta: {status: 200}, data: {[c.kind]: {total: 3, contents: [
      metaRow(1),
      metaRow(2, {title: '', thumbnailURL: 'javascript:alert(1)', userId: 'x', parentsCount: -1, childrenCount: 1.5}),
      {globalId: 'sm3', contentKind: 'video', visibleStatus: 'visible'}
    ]}}}));
    const r = await f.subject.loadRelatives('sm1', 'children', 300, {withMeta: true});
    const [a, b, c] = r.works;
    assert.deepStrictEqual(JSON.parse(JSON.stringify(a.meta)),
      {title: 'fixture 1', thumbnailUrl: 'https://example.invalid/1.jpg', userId: '123', parentsCount: 1, childrenCount: 0});
    assert.strictEqual(b.meta, undefined, 'nothing usable -> no meta, not zeros');
    assert.strictEqual(c.meta, undefined);
    assert.strictEqual(a.isEditable, undefined);
  });

  it('short pages with meta still advance by the requested window', async () => {
    const sizes = [19, 19, 16];
    const f = loader(c => ({meta: {status: 200}, data: {[c.kind]: {total: 60,
      contents: Array.from({length: sizes[c.offset / 20] ?? 0}, (_, i) => metaRow(c.offset + i + 1))}}}));
    const r = await f.subject.loadRelatives('sm1', 'children', 300, {pageSize: 20, withMeta: true});
    assert.strictEqual(f.urls.length, 3);
    assert.strictEqual(r.works.length, 54);
    assert.strictEqual(r.scanComplete, true);
  });

  it('a hint is used only when the full information fails, and nothing is cached', async () => {
    const appended = [], cachePuts = [];
    const {VideoListItem} = createPlaylistContext();
    const PlayList = loadClass('packages/zenza/src/Playlist/PlayList.js', 'PlayList', createContext({
      VideoList: class {}, VideoListItem, Emitter: class { emit() {} }, _: require('lodash'), window: {console}}));
    const p = Object.create(PlayList.prototype);
    Object.assign(p, {_initializeView() {}, emit() {},
      _thumbInfoLoader: {load: async id => { if (id === 'sm2') { throw Error('fixture'); } return {id, title: 'full', length_seconds: 60}; },
        put: () => cachePuts.push(1)},
      _appendAll(items) { appended.push(...items); return items.length; }});
    const hints = {sm1: {title: 'hint1'}, sm2: {title: 'hint2', thumbnailUrl: 'https://example.invalid/2.jpg'}};
    await p.appendWatchIds(['sm1', 'sm2'], {hints});
    assert.strictEqual(appended[1].title, 'hint2(動画情報不明)');
    assert.strictEqual(appended[1].thumbnail, 'https://example.invalid/2.jpg');
    assert.notStrictEqual(appended[0].title, 'hint1(動画情報不明)', 'full info wins over the hint');
    assert.strictEqual(cachePuts.length, 0);
    const blank = VideoListItem.createBlankInfo('sm9', {thumbnailUrl: 'http://insecure.invalid/x.jpg'});
    assert.strictEqual(blank.title, 'sm9(動画情報不明)');
    assert(!String(blank.thumbnail).startsWith('http://insecure'));
  });

  it('the dialog forwards hints from the tree to the playlist', async () => {
    const h = createDialogHarness(), calls = [];
    const d = h.dialog;
    Object.assign(d, {_videoInfo: {videoId: 'smA'}, _watchId: 'smA', _requestId: 'rA'});
    d.execCommand = () => {};
    Object.assign(d._playlist, {appendWatchIds: async (ids, o) => { calls.push(o); return ids.length; }, insertCurrentVideo() {}, scrollToActiveItem() {}});
    h.context.CommonsTreeLoader = {load: async () => ({
      parents: {total: 1, works: [{contentId: 'smP', isVideo: true, meta: {title: 'p'}}], nextOffset: null},
      children: {total: 1, works: [{contentId: 'smC', isVideo: true}], nextOffset: null}})};
    await d._onPlaylistSetCommonsTree();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0].hints)), {smP: {title: 'p'}});
  });
});
