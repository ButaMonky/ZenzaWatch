'use strict';

const assert = require('node:assert/strict');
const {beginSection, createContext, run} = require('../helpers/extractSource');
const fixture = require('../fixtures/watch-legacy-darasan.sanitized.json');
const id = fixture.data.response.video.id;

function setup(extra = {}) {
  const requests = [], events = [];
  const context = createContext({
    AbortController, CacheStorage: class {setItem() {}}, sessionStorage: {},
    debug: {}, Config: {getValue: () => false}, textUtil: {},
    nicoUtil: {hasLargeThumbnail: () => false},
    emitter: {emitAsync: (...args) => events.push(args)},
    console: {log(){}, info(){}, warn(){}, error(){}, time(){}, timeEnd(){}},
    setTimeout: fn => queueMicrotask(fn),
    netUtil: {fetch(url, options) {
      return new Promise((resolve, reject) => {
        requests.push({url, signal: options.signal, respond: data => resolve({json: async () => data}), raw: resolve, reject});
        options.signal?.addEventListener('abort', () => reject(Error('aborted')), {once:true});
      });
    }},
    ...extra
  });
  run(beginSection('packages/lib/src/nico/VideoInfoLoader.js') + '\nglobalThis.loader = VideoInfoLoader;', context);
  return {loader: context.loader, requests, events};
}

describe('Task1101 first local open watch-page read', () => {
  function watchWithLazyOwner() {
    const legacy = fixture.data.response;
    return {data:{response:{$watchV4:{data:{
      ...legacy, lazy:{authKey:'test'}, client:{...legacy.client,watchId:id,watchTrackId:'test'},
      tags:legacy.tag, metadata:{jsonLd:{owner:{id:'123',type:'user',name:'fallback'}}},
      media:{accessRightKey:'test',contents:{videos:[{id:'v'}],audios:[{id:'a'}]}}
    }}}}};
  }

  it('starts optional V4 metadata on the first click and reuses it without publishing early', async () => {
    const {loader, requests, events} = setup();
    const intent = {};
    loader.beginFirstOpenPageRead(id, intent);
    requests[0].respond(watchWithLazyOwner());
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 2);
    assert.match(requests[1].url, /watch\/lazy\//);
    assert.deepEqual(events, []);
    const load = loader.load(id, {}, intent);
    requests[1].respond({meta:{status:200},data:{series:{id:321}}});
    const result = await load;
    assert.equal(result.isPlayable, true);
    assert.equal(result.series.id, 321);
    assert.equal(requests.length, 2);
  });

  it('continues with the embedded owner when an optional HTTP body stalls after headers', async () => {
    let deadline, cancelled = false;
    const {loader, requests} = setup({Response, TransformStream, AbortController,
      setTimeout(fn, ms) { if (ms > 0 && ms <= 5000) deadline = fn; return 1; },
      clearTimeout() {}});
    const load = loader.load(id, {});
    requests[0].respond(watchWithLazyOwner());
    await new Promise(resolve => setImmediate(resolve));
    requests[1].raw(new Response(new ReadableStream({cancel(){ cancelled = true; }})));
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof deadline, 'function');
    deadline();
    const result = await load;
    assert.equal(result.isPlayable, true);
    assert.equal(String(result.watchApiData.uploaderInfo.id), '123');
    assert.equal(cancelled, true);
    assert.equal(requests.length, 2);
  });

  it('cancels a partially received optional body when the first click is superseded', async () => {
    const {loader, requests, events} = setup({Response, TransformStream, setTimeout, clearTimeout});
    const abandon = loader.beginFirstOpenPageRead(id, {});
    requests[0].respond(watchWithLazyOwner());
    await new Promise(resolve => setImmediate(resolve));
    let cancelled = false;
    requests[1].raw(new Response(new ReadableStream({cancel(){ cancelled = true; }})));
    await new Promise(resolve => setImmediate(resolve));
    loader.beginFirstOpenPageRead('sm2', {})();
    abandon();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(cancelled, true);
    assert.equal(requests.length, 3);
    assert.deepEqual(events, []);
  });

  it('uses the owner lookup fallback if the optional nicoad body never finishes', async () => {
    let deadline, cancelled = false;
    const {loader, requests} = setup({Response, TransformStream,
      setTimeout(fn, ms) { if (ms > 0 && ms <= 3000) deadline = fn; return 1; },
      clearTimeout() {},
      NicoSearchApiV2Loader: {lookupOwnerIds: async () => new Map([['sm9', {userId:'456'}]])}});
    const payload = watchWithLazyOwner();
    const video = payload.data.response.$watchV4.data;
    video.video = {...video.video, id:'sm9'};
    video.client.watchId = 'sm9';
    delete video.metadata;
    delete video.lazy;
    const load = loader.load('sm9', {});
    requests[0].respond(payload);
    await new Promise(resolve => setImmediate(resolve));
    assert.match(requests[1].url, /nicoad.*video\/sm9$/);
    requests[1].raw(new Response(new ReadableStream({cancel(){ cancelled = true; }})));
    await new Promise(resolve => setImmediate(resolve));
    deadline();
    const result = await load;
    assert.equal(result.isPlayable, true);
    assert.equal(String(result.watchApiData.uploaderInfo.id), '456');
    assert.equal(cancelled, true);
  });

  it('publishes only on foreground load and adopts exactly once', async () => {
    const {loader, requests, events} = setup();
    const intent = {};
    const abandon = loader.beginFirstOpenPageRead(id, intent);
    assert.equal(requests.length, 1);
    requests[0].respond(fixture);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.length, 0);
    const first = loader.load(id, {}, intent);
    abandon();
    assert.equal(requests[0].signal.aborted, false);
    assert.equal((await first).isPlayable, true);
    assert.equal(requests.length, 1);
    assert.equal(events.filter(e => e[0] === 'loadVideoInfo').length, 1);
    const next = loader.load(id, {}, intent);
    assert.equal(requests.length, 2);
    requests[1].respond(fixture);
    await next;
  });

  it('aborts a superseded or abandoned read and isolates stale cleanup', async () => {
    const {loader, requests, events} = setup();
    const intent = {};
    const old = loader.beginFirstOpenPageRead(id, intent);
    const current = loader.beginFirstOpenPageRead(id, intent);
    assert.equal(requests[0].signal.aborted, true);
    old();
    assert.equal(requests[1].signal.aborted, false);
    current();
    assert.equal(requests[1].signal.aborted, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(events.length, 0);
  });

  for (const mismatch of ['watchId', 'economy', 'intent']) {
    it('discards a read on mismatched ' + mismatch, async () => {
      const {loader, requests} = setup();
      const intent = {economy:true};
      loader.beginFirstOpenPageRead(id, intent);
      const actual = mismatch === 'watchId' ? 'sm2' : id;
      const options = {economy:mismatch !== 'economy'};
      const load = loader.load(actual, options, mismatch === 'intent' ? {...intent} : intent);
      assert.equal(requests[0].signal.aborted, true);
      assert.equal(requests[1].url, 'https://www.nicovideo.jp/watch/' + actual + (options.economy ? '?eco=1' : ''));
      requests[1].respond({data:{response:{statusCode:404,errorCode:'NOT_FOUND'}}});
      await assert.rejects(load, e => e.watchId === actual && e.reason === 'not found');
      assert.equal(requests.length, 2);
    });
  }

  it('adopts an already rejected raw read into the ordinary single network retry', async () => {
    const {loader, requests} = setup();
    const intent = {};
    loader.beginFirstOpenPageRead(id, intent);
    requests[0].reject(Error('offline'));
    await new Promise(resolve => setImmediate(resolve));
    const load = loader.load(id, {}, intent);
    assert.equal(requests.length, 1);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 2);
    requests[1].respond(fixture);
    assert.equal((await load).isPlayable, true);
  });

  it('keeps the ordinary publication generation when replacing a foreground load', async () => {
    const {loader, requests, events} = setup();
    const intent = {};
    loader.beginFirstOpenPageRead(id, intent);
    const first = loader.load(id, {}, intent);
    const next = loader.load(id, {});
    requests[1].respond(fixture);
    await next;
    requests[0].respond(fixture);
    await first;
    assert.equal(events.filter(e => e[0] === 'loadVideoInfo').length, 1);
    assert.equal(requests.length, 2);
  });

  it('honors foreground cancellation while the adopted request is in flight', async () => {
    const {loader, requests, events} = setup();
    const intent = {}, foreground = new AbortController();
    loader.beginFirstOpenPageRead(id, intent);
    const load = loader.load(id, {signal:foreground.signal}, intent);
    foreground.abort();
    assert.equal(requests[0].signal.aborted, true);
    await assert.rejects(load, e => e.reason === 'cancelled');
    assert.equal(events.length, 0);
    assert.equal(requests.length, 1);
  });
});
