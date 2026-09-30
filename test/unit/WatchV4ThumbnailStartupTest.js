'use strict';
const assert = require('assert');
const {beginSection, run} = require('../helpers/extractSource');
const {createDialogHarness, flush} = require('../helpers/dialogHarness');

function fixture(thumbnail = {normal: 'https://example.com/normal.jpg', middle: 'https://example.com/middle.jpg', large: 'https://example.com/large.jpg', player: 'https://example.com/player.jpg'}) {
  return {data: {response: {$watchV4: {data: {
    client: {watchId: 'sm46867460', watchTrackId: 'fixture'},
    comment: {threads: [{id: 1, fork: 0, isPostTarget: true}], layers: [{components: [{threadId: 1, fork: 0}]}], ng: {owner: []}, nvComment: {server: 'https://public.nvcomment.nicovideo.jp'}},
    media: {accessRightKey: 'fixture', contents: {videos: [{id: 'video', isAvailable: true}], audios: [{id: 'audio', isAvailable: true}]}},
    video: {id: 'sm46867460', title: 'fixture', duration: 60, count: {}, thumbnail},
    tags: {items: [], edit: {}}, genre: {}, player: {}, payment: {}, viewer: null
  }}}}};
}
function harness(payload) {
  const h = createDialogHarness();
  const c = h.context;
  Object.assign(c, {
    CacheStorage: class {setItem() {}}, sessionStorage: {},
    netUtil: {fetch: async () => ({json: async () => payload})},
    nicoUtil: {hasLargeThumbnail: () => true}, Config: {getValue: () => false},
    emitter: {emitAsync() {}}, debug: {},
    navigator: {mediaSession: {setPositionState() {}, setActionHandler() {}}},
    MediaMetadata: class {
      constructor(data) {
        for (const image of data.artwork || []) {
          if (typeof image.src !== 'string' || !image.src.trim()) throw new TypeError('MediaImage: Required member src is undefined');
        }
        Object.assign(this, data);
      }
    }
  });
  run(beginSection('src/VideoInfo.js') + '\nglobalThis.Model = VideoInfoModel;', c);
  run(beginSection('packages/lib/src/infra/MediaSessionApi.js') + '\nglobalThis.media = MediaSessionApi;', c);
  run(beginSection('packages/lib/src/nico/VideoInfoLoader.js') + '\nglobalThis.infoLoader = VideoInfoLoader;', c);
  return h;
}
describe('Task154 v4 thumbnails through playback startup', function() {
  this.timeout(10000);
  it('maps official normal/middle/large thumbnail names', async () => {
    const h = harness(fixture());
    const data = await h.context.infoLoader.load('sm46867460', {});
    assert.equal(data.watchApiData.videoDetail.thumbnail, 'https://example.com/normal.jpg');
    assert.equal(data.thumbnailUrl, 'https://example.com/large.jpg');
    assert.equal(data._data.video.thumbnail.middleUrl, 'https://example.com/middle.jpg');
  });
  it('reaches session creation and setVideo through the real model and MediaSession', async () => {
    const h = harness(fixture());
    const data = await h.context.infoLoader.load('sm46867460', {});
    h.dialog._requestId = 'r1';
    const pending = h.dialog._onVideoInfoLoaderLoad('r1', [data, {}]);
    let failure;
    pending.catch(e => {failure = e;});
    await flush();
    if (failure) throw failure;
    assert.equal(h.sessionCreate.calls.length, 1);
    const session = h.openedSession('v4');
    h.sessionCreate.calls[0].resolve(session);
    await flush();
    session.connect.calls[0].resolve({url: 'https://example.com/video.m3u8', type: 'domand'});
    await pending;
    assert.equal(h.state.currentSrc, 'https://example.com/video.m3u8');
    assert.equal(h.context.navigator.mediaSession.metadata.artwork[0].src, 'https://example.com/normal.jpg');
  });
  it('allows missing thumbnail artwork without throwing', () => {
    const h = harness(fixture());
    h.context.media.updateByVideoInfo({title: 'video', owner: {name: 'owner'}, duration: 60});
    assert.equal(h.context.navigator.mediaSession.metadata.artwork.length, 0);
  });
  it('omits empty/non-string images but preserves valid alternatives', () => {
    const h = harness(fixture());
    h.context.media.updateByVideoInfo({title: 'video', owner: {}, duration: 60, thumbnail: ' ', betterThumbnail: {}, largeThumbnail: 'https://example.com/large.jpg'});
    assert.equal(h.context.navigator.mediaSession.metadata.artwork.length, 1);
    assert.equal(h.context.navigator.mediaSession.metadata.artwork[0].src, 'https://example.com/large.jpg');
  });
  it('accepts v4 null thumbnails without preventing metadata load', async () => {
    const h = harness(fixture(null));
    const data = await h.context.infoLoader.load('sm46867460', {});
    h.context.media.updateByVideoInfo(new h.context.Model(data));
    assert.equal(h.context.navigator.mediaSession.metadata.artwork.length, 0);
  });
});

