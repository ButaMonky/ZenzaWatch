'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {stripTypeScriptTypes}=require('node:module');
function harness(){
 const p='tools/typescript-stage1/nico-src/RequestDiagnostics.ts';
 assert(fs.existsSync(p),'RequestDiagnostics missing');
 const source=stripTypeScriptTypes(fs.readFileSync(p,'utf8')).replace(/^export\s*\{[^}]*\};?\s*$/gm,'');
 const ctx=vm.createContext({URL,Date,Map,Set,WeakMap,Math});
 vm.runInContext(source+';globalThis.diag=RequestDiagnostics;',ctx);
 const events=[];ctx.diag.setSink(event=>events.push(event));return {diag:ctx.diag,events};
}
describe('Request diagnostics boundaries',()=>{
 it('keeps pending failures and recovery despite unrelated successful traffic',()=>{
  const {diag,events}=harness();
  const pending=diag.begin('video-info','pending','response');
  for(let i=0;i<150;i++)diag.begin('search','other'+i,'response').success();
  pending.failure({status:503});assert.equal(events.length,1);
  for(let i=0;i<150;i++)diag.begin('search','later'+i,'response').success();
  diag.begin('video-info','pending','response').success();assert.equal(events[1].outcome,'recovered');
  const tickets=Array.from({length:150},(_,i)=>diag.begin('search','pending'+i,'response'));
  tickets[0].failure({status:503});assert.equal(events.length,3);
  tickets.slice(1).forEach(t=>t.success());
 });
 it('reports safe transport failure and recovery without altering the response',()=>{
  const {diag,events}=harness();
  const url='https://nvapi.nicovideo.jp/v1/videos/sm9?token=DO_NOT_STORE';
  diag.startRequest(url).response({status:503});
  diag.startRequest(url).response({status:200});
  assert.equal(events.length,2);assert.equal(events[0].reason,'http');
  assert.equal(events[1].outcome,'recovered');assert.equal(events[0].key,events[1].key);
  assert(!JSON.stringify(events).includes('DO_NOT_STORE'));assert(!JSON.stringify(events).includes('/v1/'));
 });
 it('does not record ordinary success, cancellation, unknown hosts or superseded results',()=>{
  const {diag,events}=harness();const url='https://www.nicovideo.jp/watch/sm9';
  diag.startRequest(url).response({status:200});
  diag.startRequest(url,{aborted:true}).failure({name:'Error',message:'private'});
  diag.startRequest('https://unrelated.invalid/api').failure(new Error('private'));
  const old=diag.startRequest(url),current=diag.startRequest(url);
  current.failure({name:'timeout'});old.response({status:200});
  assert.equal(events.length,1);assert.equal(events[0].reason,'timeout');
 });
 it('keeps semantic errors separate from HTTP recovery and ignores inactive owners',()=>{
  const {diag,events}=harness();
  diag.begin('video-info','sm9','response').failure({errorCode:'WATCH_SCHEMA',message:'private'});
  diag.startRequest('https://www.nicovideo.jp/watch/sm9').response({status:200});
  diag.begin('video-info','sm9','response',()=>false).failure({status:500});
  assert.equal(events.length,1);assert.equal(events[0].reason,'schema');
  diag.begin('video-info','sm9','response').success();assert.equal(events[1].outcome,'recovered');
 });
 it('isolates a throwing sink and classifies unavailable resources',()=>{
  const {diag,events}=harness();diag.begin('video-info','sm9','response').failure({reason:'not found',statusCode:404});
  assert.equal(events[0].reason,'not-found');
  diag.setSink(()=>{throw Error('sink failure');});
  assert.doesNotThrow(()=>diag.begin('video-info','sm10','response').failure({name:'TypeError'}));
 });
});
