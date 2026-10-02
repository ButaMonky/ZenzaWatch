import test from 'node:test';
import assert from 'node:assert/strict';
import {HistorySession} from '../src/session.mjs';
import {RequestCoordinator} from '../src/coordinator.mjs';
import {normalizeWatch} from '../src/core.mjs';
import {DEFAULT_SETTINGS} from '../src/settings.mjs';
import {watch, comment} from './fixtures.mjs';
const ctx=normalizeWatch(watch(),'sm1');
const page=cs=>[{id:'10',fork:'main',commentCount:100,comments:cs}];
function setup(extra={}) {let t=0; const settings={maxPages:10,maxAdditionalComments:2,...extra.settings};
 const clock={now:()=>t,sleep:async n=>{t+=n;},random:()=>0};
 return {session:new HistorySession(ctx,{...extra,settings,coordinator:new RequestCoordinator({settings,...clock})}),advance:n=>{t+=n;}};}
const startWhen=1700000100;
test('approved defaults are 5000 with a bounded 20000 supported target',()=>{
 assert.equal(DEFAULT_SETTINGS.maxAdditionalComments,5000);
 assert(DEFAULT_SETTINGS.maxPages>=100);assert(DEFAULT_SETTINGS.maxRequests>=120);
});
test('continuation carries history and replays only the interrupted boundary page',async()=>{
 const calls=[];const baseline=page([comment(10,1700000010)]);
 const fetchPage=async(_c,o)=>{calls.push(o.when);return o.when===startWhen? page([comment(7,1700000007),comment(8,1700000008),comment(9,1700000009)]):page([]);};
 const first=setup({baseline,fetchPage});let result=await first.session.run({startWhen});
 assert.equal(result.counts.additionalCount,2);assert.equal(typeof first.session.resumeData,'function');
 const second=setup({baseline,fetchPage,resume:first.session.resumeData(),settings:{maxAdditionalComments:4}});
 result=await second.session.run({startWhen});
 assert.deepEqual(calls,[startWhen,startWhen,1700000007]);
 assert.equal(result.counts.additionalCount,3);assert.equal(result.counts.normalCount,1);
 assert.equal(result.reason,'empty_page');
});
test('history-only snapshot excludes overlapping normal comments',async()=>{
 const s=setup({baseline:page([comment(8,1700000008)]),fetchPage:async()=>page([comment(7,1700000007),comment(8,1700000008),comment(9,1700000009)])}).session;
 await s.run({startWhen});
 const snapshot=s.snapshot({historyOnly:true});assert.deepEqual(snapshot.flatMap(t=>t.comments.map(c=>c.no)),[7,9]);
});
test('continuation cannot reuse a different video or advance past unresolved timestamp boundaries',async()=>{
 const s=setup({baseline:[],settings:{maxAdditionalComments:5},fetchPage:async()=>page([comment(1),comment(2)])}).session;
 let result=await s.run({startWhen});assert.equal(result.reason,'same_second_boundary_unverified');
 assert.equal(typeof s.resumeData,'function');const resume=s.resumeData();
 let requests=0;const next=setup({baseline:[],resume,settings:{maxAdditionalComments:10},fetchPage:async()=>{requests++;return page([]);}}).session;
 result=await next.run({startWhen});assert.equal(requests,0);assert.equal(result.reason,'same_second_boundary_unverified');
 const other=normalizeWatch(watch('sm2'),'sm2');
 assert.throws(()=>new HistorySession(other,{baseline:[],resume}),e=>e.code==='CONTEXT_CHANGED');
});
test('finished statistics do not include time spent waiting to save diagnostics',async()=>{
 const {session,advance}=setup({baseline:[],fetchPage:async()=>page([])});
 const final=await session.run({startWhen});advance(15000);
 assert.equal(session.report().network.elapsedMs,final.network.elapsedMs);
});
