import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWatch,buildThreadRequest,validateThreads,CommentStore,summarizeThreads} from '../src/core.mjs';
import {watch,comment,body,KEY} from './fixtures.mjs';
const ctx=()=>normalizeWatch(watch(),'sm1');
const main=[{id:'10',fork:'main'}];
const code=(name)=>e=>e.code===name;

test('watchV4 is normalized without mutating metadata',()=>{const w=watch(),before=JSON.stringify(w);const c=normalizeWatch(w,'sm1');assert.equal(c.videoId,'sm1');assert.equal(c.language,'ja-jp');assert.deepEqual(c.targets,[{id:'10',fork:'owner'},...main]);assert.equal(JSON.stringify(w),before);});
test('legacy response and direct watch shapes are supported',()=>{const raw=watch().data.response.$watchV4.data;assert.equal(normalizeWatch({data:{response:raw}},'sm1').videoId,'sm1');assert.equal(normalizeWatch(raw,'sm1').videoId,'sm1');});
test('a different video is rejected',()=>assert.throws(()=>normalizeWatch(watch('sm2'),'sm1'),code('VIDEO_MISMATCH')));
test('preview metadata without a video ID is not guessed',()=>{const w=watch();delete w.data.response.$watchV4.data.video.id;assert.throws(()=>normalizeWatch(w,'sm1'),code('WATCH_SCHEMA'));});
test('search metadata is not a watch page',()=>assert.throws(()=>normalizeWatch({data:{response:{$getSearchVideoV2:{data:{}}}}},'sm1'),code('WATCH_SCHEMA')));
test('unadvertised server cannot receive a key',()=>{const w=watch();w.data.response.$watchV4.data.comment.nvComment.server='https://evil.example';assert.throws(()=>normalizeWatch(w,'sm1'),code('SERVER_NOT_ALLOWED'));});
test('context serialization omits the key',()=>{assert.equal(JSON.stringify(ctx()).includes(KEY),false);});
test('baseline request exactly preserves observed request shape',()=>{const req=buildThreadRequest(ctx());assert.equal(req.url,'https://public.nvcomment.nicovideo.jp/v1/threads?pc=1');assert.equal(req.init.credentials,'omit');assert.equal(req.init.method,'POST');assert.deepEqual(JSON.parse(req.init.body),{params:{targets:ctx().targets,language:'ja-jp'},threadKey:KEY,additionals:{}});});
test('experimental additions are explicit integer seconds and res_from',()=>{const q=JSON.parse(buildThreadRequest(ctx(),{targets:main,when:1700000000,resFrom:-1000}).init.body);assert.deepEqual(q.additionals,{when:1700000000,res_from:-1000});});
test('millisecond timestamp and fractional cursor are rejected',()=>{assert.throws(()=>buildThreadRequest(ctx(),{when:1700000000000}),code('OPTION'));assert.throws(()=>buildThreadRequest(ctx(),{when:1.2}),code('OPTION'));});
test('request cannot invent a target',()=>assert.throws(()=>buildThreadRequest(ctx(),{targets:[{id:'99',fork:'main'}]}),code('TARGET_NOT_ALLOWED')));
test('res_from accepts only bounded negative integers',()=>{for(const value of [0,1,-1001,-1.5,NaN])assert.throws(()=>buildThreadRequest(ctx(),{resFrom:value}),code('OPTION'));});
test('response matches ID and fork rather than array position',()=>{const raw={meta:{status:200},data:{threads:[{id:'10',fork:'main',commentCount:9,comments:[comment(1)]},{id:'10',fork:'owner',commentCount:0,comments:[]}]}};const result=validateThreads(raw,ctx());assert.equal(result[0].fork,'main');assert.equal(result[0].comments.length,1);});
test('missing target is not interpreted as an empty page',()=>assert.throws(()=>validateThreads(body([]),ctx()),code('MISSING_TARGET')));
test('unexpected target is rejected',()=>assert.throws(()=>validateThreads(body([],'main','99'),ctx(),main),code('TARGET_NOT_ALLOWED')));
test('malformed comments are rejected before store update',()=>{for(const extra of [{commands:null},{postedAt:'bad'},{no:NaN},{vposMs:Infinity},{id:9007199254740994}])assert.throws(()=>validateThreads(body([comment(1,1700000000,extra)]),ctx(),main),code('COMMENT_SCHEMA'));});
test('same page twice only retains one copy of each comment',()=>{const c=ctx(),s=new CommentStore(c),th=validateThreads(body([comment(1),comment(2)]),c,main);assert.deepEqual(s.add(th),{added:2,duplicates:0,limited:false});assert.deepEqual(s.add(th),{added:0,duplicates:2,limited:false});assert.equal(s.size,2);});
test('same body and position with different no are preserved',()=>{const c=ctx(),s=new CommentStore(c);s.add(validateThreads(body([comment(1,1700000000,{vposMs:0}),comment(2,1700000000,{vposMs:0})]),c,main));assert.equal(s.size,2);});
test('same no in different forks is preserved',()=>{const c=ctx(),s=new CommentStore(c);s.add(validateThreads(body([comment(1)]),c,main));s.add(validateThreads(body([comment(1)],'owner'),c,[{id:'10',fork:'owner'}]));assert.equal(s.size,2);});
test('conflicting IDs at the same identity fail atomically',()=>{const c=ctx(),s=new CommentStore(c);s.add(validateThreads(body([comment(1)]),c,main));assert.throws(()=>s.add(validateThreads(body([comment(2),comment(1,1700000000,{id:'DIFFERENT'})]),c,main)),code('IDENTITY_CONFLICT'));assert.equal(s.size,1);});
test('store snapshots cannot mutate stored commands',()=>{const c=ctx(),s=new CommentStore(c);s.add(validateThreads(body([comment(1)]),c,main));s.snapshot()[0].comments[0].commands.push('bad');assert.deepEqual(s.snapshot()[0].comments[0].commands,[]);});
test('unique comment budget is exact and reports truncation',()=>{const c=ctx(),s=new CommentStore(c);assert.deepEqual(s.add(validateThreads(body([comment(1),comment(2)]),c,main),1),{added:1,duplicates:0,limited:true});assert.equal(s.size,1);});
test('diagnostic summaries omit keys, bodies, commands and user IDs',()=>{const summary=summarizeThreads(validateThreads(body([comment(1),comment(2)]),ctx(),main));const text=JSON.stringify(summary);assert.equal(summary[0].returnedCount,2);for(const s of [KEY,'SYNTHETIC_BODY','SYNTHETIC_USER','synthetic-id-'])assert.equal(text.includes(s),false);});
test('oldest timestamp is determined independently of response order',()=>{const summary=summarizeThreads(validateThreads(body([comment(9,1700000009),comment(7,1700000007),comment(8,1700000008)]),ctx(),main));assert.equal(summary[0].oldestUnixSeconds,1700000007);assert.equal(summary[0].ascendingPostedAt,false);});
test('metadata with an explicit failure status is rejected even if it carries old data',()=>{const w=watch();w.meta.status=400;assert.throws(()=>normalizeWatch(w,'sm1'),code('WATCH_SCHEMA'));});
test('store itself rejects a foreign target before accepting its comments',()=>{const s=new CommentStore(ctx());assert.throws(()=>s.add([{id:'99',fork:'main',commentCount:1,comments:[comment(1)]}]),code('TARGET_NOT_ALLOWED'));assert.equal(s.size,0);});
test('optional comment fields cannot retain mutable objects or invalid scalar types',()=>{
 for(const extra of [{source:{}},{nicoruId:{}},{score:NaN},{isPremium:[]},{isMyPost:'yes'},{nicoruCount:-1},{deleted:{}}]){
  assert.throws(()=>validateThreads(body([comment(1,1700000000,extra)]),ctx(),main),code('COMMENT_SCHEMA'));
 }
});
