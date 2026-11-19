'use strict';
const assert = require('assert');
const {createContext, beginSection, run} = require('../helpers/extractSource');

const reply = (status, body) => ({status, headers: {get: () => null}, json: async () => body, text: async () => JSON.stringify(body)});
const empty = {meta: {status: 200}, data: {items: [], totalCount: 0}};
function setup() {
  let route;
  const events = [], calls = [], cache = new Map();
  const fetch = async (url, opts) => { calls.push(url); return route(url, opts); };
  const ctx = createContext({console: {log() {}, info() {}, error() {}, warn() {}}, location: {host: 'www.nicovideo.jp'}, fetch, AbortController,
    sessionStorage: {}, CacheStorage: class {
      getItem(key) { return cache.get(key); }
      setItem(key, value) { cache.set(key, value); }
    }, WindowMessageEmitter: {}, CrossDomainGate: class {fetch(url) { return fetch(url); }},
    textUtil: {dateToString: date => String(date), encodeBase64: s => Buffer.from(s).toString('base64')},
    VideoList: class {}, VideoListItem: class {}});
  for (const path of ['infra/RequestDiagnostics', 'infra/netUtil', 'nico/VideoSearch', 'nico/RecommendAPILoader']) {
    run(beginSection('packages/lib/src/' + path + '.js'), ctx);
  }
  run(beginSection('packages/zenza/src/Playlist/RelatedVideoList.js') +
    ';globalThis.api = {search:NicoSearchApiV2Loader, recommend:RecommendAPILoader, related:new RelatedVideoList(), diag:RequestDiagnostics};', ctx);
  ctx.api.diag.setSink(event => events.push(event));
  ctx.api.related.update = () => {};
  ctx.api.search.version.date = new Date(Date.now() + 86400000);
  return {...ctx.api, events, calls, cache, route: fn => { route = fn; }};
}
describe('Task1099 search and recommendations through their readers', () => {
  it('keeps official search HTTP, API and field facts separate across fallback and recovery', async () => {
    const h = setup();
    let primary = reply(200, {meta:{status:403,errorCode:'FORBIDDEN'}});
    const fallback = reply(200, {meta:{status:200,totalCount:0}, data:[]});
    h.route(url => url.includes('/v2/search/video') ? primary : fallback);
    assert.equal((await h.search.searchMore('PRIVATE WORD')).list.length, 0);
    assert.deepStrictEqual(h.events.map(e => [e.reason,e.statusCode,e.apiStatus]), [['permission',200,403]]);
    primary = reply(503, empty);
    await h.search.searchMore('PRIVATE WORD');
    assert.deepStrictEqual(h.events.slice(1).map(e => [e.reason,e.statusCode,e.apiStatus]), [['http',503,200]]);
    primary = reply(200, {meta:{status:200},data:{totalCount:0}});
    await h.search.searchMore('PRIVATE WORD');
    assert.equal(h.events.at(-1).missing,'data.items');
    primary = {status:200,json:async () => {throw new TypeError('PRIVATE body stream');}};
    await h.search.searchMore('PRIVATE WORD');
    assert.equal(h.events.at(-1).reason,'network');
    primary = reply(200, empty);
    assert.equal((await h.search.searchMore('PRIVATE WORD')).resultState,'empty');
    assert.equal(h.events.at(-1).outcome,'recovered');
    assert(!JSON.stringify(h.events).includes('PRIVATE'));
  });
  it('rejects a malformed snapshot and only recovers after a usable network page', async () => {
    const h = setup();
    const snap = () => h.search.searchBySnapshot('PRIVATE');
    h.route(() => reply(200,{meta:{status:200,totalCount:1},data:[{}]}));
    await assert.rejects(snap());
    assert.equal(h.events.at(-1).reason,'schema');
    assert.equal(h.events.at(-1).missing,'data.contentId');
    h.route(() => reply(503,{meta:{status:200,totalCount:0},data:[]}));
    await assert.rejects(snap());
    assert.equal(h.events.at(-1).statusCode,503);
    h.route(() => reply(200,{meta:{status:200,totalCount:0},data:[]}));
    assert.equal((await snap()).count,0);
    assert.equal(h.events.at(-1).outcome,'recovered');
    const saved = [...h.cache][0];
    h.cache.clear();
    h.route(() => reply(503,{meta:{status:200,totalCount:0},data:[]}));
    await assert.rejects(snap());
    const n = h.events.length;
    h.cache.set(...saved);
    assert.equal((await snap()).count,0);
    assert.equal(h.events.length,n);
  });
  it('does not cache a bad version probe and reports its recovery separately from the page', async () => {
    const h = setup(), version = h.search.version;
    version.date = version.lastUpdate = new Date(0);
    h.route(() => reply(200, {last_modified:'bogus'}));
    await assert.rejects(h.search.searchBySnapshot('PRIVATE'));
    assert.deepStrictEqual([h.events.at(-1).missing,h.events.at(-1).statusCode,h.calls.length],['last_modified',200,1]);
    assert.equal(version.lastUpdate.getTime(),0);
    h.route(() => reply(503,{meta:{status:429,errorCode:'TOO_MANY_REQUESTS'}}));
    await assert.rejects(h.search.searchBySnapshot('PRIVATE'));
    assert.deepStrictEqual([h.events.at(-1).statusCode,h.events.at(-1).apiStatus],[503,429]);
    h.route(url => url.endsWith('/version') ?
      {...reply(200,{last_modified:'2026-11-01T20:00:00Z'}), headers:{get:()=>null}} :
      reply(200,{meta:{status:200,totalCount:0},data:[]}));
    assert.equal((await h.search.searchBySnapshot('PRIVATE')).count,0);
    assert.equal(h.events.at(-1).outcome,'recovered');
  });
  it('keeps malformed owner pages and snapshot filters distinct from owners with no matches', async () => {
    const h = setup();
    const search = () => h.search.searchMore('PRIVATE',{userId:9});
    const owner = reply(200,{meta:{status:200},data:{items:[{essential:{id:'sm1'}}],totalCount:1}});
    h.route(() => reply(200,{meta:{status:200},data:{items:[]}}));
    await assert.rejects(search());
    assert.equal(h.events.at(-1).missing,'data.totalCount');
    h.route(url => url.includes('/users/') ? owner : reply(200,{meta:{status:200},data:{}}));
    await assert.rejects(search());
    assert.equal(h.events.at(-1).operation,'owner-videos');
    assert.equal(h.events.at(-1).missing,'data');
    h.route(url => url.includes('/users/') ? owner : reply(200,{meta:{status:200},data:[]}));
    assert.equal((await search()).count,0);
    assert.equal(h.events.at(-1).outcome,'recovered');
    // Optional/deleted wrappers coexist with usable rows. The second page need not repeat the total.
    h.route(url => {
      if (!url.includes('/users/')) return reply(200,{meta:{status:200},data:[{contentId:'sm1'},{contentId:'sm2'}]});
      const page = Number(new URL(url).searchParams.get('page'));
      return reply(200,{meta:{status:200},data:page === 1 ?
        {totalCount:101,items:[{essential:null},{essential:{id:'sm1'}}]} : {items:[{essential:{id:'sm2'}}]}});
    });
    const sparse = await search();
    assert.equal(sparse.count,2);
    assert.equal(sparse.isPartial,undefined);
    h.route(url => url.includes('/users/') ?
      reply(200,{meta:{status:200},data:{totalCount:2,items:[{}, {essential:{id:'sm1'}}]}}) :
      reply(200,{meta:{status:200},data:[{contentId:'sm1'}]}));
    const partial = await search();
    assert.deepStrictEqual([partial.count,partial.isPartial,...partial.missingOwnerPages],[1,true,1]);
    assert.equal(h.events.at(-1).missing,'data.items.essential');
    h.route(() => reply(503,{meta:{status:200},data:[{contentId:'sm1',userId:42}]}));
    assert.equal((await h.search.lookupOwnerIds(['sm1'])).size,0);
    assert.deepStrictEqual([h.events.at(-1).statusCode,h.events.at(-1).apiStatus],[503,200]);
  });
  it('distinguishes missing recommendation items from an empty list and ignores a stale view', async () => {
    const h = setup();
    const load = () => h.recommend.load({videoId:'PRIVATE'});
    h.route(() => reply(200,{meta:{status:200},data:{}}));
    await assert.rejects(load());
    assert.equal(h.events.at(-1).missing,'data.items');
    h.route(() => reply(200,{meta:{status:403,errorCode:'FORBIDDEN'}}));
    await assert.rejects(load());
    assert.deepStrictEqual([h.events.at(-1).statusCode,h.events.at(-1).apiStatus],[200,403]);
    h.route(() => reply(503,empty));
    await assert.rejects(load());
    assert.equal(h.events.at(-1).reason,'http');
    h.route(() => reply(200,{meta:{status:200},data:{items:[null,{id:'sm1'}]}}));
    assert.equal((await load()).items[1].id,'sm1');
    assert.equal(h.events.at(-1).missing,'data.items');
    h.route(() => reply(200,empty));
    assert.strictEqual(await load(),empty.data);
    assert.equal(h.events.at(-1).outcome,'recovered');
    const n = h.events.length;
    let finish;
    h.route(() => new Promise(resolve => { finish = resolve; }));
    const old = h.related.fetchRecommend('OLD');
    h.route(() => reply(200,empty));
    await h.related.fetchRecommend('NEW');
    finish(reply(503,{}));
    await old;
    assert.equal(h.events.length,n);
    assert(!JSON.stringify(h.events).includes('PRIVATE'));
  });
});
