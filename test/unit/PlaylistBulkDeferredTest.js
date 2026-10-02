// Task196 (Commons auto-fetch B/C/E/G): a large ID list (e.g. 997 commons candidates) is added in one
// step without waiting for ~1000 getthumbinfo loads; order is stable (no reversed batches behind the
// active item); existing items are not re-fetched; overflow beyond the 10,000-item playlist is reported
// and kept, never silently dropped; details are filled only for visible items with low concurrency.
const assert = require('assert');
const {createPlaylistContext, flush} = require('../helpers/playlistHarness');

const ids = (n, from = 1) => Array.from({length: n}, (_, i) => `sm${from + i}`);
function setup({maxItems} = {}) {
  const ctx = createPlaylistContext();
  const p = ctx.createPlaylist({maxItems});
  const loads = [];
  let running = 0, peak = 0;
  p._thumbInfoLoader = {load: async id => {
    loads.push(id); running++; peak = Math.max(peak, running);
    await new Promise(r => setTimeout(r, 1));
    running--;
    if (id === 'sm13') { throw {status: 'fail'}; }
    return {id, title: `thumb ${id}`, duration: 100, commentCount: 1, mylistCount: 1, viewCount: 1, thumbnail: 'https://example.invalid/t.jpg', postedAt: '2020/01/01 00:00:00'};
  }};
  return {...ctx, p, loads, peak: () => peak};
}
const order = p => Array.from(p.model.items, i => i.watchId);

describe('Task196 bulk add without waiting for details', () => {
  it('997 IDs are added at once with zero detail loads while nothing is visible', async () => {
    const s = setup();
    const report = {};
    const hints = {sm1: {title: 'hint 1'}};
    const added = await s.p.appendWatchIds(ids(997), {deferDetails: true, hints, report});
    await flush(5);
    assert.strictEqual(added, 997);
    assert.strictEqual(s.loads.length, 0, 'no getthumbinfo for the whole list');
    assert.deepStrictEqual(order(s.p), ids(997));
    assert(s.p.model.items.every(i => i.isBlankData));
    assert.strictEqual(s.p.model.items[0].title, 'hint 1(動画情報不明)');
    assert.strictEqual(report.added, 997);
    assert.strictEqual(report.overflow.length, 0);
  });

  it('inserting behind the active item keeps the given order (no reversed batches) and skips existing items', async () => {
    const s = setup();
    s.p.model.setItem([s.item('sm900'), s.item('sm2'), s.item('sm901')]);
    s.p.setIndex(0);
    s.p.model.items[0].isActive = true;
    const report = {};
    await s.p.appendWatchIds(['smP', 'sm1', 'sm2', 'sm3', 'sm4'].map(x => x === 'smP' ? 'sm500' : x), {deferDetails: true, insert: true, report});
    assert.deepStrictEqual(order(s.p), ['sm900', 'sm500', 'sm1', 'sm3', 'sm4', 'sm2', 'sm901']);
    assert.strictEqual(report.existing, 1);
    assert.strictEqual(s.p.model.findByWatchId('sm2').isBlankData, false, 'existing complete item untouched');
    assert.strictEqual(s.loads.length, 0);
  });

  it('overflow beyond the playlist capacity is reported, existing items are kept', async () => {
    const s = setup({maxItems: 100});
    s.p.model.setItem(ids(90, 5000).map(id => s.item(id)));
    s.p.model.items[0].isActive = true;
    const report = {};
    const added = await s.p.appendWatchIds(ids(25), {deferDetails: true, report});
    assert.strictEqual(added, 10);
    assert.strictEqual(s.p.model.length, 100);
    assert.deepStrictEqual(Array.from(report.overflow), ids(15, 11));
    assert(ids(90, 5000).every(id => s.p.model.findByWatchId(id)), 'no existing item dropped');
  });

  it('the real 10,000 capacity: 9,900 existing + 997 candidates -> 100 added, 897 kept as overflow', async () => {
    const s = setup();
    assert.strictEqual(s.p.model.maxItems, 10000);
    s.p.model.setItem(ids(9900, 100000).map(id => s.item(id)));
    const report = {};
    const added = await s.p.appendWatchIds(ids(997), {deferDetails: true, report});
    assert.strictEqual(added, 100);
    assert.strictEqual(report.overflow.length, 897);
    assert.strictEqual(s.p.model.length, 10000);
  });

  it('only visible incomplete items load details, at most 2 at a time, completed in place; failures keep the ID', async () => {
    const s = setup();
    await s.p.appendWatchIds(ids(50), {deferDetails: true});
    const visible = s.p.model.items.slice(10, 16);
    const before = Array.from(visible, i => i.itemId);
    visible.forEach(i => { i.isLazy = false; });
    for (let k = 0; k < 40 && s.p.model.items.slice(10, 16).some(i => i.isBlankData && !i.state.detailFailed); k++) { await flush(3); await new Promise(r => setTimeout(r, 2)); }
    assert.deepStrictEqual(Array.from(s.loads).sort(), ids(6, 11).sort());
    assert(s.peak() <= 2);
    assert.deepStrictEqual(Array.from(s.p.model.items.slice(10, 16), i => i.itemId), before, 'same items, same positions');
    assert.strictEqual(s.p.model.findByWatchId('sm11').title, 'thumb sm11');
    assert.strictEqual(s.p.model.findByWatchId('sm13').isBlankData, true);
    assert.strictEqual(s.p.model.findByWatchId('sm13').state.detailFailed, true);
    assert.strictEqual(s.p.model.length, 50);
  });

  it('a cancelled job adds nothing', async () => {
    const s = setup();
    assert.strictEqual(await s.p.appendWatchIds(ids(5), {deferDetails: true, isCancelled: () => true}), null);
    assert.strictEqual(s.p.model.length, 0);
  });

  it('hints update incomplete items only', async () => {
    const s = setup();
    s.p.model.setItem([s.item('sm1')]);
    await s.p.appendWatchIds(['sm1', 'sm2'], {deferDetails: true});
    const n = s.p.applyHints(new Map([['sm1', {title: 'x'}], ['sm2', {title: 'meta 2'}]]));
    assert.strictEqual(n, 1);
    assert.strictEqual(s.p.model.findByWatchId('sm1').title, 'title sm1');
    assert.strictEqual(s.p.model.findByWatchId('sm2').title, 'meta 2(動画情報不明)');
  });

  it('the existing (non-deferred) path is unchanged', async () => {
    const s = setup();
    await s.p.appendWatchIds(['sm1', 'sm2'], {});
    assert.strictEqual(s.loads.length, 2);
    assert.strictEqual(s.p.model.findByWatchId('sm1').isBlankData, false);
  });
});
