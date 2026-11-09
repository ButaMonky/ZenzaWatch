'use strict';
const assert = require('assert');
const {createPlaylistContext} = require('../helpers/playlistHarness');
const {extract, run} = require('../helpers/extractSource');

function makePlaylist(path) {
  const h = createPlaylistContext();
  const PlayList = path === 'packages/zenza/src/Playlist/PlayList.js'
    ? h.PlayList : run('(' + extract(path, 'PlayList', 'class') + ')', h.c);
  for (const key of ['SEARCH_LIMIT_DEFAULT', 'SEARCH_LIMIT_MIN', 'SEARCH_LIMIT_MAX']) {
    PlayList[key] = h.PlayList[key];
  }
  const p = new PlayList();
  p.initialize({loop: false, container: null, loader: {}});
  p.view = {scrollToItem() {}, scrollTop() {}, hasFocus: false};
  p.model.setItem([h.item('smSeed')]);
  p.setIndex(0);
  h.c.console = {log() {}, warn() {}, error() {}, time() {}, timeEnd() {}};
  const ids = () => Array.from(p.model.items, x => x.watchId);
  return {p,ids};
}

for (const path of ['packages/zenza/src/Playlist/PlayList.js','dist/ZenzaWatch-dev.user.js']) {
  describe('AUD #250 empty search result ' + path, () => {
    it('reports true API-success zero results without a false network error', async () => {
      const {p,ids} = makePlaylist(path);
      p._nicoSearchApiLoader = {searchMore: async () =>
        ({status: 'ok', count: 0, list: [], resultState: 'empty'})};
      const result = await p.loadSearchVideo('nothing', {}, 100);
      assert.strictEqual(result.status, 'ok');
      assert(result.message.includes('0件'));
      assert.deepStrictEqual(ids(), ['smSeed'], 'an empty result must not replace the live list');
    });
    it('distinguishes positive API matches without addable items', async () => {
      const {p,ids} = makePlaylist(path);
      p._nicoSearchApiLoader = {searchMore: async () =>
        ({status: 'ok', count: 3, list: [], resultState: 'partial'})};
      const result = await p.loadSearchVideo('removed', {}, 100);
      assert.strictEqual(result.status, 'ok');
      assert(result.message.includes('追加できる動画がありません'));
      assert.deepStrictEqual(ids(), ['smSeed']);
    });
    it('does not swallow a real network failure', async () => {
      const {p,ids} = makePlaylist(path);
      p._nicoSearchApiLoader = {searchMore: async () => {throw new Error('offline-synthetic');}};
      await assert.rejects(p.loadSearchVideo('bad', {}, 100), /offline-synthetic/);
      assert.deepStrictEqual(ids(), ['smSeed']);
    });
  });
}
