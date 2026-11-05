'use strict';
// P12-04: use the ACTUAL generated VideoInfo class and automatic policy body;
// only external raw watch-data dependencies are simulated.
const assert=require('assert');
const {beginSection,createContext,loadClass,run}=require('../helpers/extractSource');
function model({server=0,local=[],duration=300,clear=null,videoId='sm9'}={}){
 const context=createContext({JSONable:class {}});
 run(beginSection('packages/zenza/src/resume/AutoResumePolicy.js'),context);
 const VideoInfo=loadClass('src/VideoInfo.js','VideoInfoModel',context);
 const entry=Object.create(VideoInfo.prototype);
 entry._videoDetail={length:duration,id:videoId};
 entry._cacheData={resume:local,...(clear||{})};
 entry._resumeInfo={initialPlaybackPosition:server};
 return entry;
}
describe('P12 actual generated VideoInfo onepoint integration',()=>{
 it('selects only server point over many historical local positions',()=>{
  const m=model({server:120,local:[{now:100,time:60},{now:200,time:90}]});
  assert.deepStrictEqual(Array.from(m.resumePoints,x=>x.time),[120]);
  assert.strictEqual(m.initialPlaybackTime,120);
  assert.strictEqual(m.resumePoints[0].now,'\u524d\u56de');
 });
 it('chooses only latest valid local point by timestamp, not insertion order',()=>{
  const m=model({server:0,local:[
   {now:300,time:80},{now:100,time:50},{now:400,time:120}]});
  assert.deepStrictEqual(Array.from(m.resumePoints,x=>x.time),[120]);
  assert.strictEqual(m.initialPlaybackTime,120);
 });
 it('does not resurrect old server/local resume after completion tombstone',()=>{
  const m=model({server:100,local:[{now:99,time:72}],
   clear:{resumeClearedAt:200,resumeClearReason:'completed'}});
  assert.strictEqual(m.resumePoints.length,0);
  assert.strictEqual(m.initialPlaybackTime,0);
 });
 it('does not resurrect old position after explicit manual delete tombstone',()=>{
  const m=model({server:80,local:[{now:50,time:60}],
   clear:{resumeClearedAt:100,resumeClearReason:'deleted'}});
  assert.strictEqual(m.resumePoints.length,0);
 });
 it('allows a newly recorded local position after clearing older data',()=>{
  const m=model({server:80,local:[{now:90,time:60},{now:300,time:110}],
   clear:{resumeClearedAt:200,resumeClearReason:'deleted'}});
  assert.deepStrictEqual(Array.from(m.resumePoints,x=>x.time),[110]);
 });
 it('invalid duration or ill-typed time does not create a marker',()=>{
  assert.strictEqual(model({server:Infinity}).resumePoints.length,0);
  assert.strictEqual(model({server:80,duration:20}).resumePoints.length,0);
  assert.strictEqual(model({server:'80'}).initialPlaybackTime,0);
 });
 it('reads legacy cache metadata without changing cache or book-mark data',()=>{
  const old=[{now:100,time:70},{now:200,time:80}];
  const cache={resume:old,manualBookmarks:[{id:'B1',time:30}]};
  const ctx=createContext({JSONable:class {}});
  run(beginSection('packages/zenza/src/resume/AutoResumePolicy.js'),ctx);
  const VideoInfo=loadClass('src/VideoInfo.js','VideoInfoModel',ctx);
  const m=Object.create(VideoInfo.prototype);
  m._videoDetail={id:'sm9',length:300};
  m._cacheData=cache;m._resumeInfo={initialPlaybackPosition:90};
  assert.strictEqual(m.resumePoints.length,1);
  assert.strictEqual(old.length,2);
  assert.deepStrictEqual(cache.manualBookmarks,[{id:'B1',time:30}]);
 });
});
