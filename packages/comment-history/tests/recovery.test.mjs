import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeWatch,withThreadKey} from '../src/core.mjs';
import {requestThreadKey,requestWatchContext,safeError} from '../src/transport.mjs';
import {watch,KEY,response} from './fixtures.mjs';
const ctx=()=>normalizeWatch(watch(),'sm1');
test('threadKey clone is immutable, private and preserves context identity',()=>{
 const c=ctx(),n=withThreadKey(c,'NEW_PRIVATE_KEY');assert.equal(c.threadKey,KEY);assert.equal(n.threadKey,'NEW_PRIVATE_KEY');
 assert.equal(n.videoId,c.videoId);assert.deepEqual(n.targets,c.targets);assert(Object.isFrozen(n));assert(!JSON.stringify(n).includes('NEW_PRIVATE_KEY'));
});
test('key refresh uses exact read-only GET endpoint and session credentials',async()=>{
 const c=ctx();const n=await requestThreadKey(c,{fetchImpl:async(url,init)=>{
  assert.equal(url,'https://nvapi.nicovideo.jp/v1/comment/keys/thread?videoId=sm1');assert.equal(init.method,'GET');assert.equal(init.credentials,'include');assert.equal(init.redirect,'error');
  assert.equal(init.body,undefined);return response({meta:{status:200},data:{threadKey:'NEW_PRIVATE_KEY'}});
 }});assert.equal(n.threadKey,'NEW_PRIVATE_KEY');assert.equal(c.threadKey,KEY);
});
test('malformed or empty refreshed key is rejected',async()=>{
 for(const key of ['',null,42])await assert.rejects(()=>requestThreadKey(ctx(),{fetchImpl:async()=>response({meta:{status:200},data:{threadKey:key}})}),e=>e.code==='MISSING_KEY');
});
test('refresh failure is sanitized, not interpreted as an empty page',async()=>{
 await assert.rejects(()=>requestThreadKey(ctx(),{fetchImpl:async()=>response({meta:{status:403,errorCode:'FORBIDDEN',message:'SECRET'}},403)}),e=>e.code==='API_ERROR'&&!JSON.stringify(e).includes('SECRET'));
});
test('metadata GET is bounded and unwraps current watchV4 format',async()=>{
 const c=await requestWatchContext('sm1',{fetchImpl:async(url,init)=>{assert.equal(url,'https://www.nicovideo.jp/watch/sm1?responseType=json');assert.equal(init.credentials,'include');return response(watch());}});
 assert.equal(c.videoId,'sm1');assert(!JSON.stringify(c).includes(KEY));
});
test('metadata mismatched video and excessive body fail explicitly',async()=>{
 await assert.rejects(()=>requestWatchContext('sm1',{fetchImpl:async()=>response(watch('sm2'))}),e=>e.code==='VIDEO_MISMATCH');
 await assert.rejects(()=>requestWatchContext('sm1',{maxBytes:10,fetchImpl:async()=>response(watch())}),e=>e.code==='RESPONSE_TOO_LARGE');
});
test('new diagnostics preserve machine reasons without copying arbitrary fields',()=>{
 assert.equal(safeError({code:'TIME_LIMIT',secret:'x'}).code,'TIME_LIMIT');assert.equal(safeError({code:'REQUEST_LIMIT'}).code,'REQUEST_LIMIT');
 assert.deepEqual(safeError({code:'RETRY_LIMIT',causeCode:'NETWORK_ERROR',secret:'x'}),{code:'RETRY_LIMIT',causeCode:'NETWORK_ERROR'});
});
