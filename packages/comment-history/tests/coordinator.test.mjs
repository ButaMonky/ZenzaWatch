import test from 'node:test';import assert from 'node:assert/strict';
import {RequestCoordinator} from '../src/coordinator.mjs';import {HistoryError} from '../src/core.mjs';
const error=code=>e=>e.code===code;
function fixture(settings={}){let time=0;const waits=[];return {get time(){return time;},advance(ms){time+=ms;},waits,
 q:new RequestCoordinator({settings,now:()=>time,sleep:async(ms,signal)=>{if(signal?.aborted)throw new HistoryError('CANCELLED');waits.push(ms);time+=ms;},random:()=>0})};}
test('429 honors all Retry-After and counts both attempts',async()=>{
 const f=fixture();let calls=0;const r=await f.q.execute(async()=>{if(!calls++)throw new HistoryError('RATE_LIMITED',{retryAfterMs:10000});return 7;});
 assert.equal(r,7);assert.equal(calls,2);assert(f.time>=10000);assert.equal(f.q.stats().attempts,2);assert.equal(f.q.stats().retries,1);
});
test('Retry-After longer than remaining budget stops without early retry',async()=>{
 const f=fixture({maxElapsedMs:1000});let calls=0;
 await assert.rejects(()=>f.q.execute(async()=>{calls++;throw new HistoryError('RATE_LIMITED',{retryAfterMs:2000});}),error('TIME_LIMIT'));
 assert.equal(calls,1);assert.equal(f.waits.length,0);
});
test('retryable network failures have a finite retry count',async()=>{
 const f=fixture({maxRetries:1});let calls=0;
 await assert.rejects(()=>f.q.execute(async()=>{calls++;throw new HistoryError('NETWORK_ERROR');}),e=>e.code==='RETRY_LIMIT'&&e.causeCode==='NETWORK_ERROR');
 assert.equal(calls,2);
});
test('all operations share total attempt budget including retries and refresh',async()=>{
 const f=fixture({maxRequests:2});await f.q.execute(async()=>1,{kind:'metadata'});await f.q.refresh(async()=>2);
 await assert.rejects(()=>f.q.execute(async()=>3),error('REQUEST_LIMIT'));assert.equal(f.q.stats().attempts,2);
 assert.deepEqual(f.q.stats().requestsByKind,{metadata:1,comment:0,key:1});
});
test('key refresh limit is shared and enforced before network',async()=>{
 const f=fixture({maxKeyRefreshes:1});await f.q.refresh(async()=>1);let calls=0;
 await assert.rejects(()=>f.q.refresh(async()=>++calls),error('KEY_REFRESH_LIMIT'));assert.equal(calls,0);
});
test('400, auth failures, schema failures and arbitrary exceptions do not retry',async()=>{
 for(const e of [new HistoryError('API_ERROR',{httpStatus:400,apiCode:'INVALID_PARAMETER'}),new HistoryError('HTTP_ERROR',{httpStatus:403}),new HistoryError('TOKEN_INVALID'),new HistoryError('RESPONSE_SCHEMA'),new Error('private')]){
  const f=fixture();let calls=0;await assert.rejects(()=>f.q.execute(async()=>{calls++;throw e;}));assert.equal(calls,1);
 }
});
test('temporary HTTP 503 retries but HTTP 501 does not',async()=>{
 const f=fixture();let n=0;await f.q.execute(async()=>{if(!n++)throw new HistoryError('HTTP_ERROR',{httpStatus:503});});assert.equal(n,2);
 const g=fixture();n=0;await assert.rejects(()=>g.q.execute(async()=>{n++;throw new HistoryError('HTTP_ERROR',{httpStatus:501});}));assert.equal(n,1);
});
test('shared coordinator never overlaps requests',async()=>{
 const f=fixture();let active=0,max=0;const order=[];
 const run=i=>f.q.execute(async()=>{active++;max=Math.max(max,active);order.push(i);await new Promise(r=>setImmediate(r));active--;return i;});
 assert.deepEqual(await Promise.all([run(1),run(2),run(3)]),[1,2,3]);assert.equal(max,1);assert.deepEqual(order,[1,2,3]);assert(f.time>=3000);
});
test('already cancelled request consumes no budget',async()=>{
 const f=fixture();const c=new AbortController();c.abort();let calls=0;
 await assert.rejects(()=>f.q.execute(async()=>++calls,{signal:c.signal}),error('CANCELLED'));assert.equal(calls,0);assert.equal(f.q.stats().attempts,0);
});
test('cancelling queued operation prevents its callback from running',async()=>{
 const f=fixture();let release,calls=0;const first=f.q.execute(()=>new Promise(r=>release=r));await new Promise(r=>setImmediate(r));
 const c=new AbortController();const second=f.q.execute(async()=>++calls,{signal:c.signal});c.abort();
 await assert.rejects(()=>second,error('CANCELLED'));release(1);await first;assert.equal(calls,0);
});
test('retry wait can be cancelled without additional network',async()=>{
 const c=new AbortController();let started=false,calls=0;
 const q=new RequestCoordinator({sleep:async(_ms,s)=>{started=true;c.abort();if(s.aborted)throw new HistoryError('CANCELLED');}});
 await assert.rejects(()=>q.execute(async()=>{calls++;throw new HistoryError('RATE_LIMITED',{retryAfterMs:100});},{signal:c.signal}),error('CANCELLED'));
 assert(started);assert.equal(calls,1);
});
test('deadline is rechecked after an overlong sleeper',async()=>{
 const f=fixture({maxElapsedMs:2000});await f.q.execute(async()=>1);f.advance(2001);
 let calls=0;await assert.rejects(()=>f.q.execute(async()=>++calls),error('TIME_LIMIT'));assert.equal(calls,0);
});
test('stats and retry events contain no raw exceptions, secrets or payloads',async()=>{
 const f=fixture();const events=[];let n=0;
 await f.q.execute(async()=>{if(!n++)throw new HistoryError('RATE_LIMITED',{retryAfterMs:1});return 'SECRET';},{onRetry:e=>events.push(e)});
 const text=JSON.stringify({stats:f.q.stats(),events});assert(!text.includes('SECRET'));assert(events[0].waitMs>=1500);
});
