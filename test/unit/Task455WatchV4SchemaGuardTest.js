// Task455 NICOCOMPAT-04 phase 2: reject malformed watchV4 safely.
// All fixtures are synthetic; no live NicoNico calls, authentication or raw HAR.
'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function watchV4() {
  return {
    client: {watchId: 'sm9', watchTrackId: 'track'},
    metadata: {jsonLd: {owner: {type: 'user', id: '123', name: 'fixture'}}},
    comment: {threads: [], layers: [], ng: {owner: [], channel: []},
      nvComment: {server: 'https://public.nvcomment.nicovideo.jp', threadKey: 'synthetic-key'}},
    media: {accessRightKey: 'synthetic-access', contents: {videos: [{id: 'v'}], audios: [{id: 'a'}]}},
    player: {initialPlayback: {positionSec: 2}},
    video: {id: 'sm9', title: 'fixture', description: 'fixture',
      duration: 60, registeredAt: '2026-10-01T00:00:00Z',
      count: {view: 1, comment: 0, like: 0, mylist: 0},
      thumbnail: {url: 'https://example.invalid/thumbnail.png'},
      isLikedByViewer: false},
    genre: {key: 'music', label: 'music'},
    tags: {items: [], edit: {isEditable: false}},
    payment: {ppv: {isEnabled: false}, admission: {isEnabled: false},
      premium: {isEnabled: false}}
  };
}
function harness(data) {
  const calls = [], events = [];
  const context = createContext({
    CacheStorage: class {setItem() {}},
    sessionStorage: {},
    netUtil: {fetch: async (url) => {
      calls.push(String(url));
      return {json: async () => ({data: {response: {$watchV4: {data}}}})};
    }},
    nicoUtil: {hasLargeThumbnail: () => false},
    textUtil: {}, Config: {getValue: () => false},
    emitter: {emitAsync: (...args) => events.push(args)},
    debug: {},
    console: {log() {}, error() {}, warn() {}, info() {}, time() {}, timeEnd() {}}
  });
  run(beginSection('packages/lib/src/nico/VideoInfoLoader.js') +
    ';globalThis.__watchLoader=VideoInfoLoader;', context);
  return {load: () => context.__watchLoader.load('sm9', {}), calls, events};
}
async function rejectsSchema(data) {
  const h = harness(data);
  const err = await h.load().then(() => null, e => e);
  assert(err, 'malformed watchV4 is never accepted as playable');
  assert.equal(err.reason, 'watch api', 'no raw TypeError or invented network failure');
  assert.equal(err.errorCode, 'WATCH_SCHEMA', 'fixed machine-readable diagnosis');
  assert.equal(h.calls.length, 1, 'reject before optional lazy metadata fetch');
  assert.equal(h.events.length, 0, 'do not emit a valid video on schema failure');
  return err;
}
describe('Task455: malformed watchV4 does not break the entire player', () => {
  it('retains the valid canonical V4 payload and playable media', async () => {
    const data = watchV4();
    const h = harness(data), before = JSON.stringify(data);
    const result = await h.load();
    assert.equal(result.isPlayable, true);
    assert.equal(result.watchApiData.videoDetail.id, 'sm9');
    assert.equal(result.msgInfo.canPost, false);
    assert.equal(h.calls.length, 1);
    assert.equal(JSON.stringify(data), before, 'do not mutate incoming watch data');
  });
  it('rejects missing video identity, count and title', async () => {
    for (const change of [
      d => {delete d.video;},
      d => {delete d.video.id;},
      d => {d.video.title = 3;},
      d => {delete d.video.count;}
    ]) {
      const data = watchV4(); change(data); await rejectsSchema(data);
    }
  });
  it('permits null or missing optional thumbnail artwork', async () => {
    for (const value of [null, undefined]) {
      const data = watchV4();
      if (value === undefined) {delete data.video.thumbnail;}
      else {data.video.thumbnail = value;}
      const result = await harness(data).load();
      assert.equal(result.isPlayable, true);
      assert.equal(result.watchApiData.videoDetail.id, 'sm9');
    }
  });
  it('rejects non-finite, negative and string video durations', async () => {
    for (const duration of [-1, Number.NaN, Infinity, '60']) {
      const data = watchV4(); data.video.duration = duration;
      await rejectsSchema(data);
    }
  });
  it('rejects invalid tags, player and genre without throwing destructuring errors', async () => {
    for (const change of [
      d => {delete d.tags;},
      d => {d.tags.items = null;},
      d => {delete d.genre;},
      d => {delete d.player;},
      d => {d.player = [];}
    ]) {
      const data = watchV4(); change(data); await rejectsSchema(data);
    }
  });
  it('rejects invalid client identity before optional authenticated metadata', async () => {
    for (const change of [
      d => {delete d.client;},
      d => {d.client.watchId = null;},
      d => {d.client.watchTrackId = [];}
    ]) {
      const data = watchV4(); data.lazy = {authKey: 'synthetic-lazy'};
      change(data); await rejectsSchema(data);
    }
  });
  it('missing optional lazy track ID never triggers an authenticated lazy fetch', async () => {
    const data = watchV4(); delete data.client.watchTrackId;
    data.lazy = {authKey: 'synthetic-lazy'};
    const h = harness(data), result = await h.load();
    assert.equal(result.isPlayable, true);
    assert.equal(h.calls.length, 1);
  });
  it('optional comments may be missing without inventing a post target', async () => {
    const data = watchV4();delete data.comment;
    const result = await harness(data).load();
    assert.equal(result.isPlayable, true);
    assert.equal(result.msgInfo.canPost, false);
    assert.ok(result.msgInfo.commentMetadataIssues.length);
  });
  it('a video without media remains non-playable, not schema-corrupt', async () => {
    const data = watchV4();data.media = null;
    const err = await harness(data).load().then(() => null, e => e);
    assert(err);assert.notEqual(err.errorCode, 'WATCH_SCHEMA');
    assert.equal(err.info?.isPlayable, false);
  });
});
