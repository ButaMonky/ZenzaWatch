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

describe('Automatic resume editing and recording preferences',()=>{
 it('disabling automatic recording skips ordinary remote saves',async()=>{
  const {h,d,vi,calls}=setup();vi.duration=300;
  d._playerConfig={getValue:k=>k==='resume.recordEnabled'?false:undefined};
  d._savePlaybackPosition=h.context.__compiledP12Dialog.prototype._savePlaybackPosition;
  d._savePlaybackPosition('sm9',80);await flush();
  assert.equal(calls.remote.length,0);
 });
 it('edits a local point and suppresses an old server position even offline',async()=>{
  const {h,d,vi,calls}=setup({loggedIn:false});vi.duration=300;
  h.context.WatchInfoCacheDb.put=async(id,options)=>({watchId:id,resume:[{time:options.currentTime,now:500}],resumeOverride:options.currentTime});
  assert.equal(typeof d._editAutomaticResume,'function');
  assert.equal(await d._editAutomaticResume(65),true);
  assert.equal(vi._cacheData.resumeOverride,65);assert.equal(vi._cacheData.resume.length,1);
  assert.equal(calls.refresh.length,1);assert.equal(calls.remote.length,0);
 });
 it('an edit completing after video switch never refreshes the new video',async()=>{
  const {h,d,vi,calls}=setup({loggedIn:false});vi.duration=300;
  const pending=deferred();h.context.WatchInfoCacheDb.put=()=>pending.promise;
  assert.equal(typeof d._editAutomaticResume,'function');
  const saving=d._editAutomaticResume(65);
  d._watchId='sm10';d._requestId='new';d._videoInfo={watchId:'sm10'};
  pending.resolve({watchId:'sm9',resume:[{time:65,now:500}],resumeOverride:65});
  assert.equal(await saving,false);assert.equal(calls.refresh.length,0);
 });
 it('completion clearing respects the opt-out setting',()=>{
  const {d,calls}=setup();d._playerConfig={getValue:k=>k==='resume.clearOnComplete'?false:undefined};
  d._clearCompletedAutoResume();assert.equal(calls.local.length,0);
 });
});

describe('Playback point review regressions',()=>{
 it('AB ending at duration repeats instead of clearing or advancing playlist',()=>{
  const {d,vi,calls}=setup();vi.duration=300;let repeated=0,played=0,advanced=0,ended=0;
  d._view.manualBookmarkDock={repeatAtEnd(){repeated++;return true;}};
  d.play=()=>played++;d.playNextVideo=()=>advanced++;d._playlist={isEnable:true,hasNext:true};
  d._state={setVideoEnded(){ended++;}};d.emitAsync=()=>ended++;
  d._onVideoEnded();
  assert.equal(repeated,1);assert.equal(played,1);assert.equal(advanced,0);assert.equal(ended,0);assert.equal(calls.local.length,0);
 });
 it('acknowledged ordinary save updates the edited model and marker',async()=>{
  const {h,d,vi,calls}=setup({loggedIn:false});vi.duration=300;vi._cacheData.resumeOverride=65;
  h.context.WatchInfoCacheDb.putBestEffort=async()=>({watchId:'sm9',resume:[{time:100,now:600}],resumeOverride:null});
  d._savePlaybackPosition=h.context.__compiledP12Dialog.prototype._savePlaybackPosition;
  d._savePlaybackPosition('sm9',100);await flush();
  assert.equal(vi._cacheData.resumeOverride,null);assert.equal(vi._cacheData.resume[0].time,100);assert.equal(calls.refresh.length,1);
 });
});
