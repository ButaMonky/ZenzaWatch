import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {watch, comment, KEY} from './fixtures.mjs';
const source = new URL('../src/zenza-context.mjs', import.meta.url);
const api = fs.existsSync(source) ? await import(source) : {};
function subject() {
  const raw = watch().data.response.$watchV4.data;
  const info = raw.comment.threads.map(t => ({...t, label:t.forkLabel, layer:{index:t.fork===1?0:1,isTranslucent:false}}));
  return {
    playbackGeneration:'play-test', normalRevision:1,
    videoInfo:{videoId:'sm1',contextWatchId:'12345',duration:120,msgInfo:{videoId:'sm1',nvComment:raw.comment.nvComment,threads:info}},
    normalResult:{format:'threads',threadInfo:{videoId:'sm1',threadId:10,language:'ja-jp',when:null,isWaybackMode:false,canPost:true},
      body:{__usedLanguage:'ja-jp',threads:[{id:'10',fork:'owner',commentCount:0,comments:[]},{id:'10',fork:'main',commentCount:500,comments:[comment(10)]}]}}
  };
}
function seed(s=subject()) { assert.equal(typeof api.createZenzaSeed,'function','createZenzaSeed is implemented');return api.createZenzaSeed(s); }
test('seed preserves distinct canonical video and context watch identities',()=>{
  const s=seed();assert.equal(s.context.videoId,'sm1');assert.deepEqual(s.identity,{videoId:'sm1',watchId:'12345',language:'ja-jp',playbackGeneration:'play-test',normalRevision:1});
});
test('seed uses actual successful language rather than metadata preference',()=>{
  const x=subject();x.normalResult.threadInfo.language='en-us';x.normalResult.body.__usedLanguage='ja-jp';
  assert.equal(seed(x).context.language,'ja-jp');
});
test('language falls back to successful threadInfo only when response language absent',()=>{
  const x=subject();delete x.normalResult.body.__usedLanguage;x.normalResult.threadInfo.language='zh-tw';assert.equal(seed(x).context.language,'zh-tw');
  delete x.normalResult.threadInfo.language;assert.throws(()=>seed(x),{code:'LANGUAGE_MISSING'});
});
test('read-only seed accepts video with no comment post target',()=>{
  const x=subject();x.normalResult.threadInfo.canPost=false;x.normalResult.threadInfo.threadId=null;
  const s=seed(x);assert.equal(s.render.mainThreadId,null);assert.equal(s.baseline[1].comments.length,1);
});
test('canonical video mismatches and unsupported watch mode fail without mutation',()=>{
  for(const where of ['message','result','mode','format']){
    const x=subject();if(where==='message')x.videoInfo.msgInfo.videoId='sm2';
    if(where==='result')x.normalResult.threadInfo.videoId='sm2';
    if(where==='mode')x.normalResult.threadInfo.isWaybackMode=true;
    if(where==='format')x.normalResult.format='xml';
    const before=JSON.stringify(x);assert.throws(()=>seed(x));assert.equal(JSON.stringify(x),before);
  }
});
test('missing layers and duplicate descriptors are rejected rather than guessed',()=>{
  const x=subject();delete x.videoInfo.msgInfo.threads[1].layer;assert.throws(()=>seed(x),{code:'THREAD_METADATA'});
  const y=subject();y.videoInfo.msgInfo.threads.push(y.videoInfo.msgInfo.threads[1]);assert.throws(()=>seed(y),{code:'THREAD_METADATA'});
});
test('playback and normal revisions must be explicit',()=>{
  for(const changes of [{playbackGeneration:''},{normalRevision:0},{normalRevision:1.5}])assert.throws(()=>seed({...subject(),...changes}));
});
test('seed detaches baseline metadata and keeps token nonenumerable',()=>{
  const x=subject(),s=seed(x);x.videoInfo.msgInfo.threads[1].layer.index=9;x.normalResult.body.threads[1].comments[0].commands.push('red');
  assert.equal(s.render.threads[1].layer.index,1);assert.deepEqual(s.baseline[1].comments[0].commands,[]);
  assert.equal(s.context.threadKey,KEY);assert.equal(JSON.stringify(s).includes(KEY),false);
});
test('render payload adds original fork and layer without changing baseline or totals',()=>{
  const x=subject(),s=seed(x);assert.equal(typeof api.toZenzaThreads,'function');
  const out=api.toZenzaThreads(s,s.baseline);assert.deepEqual(Object.keys(out),['threads']);
  assert.equal(out.threads[1].info.fork,0);assert.equal(out.threads[0].info.fork,1);assert.equal(out.threads[1].info.layer.index,1);
  out.threads[1].comments[0].commands.push('blue');out.threads[1].info.layer.index=9;
  assert.equal(s.render.threads[1].layer.index,1);assert.deepEqual(s.baseline[1].comments[0].commands,[]);
  assert.equal(x.normalResult.body.threads[1].commentCount,500);
});
test('renderer conversion does not accept a foreign thread',()=>{
  const s=seed(),bad=structuredClone(s.baseline);bad[1].id='99';assert.throws(()=>api.toZenzaThreads(s,bad),{code:'TARGET_NOT_ALLOWED'});
});

test('current mode cannot accept a dated baseline even when flag says normal',()=>{
  const x=subject();x.normalResult.threadInfo.when=1700000000;assert.throws(()=>seed(x),{code:'UNSUPPORTED_WAYBACK'});
});
test('normal response missing an expected fork is rejected',()=>{
  const x=subject();x.normalResult.body.threads=x.normalResult.body.threads.filter(t=>t.fork==='main');assert.throws(()=>seed(x),{code:'MISSING_TARGET'});
});
test('numeric fork conflicts and alien server metadata are not silently accepted',()=>{
  const x=subject();x.videoInfo.msgInfo.threads[1].fork=2;assert.throws(()=>seed(x),{code:'THREAD_METADATA'});
  const y=subject();y.videoInfo.msgInfo.nvComment.server='https://example.invalid';assert.throws(()=>seed(y),{code:'SERVER_NOT_ALLOWED'});
});
