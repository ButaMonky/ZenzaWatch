'use strict';
// #245: no real NicoNico API calls; every request is a deterministic synthetic fake.
const assert=require('node:assert/strict');
const {beginSection,createContext,run,loadClass}=require('../helpers/extractSource');
const {describe,it}=typeof global.describe==='function'?global:require('node:test');
const tick=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
const resp=(body)=>({
  status:200,headers:{get:()=>null},json:async()=>body,text:async()=>JSON.stringify(body)
});
const page=(n,total=1500)=>({meta:{status:200},data:{
  items:Array.from({length:100},(_,i)=>({id:'sm'+(n*100+i),duration:100})),
  totalCount:total,hasNext:true}});
const snapItem=(i)=>({contentId:'sm'+i,title:'Synthetic '+i,description:'',
  startTime:'2026-01-01T00:00:00+09:00',thumbnailUrl:'https://invalid.example/'+i,
  lengthSeconds:90,commentCounter:0,mylistCounter:0,viewCounter:0,likeCounter:0});
function harness(){
  const calls=[],gateCalls=[],pendingSleep=[],quiet={log(){},info(){},warn(){},error(){}};
  let netRoute=async()=>resp(page(1)),gateRoute=async()=>resp({
    meta:{status:200,totalCount:500},data:Array.from({length:100},(_,i)=>snapItem(i))});
  const ctx=createContext({
    URL,URLSearchParams,
    window:{console:quiet},console:quiet,sessionStorage:{},WindowMessageEmitter:{},
    textUtil:{dateToString:date=>date.toISOString()},
    netUtil:{fetch:(url)=>{calls.push(url);return netRoute(url);}},
    sleep:()=>new Promise(r=>pendingSleep.push(r)),
    CrossDomainGate:class{fetch(url){gateCalls.push(url);return gateRoute(url);}},
    CacheStorage:class{getItem(){return null}setItem(){}}
  });
  run(beginSection('packages/lib/src/nico/VideoSearch.js')+
    '\nglobalThis.__loader=NicoSearchApiV2Loader;',ctx);
  return {loader:ctx.__loader,calls,gateCalls,pendingSleep,
    routeNet:fn=>{netRoute=fn},routeGate:fn=>{gateRoute=fn}};
}

describe('#245 stale search page scheduling',()=>{
  it('nvapi stops after the already-in-flight 4-page batch; no later GET or fallback',async()=>{
    const h=harness(),pending=new Map();
    let current=true;
    h.routeNet(url=>{
      const pg=Number(new URL(url).searchParams.get('page'));
      if(pg===1)return Promise.resolve(resp(page(pg)));
      return new Promise(resolve=>pending.set(pg,resolve));
    });
    const searching=h.loader.searchMore('TEST_ONLY',{},1000,()=>current);
    for(let i=0;i<25&&pending.size<4;i++)await tick();
    assert.deepEqual([...pending.keys()].sort(),[2,3,4,5]);
    current=false;
    for(const [pg,resolve]of pending)resolve(resp(page(pg)));
    await assert.rejects(searching,/SEARCH_SUPERSEDED/);
    assert.deepEqual(h.calls.map(x=>Number(new URL(x).searchParams.get('page'))),
      [1,2,3,4,5],'page 6 or later must not start');
    assert.equal(h.gateCalls.length,0,'stale nvapi must not use snapshot fallback');
  });
  it('snapshot checks again after sleep and never starts the next page',async()=>{
    const h=harness();let current=true;
    h.routeGate(url=>url.endsWith('/version')?
      Promise.resolve(resp({last_modified:'2026-11-01T00:00:00Z'})):
      Promise.resolve(resp({meta:{status:200,totalCount:500},
        data:Array.from({length:100},(_,i)=>snapItem(i))})));
    const searching=h.loader.searchMore('TEST_ONLY',{useSnapshotSearch:true},400,()=>current);
    for(let i=0;i<25&&h.pendingSleep.length===0;i++)await tick();
    assert.equal(h.pendingSleep.length,1,'snapshot should be waiting for next page');
    current=false;h.pendingSleep.shift()();
    await assert.rejects(searching,/SEARCH_SUPERSEDED/);
    assert.equal(h.gateCalls.filter(x=>x.includes('/contents/search?')).length,1);
  });
  it('owner-only mode stops before page 2 when search changes during page 1',async()=>{
    const h=harness();let release,current=true,called=0;
    h.routeNet(()=>{called++;return new Promise(resolve=>{release=resolve;});});
    const searching=h.loader.searchMore('word',{userId:'12345'},1000,()=>current);
    await tick();assert.equal(called,1);
    current=false;
    release(resp({meta:{status:200},data:{totalCount:600,
      items:[{essential:{id:'sm1'}}]}}));
    await assert.rejects(searching,/SEARCH_SUPERSEDED/);
    assert.equal(called,1);
    assert.equal(h.gateCalls.length,0);
  });
  it('current nvapi search still fetches and returns normal results',async()=>{
    const h=harness();h.routeNet(url=>Promise.resolve(resp(page(
      Number(new URL(url).searchParams.get('page')),100))));
    const result=await h.loader.searchMore('TEST_ONLY',{},50,()=>true);
    assert.equal(result.status,'ok');
    assert.equal(result.list.length,50);
    assert.equal(h.calls.length,1);
  });
});
for(const file of ['packages/zenza/src/Playlist/PlayList.js','dist/ZenzaWatch-dev.user.js']){
  describe('#245 PlayList owner bridge '+file,()=>{
    it('forwards owner callback and absorbs stale rejection',async()=>{
      const ctx=createContext({VideoList:class{},window:{console:{time(){},timeEnd(){}}}});
      const C=loadClass(file,'PlayList',ctx),o=Object.create(C.prototype);
      C.SEARCH_LIMIT_MIN=1;C.SEARCH_LIMIT_MAX=10000;C.SEARCH_LIMIT_DEFAULT=300;
      let complete,reject,owner;let current=true;
      o.model={};o._initializeView=()=>{};
      o._nicoSearchApiLoader={searchMore(word,options,limit,isCurrent){
        owner=isCurrent;
        return new Promise((res,rej)=>{complete=res;reject=rej;});
      }};
      const loading=o.loadSearchVideo('word',{},500,()=>current);
      assert.equal(typeof owner,'function');
      assert.equal(owner(),true);
      current=false;assert.equal(owner(),false);
      reject(new Error('SEARCH_SUPERSEDED'));
      const result=await loading;
      assert.equal(result.status,'superseded');
    });
  });
}