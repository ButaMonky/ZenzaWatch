import test from 'node:test';import assert from 'node:assert/strict';
import {HistorySession} from '../src/session.mjs';
import {RequestCoordinator} from '../src/coordinator.mjs';
import {normalizeWatch,withThreadKey,HistoryError} from '../src/core.mjs';
import {watch,body,comment,KEY} from './fixtures.mjs';
const ctx=()=>normalizeWatch(watch(),'sm1');
const page=(cs,count=999)=>[{...body(cs).data.threads[0],commentCount:count}];
const START=1700000100;
function coordinator(settings={}){let now=0;return new RequestCoordinator({settings,now:()=>now,sleep:async ms=>{now+=ms;},random:()=>0});}
function make(options={}){const context=options.context??ctx();const settings=options.settings??{};return new HistorySession(context,{baseline:[],...options,settings,coordinator:coordinator(settings)});}

test('ancient normal data does not determine history cursor; zero new overlap continues',async()=>{
 const seen=[];let n=0;const baseline=page([comment(1,1000000000),comment(9,1700000009)]);
 const s=make({baseline,fetchPage:async(_c,o)=>{seen.push(o.when);return [page([comment(9,1700000009)]),page([comment(8,1700000008)]),page([])][n++];}});
 const r=await s.run({startWhen:START});assert.deepEqual(seen,[START,1700000009,1700000008]);
 assert.equal(r.counts.additionalCount,1);assert.equal(r.counts.normalCount,2);assert.equal(r.reason,'empty_page');assert.equal(r.completeCoverageVerified,false);
});
test('normal fetch is counted, all advertised targets preserved',async()=>{
 let seen;const s=make({baseline:undefined,settings:{maxPages:1},fetchPage:async(c,o)=>{
  if(o.when===undefined){seen=o.targets;return [{id:'10',fork:'owner',commentCount:0,comments:[]},...page([comment(1)])];}
  return page([comment(2)]);
 }});const r=await s.run({startWhen:START});assert.deepEqual(seen,ctx().targets);assert.equal(r.network.attempts,2);assert.equal(r.pages,1);assert.equal(r.counts.additionalCount,1);
});
test('expired key refresh retries exactly the same page without mutating original context',async()=>{
 const c=ctx();const seen=[];let calls=0;
 const s=make({context:c,settings:{maxPages:1},fetchPage:async(context,o)=>{
  seen.push({key:context.threadKey,when:o.when});if(!calls++)throw new HistoryError('TOKEN_EXPIRED');return page([comment(1)]);
 },refreshKey:async context=>withThreadKey(context,'NEW_SECRET')});
 const r=await s.run({startWhen:START});assert.equal(r.pages,1);assert.equal(r.network.attempts,3);assert.equal(r.network.keyRefreshes,1);
 assert.deepEqual(seen,[{key:KEY,when:START},{key:'NEW_SECRET',when:START}]);assert.equal(c.threadKey,KEY);assert(!JSON.stringify(r).includes('NEW_SECRET'));
});
test('perpetually invalid key is stopped by refresh limit',async()=>{
 const s=make({fetchPage:async()=>{throw new HistoryError('TOKEN_INVALID');},refreshKey:async c=>withThreadKey(c,'NEW_SECRET')});
 const r=await s.run({startWhen:START});assert.equal(r.reason,'key_refresh_limit');assert.equal(r.network.attempts,3);assert.equal(r.counts.unionCount,0);
});
test('refresh cannot switch video identity, targets or language',async()=>{
 for(const change of [{videoId:'sm2'},{language:'en-us'},{targets:[{id:'999',fork:'main'}]}]){
  const s=make({fetchPage:async()=>{throw new HistoryError('TOKEN_EXPIRED');},refreshKey:async c=>Object.assign({threadKey:'NEW'},c,change)});
  const r=await s.run({startWhen:START});assert.equal(r.reason,'context_changed');assert.equal(r.network.attempts,2);
 }
});
test('newest timestamp beyond cursor detects ignored when even if oldest is earlier',async()=>{
 const s=make({fetchPage:async()=>page([comment(1,1000000000),comment(2,START+1)])});const r=await s.run({startWhen:START});
 assert.equal(r.reason,'cursor_not_respected');assert.equal(r.counts.additionalCount,0);
});
test('same-second full page stops conservatively without silently skipping the second',async()=>{
 const s=make({fetchPage:async()=>page([comment(1,1700000000),comment(2,1700000000)])});const r=await s.run({startWhen:START});
 assert.equal(r.reason,'same_second_boundary_unverified');assert.equal(r.pages,1);assert.equal(r.counts.additionalCount,2);
});
test('subsecond cursor is not rounded past missing history',async()=>{
 const s=make({fetchPage:async()=>page([comment(1,1700000000.5)])});const r=await s.run({startWhen:START});assert.equal(r.reason,'subsecond_boundary_unverified');assert.equal(r.pages,1);
});
test('history request cap is distinct from additional quota and global request cap',async()=>{
 const s=make({baseline:page([comment(1)]),settings:{maxPages:1},fetchPage:async()=>page([comment(1)])});
 const r=await s.run({startWhen:START});assert.equal(r.reason,'page_limit');assert.equal(r.counts.additionalCount,0);
});
test('additional quota does not consume existing normal comments',async()=>{
 const s=make({baseline:page([comment(1,1700000001)]),settings:{maxAdditionalComments:1},fetchPage:async()=>page([comment(1,1700000001),comment(2,1700000002),comment(3,1700000003)])});
 const r=await s.run({startWhen:START});assert.equal(r.reason,'comment_limit');assert.equal(r.counts.additionalCount,1);assert.equal(r.counts.unionCount,2);
});
test('history removal preserves normal count metadata and values exactly',async()=>{
 const baseline=page([comment(1)],5441528);const s=make({baseline,settings:{maxPages:1},fetchPage:async()=>page([comment(2)],5441277)});
 await s.run({startWhen:START});assert.equal(s.snapshot()[0].commentCount,5441528);s.removeHistory();assert.deepEqual(s.snapshot(),baseline);
 assert.equal(s.report().counts.additionalCount,0);
});
test('cancellation and history removal reject late responses without clearing baseline',async()=>{
 let release;const s=make({baseline:page([comment(1)]),fetchPage:()=>new Promise(r=>{release=r;})});
 const p=s.run({startWhen:START});await new Promise(r=>setImmediate(r));s.removeHistory();release(page([comment(2)]));
 const r=await p;assert.equal(r.reason,'cancelled');assert.equal(r.counts.additionalCount,0);assert.equal(r.counts.normalCount,1);
});
test('sequential forks are round-robin and share page and request limits',async()=>{
 const w=watch();w.data.response.$watchV4.data.comment.nvComment.params.targets.push({id:'10',fork:'easy'});const seen=[];
 const s=make({context:normalizeWatch(w,'sm1'),settings:{maxPages:2,includeEasy:true},fetchPage:async(_c,o)=>{
  const t=o.targets[0];seen.push(t.fork);return [{...page([comment(1)])[0],fork:t.fork}];
 }});const r=await s.run({startWhen:START});assert.deepEqual(seen,['main','easy']);assert.equal(r.network.attempts,2);assert.equal(r.pages,2);
});
test('run once guard prevents two jobs against one store',async()=>{
 const s=make({fetchPage:async()=>page([])});await s.run({startWhen:START});await assert.rejects(()=>s.run({startWhen:START}),e=>e.code==='ALREADY_RUN');
});
test('onProgress and report omit comments, commenter IDs and keys',async()=>{
 const events=[];const s=make({settings:{maxPages:1},fetchPage:async()=>page([comment(1)])});
 const r=await s.run({startWhen:START,onProgress:e=>events.push(e)});const text=JSON.stringify({r,events});
 for(const token of [KEY,'SYNTHETIC_BODY','SYNTHETIC_USER','synthetic-id-'])assert(!text.includes(token));
 assert.equal(r.network.attempts,1);assert.equal(s.snapshot()[0].comments.length,1);
});
test('no history target still produces a finished timestamp',async()=>{
 const w=watch();w.data.response.$watchV4.data.comment.nvComment.params.targets=[{id:'10',fork:'owner'}];
 const s=make({context:normalizeWatch(w,'sm1')});const r=await s.run({startWhen:START});
 assert.equal(r.reason,'no_history_target');assert.equal(typeof r.finishedAt,'string');assert.equal(r.network.attempts,0);
});
