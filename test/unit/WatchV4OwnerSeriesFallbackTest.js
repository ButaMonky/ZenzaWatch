// Task182 (Watch V4 audit F05): when the optional lazy metadata is missing, the owner /
// channel identity carried by the initial V4 data is kept; partial series objects do not
// throw; legacy (V3) owner/series handling is unchanged. All values are synthetic.
const assert = require('assert');
const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');

function v4({owner, metadataOwner, lazyAuth = true} = {}) {
  const data = {
    client: {watchId: 'so9', watchTrackId: 'track'},
    comment: {threads: [{id: 10, fork: 0, isPostTarget: true}], layers: [{index: 1, components: [{threadId: 10, fork: 0}]}], ng: {}, nvComment: {server: 'https://comments.invalid', threadKey: 'fixture'}},
    media: {contents: {videos: [{id: 'v', isAvailable: true}], audios: [{id: 'a', isAvailable: true}]}, accessRightKey: 'fixture', isStoryboardAvailable: false},
    player: {initialPlayback: {positionSec: 0}},
    video: {id: 'so9', title: 'fixture', duration: 300, count: {view: 1}, thumbnail: {url: 'https://example.invalid/t.jpg'}, permission: {}},
    genre: {key: 'anime', label: 'anime'}, tags: {items: [], edit: {isEditable: false}},
    payment: {ppv: {isEnabled: false}, admission: {isEnabled: false}, premium: {isEnabled: false}}, viewer: null
  };
  if (lazyAuth) { data.lazy = {authKey: 'fixture'}; }
  if (owner) { Object.assign(data, owner); }
  if (metadataOwner) { data.metadata = {jsonLd: {owner: metadataOwner}}; }
  return {data: {response: {$watchV4: {data}}}};
}
function loader(payloads, lazy = () => ({meta: {status: 200}, data: {}})) {
  const list = Array.isArray(payloads) ? payloads.slice() : [payloads];
  let current = list[0];
  const context = createContext({
    CacheStorage: class { setItem() {} }, sessionStorage: {},
    netUtil: {fetch: async url => ({json: async () => (String(url).includes('/lazy/') ? lazy() : String(url).includes('/watch/') ? current : {})})},
    nicoUtil: {hasLargeThumbnail: () => false}, textUtil: {}, Config: {getValue: () => false},
    emitter: {emitAsync() {}}, debug: {}, console: {error() {}, info() {}, warn() {}, log() {}, time() {}, timeEnd() {}}
  });
  run(beginSection('packages/lib/src/nico/VideoInfoLoader.js') + ';globalThis.loader=VideoInfoLoader;', context);
  return {load: async id => { current = list.length ? list.shift() : current; return context.loader.load(id, {}); }};
}
const legacy = () => JSON.parse(JSON.stringify(require('../fixtures/watch-legacy-darasan.sanitized.json')));
function model(series) {
  const context = createContext({JSONable: class {}, DmcInfo: class {}, DomandInfo: class {}});
  const Model = loadClass('src/VideoInfo.js', 'VideoInfoModel', context);
  const m = new Model({watchApiData: {videoDetail: {id: 'so9'}}, series});
  Object.defineProperty(m, 'betterThumbnail', {value: ''});
  return m;
}

describe('Task182 V4 owner/channel fallback and partial series (Watch V4 audit F05)', () => {
  it('keeps the initial channel identity when lazy metadata has no owner', async () => {
    const r = await loader(v4({metadataOwner: {type: 'channel', id: 'ch9', name: 'fixture-channel', iconUrl: 'https://example.invalid/i.jpg'}})).load('so9');
    assert.strictEqual(r.watchApiData.channelInfo.id, 'ch9');
    assert.strictEqual(r.watchApiData.channelInfo.name, 'fixture-channel');
    assert.strictEqual(r.watchApiData.channelInfo.iconUrl, 'https://example.invalid/i.jpg');
    assert.strictEqual(r.isPlayable, true);
  });

  it('keeps the initial user identity when lazy fails', async () => {
    const r = await loader(v4({metadataOwner: {type: 'user', id: '12345', name: 'fixture-user', iconUrl: 'https://example.invalid/u.jpg'}}), () => { throw Error('offline'); }).load('so9');
    assert.strictEqual(r.watchApiData.uploaderInfo.id, '12345');
    assert.strictEqual(r.watchApiData.uploaderInfo.name, 'fixture-user');
    assert.strictEqual(r.watchApiData.channelInfo, undefined);
  });

  it('a lazy owner still wins over the initial metadata', async () => {
    const r = await loader(v4({metadataOwner: {type: 'channel', id: 'ch9', name: 'initial'}}),
      () => ({meta: {status: 200}, data: {owner: {type: 'channel', id: 'ch7', name: 'lazy', thumbnail: {url: 'https://example.invalid/c.jpg'}}}})).load('so9');
    assert.strictEqual(r.watchApiData.channelInfo.id, 'ch7');
  });

  it('does not accept a video/watch ID or a malformed record as an owner', async () => {
    for (const metadataOwner of [{type: 'user', id: 'so9', name: 'x'}, {type: 'user', id: '1234567890x'}, {type: 'channel', id: '123', name: 'x'}, {type: 'unknown', id: 'ch9'}, 'ch9']) {
      const r = await loader(v4({metadataOwner})).load('so9');
      assert.strictEqual(r.watchApiData.channelInfo, undefined, JSON.stringify(metadataOwner));
      assert.strictEqual(r.watchApiData.uploaderInfo, null, JSON.stringify(metadataOwner));
    }
  });

  it('a lazy channel owner without a thumbnail does not break parsing', async () => {
    const r = await loader(v4(), () => ({meta: {status: 200}, data: {owner: {type: 'channel', id: 'ch7', name: 'lazy'}}})).load('so9');
    assert.strictEqual(r.watchApiData.channelInfo.id, 'ch7');
  });

  it('partial series objects do not throw and missing neighbours are null', () => {
    assert.strictEqual(model({id: 1}).nextVideo, null);
    assert.strictEqual(model({id: 1}).prevVideo, null);
    assert.strictEqual(model({id: 1}).firstVideo, null);
    assert.strictEqual(model({id: 1, video: {prev: {id: 'so1'}}}).nextVideo, null);
    assert.strictEqual(model({id: 1, video: {prev: {id: 'so1'}}}).prevVideo.id, 'so1');
    assert.strictEqual(model(null).nextVideo, null);
  });

  it('legacy owner/series stay intact across V3 -> V4 -> V3', async () => {
    const h = loader([legacy(), v4({metadataOwner: {type: 'user', id: '12345', name: 'fixture-user'}}), legacy()]);
    const a = await h.load('so46839011');
    assert.strictEqual(a.watchApiData.channelInfo.id, 'ch2650171');
    assert.strictEqual(a.series.id, 567062);
    const b = await h.load('so9');
    assert.strictEqual(b.watchApiData.uploaderInfo.id, '12345');
    assert.strictEqual(b.watchApiData.channelInfo, undefined);
    const c = await h.load('so46839011');
    assert.strictEqual(c.watchApiData.channelInfo.id, 'ch2650171');
    assert.strictEqual(c.series.video.next, null);
  });
});
