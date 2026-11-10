'use strict';
const assert=require('assert');
const {createContext,beginSection,run}=require('../helpers/extractSource');
function world(extra={}) {
 const events=[];const ctx=createContext({AbortController,...extra});
 run(beginSection('packages/lib/src/infra/RequestDiagnostics.js')+';globalThis.diag=RequestDiagnostics;',ctx);
 ctx.diag.setSink(e=>events.push(e)); return {ctx,events};
}
describe('API diagnostics expansion (offline)',()=>{
 it('classifies suggestions, nicoad, gifts and dictionary without persisting terms',()=>{
  const {ctx,events}=world();
  for(const [url,operation] of [
   ['https://sug.search.nicovideo.jp/suggestion/expand/private-word','tag-suggest'],
   ['https://api.nicoad.nicovideo.jp/v1/contents/video/sm9/thanks','advertising'],
   ['https://api.nicoad.nicovideo.jp/v2/contents/video/sm9/pickup_supporters?tags=private-tag','supporters'],
   ['https://api.nicoad.nicovideo.jp/v1/nage_video/sm9/gift/effects','gifts'],
   ['https://dic.nicovideo.jp/api/summary?titles[]=private-title','dictionary']]) {
   ctx.diag.startRequest(url).response({status:404});
   assert.equal(events.at(-1).operation,operation);
  }
  assert(!JSON.stringify(events).includes('private-'));
 });
 it('observes malformed results and recovery while preserving values, exceptions and request count',async()=>{
  const {ctx,events}=world();let count=0;
  const invalid={meta:{status:200},data:null},valid=[];
  assert.strictEqual(await ctx.diag.observe('tags','secret',async()=>{count++;return invalid;},Array.isArray),invalid);
  assert.equal(events[0].reason,'schema');
  assert.strictEqual(await ctx.diag.observe('tags','secret',async()=>{count++;return valid;},Array.isArray),valid);
  assert.equal(events[1].outcome,'recovered');
  const error=Object.assign(new Error('private message'),{status:403});
  await assert.rejects(ctx.diag.observe('tags','secret',async()=>{count++;throw error;}),e=>e===error);
  assert.equal(count,3);assert.equal(events[2].reason,'permission');
  assert(!JSON.stringify(events).includes('private message'));
 });
 it('excludes cancelled and stale results and ignores a failing validator',async()=>{
  const {ctx,events}=world();const value={};
  await ctx.diag.observe('search','old',async()=>value,()=>false,()=>false);
  await assert.rejects(ctx.diag.observe('search','abort',async()=>{throw {name:'AbortError'};}));
  assert.strictEqual(await ctx.diag.observe('search','validator',async()=>value,()=>{throw Error('observer');}),value);
  assert.equal(events.length,0);
 });
 it('reports malformed tag suggestions, but not valid empty candidates',async()=>{
  let body={};const {ctx,events}=world({netUtil:{fetch:async()=>({status:200,json:async()=>body})}});
  run(beginSection('packages/lib/src/nico/TagSuggestLoader.js')+';globalThis.loader=TagSuggestLoader;',ctx);
  await ctx.loader.load('private word');assert.equal(events[0].reason,'schema');
  body={candidates:[]};await ctx.loader.load('another');assert.equal(events.length,1);
 });
 it('records tag API failures before existing retry/error handling and later recovery',async()=>{
  let body={meta:{status:403,errorCode:'FORBIDDEN'}};
  const {ctx,events}=world({util:{fetch:async()=>({status:200,json:async()=>body})}});
  run(beginSection('packages/lib/src/nico/TagEditApi.js')+';globalThis.api=new TagEditApi();',ctx);
  await assert.rejects(ctx.api._requestOnce({url:'https://nvapi.nicovideo.jp/v1/videos/sm9/tags',options:{}},'tag'));
  assert.equal(events[0].operation,'tags');assert.equal(events[0].reason,'permission');
  body={meta:{status:200},data:{tags:[]}};
  await ctx.api._requestOnce({url:'https://nvapi.nicovideo.jp/v1/videos/sm9/tags',options:{}},'tag');
  assert.equal(events[1].outcome,'recovered');
 });
 it('records ad decoration schema failure before its optional fallback',async()=>{
  const {ctx,events}=world({netUtil:{fetch:async()=>({ok:true,status:200,json:async()=>({})})}});
  run(beginSection('packages/lib/src/nico/AdDecorationLoader.js')+';globalThis.loader=AdDecorationLoader;',ctx);
  await ctx.loader.load(['sm9']);assert.equal(events[0].operation,'ad-decoration');assert.equal(events[0].reason,'schema');
 });
 it('tracks real search schema failures and recovery without recording an empty result as failure',async()=>{
  let body={meta:{status:200},data:{items:'bad',totalCount:0}};
  const {ctx,events}=world({CacheStorage:class {},sessionStorage:{},textUtil:{},sleep:async()=>{},
   netUtil:{fetch:async()=>({status:200,json:async()=>body})}});
  run(beginSection('packages/lib/src/nico/VideoSearch.js')+';globalThis.search=NicoSearchApiV2Loader.nvapi;',ctx);
  await assert.rejects(ctx.search.search('private word',{},100));
  assert.equal(events[0].operation,'search');assert.equal(events[0].reason,'schema');
  body={meta:{status:200},data:{items:[],totalCount:0}};
  const result=await ctx.search.search('private word',{},100);assert.equal(result.list.length,0);
  assert.equal(events[1].outcome,'recovered');assert(!JSON.stringify(events).includes('private word'));
 });
 it('suppresses stale search results at both transport and response boundaries',async()=>{
  let active=true,release;
  const {ctx,events}=world({CacheStorage:class {},sessionStorage:{},textUtil:{},sleep:async()=>{},
   location:{host:'www.nicovideo.jp'},fetch:()=>new Promise(r=>{release=r;})});
  run(beginSection('packages/lib/src/infra/netUtil.js'),ctx);
  run(beginSection('packages/lib/src/nico/VideoSearch.js')+';globalThis.search=NicoSearchApiV2Loader.nvapi;',ctx);
  const pending=ctx.search.search('word',{},100,()=>active);active=false;
  release({status:503,json:async()=>({})});await assert.rejects(pending);assert.equal(events.length,0);
 });
 it('records advertising envelope failures and keeps caller cancellation silent',async()=>{
  let body={meta:{status:404}};
  const {ctx,events}=world({netUtil:{fetch:async()=>({json:async()=>body})}});
  run(beginSection('packages/lib/src/nico/UaaLoader.js')+';globalThis.loader=UaaLoader;',ctx);
  assert.strictEqual(await ctx.loader.load('sm9'),body);assert.equal(events[0].reason,'not-found');
  body={meta:{status:200},data:{sponsors:[]}};await ctx.loader.load('sm9');
  assert.equal(events[1].outcome,'recovered');
  const c=new AbortController();c.abort();body={};await ctx.loader.load('sm10',{signal:c.signal});assert.equal(events.length,2);
 });
 it('records supporter HTTP and gift schema failures before returning its existing null fallback',async()=>{
  let healthy=false;
  const {ctx,events}=world({setTimeout:()=>0,fetch:async url=>healthy?
   {ok:true,status:200,json:async()=>({data:url.includes('/gift/')?{effects:[]}:{supporters:{}}})}:
   url.includes('/gift/')?{ok:true,status:200,json:async()=>({})}:{ok:false,status:404}});
  run(beginSection('packages/zenza/src/videoPlayer/SupporterCredit.js')+';globalThis.credit=SupporterCredit;',ctx);
  assert.equal(await ctx.credit.load({videoId:'sm9'}),null);
  assert(events.some(e=>e.operation==='supporters'&&e.reason==='not-found'));
  assert(events.some(e=>e.operation==='gifts'&&e.reason==='schema'));
  healthy=true;await ctx.credit.load({videoId:'sm9'});assert.equal(events.filter(e=>e.outcome==='recovered').length,2);
 });
 it('distinguishes missing owner from malformed owner response',async()=>{
  let body={};const {ctx,events}=world({netUtil:{fetch:async()=>({ok:true,status:200,json:async()=>body})}});
  run(beginSection('packages/lib/src/nico/OwnerSupplement.js')+';globalThis.owner=OwnerSupplement;',ctx);
  assert.equal(await ctx.owner.loadFromNicoad('sm9'),null);assert.equal(events[0].reason,'schema');
  body={data:{id:'sm9'}};assert.equal(await ctx.owner.loadFromNicoad('sm9'),null);
  assert.equal(events[1].outcome,'recovered');
 });
 it('does not recover an owner schema failure on a later HTTP failure',async()=>{
  let response={ok:true,status:200,json:async()=>({})};
  const {ctx,events}=world({netUtil:{fetch:async()=>response}});
  run(beginSection('packages/lib/src/nico/OwnerSupplement.js')+';globalThis.owner=OwnerSupplement;',ctx);
  await ctx.owner.loadFromNicoad('sm9');response={ok:false,status:404};
  assert.equal(await ctx.owner.loadFromNicoad('sm9'),null);
  assert.equal(events[1].reason,'not-found');assert.equal(events[1].outcome,'failed');
 });
 it('reports invalid owner lookup before its empty Map fallback and recovers on valid empty data',async()=>{
  let body={};const {ctx,events}=world({CacheStorage:class {},sessionStorage:{},WindowMessageEmitter:{},
   CrossDomainGate:class {fetch(){return Promise.resolve({status:200,text:async()=>JSON.stringify(body)});}}});
  run(beginSection('packages/lib/src/nico/VideoSearch.js')+';globalThis.loader=NicoSearchApiV2Loader;',ctx);
  assert.equal((await ctx.loader.lookupOwnerIds(['sm9'])).size,0);assert.equal(events[0].reason,'schema');
  body={meta:{status:200},data:[]};assert.equal((await ctx.loader.lookupOwnerIds(['sm9'])).size,0);
  assert.equal(events[1].outcome,'recovered');
 });
});
