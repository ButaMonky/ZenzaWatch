'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {stripTypeScriptTypes}=require('node:module');
async function fixture(){
 let controller;
 const ctx=vm.createContext({exports:{},console,Map,Set,setTimeout,clearTimeout,IDBKeyRange:{lowerBound:(key,open)=>({key,open})},workerUtil:{createCrossMessageWorker(fn){controller=fn({});return {post:async()=>{}};}}});
 const source=fs.readFileSync('tools/typescript-stage1/nico-src/IndexedDbStorage.ts','utf8');
 vm.runInContext(stripTypeScriptTypes(source).replace('export {IndexedDbStorage};','exports.db=IndexedDbStorage;'),ctx);
 await ctx.exports.db.open({name:'watch-info',stores:[]});return controller;
}
describe('Saved points history projection',()=>{
 it('enumerates only display fields in a readonly page and waits for transaction completion',async()=>{
  const c=await fixture(),tx={},req={};let args;
  c.getStore=async p=>{args=p;return {store:{openCursor:()=>req},transaction:tx};};
  const pending=c.listSavedPoints({name:'watch-info',storeName:'cache',data:{maxRecords:2}});await new Promise(setImmediate);
  req.result={primaryKey:'sm9',value:{watchId:'sm9',updatedAt:10,videoInfo:{title:'Test',duration:90,token:'secret'},resume:[{time:23,now:10}],comment:['private'],config:'private'},continue(){req.result=null;req.onsuccess();}};req.onsuccess();
  assert.equal(args.mode,'readonly');let settled=false;pending.then(()=>settled=true);await new Promise(setImmediate);assert.equal(settled,false);tx.oncomplete();
  const result=await pending;assert.deepStrictEqual(JSON.parse(JSON.stringify(result)),{items:[{watchId:'sm9',title:'Test',duration:90,updatedAt:10,automaticTime:23}],nextKey:null});
 });
 it('rejects unrelated store and invalid page size',async()=>{
  const c=await fixture();await assert.rejects(()=>c.listSavedPoints({name:'other',storeName:'cache',data:{}}));
  await assert.rejects(()=>c.listSavedPoints({name:'watch-info',storeName:'cache',data:{maxRecords:100000}}));
 });
});

describe('Saved points page boundaries and failure ownership',()=>{
 it('bounds scanned records including invalid rows and uses an exclusive continuation key',async()=>{
  const c=await fixture(),tx={},req={};let range,continued=0;
  c.getStore=async()=>({store:{openCursor:r=>{range=r;return req;}},transaction:tx});
  const pending=c.listSavedPoints({name:'watch-info',storeName:'cache',data:{afterKey:'sm1',maxRecords:2}});
  await new Promise(setImmediate);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(range)),{key:'sm1',open:true});
  req.result={primaryKey:'sm2',value:null,continue(){continued++;}};req.onsuccess();
  req.result={primaryKey:'sm3',value:{watchId:'sm3',videoInfo:{title:'Manual only',duration:120},updatedAt:4},continue(){continued++;}};req.onsuccess();
  assert.equal(continued,1);tx.oncomplete();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(await pending)),{items:[{watchId:'sm3',title:'Manual only',duration:120,updatedAt:4,automaticTime:null}],nextKey:'sm3'});
 });
 it('preserves explicit zero, validates fallback resume numbers and never mutates rows',async()=>{
  const c=await fixture(),tx={},req={};
  c.getStore=async()=>({store:{openCursor:()=>req},transaction:tx});
  const pending=c.listSavedPoints({name:'watch-info',storeName:'cache',data:{}});
  await new Promise(setImmediate);
  const rows=[
   {watchId:'sm1',resumeOverride:0,resume:[{time:12}]},
   {watchId:'sm2',resumeOverride:NaN,resume:[{time:22}]},
   {watchId:'sm3',resume:[{time:'30'}]},
   {watchId:'sm4',resume:[{time:-1}]}
  ];
  const before=JSON.stringify(rows);
  for(const row of rows){req.result={primaryKey:row.watchId,value:row,continue(){}};req.onsuccess();}
  req.result=null;req.onsuccess();tx.oncomplete();
  const result=await pending;
  assert.deepStrictEqual(Array.from(result.items,x=>x.automaticTime),[0,22,null,null]);
  assert.equal(JSON.stringify(rows),before);
 });
 it('rejects abort and request errors instead of exposing an incomplete page',async()=>{
  for(const failure of ['abort','request']){
   const c=await fixture(),tx={abort(){}},req={};
   c.getStore=async()=>({store:{openCursor:()=>req},transaction:tx});
   const pending=c.listSavedPoints({name:'watch-info',storeName:'cache',data:{}});
   await new Promise(setImmediate);
   const reason=new Error('failed');tx.error=reason;req.error=reason;
   if(failure==='abort')tx.onabort({target:tx});else req.onerror({target:req});
   await assert.rejects(pending,/failed/);
  }
 });
});

function historyFacade(cache){
 const ctx=vm.createContext({exports:{},console,location:{host:'www.nicovideo.jp'},
  setTimeout(){throw new Error('enumeration must not schedule a write scrub');},
  IndexedDbStorage:{open:async()=>({cache})}});
 const source=fs.readFileSync('tools/typescript-stage1/nico-src/WatchInfoCacheDb.ts','utf8');
 vm.runInContext(stripTypeScriptTypes(source).replace('export {WatchInfoCacheDb};','exports.db=WatchInfoCacheDb;'),ctx);
 return ctx.exports.db;
}
describe('Saved points facade',()=>{
 it('loops readonly pages without get, timestamp touch or migration and keeps manual-only metadata',async()=>{
  const calls=[];
  const cache={scrubWatchVideoInfo(){throw new Error('write scrub');},get(){throw new Error('get');},updateTime(){throw new Error('touch');},
   async listSavedPoints(query){
    calls.push(query);
    return query.afterKey===null?
     {items:[{watchId:'sm1',title:'One',duration:90,updatedAt:4,automaticTime:0,comment:'private'}],nextKey:'sm1'}:
     {items:[{watchId:'sm2',title:'Two',duration:60,updatedAt:2,automaticTime:null}],nextKey:null};
   }};
  const rows=await historyFacade(cache).listSavedPoints();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(rows)),[
   {watchId:'sm1',title:'One',duration:90,updatedAt:4,automaticTime:0},
   {watchId:'sm2',title:'Two',duration:60,updatedAt:2,automaticTime:null}]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls)),[{afterKey:null,maxRecords:200},{afterKey:'sm1',maxRecords:200}]);
 });
 it('rejects nonadvancing bridge cursors',async()=>{
  const db=historyFacade({listSavedPoints:async()=>({items:[],nextKey:'sm1'})});
  await assert.rejects(db.listSavedPoints(),/Invalid saved points page/);
 });
});

describe('Saved points bridge routing',()=>{
 it('passes the page query and rejects unrelated stores before enumeration',async()=>{
  const source=stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/nico-src/GateAPI.ts','utf8'));
  const start=source.indexOf('    const bridgeDb = async');
  const end=source.indexOf('    const onBroadcastMessage',start);
  assert(start>0&&end>start);
  const calls=[],posts=[];
  const store={listSavedPoints:async data=>{calls.push(data);return {items:[],nextKey:null};}};
  const ctx=vm.createContext({dbMap:{'watch-info':{cache:store,other:store},other:{cache:store}},
   post:body=>posts.push(body)});
  vm.runInContext(source.slice(start,end)+';globalThis.send=bridgeDb;',ctx);
  await ctx.send({command:'listSavedPoints',params:{name:'watch-info',storeName:'cache',data:{afterKey:'sm1',maxRecords:7}}});
  assert.deepStrictEqual(calls,[{afterKey:'sm1',maxRecords:7}]);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(posts[0].params)),{items:[],nextKey:null});
  await assert.rejects(ctx.send({command:'listSavedPoints',params:{name:'other',storeName:'cache',data:{}}}),/Invalid saved points target/);
  await assert.rejects(ctx.send({command:'listSavedPoints',params:{name:'watch-info',storeName:'other',data:{}}}),/Invalid saved points target/);
  assert.equal(calls.length,1);
 });
});
