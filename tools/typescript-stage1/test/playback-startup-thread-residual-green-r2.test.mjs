// R2 isolated anonymous ThreadLoader console negative-to-green fixture.
// All identifiers, URLs and response payloads below are synthetic. No HTTP is performed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {read} from './nico-api-harness.mjs';

const ts=read('tools/typescript-stage1/nico-src/ThreadLoader.ts');
const js=read('packages/lib/src/nico/ThreadLoader.js');
const manifest=JSON.parse(read('tools/typescript-stage1/nico-api-manifests/ThreadLoader.json'));
const ID='SYNTH_R2_PRIVATE_IDENTIFIER_SENTINEL';
const SENTINEL='SYNTH_R2_FAKE_TOKEN_SENTINEL';
const SERVER='https://unit.invalid/';
const fakeInfo=()=>({
  videoId:ID,userId:ID,threadId:ID,language:'en-us',canPost:true,when:0,
  defaultThread:null,threads:[],nvComment:{server:SERVER,threadKey:SENTINEL,params:{language:'en-us'}}
});
function sliceMethod(start,end){
  const a=js.indexOf(start),b=a<0?-1:js.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'runtime method anchors exist');
  return js.slice(a,b).trim();
}
function capture(){
  const calls=[],timers=[];
  const add=(...args)=>calls.push(args);
  return {calls,timers,
    console:{log:add,error:add,warn:add,time:(v)=>{timers.push(['start',v]);add(v);},
      timeEnd:(v)=>{timers.push(['end',v]);add(v);}}};
}
function contains(value,marker,seen=new Set()){
  if(typeof value==='string')return value.includes(marker);
  if(!value||typeof value!=='object'||seen.has(value))return false;
  seen.add(value);
  return Reflect.ownKeys(value).some(key=>{
    const d=Object.getOwnPropertyDescriptor(value,key);
    return !!d&&Object.hasOwn(d,'value')&&contains(d.value,marker,seen);
  });
}
function noLeak(c){
  for(const token of [ID,SENTINEL])assert.equal(contains(c.calls,token),false,'no synthetic identifier/secret in console');
}
function subject(method,extra={}){
  const c=capture();
  const s=runInNewContext('({'+method+'\n})',{
    console:c.console,window:{console:c.console},URL,
    FRONT_ID:'6',FRONT_VER:'0',threadLogSequence:0,
    checkAbort:(signal)=>{if(signal?.aborted)throw Object.assign(new Error('synthetic abort'),{name:'AbortError'});},
    readJson:async()=>({meta:{status:200},data:{threads:[],globalComments:[]}}),
    CommentReadAdapter:{threads:(data)=>data},
    logSafe:{redact:(x)=>x}, // worst case: inherited redactor passes nested strings unchanged
    PopupMessage:{alert:()=>{}},debug:{},waitForRetry:async()=>{},
    netUtil:{fetch:async()=>({json:async()=>({meta:{status:200},data:{value:'synthetic'}})})},
    ...extra
  });
  return {s,c};
}

test('R2 canonical TS/runtime manifest hashes remain exact',()=>{
  const sha=(s)=>createHash('sha256').update(s,'utf8').digest('hex');
  assert.equal(sha(ts),manifest.sourceSha256);
  assert.equal(sha(js),manifest.runtimeSha256);
});

test('R2 retry: key and request URL preserved while console masks identifier and packet',async()=>{
  const requested=[],info=fakeInfo();
  const {s,c}=subject(sliceMethod('async _load(msgInfo, options = {}) {','async load(msgInfo, options = {}) {'),{
    readJson:async(url,options)=>{requested.push({url,options});
      return {meta:{status:200},data:{threads:[],globalComments:[]}};}
  });
  s.getThreadKey=async()=>({threadKey:SENTINEL});
  const result=await s._load(info,{retrying:true});
  assert.equal(result.__usedLanguage,'en-us');
  assert.equal(requested.length,1);
  assert.equal(requested[0].options.body.includes(SENTINEL),true);
  assert.equal(requested[0].options.method,'POST');
  assert.equal(requested[0].url.pathname,'/v1/threads');
  noLeak(c);
});

test('R2 failure: unchanged error wrapper but no nested Error/cause in console',async()=>{
  const error=new Error('synthetic failure '+SENTINEL);
  Object.defineProperty(error,'cause',{value:{identifier:ID,url:SERVER+SENTINEL},enumerable:false});
  error.status=403;error.errorCode='SYNTH_DENIED';
  const {s,c}=subject(sliceMethod('async _load(msgInfo, options = {}) {','async load(msgInfo, options = {}) {'),{
    readJson:async()=>{throw error;}
  });
  await assert.rejects(s._load(fakeInfo()),e=>e.result===error);
  noLeak(c);
});

test('R2 paired concurrent load timings: unique anonymous labels and language fallback',async()=>{
  const {s,c}=subject(sliceMethod('async load(msgInfo, options = {}) {','async getChallengeToken(siteKey) {'));
  s._load=async()=>({threads:[],globalComments:[],__usedLanguage:'ja-jp'});
  const [a,b]=await Promise.all([s.load(fakeInfo()),s.load(fakeInfo())]);
  assert.equal(a.format,'threads');assert.equal(b.format,'threads');
  assert.equal(c.timers.filter(v=>v[0]==='start').length,2);
  assert.equal(c.timers.filter(v=>v[0]==='end').length,2);
  const starts=c.timers.filter(v=>v[0]==='start').map(v=>v[1]);
  assert.notEqual(starts[0],starts[1],'parallel requests must not share a console timer label');
  for(const x of starts)assert.equal(c.timers.filter(v=>v[0]==='end'&&v[1]===x).length,1);
  noLeak(c);
});

test('R2 delete/reaction key request inputs are unchanged and console is anonymous',async()=>{
  const captured=[];
  const fetch=async(url,options)=>{captured.push({url,options});
    return {json:async()=>({meta:{status:200},data:{value:'synthetic'}})};};
  const del=subject(sliceMethod('async getDeleteKey(threadId, options = {}) {','async deleteChat(msgInfo, chat) {'),{
    netUtil:{fetch}
  });
  const nicoru=subject(sliceMethod('async getNicoruKey(threadId, options = {}) {','async nicoru(msgInfo, chat) {'),{
    netUtil:{fetch}
  });
  await del.s.getDeleteKey(ID,{fork:'owner'});
  await nicoru.s.getNicoruKey(ID);
  assert.equal(captured.length,2);
  assert.equal(captured.every(v=>v.url.includes(ID)),true);
  assert.equal(captured.every(v=>v.options.credentials==='include'),true);
  noLeak(del.c);noLeak(nicoru.c);
});

test('R2 comment-post diagnostics suppress identifier and nested user payload',()=>{
  const start='const logCommentPostDiagnostic = ',end='const summarizeCommentPostAck = ';
  const a=js.indexOf(start),b=a<0?-1:js.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a);
  const expression=js.slice(a+start.length,b).trim().replace(/;\s*$/,'');
  const c=capture();
  const report=runInNewContext('('+expression+')',{window:{console:c.console},logSafe:{redact:x=>x}});
  report({id:'cp-'+ID,attempt:1,videoId:ID,threadId:SENTINEL,language:'en-us'},
    'post-key','failure',{cause:{url:SERVER+SENTINEL},errorCode:SENTINEL,hasNo:true});
  noLeak(c);
});

test('R2 source and generated runtime keep console argument boundaries minimal',()=>{
  for(const text of [ts,js]){
    const lines=text.split(/\r?\n/);
    assert.equal(lines.some(x=>/console\.log\('threadKey \(retry\):/.test(x)),false);
    assert.equal(lines.some(x=>/console\.log\('load threads\.\.\.'/ .test(x)),false);
    assert.equal(lines.some(x=>/console\.log\('get(Delete|Nicoru)Key url:/.test(x)),false);
    assert.equal(lines.some(x=>/loadComment videoId:/.test(x)),false);
    assert.equal(lines.some(x=>/console\.log\('threadInfo:/.test(x)),false);
    assert.equal(lines.some(x=>/console\.log\('(put|post) packet:/.test(x)),false);
  }
});
