// R3 isolated, anonymous ThreadLoader module-private debug retention tests.
// No live network, actual identifiers, URLs, credentials or public debug exports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {read} from './nico-api-harness.mjs';

const ts = read('tools/typescript-stage1/nico-src/ThreadLoader.ts');
const js = read('packages/lib/src/nico/ThreadLoader.js');
const manifest = JSON.parse(read('tools/typescript-stage1/nico-api-manifests/ThreadLoader.json'));
const begin = js.indexOf('async load(msgInfo, options = {}) {');
const end = js.indexOf('async getChallengeToken(siteKey) {', begin + 1);
assert.ok(begin >= 0 && end > begin, 'exact generated load() method anchors');
const method = js.slice(begin, end).trim();
const makeInfo = () => ({
  videoId:'SYNTH_R3_VIDEO', userId:'SYNTH_R3_USER', threadId:'SYNTH_R3_THREAD',
  threads:[{id:'SYNTH_R3_THREAD',forkLabel:'main'}],
  nvComment:{params:{language:'ja-jp'}}, language:'ja-jp',
  canPost:true,when:0,defaultThread:{is184Forced:false}
});
const payload = () => ({
  globalComments:[{count:4}], threads:[{id:'SYNTH_R3_THREAD',fork:'main',commentCount:4,
    nested:{content:'SYNTH_R3_PRIVATE_PAYLOAD'}}]
});
function fixture({initialBag = {}, loader = async () => payload()} = {}) {
  const bag = initialBag, events = [];
  const logger = {log:()=>{},error:()=>{},warn:()=>{},
    time:(key)=>events.push(['start',key]),timeEnd:(key)=>events.push(['end',key])};
  const checkAbort = (signal) => {
    if(signal?.aborted) throw Object.assign(new Error('synthetic abort'),{name:'AbortError'});
  };
  const loaderObject = runInNewContext('({' + method + '\n})',{
    console:logger,window:{console:logger},debug:bag,threadLogSequence:0,
    checkAbort,logSafe:{redact:value=>value},PopupMessage:{alert:()=>{}},waitForRetry:async()=>{}
  });
  loaderObject._load = loader;
  return {loaderObject,bag,events};
}
test('R3 initial legacy debug reference is evicted before successful new request', async () => {
  const old = {secret:{nested:'SYNTH_R3_OLD_PAYLOAD'}};
  const f = fixture({initialBag:{lastMessageServerResult:old}});
  const result = await f.loaderObject.load(makeInfo());
  assert.equal(result.format,'threads');
  assert.equal(result.body.globalComments[0].count,4);
  assert.equal(result.threadInfo.totalResCount,4);
  assert.equal(result.body.threads[0].info.id,'SYNTH_R3_THREAD');
  assert.equal(Object.hasOwn(f.bag,'lastMessageServerResult'),false,
    'debug must never retain the full nested result');
  assert.equal(f.events.filter(([type])=>type==='end').length,1);
});
test('R3 return value keeps exact synthetic nested response object', async () => {
  const body = payload();
  const f = fixture({loader:async()=>body});
  const returned = await f.loaderObject.load(makeInfo());
  assert.equal(returned.body,body,'normal comment response identity is preserved');
  assert.equal(body.threads[0].nested.content,'SYNTH_R3_PRIVATE_PAYLOAD');
  assert.equal(Object.hasOwn(f.bag,'lastMessageServerResult'),false);
});
test('R3 a following paid/rights failure does not leave previous debug payload', async () => {
  const previous = payload();
  const f = fixture({initialBag:{lastMessageServerResult:previous},
    loader:async()=>{throw {result:{status:403,errorCode:'SYNTH_DENIED'}};}});
  await assert.rejects(f.loaderObject.load(makeInfo()), e => e.result.status===403);
  assert.equal(Object.hasOwn(f.bag,'lastMessageServerResult'),false);
});
test('R3 pre-aborted call clears any old debug reference without network', async () => {
  let calls=0;
  const f=fixture({initialBag:{lastMessageServerResult:payload()},
    loader:async()=>{calls++;return payload();}});
  const controller=new AbortController();
  controller.abort();
  await assert.rejects(f.loaderObject.load(makeInfo(),{signal:controller.signal}),
    e=>e.name==='AbortError');
  assert.equal(calls,0);
  assert.equal(Object.hasOwn(f.bag,'lastMessageServerResult'),false);
});
test('R3 aborted in-flight result is rejected and not cached in debug', async () => {
  const controller=new AbortController();
  let release;
  const f=fixture({initialBag:{lastMessageServerResult:payload()},
    loader:()=>new Promise(resolve => { release=resolve; })});
  const pending=f.loaderObject.load(makeInfo(),{signal:controller.signal});
  controller.abort();
  release(payload());
  await assert.rejects(pending,e=>e.name==='AbortError');
  assert.equal(Object.hasOwn(f.bag,'lastMessageServerResult'),false);
});
test('R3 concurrent synthetic loads preserve both results without diagnostic retention', async () => {
  const f=fixture(), a=payload(), b=payload();
  const queued=[a,b];
  f.loaderObject._load=async()=>queued.shift();
  const both=await Promise.all([f.loaderObject.load(makeInfo()),f.loaderObject.load(makeInfo())]);
  assert.equal(both[0].body,a);assert.equal(both[1].body,b);
  assert.equal(Object.hasOwn(f.bag,'lastMessageServerResult'),false);
  assert.equal(f.events.filter(([kind])=>kind==='start').length,2);
});
test('R3 source and runtime are manifest-identical (not proof of pinned emitter run)', () => {
  const sha = text => createHash('sha256').update(text,'utf8').digest('hex');
  assert.equal(sha(ts),manifest.sourceSha256);
  assert.equal(sha(js),manifest.runtimeSha256);
  assert.doesNotMatch(js,/export\s*\{[^}]*\bdebug\b/);
  assert.doesNotMatch(ts,/export\s+const\s+debug\b/);
});
