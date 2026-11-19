import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSource} from './nonvisual-audit-source-harness.mjs';

function fixture(name, ...responses) {
  const events = [], calls = [], cache = new Map();
  const diagnostics = loadSource('nico-src/RequestDiagnostics.ts', 'RequestDiagnostics');
  diagnostics.setSink(event => events.push(event));
  const api = loadSource('nico-src/' + name + '.ts', name, {
    URLSearchParams, window: {}, sessionStorage: {}, emitter: {on() {}},
    CacheStorage: class {
      getItem(key) { return cache.get(key); }
      setItem(key, value) { cache.set(key, value); }
      removeItem(key) { cache.delete(key); }
    },
    RequestDiagnostics: diagnostics,
    setTimeout: fn => fn(),
    netUtil: {fetch: async (url, options) => {
      calls.push({url, options});
      assert.equal(options.method || 'GET', 'GET');
      const next = responses.shift();
      if (!next) throw Error('Unexpected request');
      return typeof next === 'function' ? next() : next;
    }}
  });
  return {api, calls, events, cache};
}
const page = (data, apiStatus = 200, status = 200) => ({
  status, json: async () => ({meta: {status: apiStatus}, data})
});

for (const [name, read, field, empty] of [
  ['PlaylistApiLoader', l => l.load({type:'series', id:7, all:false}), 'data.items', {items:[]}],
  ['MylistApiLoader', l => l.getMylistList(), 'data.mylists', {mylists:[]}],
  ['MylistApiLoader', l => l._getDeflistItems(), 'data.watchLater.items', {watchLater:{items:[]}}],
  ['MylistApiLoader', l => l._getMylistItems(7), 'data.mylist.items', {mylist:{items:[]}}]
]) {
  test(field + ' distinguishes malformed data from a successful empty retry', async () => {
    const badData = {items:{}, mylists:{}, mylist:{items:'secret'}, watchLater:{items:'secret'}};
    const h = fixture(name, page(badData), page(empty));
    await assert.rejects(read(h.api));
    assert.equal(h.cache.size, 0);
    assert.equal(h.events[0]?.reason, 'schema');
    assert.equal(h.events[0].missing, field);
    assert.equal(h.events[0].statusCode, 200);
    assert.equal(h.events[0].apiStatus, 200);
    assert.equal((await read(h.api)).length, 0);
    assert.equal(h.events[1]?.outcome, 'recovered');
    assert.doesNotMatch(JSON.stringify(h.events), /secret/);
  });
  test(field + ' rejects unsuccessful HTTP even when the body declares success', async () => {
    const h = fixture(name, page(empty, 200, 403));
    await assert.rejects(read(h.api));
    assert.equal(h.events[0]?.reason, 'permission');
    assert.equal(h.events[0]?.statusCode, 403);
    assert.equal(h.cache.size, 0);
  });
}
test('a corrupt old single-page cache entry is fetched again', async () => {
  const h = fixture('PlaylistApiLoader', page({items:[]}));
  h.cache.set('playlist; https://nvapi.nicovideo.jp/v1/playlist/series/7', {items:'bad'});
  const result = await h.api.load({type:'series', id:7, all:false});
  assert.equal(result.length, 0);
  assert.equal(h.calls.length, 1);
});
test('a stale final shorts page cannot resolve successfully', async () => {
  let current = true;
  const h = fixture('PlaylistApiLoader', () => {
    current = false;
    return page({items:[{essential:{id:'ss9'}}]});
  });
  await assert.rejects(h.api.loadUserShorts(7, {isCurrent:() => current}));
  assert.equal(h.events.length, 0);
});
test('a failed second page is atomic and reports the rejection after its retry', async () => {
  const h = fixture('PlaylistApiLoader', page({items:[{watchId:'sm9'}], hasNext:true}),
    page({}, 503), page({}, 503));
  await assert.rejects(h.api.load({type:'series', id:7}));
  assert.equal(h.calls.length, 3);
  assert.equal(h.cache.size, 0);
  assert.equal(h.events.length, 1);
  assert.equal(h.events[0].statusCode, 200);
  assert.equal(h.events[0].apiStatus, 503);
  assert.equal(h.events[0].reason, 'service');
});
for (const [name, read] of [
  ['PlaylistApiLoader', l => l.load({type:'series', id:7, all:false})],
  ['MylistApiLoader', l => l.getMylistList()]
]) {
  test(name + ' distinguishes JSON, stream, gate timeout and cancellation', async () => {
    for (const [fixtureResponse, expected] of [
      [{status:200, json:async () => { throw SyntaxError('private'); }}, {reason:'schema', missing:'json', statusCode:200}],
      [{status:200, json:async () => { throw TypeError('private'); }}, {reason:'network', statusCode:200}],
      [() => { throw Object.assign(Error('private'), {status:'timeout'}); }, {reason:'timeout'}],
      // A rejected promise supplies no Response. Its arbitrary statusCode cannot prove a wire status.
      [() => { throw Object.assign(Error('private'), {statusCode:403}); }, {reason:'network', statusCode:undefined}],
      [{status:200, json:async () => { throw Object.assign(Error('private'), {name:'AbortError'}); }}, null]
    ]) {
      const h = fixture(name, fixtureResponse);
      await assert.rejects(read(h.api));
      assert.equal(h.events.length, expected ? 1 : 0);
      for (const [key, value] of Object.entries(expected || {})) {
        assert.equal(h.events[0][key], value);
      }
      assert.doesNotMatch(JSON.stringify(h.events), /private/);
    }
  });
}
test('single pages validate row IDs in a cached array and a fresh response', async () => {
  const h = fixture('PlaylistApiLoader', page({items:[null]}), page({items:[{content:{id:'sm5'}}]}));
  const key = 'playlist; https://nvapi.nicovideo.jp/v1/playlist/series/7';
  const request = {type:'series', id:7, all:false};
  h.cache.set(key, ['broken']);
  await assert.rejects(h.api.load(request));
  assert.equal(h.events[0]?.missing, 'data.items[].watchId');
  assert.equal((await h.api.load(request))[0].content.id, 'sm5');
  assert.equal(h.events[1]?.outcome, 'recovered');
  assert.equal(h.calls.length, 2);
});
test('invalid group rows fail before the hover menu reads the group id', async () => {
  const h = fixture('MylistApiLoader', page({mylists:[null]}));
  await assert.rejects(h.api.getMylistList());
  assert.equal(h.events[0].reason, 'schema');
  assert.equal(h.events[0].missing, 'data.mylists');
});

test('cached single pages and collections leave an API failure open until a network read succeeds', async () => {
  for (const all of [false, true]) {
    const request = {type:'series', id:7, all};
    const valid = () => page({items:[{watchId:'sm5'}], hasNext:false});
    const h = fixture('PlaylistApiLoader', valid(), page({items:[null]}), valid());
    await h.api.load(request);
    const saved = Array.from(h.cache);
    assert.equal(saved.length, 1);
    h.cache.clear();
    await assert.rejects(h.api.load(request));
    for (const [key,value] of saved) h.cache.set(key,value);
    assert.equal((await h.api.load(request)).length, 1);
    assert.deepEqual(h.events.map(e=>e.outcome), ['failed']);
    h.cache.clear();
    await h.api.load(request);
    assert.deepEqual(h.events.map(e=>e.outcome), ['failed','recovered']);
    assert.equal(h.calls.length, 3);
  }
});
