// Offline NicoNico compatibility regression checks.
// Only synthetic fixtures; no live NicoNico fetch or account credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {
  COMMENT_ORIGIN,normalizeWatch,buildThreadRequest,validateThreads
} from '../../packages/comment-history/src/core.mjs';
import {watch,comment,body} from '../../packages/comment-history/tests/fixtures.mjs';

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ctx=()=>normalizeWatch(watch('sm1'),'sm1');
const main=[{id:'10',fork:'main'}];
const expectCode=(code)=>error=>error?.code===code;
const read=relative=>readFileSync(resolve(cwd,relative),'utf8');

test('synthetic watch V4 baseline has the expected video/target relationship',()=>{
  const c=ctx();
  assert.equal(c.videoId,'sm1');
  assert.equal(c.server,COMMENT_ORIGIN);
  assert.equal(c.language,'ja-jp');
  assert.deepEqual(c.targets.map(t=>t.fork),['owner','main']);
});

test('watch payload must not silently accept a removed nvComment envelope',()=>{
  const w=watch('sm1');
  delete w.data.response.$watchV4.data.comment.nvComment;
  assert.throws(()=>normalizeWatch(w,'sm1'),expectCode('WATCH_SCHEMA'));
});
test('watch payload must not silently accept renamed video IDs',()=>{
  const w=watch('sm1');
  delete w.data.response.$watchV4.data.video.id;
  w.data.response.$watchV4.data.video.videoId='sm1';
  assert.throws(()=>normalizeWatch(w,'sm1'),expectCode('WATCH_SCHEMA'));
});
test('unexpected comment server is rejected instead of sending credentials elsewhere',()=>{
  const w=watch('sm1');
  w.data.response.$watchV4.data.comment.nvComment.server='https://other.example.invalid';
  assert.throws(()=>normalizeWatch(w,'sm1'),expectCode('SERVER_NOT_ALLOWED'));
});
test('missing thread key is reported as a specific protocol failure',()=>{
  const w=watch('sm1');
  delete w.data.response.$watchV4.data.comment.nvComment.threadKey;
  assert.throws(()=>normalizeWatch(w,'sm1'),expectCode('MISSING_KEY'));
});
test('unknown fork values are not silently used',()=>{
  const w=watch('sm1');
  w.data.response.$watchV4.data.comment.nvComment.params.targets[0].fork='unknown';
  assert.throws(()=>normalizeWatch(w,'sm1'),expectCode('TARGET_SCHEMA'));
});
test('thread request remains a bounded POST to the allowlisted comments host',()=>{
  const req=buildThreadRequest(ctx(),{targets:main});
  const url=new URL(req.url);
  assert.equal(url.origin,COMMENT_ORIGIN);
  assert.equal(url.pathname,'/v1/threads');
  assert.equal(req.init.method,'POST');
  assert.equal(req.init.credentials,'omit');
  assert.equal(req.init.redirect,'error');
  assert.deepEqual(JSON.parse(req.init.body).params.targets,main);
});
test('well-formed synthetic comment loads without live network',()=>{
  const out=validateThreads(body([comment(1)],'main','10'),ctx(),main);
  assert.equal(out.length,1);
  assert.equal(out[0].comments.length,1);
  assert.equal(out[0].comments[0].no,1);
});
test('renamed comment-body field is an explicit schema failure',()=>{
  const c=comment(1);
  delete c.body;
  c.content='a field name changed';
  assert.throws(()=>validateThreads(body([c],'main','10'),ctx(),main),
    expectCode('COMMENT_SCHEMA'));
});
test('missing timestamp prevents the UI from seeking to a guessed position',()=>{
  const c=comment(1);
  delete c.vposMs;
  assert.throws(()=>validateThreads(body([c],'main','10'),ctx(),main),
    expectCode('COMMENT_SCHEMA'));
});
test('changed thread response envelope is recognized as a contract change',()=>{
  const data=body([comment(1)],'main','10');
  data.data.threadList=data.data.threads;
  delete data.data.threads;
  assert.throws(()=>validateThreads(data,ctx(),main),
    expectCode('RESPONSE_SCHEMA'));
});
test('missing thread target is rejected without fabricating comments',()=>{
  const data=body([comment(1)],'main','10');
  assert.throws(()=>validateThreads(data,ctx()),
    expectCode('MISSING_TARGET'));
});

// Source ownership sentinels: flag changes to high-impact API and player code
// for human review. A passing sentinel is NOT proof the live site is compatible.
const sentinels=[
  ['watch information','packages/lib/src/nico/VideoInfoLoader.js',
    /\/v4\/watch\/lazy/],
  ['thread transport','packages/lib/src/nico/ThreadLoader.js',
    /\/v1\/threads/],
  ['HLS access rights','packages/lib/src/nico/VideoSessionWorker.js',
    /access-rights\/hls/],
  ['storyboard access rights','packages/lib/src/nico/VideoSessionWorker.js',
    /access-rights\/storyboard/],
  ['video search','packages/lib/src/nico/VideoSearch.js',
    /\/v2\/search\/video/],
  ['player seek dispatch','src/NicoVideoPlayerDialog.js',
    /case\s+['"]seekBy['"]\s*:/],
  ['seekbar hit-testing','src/VideoControlBar.js',
    /_onSeekBarMouseDown/]
];
for(const [name,file,pattern] of sentinels){
  test('requires explicit review when '+name+' code contract changes',()=>{
    assert.match(read(file),pattern,name+' moved or changed: '+file);
  });
}
