'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const parser=require('@babel/parser');
const {pathToFileURL}=require('url');
const {createDialogHarness,deferred,flush}=require('../helpers/dialogHarness');
const {run}=require('../helpers/extractSource');
const emitted='tools/typescript-stage1/.generated/nico/NicoVideoPlayerDialog.js';
let classSource,ClearCoordinator;
function getDialogClass(){
 if(classSource)return classSource;
 const text=fs.readFileSync(path.resolve(emitted),'utf8');
 const parsed=parser.parse(text,{sourceType:'module',allowUndeclaredExports:true,
   plugins:['classProperties']});
 const cl=parsed.program.body.find(x=>
   x.type==='ClassDeclaration'&&x.id?.name==='NicoVideoPlayerDialog');
 assert(cl,'the actual compiled Dialog class is missing');
 return classSource=text.slice(cl.start,cl.end)
   .replace(/^class NicoVideoPlayerDialog extends /,'class P12CompiledDialog extends ');
}
before(async()=>{
 const url=pathToFileURL(path.resolve(
   'packages/zenza/src/resume/AutoResumeClearCoordinator.js')).href;
 ({AutoResumeClearCoordinator:ClearCoordinator}=await new Function('url',
   'return import(url)')(url));
});
function setup({watchId='sm9',contextWatchId=watchId,videoId=watchId,loggedIn=true}={}){
 const h=createDialogHarness(),d=h.dialog;
 run(getDialogClass()+';globalThis.__compiledP12Dialog=P12CompiledDialog;',h.context);
 Object.setPrototypeOf(d,h.context.__compiledP12Dialog.prototype);
 h.context.AutoResumeClearCoordinator=ClearCoordinator;
 const calls={local:[],remote:[],refresh:[],warnings:[]};
 const vi={watchId,contextWatchId,videoId,
   msgInfo:{frontendId:6,frontendVersion:0},
   _cacheData:{resume:[{now:100,time:80}],videoInfo:{title:'unchanged'},
     manualBookmarks:[{id:'B1',time:30}]}};
 d._watchId=watchId;d._videoInfo=vi;
 d._view={videoControlBar:{refreshAutoResumePointers:x=>calls.refresh.push(x)}};
 h.context.util.isLogin=()=>loggedIn;
 h.context.WatchInfoCacheDb.clearAutomaticResume=async(id,reason)=>{
   calls.local.push([id,reason]);
   return {watchId:id,resume:[],resumeClearedAt:250,
     resumeClearReason:reason,manualBookmarks:[{id:'B1',time:30}]};
 };
 h.context.PlaybackPosition={
   record:async(...args)=>{calls.remote.push(args);return {status:204};}
 };
 h.context.window.console.warn=(...args)=>calls.warnings.push(args);
 return {h,d,vi,calls};
}
describe('P12 explicit delete integrates real compiled Dialog with per-video local clear',()=>{
 it('atomically clears current point, refreshes marker and ACKs server zero',async()=>{
  const {d,vi,calls}=setup();
  const result=await d._deleteAutomaticResume();
  assert.equal(result.remote,'acknowledged');
  assert.equal(result.fullyAcknowledged,true);
  assert.deepStrictEqual(calls.local,[['sm9','deleted']]);
  assert.deepStrictEqual(calls.remote,[['sm9',0,6,0]]);
  assert.deepStrictEqual(calls.refresh,[vi]);
  assert.equal(vi._cacheData.resume.length,0);
  assert.equal(vi._cacheData.manualBookmarks.length,1);
  assert.equal(vi._cacheData.videoInfo.title,'unchanged');
 });
 it('deletion cannot be recreated by same-session pause or close cache writes',async()=>{
  const {h,d,vi,calls}=setup();
  d._requestId='play-old';
  vi.duration=300;
  vi.contextWatchId='sm9';
  d._state={isEnded:false,isPlaying:false};
  d._nicoVideoPlayer={currentTime:85};
  const cache=[];
  h.context.WatchInfoCacheDb.putBestEffort=(...args)=>cache.push(args);
  h.context.Fullscreen={now:()=>false};
  h.context.global={emitter:{emitAsync:()=>{}}};
  d.pause=()=>{};d.hide=()=>{};d._cancelCommentLoad=()=>{};
  d._abortCommonsTreeJob=()=>{};d._clearVideoTimers=()=>{};
  d._refresh=()=>{};d.emit=()=>{};
  // The generic Dialog harness stubs this saver; restore the actual
  // compiled implementation so pause-resurrection regression is meaningful.
  d._savePlaybackPosition=h.context.__compiledP12Dialog.prototype._savePlaybackPosition;
  const removed=await d._deleteAutomaticResume();
  assert.equal(removed.local,'cleared');
  assert.equal(calls.remote.length,1,'server-zero delete request');
  d._savePlaybackPosition('sm9',85);
  assert.equal(calls.remote.length,1,'pause must not restore a deleted position');
  d.close();
  assert.equal(cache.length,1);
  assert.equal(cache[0][0],'sm9');
  assert.equal(cache[0][1].currentTime,0);
  assert.equal(calls.remote.length,1);
 });
 it('pending delete prevents racing save, failed local deletion restores saves',async()=>{
  const {h,d,vi,calls}=setup();
  d._requestId='play-current';vi.contextWatchId='sm9';vi.duration=300;
  const pendingLocal=deferred();
  h.context.WatchInfoCacheDb.clearAutomaticResume=()=>pendingLocal.promise;
  d._savePlaybackPosition=h.context.__compiledP12Dialog.prototype._savePlaybackPosition;
  const deleting=d._deleteAutomaticResume();
  d._savePlaybackPosition('sm9',85);
  assert.equal(calls.remote.length,0,'no positive save while local delete pending');
  pendingLocal.reject(Error('private local error'));
  assert.equal(await deleting,null);
  assert.equal(d._isAutoResumeSaveSuppressed(),false);
  d._savePlaybackPosition('sm9',85);
  assert.equal(calls.remote.length,1,'ordinary save resumes after failed local delete');
  assert.equal(calls.remote[0][1],85);
 });
 it('reports full versus local-only deletion without claiming remote success',async()=>{
  const good=setup(),success=[];
  good.d.execCommand=(...args)=>success.push(args);
  await good.d._deleteAutomaticResume();
  assert.equal(success.length,1);
  assert.equal(success[0][0],'notify');
  assert(success[0][1].includes('削除しました'));
  const offline=setup({loggedIn:false}),partial=[];
  offline.d.execCommand=(...args)=>partial.push(args);
  const offlineResult=await offline.d._deleteAutomaticResume();
  assert.equal(offlineResult.fullyAcknowledged,false);
  assert.equal(partial.length,1);
  assert(!partial[0][1].includes('完全に削除'));
  assert(partial[0][1].includes('サーバー'));
  const failed=setup(),errors=[];
  failed.d.execCommand=(...args)=>errors.push(args);
  failed.h.context.PlaybackPosition.record=async()=>{throw Error('private response');};
  const failure=await failed.d._deleteAutomaticResume();
  assert.equal(failure.remote,'failed');
  assert.equal(errors.length,1);
  assert(errors[0][1].includes('未確認'));
  assert(!JSON.stringify(errors).includes('private response'));
 });
 it('same video reopened during deletion does not refresh its newer session',async()=>{
  const {h,d,vi,calls}=setup();
  d._requestId='play-old';
  const hold=deferred();
  h.context.WatchInfoCacheDb.clearAutomaticResume=()=>hold.promise;
  const notices=[];
  d.execCommand=(...args)=>notices.push(args);
  const pending=d._deleteAutomaticResume();
  d._requestId='play-new';
  d._videoInfo={...vi};
  hold.resolve({watchId:'sm9',resume:[],resumeClearedAt:250,
    resumeClearReason:'deleted'});
  const result=await pending;
  assert.equal(result.remote,'stale-video');
  assert.deepStrictEqual(calls.remote,[]);
  assert.deepStrictEqual(calls.refresh,[]);
  assert.deepStrictEqual(notices,[],'old session must not notify new video');
 });
 it('supports a channel video whose watchId differs from contextWatchId',async()=>{
  const {d,calls}=setup({watchId:'so42',contextWatchId:'thread42',videoId:'so42'});
  const result=await d._deleteAutomaticResume();
  assert.equal(result.remote,'acknowledged');
  assert.deepStrictEqual(calls.local,[['so42','deleted']]);
  assert.deepStrictEqual(calls.remote,[['so42',0,6,0]]);
 });
 it('without login clears locally only and reports remote unavailable',async()=>{
  const {d,calls}=setup({loggedIn:false});
  const result=await d._deleteAutomaticResume();
  assert.equal(result.local,'cleared');
  assert.equal(result.remote,'unavailable');
  assert.equal(result.fullyAcknowledged,false);
  assert.equal(calls.remote.length,0);
 });
 it('network failure does not falsely claim complete server deletion',async()=>{
  const {h,d,calls}=setup();
  h.context.PlaybackPosition.record=async()=>{throw Error('TOKEN_SHOULD_NOT_LEAK');};
  const result=await d._deleteAutomaticResume();
  assert.equal(result.remote,'failed');
  assert.equal(result.retryRemote,true);
  assert.equal(calls.remote.length,0);
  assert(!JSON.stringify(calls.warnings).includes('TOKEN_SHOULD_NOT_LEAK'));
 });
 it('switching to a different video while local cache resolves cannot mutate new UI',async()=>{
  const {h,d,calls}=setup();
  const hold=deferred();
  h.context.WatchInfoCacheDb.clearAutomaticResume=(id,reason)=>{
   calls.local.push([id,reason]);return hold.promise;
  };
  const request=d._deleteAutomaticResume();
  d._watchId='sm2';
  d._videoInfo={watchId:'sm2',contextWatchId:'sm2',videoId:'sm2',
   msgInfo:{frontendId:6,frontendVersion:0},_cacheData:{resume:[{time:45}]}};
  hold.resolve({watchId:'sm9',resume:[],resumeClearedAt:250,
   resumeClearReason:'deleted'});
  const result=await request;
  assert.equal(result.remote,'stale-video');
  assert.deepStrictEqual(calls.refresh,[]);
  assert.deepStrictEqual(calls.remote,[]);
  assert.equal(d._videoInfo._cacheData.resume.length,1);
 });
 it('wrong current watch ID prevents local and server changes',async()=>{
  const {d,calls}=setup();
  d._watchId='smDifferent';
  const result=await d._deleteAutomaticResume();
  assert.equal(result,null);
  assert.deepStrictEqual(calls.local,[]);
  assert.deepStrictEqual(calls.remote,[]);
 });
 it('an invalid local acknowledgement cannot trigger remote deletion',async()=>{
  const {h,d,calls}=setup();
  const notices=[];
  d.execCommand=(...args)=>notices.push(args);
  h.context.WatchInfoCacheDb.clearAutomaticResume=async()=>{
    return {watchId:'sm9',resume:[{time:95}],resumeClearReason:'deleted'};
  };
  const result=await d._deleteAutomaticResume();
  assert.equal(result,null);
  assert.deepStrictEqual(calls.remote,[]);
  assert.equal(calls.warnings.length,1);
  assert.equal(notices.length,1);
  assert.equal(notices[0][0],'alert');
  assert(notices[0][1].includes('削除できません'));
 });
 it('concurrent repeated Delete commands share a single in-flight transaction',async()=>{
  const {h,d,calls}=setup();
  const hold=deferred();
  h.context.WatchInfoCacheDb.clearAutomaticResume=(id,reason)=>{
   calls.local.push([id,reason]);return hold.promise;
  };
  const first=d._deleteAutomaticResume();
  const second=d._deleteAutomaticResume();
  hold.resolve({watchId:'sm9',resume:[],resumeClearedAt:250,
    resumeClearReason:'deleted'});
  const [a,b]=await Promise.all([first,second]);
  assert.equal(a.remote,'acknowledged');
  assert.equal(b.remote,'acknowledged');
  assert.equal(calls.local.length,1);
  assert.equal(calls.remote.length,1);
 });
});
