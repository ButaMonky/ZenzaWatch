'use strict';
const assert=require('assert');
const {createDialogHarness}=require('../helpers/dialogHarness');

function endedHarness(){
 const h=createDialogHarness(),d=h.dialog,saves=[],clears=[],warnings=[];
 d._watchId='smEnd';
 d._videoInfo={contextWatchId:'smEnd'};
 d._saveFinalPlaybackPosition=(...args)=>saves.push(args);
 d._playlist={isEnable:false,toggleEnable(){}};
 d._videoWatchOptions={hasKey(){return false;}};
 d._playerConfig={getValue(key){return key==='resume.recordEnabled'||key==='resume.clearOnComplete';}};
 h.state.setVideoEnded=()=>{h.state.isEnded=true;h.state.isPlaying=false;};
 h.context.WatchInfoCacheDb.clearAutomaticResume=(id,reason)=>{
  clears.push([id,reason]);return Promise.resolve({watchId:id,resume:[]});
 };
 h.context.console.warn=(...args)=>warnings.push(args);
 return {h,d,saves,clears,warnings};
}
function closeHarness(ended){
 const h=createDialogHarness(),d=h.dialog,puts=[];
 d._watchId='smClose';
 h.state.isEnded=ended;
 h.state.isPlaying=false;
 Object.defineProperty(d,'currentTime',{configurable:true,value:299});
 d._cancelCommentLoad=()=>{};
 d._abortCommonsTreeJob=()=>{};
 d._clearVideoTimers=()=>{};
 d._refresh=()=>{};
 d.pause=()=>{};
 d.hide=()=>{};
 h.context.WatchInfoCacheDb.putBestEffort=(id,options)=>{
  puts.push([id,options]);return Promise.resolve();
 };
 return {h,d,puts};
}
describe('P12-02 video-ended local auto resume clear ownership',()=>{
 it('saves the server final zero and clears only the correct local video',async()=>{
  const {h,d,saves,clears}=endedHarness();
  d._onVideoEnded();await h.flush();
  assert.deepStrictEqual(saves,[['smEnd',0]]);
  assert.deepStrictEqual(clears,[['smEnd','completed']]);
  assert.strictEqual(h.state.isEnded,true);
 });
 it('an omitted optional storage method does not prevent playback ended events',async()=>{
  const {h,d,saves}=endedHarness();
  delete h.context.WatchInfoCacheDb.clearAutomaticResume;
  assert.doesNotThrow(()=>d._onVideoEnded());
  await h.flush();
  assert.deepStrictEqual(saves,[['smEnd',0]]);
  assert.strictEqual(h.state.isEnded,true);
 });
 it('failed local persistence is reported without leaking ID or server credentials',async()=>{
  const {h,d,warnings}=endedHarness();
  h.context.WatchInfoCacheDb.clearAutomaticResume=()=>Promise.reject(new Error('private-disk-path'));
  d._onVideoEnded();await h.flush();
  assert.strictEqual(warnings.length,1);
  assert.strictEqual(warnings[0][0],'Automatic resume local clear failed');
  assert(!JSON.stringify(warnings).includes('private-disk-path'));
 });
 it('synchronous cache failure is also contained without an unhandled throw',()=>{
  const {h,d,warnings}=endedHarness();
  h.context.WatchInfoCacheDb.clearAutomaticResume=()=>{throw Error('injected');};
  assert.doesNotThrow(()=>d._onVideoEnded());
  assert.strictEqual(warnings.length,1);
 });
 it('a missing watch ID skips the local write (never clears an unrelated row)',async()=>{
  const {h,d,clears}=endedHarness();
  d._watchId=null;
  d._onVideoEnded();await h.flush();
  assert.strictEqual(clears.length,0);
 });
 it('close after completion cannot re-add a timestamp to auto resume history',()=>{
  const {d,puts}=closeHarness(true);
  d.close();
  assert.strictEqual(puts.length,1);
  assert.strictEqual(puts[0][0],'smClose');
  assert.strictEqual(puts[0][1].currentTime,0);
 });
 it('close during ordinary playback preserves the existing last position',()=>{
  const {d,puts}=closeHarness(false);
  d.close();
  assert.strictEqual(puts[0][1].currentTime,299);
 });
 it('the existing final zero save is still unthrottled',()=>{
  const {d,saves}=endedHarness();
  d._onVideoEnded();
  assert.deepStrictEqual(saves,[['smEnd',0]]);
 });
});
