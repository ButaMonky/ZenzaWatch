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
 it('records malformed comment keys and recovery without retaining the key',async()=>{
  let data={};const {ctx,events}=world({debug:{},sleep:async()=>{},PopupMessage:{alert(){}},
   netUtil:{fetch:async()=>({json:async()=>({meta:{status:200},data})})}});
  run(beginSection('packages/lib/src/nico/ThreadLoader.js')+';globalThis.loader=ThreadLoader;',ctx);
  await assert.rejects(ctx.loader.getThreadKey('sm9'));
  data={threadKey:'private-key-value'};await ctx.loader.getThreadKey('sm9');
  assert.equal(events[0].reason,'schema');assert.equal(events[1].outcome,'recovered');
  assert(!JSON.stringify(events).includes('private-key-value'));
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
