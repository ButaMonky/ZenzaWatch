// Task172 (Watch V4 audit F01): the parent-work / content-tree entry must not be
// hidden just because the V4 watch response carries no content-tree flag.
const assert = require('assert');
const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');

function v4Payload(external) {
  const data = {
    client: {watchId: 'sm9', watchTrackId: 'track'},
    comment: {threads: [{id: 10, fork: 0, isPostTarget: true}], layers: [{index: 1, components: [{threadId: 10, fork: 0}]}], ng: {}, nvComment: {server: 'https://comments.example', threadKey: 'fixture'}},
    media: {contents: {videos: [{id: 'video', isAvailable: true}], audios: [{id: 'audio', isAvailable: true}]}, accessRightKey: 'fixture', isStoryboardAvailable: true},
    player: {initialPlayback: {positionSec: 0}},
    video: {id: 'sm9', title: 'test', duration: 60, count: {view: 1}, thumbnail: {url: 'thumb'}, permission: {}},
    genre: {key: 'music', label: 'music'}, tags: {items: [], edit: {isEditable: false}},
    payment: {ppv: {isEnabled: false}, admission: {isEnabled: false}, premium: {isEnabled: false}}, viewer: null
  };
  if (external !== undefined) { data.external = external; }
  return {data: {response: {$watchV4: {data}}}};
}
function legacyPayload(hasContentTree) {
  const p = v4Payload();
  const d = p.data.response.$watchV4.data;
  Object.assign(d, {external: {commons: {hasContentTree}}, media: {domand: {videos: [], audios: []}}, payment: {video: {}}, tag: d.tags, owner: {id: 1, nickname: 'legacy'}});
  d.comment.keys = {}; d.comment.server = {url: 'legacy'};
  d.comment.threads[0].isDefaultPostTarget = true;
  d.comment.layers[0].threadIds = [{id: 10, fork: 0}];
  p.data.response = d;
  return p;
}
function loader(payload) {
  const calls = [];
  const context = createContext({
    CacheStorage: class { setItem() {} }, sessionStorage: {},
    netUtil: {fetch: async (url, options) => { calls.push(url); return {json: async () => payload}; }},
    nicoUtil: {hasLargeThumbnail: () => false}, textUtil: {}, Config: {getValue: () => false},
    emitter: {emitAsync() {}}, debug: {}, console: {error() {}, info() {}, warn() {}, log() {}, time() {}, timeEnd() {}}
  });
  run(beginSection('packages/lib/src/nico/VideoInfoLoader.js') + ';globalThis.loader=VideoInfoLoader;', context);
  return {load: (id = 'sm9') => context.loader.load(id, {}), calls, setPayload(next) { payload = next; }};
}
// Anonymised legacy (data.response without $watchV4) record of 2026-10-01, Darasan follow-up.
const legacyRecord = () => JSON.parse(JSON.stringify(require('../fixtures/watch-legacy-darasan.sanitized.json')));
function model(commonsTreeExists, videoId = 'sm9') {
  const context = createContext({JSONable: class {}, DmcInfo: class {}, DomandInfo: class {}});
  const Model = loadClass('src/VideoInfo.js', 'VideoInfoModel', context);
  const detail = {v: videoId, id: videoId};
  if (commonsTreeExists !== undefined) { detail.commons_tree_exists = commonsTreeExists; }
  return new Model({watchApiData: {videoDetail: detail}});
}
function menu() {
  const states = [];
  const attr = () => ({setAttribute() {}});
  const context = createContext({
    BaseViewComponent: class {
      constructor() {}
      setState(s) { states.push(s); }
      emit() {}
    }
  });
  const Menu = loadClass('src/VideoInfoPanel.js', 'RelatedInfoMenu', context);
  const m = Object.create(Menu.prototype);
  Object.assign(m, {_view: {open: true}, _ginzaLink: attr(), _originalLink: attr(), _twitterLink: attr(), _parentVideoLink: attr()});
  return {m, states};
}

describe('Task172 content-tree entry (Watch V4 audit F01)', () => {
  it('keeps an absent V4 content-tree flag unknown instead of false', async () => {
    const h = loader(v4Payload());
    const r = await h.load();
    assert.strictEqual(r.watchApiData.videoDetail.commons_tree_exists, null);
    assert(!h.calls.some(url => /commons/.test(String(url))), 'no parent/child request during initial load: ' + h.calls.join(' '));
  });

  it('honours explicit V4 and legacy true/false flags', async () => {
    assert.strictEqual((await loader(v4Payload({commons: {hasContentTree: true}})).load()).watchApiData.videoDetail.commons_tree_exists, true);
    assert.strictEqual((await loader(v4Payload({commons: {hasContentTree: false}})).load()).watchApiData.videoDetail.commons_tree_exists, false);
    assert.strictEqual((await loader(legacyPayload(true)).load()).watchApiData.videoDetail.commons_tree_exists, true);
    assert.strictEqual((await loader(legacyPayload(false)).load()).watchApiData.videoDetail.commons_tree_exists, false);
  });

  it('keeps the real legacy-record value true and its channel/series/thread forks', async () => {
    const r = await loader(legacyRecord()).load('so46839011');
    assert.strictEqual(r.watchApiData.videoDetail.commons_tree_exists, true);
    assert.strictEqual(r.watchApiData.channelInfo.id, 'ch2650171');
    assert.strictEqual(r.series.id, 567062);
    assert.deepStrictEqual(Array.from(r.msgInfo.threads, t => [t.id, t.fork]),
      [[1790214592, 1], [1790214592, 0], [1790214593, 0], [1790214593, 2]]);
    assert.strictEqual(r.msgInfo.defaultThread.id, 1790214593);
  });

  it('decides old/new shape per response across V3 -> V4 -> V3 loads', async () => {
    const h = loader(legacyRecord());
    assert.strictEqual((await h.load('so46839011')).watchApiData.videoDetail.commons_tree_exists, true);
    h.setPayload(v4Payload());
    assert.strictEqual((await h.load('sm9')).watchApiData.videoDetail.commons_tree_exists, null);
    const legacyFalse = legacyRecord();
    legacyFalse.data.response.external.commons.hasContentTree = false;
    h.setPayload(legacyFalse);
    const r = await h.load('so46839011');
    assert.strictEqual(r.watchApiData.videoDetail.commons_tree_exists, false);
    assert.strictEqual(r.watchApiData.channelInfo.id, 'ch2650171');
  });

  it('separates existence (true/false/unknown) from the ability to open the tree', () => {
    const unknown = model(null);
    assert.strictEqual(unknown.contentTreeState, 'unknown');
    assert.strictEqual(unknown.hasParentVideo, false, 'unknown is not reported as an existing parent');
    assert.strictEqual(unknown.canOpenContentTree, true);
    assert.strictEqual(model(undefined).contentTreeState, 'unknown');

    const exists = model(true);
    assert.strictEqual(exists.contentTreeState, 'exists');
    assert.strictEqual(exists.hasParentVideo, true);
    assert.strictEqual(exists.canOpenContentTree, true);

    const none = model(false);
    assert.strictEqual(none.contentTreeState, 'none');
    assert.strictEqual(none.hasParentVideo, false);
    assert.strictEqual(none.canOpenContentTree, false);
  });

  it('opens the tree only for a real video ID, not a bare numeric watch ID', () => {
    assert.strictEqual(model(null, 'so123').canOpenContentTree, true);
    assert.strictEqual(model(null, 'nm456').canOpenContentTree, true);
    assert.strictEqual(model(null, '1234567890').canOpenContentTree, false);
    assert.strictEqual(model(null, '').canOpenContentTree, false);
  });

  it('shows both related-menu entries for V4 unknown and hides them for explicit false', () => {
    const shown = menu();
    shown.m.update({watchId: 'sm9', videoId: 'sm9', hasParentVideo: false, canOpenContentTree: true});
    assert.strictEqual(shown.states[0].isParentVideoExist, true);
    const hidden = menu();
    hidden.m.update({watchId: 'sm9', videoId: 'sm9', hasParentVideo: false, canOpenContentTree: false});
    assert.strictEqual(hidden.states[0].isParentVideoExist, false);
  });
});
