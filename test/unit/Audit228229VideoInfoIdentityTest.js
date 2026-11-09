'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

// A/B/C are synthetic, with no actual viewing history or authenticated API payload.
function setup() {
  const events = [];
  const context = createContext({
    Emitter: class {}, JSONable: class {},
    global: {debug: {}}, CONSTANT: {}, _: {debounce: v => v},
    DmcInfo: class {}, DomandInfo: class {}
  });
  const code = [
    extract('src/State.js', 'BaseState'),
    extract('src/State.js', 'PlayerState'),
    extract('src/VideoInfo.js', 'VideoInfoModel'),
    'globalThis.Classes = {PlayerState, VideoInfoModel};'
  ].join('\n');
  run(code, context);
  const {PlayerState, VideoInfoModel} = context.Classes;
  const state = Object.create(PlayerState.prototype);
  state.emit = (name, value) => events.push([name, value]);
  const info = (id, cache = {}) => new VideoInfoModel({
    watchApiData: {videoDetail: {id, v: id, length: 120,
      commentCount: 0, mylistCount: 0, viewCount: 0}},
    thumbnail: id + '.jpg', viewerInfo: {}, ngFilters: {},
    msgInfo: {}, resumeInfo: {}
  }, cache);
  return {state, info, events, context};
}
describe('Issues #228/#229 VideoInfo model identity and cache ownership', () => {
  it('second video replaces state model and event points to exactly that instance', () => {
    const h = setup();
    const a = h.info('smA', {resumeOverride: 12, resumeClearedAt: 30});
    const b = h.info('smB', {resumeOverride: 88, resumeClearedAt: 40});
    h.state.videoInfo = a;
    h.state.videoInfo = b;
    assert.strictEqual(h.state.videoInfo, b);
    assert.strictEqual(h.events[1][1], h.state.videoInfo);
    assert.strictEqual(h.context.global.debug.videoInfo, b);
    assert.strictEqual(h.state.videoInfo.videoId, 'smB');
    assert.strictEqual(h.state.videoInfo._cacheData.resumeOverride, 88);
    assert.strictEqual(h.state.videoInfo._cacheData.resumeClearedAt, 40);
    assert.strictEqual(h.state.thumbnail, 'smB.jpg');
  });
  it('A→B→C does not retain earlier resume override/deletion barrier', () => {
    const h = setup();
    h.state.videoInfo = h.info('smA', {resumeOverride: 20, resumeClearedAt: 5});
    h.state.videoInfo = h.info('smB', {resumeOverride: 40});
    h.state.videoInfo = h.info('smC', {});
    assert.strictEqual(h.state.videoInfo.videoId, 'smC');
    assert.strictEqual(h.state.videoInfo._cacheData.resumeOverride, undefined);
    assert.strictEqual(h.state.videoInfo._cacheData.resumeClearedAt, undefined);
    assert.strictEqual(h.events[2][1], h.state.videoInfo);
    h.state.videoInfo = null;
    assert.strictEqual(h.state.videoInfo, null);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(h.state.videoCount)), {});
    assert.strictEqual(h.events[3][1], null);
  });
  it('explicit in-place VideoInfoModel.update carries the incoming cache, not the old cache', () => {
    const h = setup();
    const a = h.info('smA', {resumeOverride: 10, resumeClearedAt: 15});
    const b = h.info('smB', {resumeOverride: 70, resumeClearReason: 'manual'});
    a.update(b);
    assert.strictEqual(a.videoId, 'smB');
    assert.strictEqual(a._cacheData.resumeOverride, 70);
    assert.strictEqual(a._cacheData.resumeClearedAt, undefined);
    assert.strictEqual(a._cacheData.resumeClearReason, 'manual');
    a.update(h.info('smC', {}));
    assert.strictEqual(a._cacheData.resumeClearReason, undefined);
  });
});
