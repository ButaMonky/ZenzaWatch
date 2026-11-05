// B18 private lane-02 synthetic console privacy regression; no real IDs, secrets or HTTP.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {read} from './nico-api-harness.mjs';

const ts=read('tools/typescript-stage1/nico-src/ThreadLoader.ts');
const js=read('packages/lib/src/nico/ThreadLoader.js');
const manifest=JSON.parse(read('tools/typescript-stage1/nico-api-manifests/ThreadLoader.json'));
const ID='SYNTH_B18_FAKE_ID_SENTINEL';
const KEY='SYNTH_B18_FAKE_KEY_SENTINEL';
function method(a,b) {
  const i=js.indexOf(a), j=i<0 ? -1 : js.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i,'generated method boundary');
  return js.slice(i,j).trim();
}
const getKey=method('async getThreadKey(videoId, options = {}) {','async getPostKey(threadId, options = {}) {');
const getPost=method('async getPostKey(threadId, options = {}) {','async _delete(url, body, options = {}) {');
function has(value,marker,seen=new Set()) {
  if(typeof value==='string')return value.includes(marker);
  if(!value||typeof value!=='object'||seen.has(value))return false;
  seen.add(value);
  return Reflect.ownKeys(value).some((key)=>{
    const desc=Object.getOwnPropertyDescriptor(value,key);
    return !!desc&&Object.hasOwn(desc,'value')&&has(desc.value,marker,seen);
  });
}
function harness(code,{readJson=async()=>({meta:{status:200},data:{threadKey:KEY}}),
  checkAbort=()=>{},getPostKey=async()=>({postKey:KEY})}={}) {
  const calls=[];
  const subject=runInNewContext('({' + code + '\n})',{
    console:{log:(...args)=>calls.push(args)},
    FRONT_ID:1, FRONT_VER:'SYNTH_B18',
    readJson,checkAbort,
    CommentReadAdapter:{threadKey:(data)=>({threadKey:data.threadKey})},
    CommentPostWire:{getPostKey}
  });
  subject._threadKeys={};
  return {subject,calls};
}
function safe(calls){assert.equal(has(calls,ID),false);assert.equal(has(calls,KEY),false);}
test('B18 canonical static anchors, runtime and exact manifest hashes',()=>{
  assert.match(ts,/console\.log\('getThreadKey request'\)/);
  assert.match(ts,/console\.log\('getPostKey request'\)/);
  assert.doesNotMatch(getKey,/console\.log\([^)]*\burl\b/);
  assert.doesNotMatch(getPost,/console\.log\([^)]*\burl\b/);
  const sha=(v)=>createHash('sha256').update(v,'utf8').digest('hex');
  assert.equal(sha(ts),manifest.sourceSha256);
  assert.equal(sha(js),manifest.runtimeSha256);
});
test('B18 key success: preserves synthetic request, options, cache, suppresses console identifier/key',async()=>{
  const requests=[],signal={aborted:false};
  const {subject,calls}=harness(getKey,{readJson:async(url,opts)=>{
    requests.push({url,opts});return {meta:{status:200},data:{threadKey:KEY}};
  }});
  const out=await subject.getThreadKey(ID,{signal});
  assert.equal(out.threadKey,KEY);
  assert.equal(subject._threadKeys[ID],KEY);
  assert.equal(requests.length,1);
  assert.ok(requests[0].url.includes(ID)); // local fake spy; no actual network.
  assert.equal(requests[0].opts.credentials,'include');
  assert.equal(requests[0].opts.signal,signal);
  assert.equal(requests[0].opts.headers['X-Frontend-Id'],1);
  assert.equal(requests[0].opts.headers['X-Frontend-Version'],'SYNTH_B18');
  safe(calls);
});
test('B18 synthetic paid/rights denial preserved, no cache or log',async()=>{
  const {subject,calls}=harness(getKey,{readJson:async()=>({
    meta:{status:403,errorCode:'SYNTH_DENIED'},data:{threadKey:KEY}
  })});
  await assert.rejects(subject.getThreadKey(ID),(e)=>e.result.status===403&&e.result.errorCode==='SYNTH_DENIED');
  assert.equal(subject._threadKeys[ID],undefined);
  safe(calls);
});
test('B18 aborted request keeps error wrapper, does not cache or log',async()=>{
  const signal={aborted:true},abort=new Error('SYNTH_ABORT');abort.name='AbortError';
  const {subject,calls}=harness(getKey,{checkAbort:(s)=>{assert.equal(s,signal);throw abort;}});
  await assert.rejects(subject.getThreadKey(ID,{signal}),(e)=>e.result===abort&&e.message.includes(ID));
  assert.equal(subject._threadKeys[ID],undefined);
  safe(calls);
});
test('B18 nested Error preserved only as existing rejection, not raw console',async()=>{
  const e=new Error('SYNTH_NETWORK_FAILURE');
  Object.defineProperty(e,'cause',{value:{hidden:KEY},enumerable:false});
  const {subject,calls}=harness(getKey,{readJson:async()=>{throw e;}});
  await assert.rejects(subject.getThreadKey(ID),(v)=>v.result===e);
  safe(calls);
});
test('B18 post-key request keeps language/id, console no interpolated URL',async()=>{
  const requests=[];
  const {subject,calls}=harness(getPost,{getPostKey:async(id,lang)=>{
    requests.push({id,lang});return {postKey:KEY};
  }});
  const out=await subject.getPostKey(ID,{language:'en-us'});
  assert.equal(out.postKey,KEY);
  assert.equal(requests.length,1);
  assert.equal(requests[0].id,ID);
  assert.equal(requests[0].lang,'en-us');
  safe(calls);
});
