'use strict';

const assert = require('assert');
const {createPlaylistContext} = require('../helpers/playlistHarness');
const order = playlist => Array.from(playlist.model.items, item => item.watchId);

function setup(existing = ['sm9', 'sm2', 'sm3', 'sm8'], maxItems = 10000) {
  const harness = createPlaylistContext();
  const playlist = harness.createPlaylist({maxItems});
  playlist._initializeView = () => {};
  playlist.model.setItem(existing.map(id => harness.item(id)));
  playlist.setIndex(existing.indexOf('sm2'), true);
  playlist._playlistApiLoader = {load: async () => playlist.incoming.map(id => harness.raw(id))};
  const load = (ids, type = 'series', extra = {}) => {
    playlist.incoming = ids;
    return playlist.load({type, id: '1'}, {watchId: 'sm2', insert: true, ...extra}, {});
  };
  return {harness, playlist, load};
}

describe('Task296 playlist neighbour insertion recovery (Task223 expectations)', () => {
  it('places preceding episodes before the active item without moving existing objects', async () => {
    const {playlist, load} = setup();
    const current = playlist.model.findByWatchId('sm2');
    const next = playlist.model.findByWatchId('sm3');
    const result = await load(['sm1', 'sm2', 'sm3']);
    assert.deepStrictEqual(order(playlist), ['sm9', 'sm1', 'sm2', 'sm3', 'sm8']);
    assert.strictEqual(playlist.model.findByWatchId('sm2'), current);
    assert.strictEqual(playlist.model.findByWatchId('sm3'), next);
    assert.strictEqual(current.isActive, true);
    assert.strictEqual(playlist.getIndex(), 2);
    assert.ok(result.message.includes('1'));
  });

  it('keeps uploaded videos oldest first around the current video', async () => {
    const {playlist, load} = setup();
    await load(['sm3', 'sm2', 'sm1'], 'user-uploaded');
    assert.deepStrictEqual(order(playlist), ['sm9', 'sm1', 'sm2', 'sm3', 'sm8']);
  });

  it('repeated insertion preserves identity and introduces no duplicates', async () => {
    const {playlist, load} = setup();
    await load(['sm1', 'sm2', 'sm3', 'sm3']);
    const first = Array.from(playlist.model.items);
    await load(['sm1', 'sm2', 'sm3']);
    assert.deepStrictEqual(Array.from(playlist.model.items), first);
  });

  it('preserves all existing entries when capacity is full', async () => {
    const {playlist, load} = setup(undefined, 4);
    const result = await load(['sm1', 'sm2', 'sm3', 'sm4']);
    assert.deepStrictEqual(order(playlist), ['sm9', 'sm2', 'sm3', 'sm8']);
    assert.ok(result.message.includes('上限'));
    assert.ok(result.message.includes('2'));
  });

  it('inserts after current when the anchor is absent from the response', async () => {
    const {playlist, load} = setup(undefined, 5);
    const result = await load(['sm4', 'sm5']);
    assert.deepStrictEqual(order(playlist), ['sm9', 'sm2', 'sm4', 'sm3', 'sm8']);
    assert.ok(result.message.includes('上限'));
  });

  it('keeps newly discovered later episodes behind an existing next episode', async () => {
    const {playlist, load} = setup();
    const next = playlist.model.findByWatchId('sm3');
    await load(['sm1', 'sm2', 'sm3', 'sm4']);
    assert.deepStrictEqual(order(playlist), ['sm9', 'sm1', 'sm2', 'sm3', 'sm4', 'sm8']);
    assert.strictEqual(playlist.model.findByWatchId('sm3'), next);
  });

  it('does not change generic mylist insertion order', async () => {
    const {playlist, load} = setup();
    await load(['sm1', 'sm2', 'sm3'], 'mylist');
    assert.deepStrictEqual(order(playlist), ['sm9', 'sm2', 'sm1', 'sm3', 'sm8']);
  });
});
