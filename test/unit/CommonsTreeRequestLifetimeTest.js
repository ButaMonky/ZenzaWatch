// Task181 (Watch V4 audit F04 + Commons COM-05): a parent/child request started for
// video A must not add, notify, insert the current video or scroll after the player
// moved to B, closed, or a newer request replaced it, including while the playlist is
// still loading item metadata inside appendWatchIds.
const assert = require('assert');
const {createDialogHarness, flush, deferred} = require('../helpers/dialogHarness');
const {loadClass, createContext} = require('../helpers/extractSource');

function setup() {
  const h = createDialogHarness(), notes = [], adds = [], inserted = [], scrolls = [];
  const d = h.dialog;
  Object.assign(d, {_videoInfo: {videoId: 'smA'}, _watchId: 'smA', _requestId: 'rA'});
  d.execCommand = (cmd, text) => notes.push(`${cmd}:${text}`);
  Object.assign(d._playlist, {
    appendWatchIds: async (ids, options) => { adds.push({ids, options}); return ids.length; },
    insertCurrentVideo(v) { inserted.push(v); },
    scrollToActiveItem() { scrolls.push(1); }
  });
  const tree = ids => ({parents: {total: ids.length, works: ids.map(id => ({contentId: id, isVideo: true}))}, children: {total: 0, works: []}});
  return {h, d, notes, adds, inserted, scrolls, tree};
}
const switchTo = (d, id) => Object.assign(d, {_videoInfo: {videoId: id}, _watchId: id, _requestId: 'r' + id});

describe('Task181 Commons request lifetime (F04)', () => {
  it('A result arriving after switching to B is not added to B', async () => {
    const s = setup(), wait = deferred();
    s.h.context.CommonsTreeLoader = {load: () => wait.promise};
    const pending = s.d._onPlaylistSetCommonsTree();
    switchTo(s.d, 'smB');
    wait.resolve(s.tree(['smParentA']));
    await pending; await flush();
    assert.strictEqual(s.adds.length, 0);
    assert.strictEqual(s.inserted.length, 0);
    assert(!s.notes.some(n => n.includes('追加')), s.notes.join('|'));
  });

  it('closing while loading discards the result', async () => {
    const s = setup(), wait = deferred();
    s.h.context.CommonsTreeLoader = {load: () => wait.promise};
    const pending = s.d._onPlaylistSetCommonsTree();
    s.d._requestId = null; // close()
    wait.resolve(s.tree(['smParentA']));
    await pending;
    assert.strictEqual(s.adds.length, 0);
  });

  it('a second click supersedes the first; only the newest result is added once', async () => {
    const s = setup(), first = deferred(), second = deferred();
    const waits = [first, second];
    s.h.context.CommonsTreeLoader = {load: () => waits.shift().promise};
    const p1 = s.d._onPlaylistSetCommonsTree();
    const p2 = s.d._onPlaylistSetCommonsTree();
    second.resolve(s.tree(['smP2']));
    first.resolve(s.tree(['smP1']));
    await Promise.all([p1, p2]);
    assert.deepStrictEqual(s.adds.map(a => a.ids), [['smP2']]);
  });

  it('the cancellation reaches inside appendWatchIds and the delayed scroll', async () => {
    const s = setup();
    s.h.context.CommonsTreeLoader = {load: async () => s.tree(['smParentA'])};
    let cancelledInside = null;
    s.d._playlist.appendWatchIds = async (ids, options) => {
      s.adds.push({ids, options});
      switchTo(s.d, 'smB');                        // the user moves on while metadata loads
      cancelledInside = options.isCancelled();
      return options.isCancelled() ? null : ids.length;
    };
    await s.d._onPlaylistSetCommonsTree();
    s.h.timers.advance(2000);
    assert.strictEqual(cancelledInside, true);
    assert.strictEqual(s.inserted.length, 0);
    assert.strictEqual(s.scrolls.length, 0);
  });

  it('the normal path still adds once, inserts the current video and scrolls later', async () => {
    const s = setup();
    s.h.context.CommonsTreeLoader = {load: async () => s.tree(['smParentA'])};
    await s.d._onPlaylistSetCommonsTree();
    assert.deepStrictEqual(s.adds.map(a => a.ids), [['smParentA']]);
    assert.strictEqual(s.adds[0].options.watchId, 'smA');
    assert.strictEqual(s.inserted.length, 1);
    s.h.timers.advance(1000);
    assert.strictEqual(s.scrolls.length, 1);
  });
});

describe('Task181 PlayList.appendWatchIds honours cancellation before changing the list', () => {
  function playlist() {
    const appended = [];
    const c = createContext({VideoListItem: {createByThumbInfo: i => ({watchId: i.id}), createBlankInfo: id => ({watchId: id})}});
    const PlayList = loadClass('packages/zenza/src/Playlist/PlayList.js', 'PlayList', createContext({
      VideoList: class {}, VideoListItem: c.VideoListItem, Emitter: class { emit() {} }, _: require('lodash'), window: {console}
    }));
    const p = Object.create(PlayList.prototype);
    Object.assign(p, {_initializeView() {}, _thumbInfoLoader: {load: async id => ({id})},
      _appendAll(items) { appended.push(...items); return items.length; }, _insertAll(items) { appended.push(...items); return items.length; },
      emit() {}});
    return {p, appended};
  }

  it('returns null and adds nothing when cancelled', async () => {
    const {p, appended} = playlist();
    assert.strictEqual(await p.appendWatchIds(['sm1', 'sm2'], {isCancelled: () => true}), null);
    assert.strictEqual(appended.length, 0);
  });

  it('adds normally without a cancellation hook', async () => {
    const {p, appended} = playlist();
    assert.strictEqual(await p.appendWatchIds(['sm1', 'sm2'], {}), 2);
    assert.deepStrictEqual(appended.map(i => i.watchId), ['sm1', 'sm2']);
  });
});
