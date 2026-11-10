'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {stripTypeScriptTypes}=require('node:module');
async function fixture(){
 let controller;
 const ctx=vm.createContext({exports:{},console,Map,Set,ArrayBuffer,Date,JSON,Number,Math,Object,setTimeout,clearTimeout,workerUtil:{createCrossMessageWorker(fn){controller=fn({});return {post:async()=>{}};}}});
 vm.runInContext(stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/nico-src/IndexedDbStorage.ts','utf8')).replace('export {IndexedDbStorage};','exports.db=IndexedDbStorage;'),ctx);
 await ctx.exports.db.open({name:'storyboard',stores:[]});
 const rows=new Map(),metrics={scans:0,reads:[]};let queue=Promise.resolve();
 const request=value=>{const req={result:value};queueMicrotask(()=>req.onsuccess&&req.onsuccess({target:req}));return req;};
 const store={get:key=>{metrics.reads.push(key);return request(rows.get(key));},put:row=>{rows.set(row.watchId,row);return request(row.watchId);},delete:key=>{rows.delete(key);return request();},clear:()=>{rows.clear();return request();},
 openCursor(){metrics.scans++;const req={},keys=[...rows.keys()];let i=0;const next=()=>queueMicrotask(()=>{const key=keys[i++];req.result=key===undefined?null:{primaryKey:key,value:rows.get(key),delete:()=>store.delete(key),update:row=>store.put(row),continue:next};req.onsuccess();});next();return req;}};
 controller._write=(_,fn)=>{const task=queue.then(()=>new Promise((resolve,reject)=>fn(store,resolve,reject)));queue=task.catch(()=>{});return task;};
 return {rows,metrics,call:data=>controller.storyboardCache({name:'storyboard',storeName:'cache',data}),controller};
}
const board=(bytes,url='a')=>({status:'ok',format:'domand',duration:60,storyboard:{thumbnail:{width:160,height:90},rows:1,columns:1,interval:1000,count:2,images:[{url,buffer:new ArrayBuffer(bytes)},{url:'b'}]}});
describe('Task996 bounded storyboard persistence',()=>{
 it('sizes legacy records and evicts oldest under a compressed byte budget',async()=>{const f=await fixture();f.rows.set('old',{watchId:'old',updatedAt:Date.now()-1000,sbInfo:board(4000)});await f.call({op:'configure',maxBytes:6000,maxAgeMs:86400000});await f.call({op:'put',record:{watchId:'new',sbInfo:board(4000)}});const stats=await f.call({op:'stats'});assert(stats.bytes<=6000);assert(!f.rows.has('old'));assert(f.rows.has('new'));});
 it('merges compatible partial sheets and does not mix signed URL snapshots',async()=>{const f=await fixture();await f.call({op:'put',record:{watchId:'x',sbInfo:board(10)}});const next=board(0);delete next.storyboard.images[0].buffer;next.storyboard.images[1].buffer=new ArrayBuffer(20);await f.call({op:'put',record:{watchId:'x',sbInfo:next}});assert.equal((await f.call({op:'get',key:'x'})).sbInfo.storyboard.images[0].buffer.byteLength,10);next.storyboard.images[0].url='new-signature';await f.call({op:'put',record:{watchId:'x',sbInfo:next}});assert(!((await f.call({op:'get',key:'x'})).sbInfo.storyboard.images[0].buffer));});
 it('rejects inflight writes after clear and disables persistence at zero',async()=>{const f=await fixture(),generation=Date.now()-1;await f.call({op:'clear'});await f.call({op:'put',expectedGeneration:generation,record:{watchId:'x',sbInfo:board(10)}});assert.equal((await f.call({op:'stats'})).entries,0);await f.call({op:'configure',maxBytes:0});await f.call({op:'put',record:{watchId:'x',sbInfo:board(10)}});assert.equal((await f.call({op:'stats'})).entries,0);});
 it('expires idle rows before touching and rejects non-storyboard targets',async()=>{const f=await fixture();f.rows.set('old',{watchId:'old',updatedAt:1,sbInfo:board(1)});assert.equal(await f.call({op:'get',key:'old'}),null);await assert.rejects(()=>f.controller.storyboardCache({name:'watch-info',storeName:'cache',data:{op:'clear'}}));});
});

describe('Task996 cache boundary contracts',()=>{
 it('returns only selected preview bytes without deleting other persisted sheets',async()=>{const f=await fixture(),info=board(10);info.storyboard.images[1].buffer=new ArrayBuffer(20);await f.call({op:'put',record:{watchId:'x',sbInfo:info}});const row=await f.call({op:'get',key:'x',previewTime:1});assert(!row.sbInfo.storyboard.images[0].buffer);assert.equal(row.sbInfo.storyboard.images[1].buffer.byteLength,20);assert.equal(f.rows.get('x').sbInfo.storyboard.images[0].buffer.byteLength,10);});
 it('keeps concurrent writes inside the total budget and clamps policy',async()=>{const f=await fixture();await f.call({op:'configure',maxBytes:6000,maxAgeMs:1});await Promise.all(['x','y','z'].map(watchId=>f.call({op:'put',record:{watchId,sbInfo:board(4000)}})));const stats=await f.call({op:'stats'});assert(stats.bytes<=6000);assert.equal(stats.entries,1);assert.equal(stats.maxAgeMs,86400000);});
 it('facade suppresses storage failure and fences same-clock clear completions',async()=>{
  let rejectWrite=false,cleared=0;
  const store={storyboardCache:async data=>{if(data.op==='clear'){cleared=100;return {clearedAt:100};}if(data.op==='stats')return {};if(rejectWrite)throw Error('QuotaExceededError');return data.record;},delete:async()=>{},gc:async()=>{}};
  const ctx=vm.createContext({exports:{},console,Date:{now:()=>100},location:{host:'www.nicovideo.jp'},IndexedDbStorage:{open:async()=>({cache:store})}});
  vm.runInContext(stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/nico-src/StoryboardCacheDb.ts','utf8')).replace('export {StoryboardCacheDb};','exports.cache=StoryboardCacheDb;'),ctx);
  const cache=ctx.exports.cache,old=cache.captureGeneration();await cache.clear();assert.equal(cleared,100);assert.equal(await cache.put('old',board(1),old),undefined);assert(await cache.put('new',board(1),cache.captureGeneration()));rejectWrite=true;assert.equal(await cache.put('quota',board(1)),undefined);assert.equal(await cache.get('quota'),null);
 });
});

describe('Task996 image-only bridge',()=>{
 it('routes image policy and refuses history/bookmark targets',async()=>{
  const source=stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/nico-src/GateAPI.ts','utf8')),start=source.indexOf('    const bridgeDb = async'),end=source.indexOf('    const onBroadcastMessage',start);
  const calls=[],posts=[],store={storyboardCache:async data=>{calls.push(data);return {bytes:0,entries:0};}};
  const ctx=vm.createContext({dbMap:{storyboard:{cache:store,other:store},'watch-info':{cache:store}},post:body=>posts.push(body)});
  vm.runInContext(source.slice(start,end)+';globalThis.send=bridgeDb;',ctx);
  await ctx.send({command:'storyboardCache',params:{name:'storyboard',storeName:'cache',data:{op:'clear'}}});assert.deepStrictEqual(calls,[{op:'clear'}]);assert.equal(posts[0].params.entries,0);
  await assert.rejects(ctx.send({command:'storyboardCache',params:{name:'watch-info',storeName:'cache',data:{op:'clear'}}}),/Invalid storyboard cache target/);
  await assert.rejects(ctx.send({command:'storyboardCache',params:{name:'storyboard',storeName:'other',data:{op:'clear'}}}),/Invalid storyboard cache target/);assert.equal(calls.length,1);
 });
});

describe('Task996 preview cache hot path',()=>{
 it('reads only policy and requested record with no full-cache scan on hits, misses or expiry',async()=>{
  const f=await fixture();await f.call({op:'put',record:{watchId:'hit',sbInfo:board(10)}});
  f.rows.set('expired',{watchId:'expired',updatedAt:1,sbInfo:board(10)});
  const scans=f.metrics.scans;f.metrics.reads.length=0;
  for(let i=0;i<12;i++)assert(await f.call({op:'get',key:'hit',previewTime:0}));
  assert.equal(await f.call({op:'get',key:'miss'}),null);assert.equal(await f.call({op:'get',key:'expired'}),null);
  assert.equal(f.metrics.scans,scans);assert.equal(f.metrics.reads.length,28);assert(!f.rows.has('expired'));
 });
 it('reuses persisted byte accounting and recomputes replacement sizes',async()=>{
  const f=await fixture();await f.call({op:'put',record:{watchId:'x',sbInfo:board(10)}});const first=f.rows.get('x').byteSize;
  const row=f.rows.get('x');Object.defineProperty(row,'sbInfo',{get(){throw Error('accounted payload must not be sized again');}});
  assert.equal((await f.call({op:'stats'})).bytes,first);f.rows.delete('x');
  await f.call({op:'put',record:{watchId:'x',sbInfo:board(100)}});assert.equal(f.rows.get('x').byteSize,first+90);
 });
});
