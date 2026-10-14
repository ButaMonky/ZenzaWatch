// Purely synthetic regressions for unexpectedly changed NicoNico API shapes.
// No network, logged-in browser, raw HAR, cookies or publication credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMENT_ORIGIN,normalizeWatch,buildThreadRequest,validateThreads} from '../../packages/comment-history/src/core.mjs';
import {watch,comment,body} from '../../packages/comment-history/tests/fixtures.mjs';

const makeWatch = () => watch('sm1');
const data = w => w.data.response.$watchV4.data;
const commentNode = w => data(w).comment.nvComment;
const context = () => normalizeWatch(makeWatch(),'sm1');
const main = [{id:'10',fork:'main'}];
const code = expected => err => err?.code === expected;

test('a valid-looking response for a different video cannot drive current UI',()=>{
  const w=makeWatch();
  data(w).video.id='sm2';
  assert.throws(()=>normalizeWatch(w,'sm1'),code('VIDEO_MISMATCH'));
});

test('HTTP failure is not misread as a successful watch response',()=>{
  const w=makeWatch();
  w.meta.status=404;
  assert.throws(()=>normalizeWatch(w,'sm1'),code('WATCH_SCHEMA'));
});

test('prefix-matching impostor comment host is never accepted',()=>{
  const w=makeWatch();
  commentNode(w).server=COMMENT_ORIGIN+'.attacker.invalid';
  assert.throws(()=>normalizeWatch(w,'sm1'),code('SERVER_NOT_ALLOWED'));
});

test('malformed language in a watch response fails explicitly',()=>{
  const w=makeWatch();
  commentNode(w).params.language='ja';
  assert.throws(()=>normalizeWatch(w,'sm1'),code('WATCH_SCHEMA'));
});

test('empty thread target set fails before a request can be built',()=>{
  const w=makeWatch();
  commentNode(w).params.targets=[];
  assert.throws(()=>normalizeWatch(w,'sm1'),code('WATCH_SCHEMA'));
});

test('duplicate thread targets must not silently double-load comments',()=>{
  const w=makeWatch();
  const targets=commentNode(w).params.targets;
  targets.push({...targets[0]});
  assert.throws(()=>normalizeWatch(w,'sm1'),code('TARGET_SCHEMA'));
});

test('non-numeric and negative thread IDs never enter a comment request',()=>{
  for(const id of ['10x','-1',-1,Infinity]){
    const w=makeWatch();
    commentNode(w).params.targets[0].id=id;
    assert.throws(()=>normalizeWatch(w,'sm1'),code('TARGET_SCHEMA'));
  }
});

test('attempt to request a thread belonging to another video is rejected',()=>{
  assert.throws(()=>buildThreadRequest(context(),{targets:[{id:'999',fork:'main'}]}),
    code('TARGET_NOT_ALLOWED'));
});

test('request transport remains credential-free with optional query parameters',()=>{
  const r=buildThreadRequest(context(),{targets:main,when:123,resFrom:-100});
  assert.equal(new URL(r.url).origin,COMMENT_ORIGIN);
  assert.equal(r.init.credentials,'omit');
  assert.equal(r.init.redirect,'error');
  assert.equal(r.init.method,'POST');
  const parsed=JSON.parse(r.init.body);
  assert.deepEqual(parsed.additionals,{when:123,res_from:-100});
  assert.deepEqual(parsed.params.targets,main);
});

test('bad request time and comment range are rejected as options',()=>{
  for(const value of [-1,1.5,Infinity,Number.NaN]){
    assert.throws(()=>buildThreadRequest(context(),{when:value}),code('OPTION'));
  }
  for(const value of [0,-1001,1.5]){
    assert.throws(()=>buildThreadRequest(context(),{resFrom:value}),code('OPTION'));
  }
});

test('duplicate selected targets cannot create ambiguous response ownership',()=>{
  assert.throws(()=>buildThreadRequest(context(),{targets:[...main,...main]}),
    code('OPTION'));
});

test('API errors retain a machine-readable classification, not raw server data',()=>{
  const reply=body([comment(1)],'main','10');
  reply.meta.status=400;
  reply.meta.errorCode='SOME_REMOTE_ERROR';
  assert.throws(()=>validateThreads(reply,context(),main),err=>
    err?.code==='API_ERROR' && !String(err.message).includes('SOME_REMOTE_ERROR'));
});

test('unexpected fork in a response is not attributed to requested target',()=>{
  const reply=body([comment(1)],'main','10');
  reply.data.threads[0].fork='owner';
  assert.throws(()=>validateThreads(reply,context(),main),code('TARGET_NOT_ALLOWED'));
});

test('duplicate response threads are detected rather than double-rendered',()=>{
  const reply=body([comment(1)],'main','10');
  reply.data.threads.push(structuredClone(reply.data.threads[0]));
  assert.throws(()=>validateThreads(reply,context(),main),code('RESPONSE_SCHEMA'));
});

test('invalid comment fields fail rather than causing unsafe seek/render',()=>{
  const transforms=[
    c=>{c.commands='NG';},
    c=>{c.vposMs=Infinity;},
    c=>{c.postedAt='invalid-date';},
    c=>{c.userId=undefined;},
    c=>{c.nicoruCount=-1;}
  ];
  for(const change of transforms){
    const c=comment(1);
    change(c);
    assert.throws(()=>validateThreads(body([c],'main','10'),context(),main),
      code('COMMENT_SCHEMA'));
  }
});

test('non-enumerable thread key is excluded from context diagnostics',()=>{
  const c=context();
  assert.ok(typeof c.threadKey==='string' && c.threadKey.length>0);
  assert.equal(Object.keys(c).includes('threadKey'),false);
  assert.equal(JSON.stringify(c).includes('threadKey'),false);
});

test('malformed current video IDs are rejected instead of guessed',()=>{
  for(const videoId of ['', 'https://example.invalid/', '../sm1', null]){
    assert.throws(()=>normalizeWatch(makeWatch(),videoId),code('OPTION'));
  }
});
