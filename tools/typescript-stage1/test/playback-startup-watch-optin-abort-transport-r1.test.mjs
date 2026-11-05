// Opt-in Watch AbortSignal transport regression on actual generated VideoInfoLoader JS.
// Entirely synthetic; no real site, credentials, network or logged-in playback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {read,loadLegacy,settle} from './nico-api-harness.mjs';
const runtime=read('packages/lib/src/nico/VideoInfoLoader.js');
const ID='sm0',MARK='SYNTHETIC_OPTIN_ABORT';
const deferred=()=>{
  let resolve,reject;
  const promise=new Promise((a,b)=>{resolve=a;reject=b;});
  return {promise,resolve,reject};
};
const payload=({paid=false,media=true}={})=>({
  data:{response:{$watchV4:{data:{
    client:{watchId:ID,watchTrackId:MARK},
    video:{id:ID,title:'synthetic',description:'synthetic',duration:42,
      registeredAt:'2000-01-01T00:00:00+09:00',
      count:{view:1,comment:0,mylist:0,like:0},
      thumbnail:{url:MARK,middleUrl:MARK,largeUrl:MARK},isLikedByViewer:false},
    player:{initialPlayback:{type:'resume',positionSec:0}},
    genre:{key:'game',label:'synthetic'},
    tags:{edit:{isEditable:false},items:[]},
    comment:{nvComment:{server:MARK,threadKey:MARK,params:{}},
      ng:{channel:[],owner:[]},threads:[],layers:[]},
    media:media?{accessRightKey:MARK,contents:{videos:[{id:MARK}]}}:null,
    payment:{admission:{isEnabled:false},ppv:{isEnabled:paid},
      premium:{isEnabled:false}},viewer:{id:0,isPremium:false},
    metadata:{jsonLd:{owner:{type:'user',id:'0',name:'synthetic'}}}
  }}}}
});
const response=(p=payload())=>({status:200,ok:true,
  text:async()=>JSON.stringify(p),json:async()=>p});
const emptyPage=()=>({status:200,ok:true,text:async()=>'',json:async()=>({})});
function harness({pauseRetry=false}={}){
  const queue=[],calls=[],events=[],logs=[],delays=[],pendingRetries=[];
  const quiet=Object.fromEntries(['log','warn','info','error','time','timeEnd']
    .map(name=>[name,(...args)=>logs.push({name,args})]));
  const ctx={
    netUtil:{fetch(url,options){calls.push({url,options});const job=queue.shift();
      if(!job)throw Error('UNEXPECTED_SYNTHETIC_FETCH');
      return typeof job==='function'?job(url,options):job;
    }},
    CacheStorage:class{setItem(){}},
    DOMParser:class{parseFromString(html){
      return {querySelector:()=>html?{getAttribute:()=>html}:null};
    }},
    nicoUtil:{hasLargeThumbnail:()=>false},
    CommentPostTarget:{select:()=>({defaultThread:null,threadId:null,
      canPost:false,postUnavailableReason:'synthetic',optionalThreads:[]})},
    NicoSearchApiV2Loader:{lookupOwnerIds:()=>Promise.resolve(new Map())},
    emitter:{emitAsync:(name,data)=>{if(name==='loadVideoInfo')events.push(data);}},
    Config:{getValue:()=>false},debug:{},sessionStorage:{},
    console:quiet,window:{console:quiet},URLSearchParams,Promise,Object,Array,
    String,Number,Error,JSON,AbortController,AbortSignal,
    setTimeout:(fn,ms)=>{delays.push(ms);
      if(ms===5000&&pauseRetry)pendingRetries.push(fn);
      else queueMicrotask(fn);
      return 1;}
  };
  return {loader:loadLegacy(runtime,'VideoInfoLoader',ctx),queue,calls,events,logs,delays,pendingRetries,
    enqueue:entry=>queue.push(entry)};
}
test('without caller signal, Watch fetch retains original credentials/options and metadata event',async()=>{
  const h=harness();h.enqueue(response());
  const result=await settle(()=>h.loader.load(ID,{}));
  assert.equal(result.ok,true);
  assert.equal(result.value.isPlayable,true);
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].options.credentials,'include');
  assert.equal(Object.hasOwn(h.calls[0].options,'signal'),false);
  assert.equal(h.events.length,1);
});
test('pre-aborted caller signal rejects immediately without fetch, event or retry',async()=>{
  const h=harness(),controller=new AbortController();
  controller.abort(new Error('SYNTHETIC_PRIVATE_ABORT_PAYLOAD'));
  h.enqueue(response());
  const result=await settle(()=>h.loader.load(ID,{signal:controller.signal}));
  assert.equal(result.ok,false);
  assert.equal(result.error.reason,'cancelled');
  assert.equal(h.calls.length,0);
  assert.equal(h.events.length,0);
  assert.equal(h.delays.filter(ms=>ms===5000).length,0);
  assert.equal(JSON.stringify(h.logs).includes('SYNTHETIC_PRIVATE_ABORT_PAYLOAD'),false);
});
test('signal passes to primary fetch; abort after headers and delayed body prevents retry and event',async()=>{
  const h=harness(),controller=new AbortController(),body=deferred();
  h.enqueue({status:200,ok:true,text:()=>body.promise});
  const run=settle(()=>h.loader.load(ID,{signal:controller.signal}));
  for(let i=0;i<30&&!h.calls.length;i++)await Promise.resolve();
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].options.signal,controller.signal);
  controller.abort(new Error('PRIVATE_BODY_ABORT'));
  body.resolve(JSON.stringify(payload()));
  const result=await run;
  assert.equal(result.ok,false);
  assert.equal(result.error.reason,'cancelled');
  assert.equal(h.calls.length,1);
  assert.equal(h.events.length,0);
  assert.equal(h.delays.filter(ms=>ms===5000).length,0);
  assert.equal(JSON.stringify(h.logs).includes('PRIVATE_BODY_ABORT'),false);
});
test('signal passes to legacy fallback; abort before fallback JSON completes does not retry',async()=>{
  const h=harness(),controller=new AbortController(),body=deferred();
  h.enqueue(emptyPage());
  h.enqueue({status:200,ok:true,json:()=>body.promise});
  const run=settle(()=>h.loader.load(ID,{signal:controller.signal}));
  for(let i=0;i<80&&h.calls.length<2;i++)await Promise.resolve();
  assert.equal(h.calls.length,2);
  assert.equal(h.calls[1].options.signal,controller.signal);
  assert.match(h.calls[1].url,/responseType=json/);
  controller.abort();
  body.resolve(payload());
  const result=await run;
  assert.equal(result.ok,false);
  assert.equal(result.error.reason,'cancelled');
  assert.equal(h.calls.length,2);
  assert.equal(h.events.length,0);
});
test('non-aborted network failure still gets exactly one original 5-second retry',async()=>{
  const h=harness();h.enqueue(Promise.reject(new Error('synthetic transient network')));
  h.enqueue(response());
  const result=await settle(()=>h.loader.load(ID,{}));
  assert.equal(result.ok,true);
  assert.equal(h.calls.length,2);
  assert.equal(h.delays.filter(ms=>ms===5000).length,1);
  assert.equal(h.events.length,1);
});
test('caller signal still preserves original paid denial when not aborted',async()=>{
  const h=harness(),controller=new AbortController();
  h.enqueue(response(payload({paid:true,media:false})));
  const result=await settle(()=>h.loader.load(ID,{signal:controller.signal}));
  assert.equal(result.ok,false);
  assert.equal(result.error?.info?.isNeedPayment,true);
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0].options.signal,controller.signal);
  assert.equal(h.events.length,0);
});
test('caller abort during the original 5-second retry wait prevents a second request',async()=>{
  const h=harness({pauseRetry:true}),controller=new AbortController();
  h.enqueue(Promise.reject(new Error('synthetic temporary failure')));
  h.enqueue(response());
  const run=settle(()=>h.loader.load(ID,{signal:controller.signal}));
  for(let i=0;i<100&&!h.pendingRetries.length;i++)await new Promise(r=>setImmediate(r));
  assert.equal(h.pendingRetries.length,1,'expected a real retry delay before abort');
  assert.equal(h.calls.length,1);
  controller.abort();
  h.pendingRetries[0]();
  const result=await run;
  assert.equal(result.ok,false);
  assert.equal(result.error?.reason,'cancelled');
  assert.equal(h.calls.length,1);
  assert.equal(h.events.length,0);
});
