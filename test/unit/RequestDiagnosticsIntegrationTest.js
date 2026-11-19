'use strict';
const assert=require('assert');
const {createContext,beginSection,run}=require('../helpers/extractSource');
function world(extra={}){
 const events=[];const ctx=createContext({AbortController,...extra});
 run(beginSection('packages/lib/src/infra/RequestDiagnostics.js')+
   ';globalThis.diag=RequestDiagnostics;',ctx);
 ctx.diag.setSink(e=>events.push(e));return {ctx,events};
}
describe('Request diagnostics live source wiring (offline)',()=>{
 it('does not report a superseded video transport failure even without caller abort',async()=>{
  let release,first=true;
  const {ctx,events}=world({CacheStorage:class {},sessionStorage:{},debug:{},location:{host:'www.nicovideo.jp'},
   Config:{getValue:()=>false},emitter:{emitAsync(){}},textUtil:{},nicoUtil:{},
   setTimeout:(fn,ms)=>setTimeout(fn,ms===5000?0:ms),
   fetch:async()=>{if(first){first=false;return new Promise(r=>{release=r;});}
    return {status:200,json:async()=>({meta:{status:200},data:{response:{}}})};}});
  run(beginSection('packages/lib/src/infra/netUtil.js')+beginSection('packages/lib/src/nico/VideoInfoLoader.js')+
    ';globalThis.loader=VideoInfoLoader;',ctx);
  const old=ctx.loader.load('sm9',{}).catch(e=>e);
  await assert.rejects(ctx.loader.load('sm10',{}));
  release({status:503,text:async()=>''});await old;
  assert.equal(events.length,1);assert.equal(events[0].phase,'response');
 });
 it('strips local ownership callbacks from the wire and suppresses late failures',async()=>{
  let active=true,resolve,wire;
  const {ctx,events}=world({location:{host:'www.nicovideo.jp'},fetch:(_url,options)=>{
   wire=options;return new Promise(r=>{resolve=r;});},NicoVideoApi:{fetch:(_url,options)=>{wire=options;return Promise.resolve({status:503});}}});
  run(beginSection('packages/lib/src/infra/netUtil.js')+';globalThis.net=netUtil;',ctx);
  const options={diagnosticActive:()=>active};
  const pending=ctx.net.fetch('https://www.nicovideo.jp/watch/sm9',options);
  assert(!('diagnosticActive' in wire));assert.equal(typeof options.diagnosticActive,'function');
  active=false;resolve({status:503});await pending;assert.equal(events.length,0);
  ctx.location.host='ext.nicovideo.jp';await ctx.net.fetch('https://www.nicovideo.jp/watch/sm9',options);
  assert(!('diagnosticActive' in wire));assert.equal(events.length,0);
 });
 it('records an unusable video response as schema failure',async()=>{
  const {ctx,events}=world({CacheStorage:class {},sessionStorage:{},debug:{},
   Config:{getValue:()=>false},emitter:{emitAsync(){}},textUtil:{},nicoUtil:{},
   netUtil:{fetch:async()=>({json:async()=>({meta:{status:200},data:{response:{}}})})}});
  run(beginSection('packages/lib/src/nico/VideoInfoLoader.js')+';globalThis.loader=VideoInfoLoader;',ctx);
  await assert.rejects(ctx.loader.load('sm9',{}));
  assert.equal(events.length,1);assert.equal(events[0].reason,'schema');
  assert.equal(events[0].phase,'response');
 });
 it('records history reads and key refreshes from the player, including recovery and cancellation',async function(){
  this.timeout(20000);
  const {JSDOM}=require('jsdom');
  const {watch,body,response,KEY}=await import('../../packages/comment-history/tests/fixtures.mjs');
  const dom=new JSDOM('',{url:'https://www.nicovideo.jp/'});
  const window=dom.window;
  let read=()=>response({meta:{status:200},data:{detail:'PRIVATE_BODY'}});
  const {ctx,events}=world({window,TextDecoder,performance,fetch:(...args)=>read(...args)});
  run(beginSection('packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js')+
    beginSection('src/NicoVideoPlayerDialogComments.js')+
    ';globalThis.playerComments=NicoVideoPlayerDialogComments;',ctx);
  const dialog={_nicoVideoPlayer:{clearCommentHistory(){},applyHistoryThreads(){}},execCommand(){}};
  const feature=ctx.playerComments._ensureCommentHistory.call(dialog);
  try{
   feature.preferences.patch({maxRetries:0});
   feature.controller.setEnabled(true);
   const load=id=>{
    const {comment}=watch(id).data.response.$watchV4.data;
    const threads=comment.threads.map(t=>({...t,label:t.forkLabel,layer:{index:0}}));
    return feature.controller.normalReady({generation:id,videoInfo:{videoId:id,contextWatchId:id,duration:120,
     msgInfo:{videoId:id,nvComment:comment.nvComment,threads}},
     result:{format:'threads',threadInfo:{videoId:id,threadId:'10',language:'ja-jp',isWaybackMode:false},
      body:{threads:threads.map(t=>({id:String(t.id),fork:t.forkLabel,commentCount:0,comments:[]}))}}});
   };
   for(const id of ['sm21','sm22','sm23'])await load(id);
   assert.equal(feature.controller.state.reason,'response_schema');
   assert.deepEqual(events.map(e=>e.reason),['schema','schema','spec-change','schema']);
   assert.equal(events[2].distinctTargets,3);
   for(const e of events){
    assert.equal(e.operation,'comment-history-read');assert.equal(e.errorCode,'RESPONSE_SCHEMA');
    assert(e.message.startsWith('コメント増量（過去のコメントを追加取得）'));
    assert.equal(e.missing,'data.threads');assert.equal(e.module,'packages/comment-history/src/core.mjs');
   }
   read=()=>{throw new TypeError('PRIVATE_NETWORK_ERROR');};
   // Even when a budget stops the coordinator before it can schedule its retry, retain the wire failure.
   feature.preferences.patch({maxRetries:1,maxRequests:1});
   await load('sm29');
   assert.equal(feature.controller.state.reason,'request_limit');
   assert.equal(events.at(-1).reason,'network');
   read=()=>response(body());
   await feature.controller.restart();
   assert.equal(events.at(-1).outcome,'recovered');
   assert.equal(events.at(-1).key,events.at(-2).key);
   const count=events.length;
   let entered;const pending=new Promise(resolve=>{entered=resolve;});
   read=()=>{entered();return new Promise(()=>{});};
   const loading=feature.controller.restart();
   await pending;feature.controller.stop();await loading;
   assert.equal(events.length,count);
   for(const secret of [KEY,'PRIVATE_BODY','PRIVATE_NETWORK_ERROR','sm29','public.nvcomment','threadKey']){
    assert(!JSON.stringify(events).includes(secret));
   }
   feature.preferences.patch({maxRetries:0,maxRequests:5,maxKeyRefreshes:1});
   const denied=()=>response({meta:{status:400,errorCode:'INVALID_TOKEN'}},400);
   let key=()=>response({meta:{status:200},data:{threadKey:'  '}});
   read=url=>String(url).includes('/keys/thread?')?key():denied();
   const offset=events.length;
   await load('sm30');
   assert.deepEqual(events.slice(offset).map(e=>[e.operation,e.reason,e.missing]),[
    ['comment-history-read','permission',undefined],['comment-key','schema','data.threadKey']
   ]);
   assert.equal(events.at(-1).errorCode,'RESPONSE_SCHEMA');
   assert.equal(events.at(-1).module,'packages/comment-history/src/core.mjs');
   const keyFailed=events.at(-1).key;
   key=()=>response({meta:{status:200},data:{threadKey:'PRIVATE_RENEWED_KEY'}});
   await feature.controller.restart();
   assert.deepEqual(events.slice(offset+2).map(e=>[e.operation,e.reason]),[
    ['comment-history-read','permission'],['comment-key','recovered'],['comment-history-read','permission']
   ]);
   assert.equal(events.at(-2).key,keyFailed);
   key=()=>response({meta:{status:401,errorCode:'UNAUTHORIZED'},data:{threadKey:'PRIVATE_REJECTED_KEY'}},200);
   await feature.controller.restart();
   const deniedKey=events.at(-1);
   assert.deepEqual([deniedKey.operation,deniedKey.reason,deniedKey.statusCode,deniedKey.apiStatus],['comment-key','permission',200,401]);
   const beforeCancel=events.length;
   let startKey;const keyStarted=new Promise(resolve=>{startKey=resolve;});
   key=()=>{startKey();return new Promise(()=>{});};
   const refreshing=feature.controller.restart();
   await keyStarted;feature.controller.stop();await refreshing;
   assert.deepEqual(events.slice(beforeCancel).map(e=>e.operation),['comment-history-read']);
   for(const secret of [KEY,'PRIVATE_RENEWED_KEY','sm30'])assert(!JSON.stringify(events).includes(secret));
  }finally{feature.dispose();window.close();}
 });
 it('keeps rejected history keys distinct from a repeated API format change',()=>{
  for(const [code,apiCode] of [['TOKEN_INVALID','INVALID_TOKEN'],['TOKEN_EXPIRED','EXPIRED_TOKEN']]){
   const {ctx,events}=world();
   for(const video of ['sm21','sm22','sm23']){
    ctx.diag.begin('comment-history-read',video,'response').failure({code,apiCode,httpStatus:400});
   }
   assert.equal(events.length,3);
   for(const event of events){
    assert.equal(event.reason,'permission');
    assert.equal(event.errorCode,apiCode);
    assert.equal(event.statusCode,400);
   }
  }
 });
 it('records malformed comment keys and recovery without retaining the key',async()=>{
  let status,meta={status:200},data={};
  const {ctx,events}=world({debug:{},sleep:async()=>{},PopupMessage:{alert(){}},
   netUtil:{fetch:async()=>({status,json:async()=>({meta,data})})}});
  run(beginSection('packages/lib/src/nico/ThreadLoader.js')+';globalThis.loader=ThreadLoader;',ctx);
  await assert.rejects(ctx.loader.getThreadKey('sm9'));
  data={threadKey:'private-key-value'};await ctx.loader.getThreadKey('sm9');
  assert.equal(events[0].reason,'schema');assert.equal(events[0].missing,'data.threadKey');
  assert.equal(events[0].module,'packages/comment-history/src/core.mjs');
  assert.equal(events[1].outcome,'recovered');
  meta={status:200,errorCode:'UNKNOWN_PRIVATE_CODE',missing:'PRIVATE_FIELD',message:'PRIVATE_DETAIL'};
  data={threadKey:'PRIVATE_REJECTED_KEY'};
  await assert.rejects(ctx.loader.getThreadKey('sm9'));
  assert.equal(ctx.loader._threadKeys.sm9,'private-key-value');
  assert.equal(events.at(-1).reason,'service');assert.equal(events.at(-1).errorCode,'OTHER');
  assert.equal(events.at(-1).missing,undefined);
  assert.equal(events.at(-1).statusCode,undefined);
  assert.equal(events.at(-1).apiStatus,200);
  status=200;meta={status:401,errorCode:'UNAUTHORIZED'};
  await assert.rejects(ctx.loader.getThreadKey('sm9'),e=>e.result===meta);
  assert.deepEqual([events.at(-1).reason,events.at(-1).statusCode,events.at(-1).apiStatus],['permission',200,401]);
  meta={status:200};data={threadKey:'PRIVATE_FRESH_KEY'};
  assert.equal((await ctx.loader.getThreadKey('sm9')).threadKey,'PRIVATE_FRESH_KEY');
  assert.equal(events.at(-1).outcome,'recovered');
  for(const value of ['private-key-value','UNKNOWN_PRIVATE_CODE','PRIVATE_FIELD','PRIVATE_DETAIL','PRIVATE_REJECTED_KEY','PRIVATE_FRESH_KEY']){
   assert(!JSON.stringify(events).includes(value));
  }
 });
 it('reports only validated key recovery when the normal reader uses the real netUtil',async()=>{
  let status=503,meta={status:503};
  const {ctx,events}=world({debug:{},location:{host:'www.nicovideo.jp'},
   fetch:async(_url,opts)=>{assert(!('diagnosticActive' in opts));return {status,json:async()=>({meta,data:{threadKey:'PRIVATE_KEY'}})};}});
  run(beginSection('packages/lib/src/infra/netUtil.js')+beginSection('packages/lib/src/nico/ThreadLoader.js')+
   ';globalThis.loader=ThreadLoader;',ctx);
  await assert.rejects(ctx.loader.getThreadKey('sm9'));
  status=200;meta={status:401,errorCode:'UNAUTHORIZED'};
  await assert.rejects(ctx.loader.getThreadKey('sm9'));
  meta={status:200};await ctx.loader.getThreadKey('sm9');
  assert.deepEqual(events.map(e=>[e.operation,e.phase,e.outcome,e.statusCode,e.apiStatus]),[
   ['comment-key','response','failed',503,503],['comment-key','response','failed',200,401],
   ['comment-key','response','recovered',undefined,undefined]
  ]);
 });
 it('observes direct and delegated transport without consuming bodies or replacing failures',async()=>{
  const failure=Object.assign(new Error('must not log raw errors'),{name:'timeout'});
  let response={status:503,json(){throw Error('body must not be read');}},reject=false;
  const {ctx,events}=world({location:{host:'www.nicovideo.jp'},fetch:()=>reject?Promise.reject(failure):Promise.resolve(response),
   NicoVideoApi:{fetch:()=>Promise.resolve(response)}});
  run(beginSection('packages/lib/src/infra/netUtil.js')+';globalThis.net=netUtil;',ctx);
  const url='https://nvapi.nicovideo.jp/v1/videos/sm9';
  assert.strictEqual(await ctx.net.fetch(url),response);assert.equal(events.length,1);
  response={status:200};assert.strictEqual(await ctx.net.fetch(url),response);assert.equal(events[1].outcome,'recovered');
  reject=true;await assert.rejects(ctx.net.fetch(url),e=>e===failure);assert.equal(events[2].reason,'timeout');
  ctx.location.host='ext.nicovideo.jp';response={status:403};
  assert.strictEqual(await ctx.net.fetch(url),response);assert.equal(events[3].reason,'permission');
  assert(!JSON.stringify(events).includes('must not log'));
 });
 it('excludes caller cancellation while preserving its custom rejection identity',async()=>{
  const controller=new AbortController(),reason={private:'custom cancellation'};controller.abort(reason);
  const {ctx,events}=world({location:{host:'www.nicovideo.jp'},fetch:()=>{throw Error('must not fetch');}});
  run(beginSection('packages/lib/src/infra/netUtil.js')+';globalThis.net=netUtil;',ctx);
  await assert.rejects(ctx.net.fetch('https://www.nicovideo.jp/watch/sm9',{signal:controller.signal}),e=>e===reason);
  assert.equal(events.length,0);
 });
 it('observes session failures/recovery and abnormal state, but not manual close',async()=>{
  let fail=true;const failure={status:503};
  const state={sessionId:'session',isAbnormallyClosed:true};
  const {ctx,events}=world({workerUtil:{createCrossMessageWorker:()=>({post:async ({command})=>{
   if(command==='create')return {sessionId:'session'};
   if(command==='connect'){if(fail)throw failure;return state;}
   return state;
  }})}});
  run(beginSection('packages/lib/src/nico/VideoSessionWorker.js')+';globalThis.worker=VideoSessionWorker;',ctx);
  const handle=await ctx.worker.create({videoInfo:{toJSON:()=>({watchId:'sm9'})},serverType:'domand'});
  await assert.rejects(handle.connect(),e=>e===failure);fail=false;
  assert.strictEqual(await handle.connect(),state);assert.equal(events[1].outcome,'recovered');
  assert.strictEqual(await handle.getState(),state);assert.equal(events[2].reason,'session-closed');
  await handle.close();await handle.getState();assert.equal(events.length,3);
 });
});
