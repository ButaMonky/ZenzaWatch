// Current-develop PR129 narrowed port: synthetic module-event generation ownership, no live requests.
// Port-source-only test; inherited donor used for provenance and comparison.
import test from 'node:test';
import assert from 'node:assert/strict';
import {read, loadLegacy, settle} from './nico-api-harness.mjs';

const runtime = read('packages/lib/src/nico/VideoInfoLoader.js');
const WATCH='sm0'; // deliberately nonexistent synthetic-shaped identifier
const MARK='CURRENT_PORT_FAKE_ONLY';
const defer=()=>{
  let resolve;
  const promise=new Promise(r=>{resolve=r;});
  return {promise,resolve};
};
async function until(predicate,label){
  for(let i=0;i<100;i++){
    if(predicate())return;
    await new Promise(resolve=>setImmediate(resolve));
  }
  throw Error('CURRENT_PORT_FIXTURE_SETUP: '+label);
}
const payload=({owner=true,paid=false,media=true}={})=>{
  const data={
    client:{watchId:WATCH,watchTrackId:MARK},
    video:{id:WATCH,title:'synthetic',description:'synthetic',duration:42,
      registeredAt:'2000-01-01T00:00:00+09:00',
      count:{view:1,comment:0,mylist:0,like:0},
      thumbnail:{url:MARK,middleUrl:MARK,largeUrl:MARK},
      isLikedByViewer:false},
    player:{initialPlayback:{type:'resume',positionSec:0}},
    genre:{key:'game',label:'synthetic'},
    tags:{edit:{isEditable:false},items:[]},
    comment:{nvComment:{server:MARK,threadKey:MARK,params:{}},
      ng:{channel:[],owner:[]},threads:[],layers:[]},
    media:media?{accessRightKey:MARK,contents:{videos:[{id:MARK}]}}:null,
    payment:{admission:{isEnabled:false},ppv:{isEnabled:paid},
      premium:{isEnabled:false}},
    viewer:{id:0,isPremium:false}
  };
  if(owner)data.metadata={jsonLd:{owner:{type:'user',id:'0',name:'synthetic'}}};
  return {data:{response:{$watchV4:{data}}}};
};
const reply=p=>({status:200,ok:true,text:async()=>JSON.stringify(p),
  json:async()=>p});
function world({snapshotPromise=null}={}){
  const queue=[],events=[],kinds=[];
  let snapshotCalls=0;
  const quiet=Object.fromEntries(['log','warn','info','error','time','timeEnd']
    .map(name=>[name,()=>{}]));
  const globals={
    netUtil:{fetch:async url=>{
      if(url.includes('api.nicoad.')){
        kinds.push('owner');
        return {status:404,ok:false,json:async()=>({})};
      }
      if(url.includes('channelVideoDAnimeLinks')){
        kinds.push('linked');
        return {status:200,ok:true,json:async()=>({data:{items:[]}})};
      }
      kinds.push('watch');
      if(!queue.length)throw Error('CURRENT_PORT_UNEXPECTED_FAKE_REQUEST');
      return queue.shift()();
    }},
    CacheStorage:class{setItem(){}},
    DOMParser:class{parseFromString(markup){
      return {querySelector:()=>({getAttribute:()=>markup})};
    }},
    nicoUtil:{hasLargeThumbnail:()=>false},
    CommentPostTarget:{select:()=>({
      defaultThread:null,threadId:null,canPost:false,
      postUnavailableReason:'synthetic',optionalThreads:[]
    })},
    NicoSearchApiV2Loader:{lookupOwnerIds:()=>{
      snapshotCalls++;
      return snapshotPromise??Promise.resolve(new Map());
    }},
    emitter:{emitAsync:(name,data)=>{
      if(name==='loadVideoInfo')events.push({playable:data.isPlayable,
        needsPayment:data.isNeedPayment,ownerKnown:!!data.uploaderInfo});
    }},
    Config:{getValue:()=>false},
    debug:{},sessionStorage:{},console:quiet,window:{console:quiet},
    URLSearchParams,Promise,Object,Array,String,Number,Error,JSON,
    setTimeout:(callback,ms)=>{
      if(ms!==5000)queueMicrotask(callback);
      return 1;
    }
  };
  return {
    loader:loadLegacy(runtime,'VideoInfoLoader',globals),
    enqueue:r=>queue.push(r),events,kinds,
    get snapshotCalls(){return snapshotCalls;}
  };
}

test('Current port active allowed candidate still emits exactly one metadata event',async()=>{
  const w=world();
  w.enqueue(()=>reply(payload()));
  const result=await settle(()=>w.loader.load(WATCH,{}));
  assert.equal(result.ok,true);
  assert.equal(result.value.isPlayable,true);
  assert.equal(w.events.length,1);
  assert.equal(w.events[0].playable,true);
});

test('Current port caller AbortSignal suppresses late emission even without a newer load',
  {timeout:4000},async()=>{
    const slow=defer(),w=world(),controller=new AbortController();
    w.enqueue(()=>slow.promise);
    const old=settle(()=>w.loader.load(WATCH,{signal:controller.signal}));
    await until(()=>w.kinds.includes('watch'),'initial fake request');
    controller.abort();
    slow.resolve(reply(payload()));
    await old;
    assert.equal(w.events.length,0,'abort must suppress a late metadata event');
  });

test('Current port newer candidate wins and older success cannot publish later',
  {timeout:4000},async()=>{
    const slow=defer(),w=world();
    w.enqueue(()=>slow.promise);
    w.enqueue(()=>reply(payload({owner:true,paid:false,media:true})));
    const old=settle(()=>w.loader.load(WATCH,{}));
    await until(()=>w.kinds.filter(x=>x==='watch').length===1,'old fake request');
    const current=await settle(()=>w.loader.load(WATCH,{}));
    assert.equal(current.ok,true);
    assert.equal(w.events.length,1);
    slow.resolve(reply(payload()));
    await old;
    assert.equal(w.events.length,1,'stale success must not overwrite newer event');
  });

test('Current port completed success is not retroactively suppressed by later paid denial',
  async()=>{
    const w=world();
    w.enqueue(()=>reply(payload()));
    w.enqueue(()=>reply(payload({paid:true,media:false})));
    const earlier=await settle(()=>w.loader.load(WATCH,{}));
    assert.equal(earlier.ok,true);
    assert.equal(w.events.length,1);
    const denied=await settle(()=>w.loader.load(WATCH,{}));
    assert.equal(denied.ok,false);
    assert.equal(denied.error?.info?.isNeedPayment,true);
    assert.equal(w.events.length,1,'later denial must not forge a new event');
  });
