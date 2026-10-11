'use strict';
const assert = require('assert');
const {createPlaylistContext} = require('../helpers/playlistHarness');
const {extract, run} = require('../helpers/extractSource');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
};
function fixture(path) {
  const h = createPlaylistContext();
  const P = path === 'packages/zenza/src/Playlist/PlayList.js' ?
    h.PlayList : run('(' + extract(path, 'PlayList', 'class') + ')', h.c);
  // Babel class extraction excludes static assignments placed after the class.
  for (const key of ['SEARCH_LIMIT_DEFAULT', 'SEARCH_LIMIT_MIN', 'SEARCH_LIMIT_MAX']) {
    P[key] = h.PlayList[key];
  }
  const p = new P();
  p.initialize({loop: false, container: null, loader: {}});
  p.view = {scrollToItem() {}, scrollTop() {}, hasFocus: false};
  h.c.console = {log() {}, warn() {}, error() {}, time() {}, timeEnd() {}};
  p.model.setItem([h.item('smSeed')]);
  p.setIndex(0);
  const requests = [], updates = [];
  p._playlistApiLoader = {load: (playlist, msgInfo) => {
    const request = deferred();
    requests.push({kind: 'load', name: playlist.id, msgInfo, ...request});
    return request.promise;
  }};
  p._nicoSearchApiLoader = {searchMore: (word, options, limit) => {
    const request = deferred();
    requests.push({kind: 'search', name: word, options, limit, ...request});
    return request.promise;
  }};
  p.on('update', () => updates.push('update'));
  const load = (id, options = {}) =>
    p.load({type: 'mylist', id}, {watchId: 'smSeed', ...options}, {});
  const search = (word, options = {}) =>
    p.loadSearchVideo(word, {watchId: 'smSeed', ...options}, 30);
  const complete = (request, ids) => request.kind === 'load' ?
    request.resolve(ids.map(id => h.raw(id))) :
    request.resolve({list: ids.map(id => h.raw(id))});
  const ids = () => Array.from(p.model.items, item => item.watchId);
  const snapshot = () => ({
    ids: ids(),
    current: p._activeItem?.watchId ?? null,
    updates: updates.length
  });
  return {h, p, requests, updates, load, search, complete, ids, snapshot};
}
for (const path of ['packages/zenza/src/Playlist/PlayList.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task384 AUD-41 latest replace-only playlist owner: ' + path, function() {
    this.timeout(20000);
    it('ignores old mylist load when the newer mylist resolves first', async () => {
      const f = fixture(path);
      const old = f.load('A'), newer = f.load('B');
      f.complete(f.requests[1], ['smB1', 'smB2']);
      assert.strictEqual((await newer).status, 'ok');
      const after = f.snapshot();
      f.complete(f.requests[0], ['smA']);
      const result = await old;
      assert.strictEqual(result.status, 'superseded');
      assert.deepStrictEqual(f.snapshot(), after);
      assert.deepStrictEqual(f.ids(), ['smB1','smB2']);
    });
    it('ignores old search after a later search completes', async () => {
      const f = fixture(path);
      const old = f.search('old'), newer = f.search('new');
      f.complete(f.requests[1], ['smB']);
      await newer;
      const after = f.snapshot();
      f.complete(f.requests[0], ['smA']);
      assert.strictEqual((await old).status, 'superseded');
      assert.deepStrictEqual(f.snapshot(), after);
    });
    it('shares ordering between mylist and search: load A then search B', async () => {
      const f = fixture(path);
      const old = f.load('A'), newer = f.search('B');
      f.complete(f.requests[1], ['smB']);
      await newer;
      f.complete(f.requests[0], ['smA']);
      assert.strictEqual((await old).status, 'superseded');
      assert.deepStrictEqual(f.ids(), ['smB']);
    });
    it('shares ordering between search and mylist: search A then load B', async () => {
      const f = fixture(path);
      const old = f.search('A'), newer = f.load('B');
      f.complete(f.requests[1], ['smB']);
      await newer;
      f.complete(f.requests[0], ['smA']);
      assert.strictEqual((await old).status, 'superseded');
      assert.deepStrictEqual(f.ids(), ['smB']);
    });
    it('does not apply old replace even if the latest search returns empty', async () => {
      const f = fixture(path);
      const old = f.load('A'), newer = f.search('empty');
      f.complete(f.requests[1], []);
      await assert.rejects(newer);
      f.complete(f.requests[0], ['smA']);
      assert.strictEqual((await old).status, 'superseded');
      assert.deepStrictEqual(f.ids(), ['smSeed']);
    });
    it('handles an old network rejection as superseded without a false error', async () => {
      const f = fixture(path);
      const old = f.load('A'), newer = f.load('B');
      f.complete(f.requests[1], ['smB']);
      await newer;
      f.requests[0].reject(new Error('old-network-error'));
      const result = await old;
      assert.strictEqual(result.status, 'superseded');
      assert.deepStrictEqual(f.ids(), ['smB']);
    });
    it('leaves the latest active request network failure as a rejection', async () => {
      const f = fixture(path);
      const p = f.search('latest');
      f.requests[0].reject(new Error('new-network-error'));
      await assert.rejects(p, /new-network-error/);
      assert.deepStrictEqual(f.ids(), ['smSeed']);
    });
    it('keeps an ordinary single replacement and active video selection', async () => {
      const f = fixture(path);
      const p = f.load('one');
      f.complete(f.requests[0], ['smSeed','smNext']);
      const result = await p;
      assert.strictEqual(result.status, 'ok');
      assert.deepStrictEqual(f.ids(), ['smSeed','smNext']);
      assert.strictEqual(f.p._activeItem?.watchId, 'smSeed');
    });
    it('keeps successful search sort/limit options and result notification', async () => {
      const f = fixture(path);
      const p = f.search('word', {playlistSort: true});
      assert.strictEqual(f.requests[0].limit, f.h.PlayList.normalizeSearchLimit(30));
      f.complete(f.requests[0], ['smA','smB']);
      const result = await p;
      assert.strictEqual(result.status, 'ok');
      assert.ok(result.message.includes('検索結果'));
      assert.deepStrictEqual(f.ids(), ['smA','smB']);
    });
    it('preserves append mode and commits overlapping requests in start order', async () => {
      const f = fixture(path);
      const a = f.load('A', {append:true}), b = f.load('B', {append:true});
      f.complete(f.requests[1], ['smB']);
      await new Promise(resolve => setImmediate(resolve));
      assert.deepStrictEqual(f.ids(), ['smSeed'], 'B waits for A to commit');
      f.complete(f.requests[0], ['smA']);
      const [ra, rb] = await Promise.all([a, b]);
      assert.strictEqual(ra.status, 'ok');
      assert.strictEqual(rb.status, 'ok');
      assert.deepStrictEqual(f.ids(), ['smSeed','smA','smB']);
    });
    it('preserves insert mode and commits overlapping requests in start order', async () => {
      const f = fixture(path);
      const a = f.load('A', {insert:true}), b = f.load('B', {insert:true});
      f.complete(f.requests[1], ['smB']);
      await new Promise(resolve => setImmediate(resolve));
      assert.deepStrictEqual(f.ids(), ['smSeed']);
      f.complete(f.requests[0], ['smA']);
      const [ra, rb] = await Promise.all([a, b]);
      assert.strictEqual(ra.status, 'ok');
      assert.strictEqual(rb.status, 'ok');
      assert.deepStrictEqual(f.ids(), ['smSeed','smB','smA']);
    });
    it('protects a newer append request from an older pending replace', async () => {
      const f = fixture(path);
      const old = f.load('old'), newer = f.load('newAppend',{append:true});
      f.complete(f.requests[1], ['smAdded']);
      assert.strictEqual((await newer).status, 'ok');
      f.complete(f.requests[0], ['smOld']);
      assert.strictEqual((await old).status, 'superseded');
      assert.deepStrictEqual(f.ids(), ['smSeed','smAdded']);
    });
    it('protects a newer search insert from an older pending search replace', async () => {
      const f = fixture(path);
      const old = f.search('old'), newer = f.search('newInsert',{insert:true});
      f.complete(f.requests[1], ['smAdded']);
      assert.strictEqual((await newer).status, 'ok');
      f.complete(f.requests[0], ['smOld']);
      assert.strictEqual((await old).status, 'superseded');
      assert.deepStrictEqual(f.ids(), ['smSeed','smAdded']);
    });
    it('drops pending network replacement after a synchronous replaceItems', async () => {
      const f = fixture(path);
      const pending = f.load('old');
      f.p.replaceItems([f.h.raw('smManual')], {});
      f.complete(f.requests[0], ['smOld']);
      assert.strictEqual((await pending).status, 'superseded');
      assert.deepStrictEqual(f.ids(), ['smManual']);
    });
    it('drops pending network replacement after a valid manual JSON import', async () => {
      const f = fixture(path);
      const pending = f.search('old');
      const data = JSON.stringify({items:[f.h.raw('smImported')],
        index:0,enable:false,loop:false});
      f.p.unserialize(JSON.parse(data));
      f.complete(f.requests[0], ['smOld']);
      assert.strictEqual((await pending).status, 'superseded');
      assert.deepStrictEqual(f.ids(), ['smImported']);
    });
    it('does not mutate a replaced model when a stale request returns', async () => {
      const f = fixture(path);
      const pending = f.load('old');
      const newModel = new f.h.PlayListModel({});
      f.p.model = newModel;
      newModel.setItem([f.h.item('smAnother')]);
      f.complete(f.requests[0], ['smOld']);
      assert.strictEqual((await pending).status, 'superseded');
      assert.deepStrictEqual(f.ids(), ['smAnother']);
    });
  });
}
