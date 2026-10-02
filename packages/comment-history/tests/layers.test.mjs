import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWatch} from '../src/core.mjs';
import {LayeredCommentStore} from '../src/layers.mjs';
import {watch,body,comment} from './fixtures.mjs';
const context=()=>normalizeWatch(watch(),'sm1');
const threads=(cs,n=999)=>[{...body(cs).data.threads[0],commentCount:n}];

test('normal and history memberships are distinct, removal restores baseline exactly',()=>{
 const s=new LayeredCommentStore(context());s.addNormal(threads([comment(1),comment(2)]));const normal=s.snapshot();
 s.addHistory(threads([comment(2),comment(3)],800));
 assert.deepEqual(s.counts(),{normalCount:2,historyCount:2,overlapCount:1,additionalCount:1,unionCount:3});
 assert.equal(s.snapshot()[0].commentCount,999);s.removeHistory();assert.deepEqual(s.snapshot(),normal);
 assert.deepEqual(s.counts(),{normalCount:2,historyCount:0,overlapCount:0,additionalCount:0,unionCount:2});
});
test('history allowance counts additional-only comments and allows normal overlaps',()=>{
 const s=new LayeredCommentStore(context());s.addNormal(threads([comment(1)]));
 const r=s.addHistory(threads([comment(1),comment(2),comment(3)]),1);
 assert.equal(r.added,1);assert.equal(r.limited,true);assert.equal(s.counts().historyCount,2);assert.equal(s.counts().unionCount,2);
});
test('normal values have priority over historic nicoru and flags',()=>{
 const s=new LayeredCommentStore(context());s.addNormal(threads([comment(1,1700000000,{nicoruCount:5})]));
 s.addHistory(threads([comment(1,1700000000,{nicoruCount:0})],10));assert.equal(s.snapshot()[0].comments[0].nicoruCount,5);
});
test('normal arriving after history changes membership but does not duplicate it',()=>{
 const s=new LayeredCommentStore(context());s.addHistory(threads([comment(1)]));s.addNormal(threads([comment(1)]));
 assert.equal(s.counts().additionalCount,0);s.removeHistory();assert.equal(s.snapshot()[0].comments.length,1);
});
test('malformed later comment rejects entire page before any update',()=>{
 const s=new LayeredCommentStore(context());assert.throws(()=>s.addHistory(threads([comment(1),comment(2,1700000000,{commands:null})])),e=>e.code==='COMMENT_SCHEMA');
 assert.equal(s.counts().unionCount,0);
});
test('cross-layer identity conflict rejects entire page atomically',()=>{
 const s=new LayeredCommentStore(context());s.addNormal(threads([comment(1)]));
 assert.throws(()=>s.addHistory(threads([comment(2),comment(1,1700000000,{id:'CONFLICT'})])),e=>e.code==='IDENTITY_CONFLICT');
 assert.equal(s.counts().unionCount,1);assert.equal(s.counts().historyCount,0);
});
test('same content is preserved in different comment numbers and forks',()=>{
 const s=new LayeredCommentStore(context());const cs=[comment(1),comment(2)];s.addNormal(threads(cs));
 s.addHistory([{...threads([comment(1)])[0],fork:'owner'}]);assert.equal(s.counts().unionCount,3);
});
test('snapshots do not expose mutable store arrays',()=>{
 const s=new LayeredCommentStore(context());const input=threads([comment(1)]);s.addHistory(input);input[0].comments[0].commands.push('alter');
 const a=s.snapshot();a[0].comments[0].commands.push('alter2');assert.deepEqual(s.snapshot()[0].comments[0].commands,[]);
});
test('same page twice is history duplicate, not additional gain',()=>{
 const s=new LayeredCommentStore(context());s.addHistory(threads([comment(1)]));const r=s.addHistory(threads([comment(1)]));
 assert.equal(r.added,0);assert.equal(r.duplicates,1);assert.equal(s.counts().additionalCount,1);
});
test('foreign thread rejected and normal-only snapshot hides history',()=>{
 const s=new LayeredCommentStore(context());s.addHistory(threads([comment(1)]));assert.deepEqual(s.snapshot({historyEnabled:false}),[]);
 assert.throws(()=>s.addNormal([{...threads([])[0],id:'999'}]),e=>e.code==='TARGET_NOT_ALLOWED');
});
