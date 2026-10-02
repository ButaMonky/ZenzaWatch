// Task195 (Commons auto-fetch F, audit A08): an incomplete (ID-only) playlist item keeps that status
// across serialize -> restore, can then be completed in place (same item, ID and position), and the
// old save format without the marker still loads as a complete item. Hints never confirm duration/counts,
// and complete items are never overwritten by incomplete data. Synthetic data only.
const assert = require('assert');
const {createPlaylistContext} = require('../helpers/playlistHarness');

const videoInfo = id => ({watchId: id, title: `full ${id}`, duration: 120, count: {comment: 5, mylist: 6, view: 7},
  thumbnail: 'https://example.invalid/full.jpg', postedAt: '2020/02/02 00:00:00'});
const thumbInfo = id => ({id, title: `thumb ${id}`, duration: 90, commentCount: 1, mylistCount: 2, viewCount: 3,
  thumbnail: 'https://example.invalid/t.jpg', postedAt: '2020/03/03 00:00:00'});

describe('Task195 incomplete playlist items survive save/restore', () => {
  it('serialize -> new VideoListItem keeps the incomplete status (A08)', () => {
    const {VideoListItem} = createPlaylistContext();
    const blank = VideoListItem.createBlankInfo('sm1', {title: 'hint'});
    const saved = JSON.parse(JSON.stringify(blank.serialize()));
    assert.strictEqual(saved.incomplete, true);
    const restored = new VideoListItem(saved);
    assert.strictEqual(restored.isBlankData, true);
    restored.updateByVideoInfo(videoInfo('sm1'));
    assert.strictEqual(restored.title, 'full sm1');
    assert.strictEqual(restored.duration, 120);
    assert.strictEqual(restored.isBlankData, false);
  });

  it('old saves without the marker load as complete (no blanket migration)', () => {
    const {VideoListItem, raw} = createPlaylistContext();
    const restored = new VideoListItem(raw('sm2'));
    assert.strictEqual(restored.isBlankData, false);
    assert.strictEqual(JSON.parse(JSON.stringify(restored.serialize())).incomplete, undefined);
  });

  it('a restored incomplete item is completed in place in the model (identity, position, state kept)', () => {
    const {PlayListModel, VideoListItem, item} = createPlaylistContext();
    const m = new PlayListModel({});
    const blank = VideoListItem.createBlankInfo('sm3');
    m.setItem([item('sm1'), blank, item('sm4')]);
    const data = JSON.parse(JSON.stringify(m.serialize()));
    const m2 = new PlayListModel({});
    m2.unserialize(data);
    const target = m2.findByWatchId('sm3');
    target.isPlayed = true;
    const itemId = target.itemId;
    assert.strictEqual(target.isBlankData, true);
    assert.strictEqual(target.upgradeByThumbInfo(thumbInfo('sm3')), true);
    assert.strictEqual(m2.findByWatchId('sm3'), target);
    assert.strictEqual(target.itemId, itemId);
    assert.strictEqual(m2.indexOf(target), 1);
    assert.strictEqual(target.isPlayed, true);
    assert.strictEqual(target.title, 'thumb sm3');
    assert.strictEqual(target.duration, 90);
    assert.strictEqual(target.isBlankData, false);
    assert.strictEqual(JSON.parse(JSON.stringify(target.serialize())).incomplete, undefined);
  });

  it('hints update only title/thumbnail of incomplete items and never confirm the rest', () => {
    const {VideoListItem, item} = createPlaylistContext();
    const blank = VideoListItem.createBlankInfo('sm5');
    assert.strictEqual(blank.applyHint({title: 'meta title', thumbnailUrl: 'https://example.invalid/m.jpg'}), true);
    assert.strictEqual(blank.title, 'meta title(動画情報不明)');
    assert.strictEqual(blank.thumbnail, 'https://example.invalid/m.jpg');
    assert.strictEqual(blank.isBlankData, true, 'still incomplete');
    assert.strictEqual(blank.applyHint({thumbnailUrl: 'javascript:alert(1)'}), false);
    const full = item('sm6');
    assert.strictEqual(full.applyHint({title: 'x'}), false);
    assert.strictEqual(full.upgradeByThumbInfo(thumbInfo('sm6')), false, 'complete data is not overwritten');
    assert.strictEqual(full.title, 'title sm6');
    assert.strictEqual(full.duration, 60);
  });

  it('a thumb info without a title does not complete the item', () => {
    const {VideoListItem} = createPlaylistContext();
    const blank = VideoListItem.createBlankInfo('sm7');
    assert.strictEqual(blank.upgradeByThumbInfo({id: 'sm7'}), false);
    assert.strictEqual(blank.isBlankData, true);
  });
});
