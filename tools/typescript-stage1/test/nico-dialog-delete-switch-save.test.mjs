import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const read=name=>stripTypeScriptTypes(fs.readFileSync(new URL(name,import.meta.url),'utf8'),{mode:'strip'});
const dialogText=read('../nico-src/NicoVideoPlayerDialog.ts');
const classSource=name=>{
 const start=dialogText.indexOf('class '+name+' ');
 assert(start>=0,name+' missing');
 return dialogText.slice(start,dialogText.indexOf('\n}',start)+2);
};
const coordinator=read('../p12-src/AutoResumeClearCoordinator.ts').replace('export class ','class ');
function fixture({record}={}){
 const remote=[],cache=[],events=[],warnings=[],pending=new Promise(()=>{});
 const quiet=Object.fromEntries(['log','info','warn','error','time','timeEnd'].map(x=>[x,()=>{}]));
 quiet.warn=(...args)=>warnings.push(args);
 const context=vm.createContext({console:quiet,Emitter:class{},
  _: {isBoolean:x=>typeof x==='boolean'},
  window:{console:quiet,setTimeout:()=>1,clearTimeout(){}},
  util:{isLogin:()=>true},Fullscreen:{now:()=>false},
  global:{emitter:{emitAsync(){},emitResolve(){}}},
  VideoInfoLoader:{load:()=>pending},
  WatchInfoCacheDb:{get:()=>pending,clearAutomaticResume:async watchId=>({
   watchId,resume:[],resumeClearedAt:250,resumeClearReason:'deleted'}),
   putBestEffort:(...args)=>cache.push(args)},
  PlaybackPosition:{record:async(...args)=>{remote.push(args);
   return record?record(...args):{status:204};}}
 });
 vm.runInContext(coordinator+'\n'+classSource('VideoWatchOptions')+'\n'+
  classSource('NicoVideoPlayerDialog')+';globalThis.Dialog=NicoVideoPlayerDialog;',context);
 const dialog=Object.create(context.Dialog.prototype);
 Object.assign(dialog,{
  _requestId:'request-A',_watchId:'sm1',_lastOpenAt:0,_lastCurrentTime:85,
  _videoInfo:{watchId:'sm1',contextWatchId:'sm1',videoId:'sm1',duration:300,
   msgInfo:{frontendId:6,frontendVersion:0}},
  _state:{isError:false,isPlaying:false,isEnded:false,resetVideoLoadingStatus(){},setPausing(){}},
  // The shipping Config defaults automatic position recording to ON; the old
  // fake getValue returned false for every key, silently disabling all saves.
  _playerConfig:{props:{'resume.recordEnabled':true},
   getValue:key=>key==='resume.recordEnabled'},
  _nicoVideoPlayer:{currentTime:85,close:()=>events.push('player-close')},
  _view:{clearPanel(){},videoControlBar:{refreshAutoResumePointers(){}}},
  _initializePlaylist:()=>pending,
  refreshLastPlayerId(){},_cancelCommentLoad(){},_abortCommonsTreeJob(){},
  _clearVideoTimers(){},show(){},emit(){},emitResolve(){},execCommand(){}
 });
 return {dialog,remote,cache,events,warnings};
}
test('recording OFF suppresses ordinary outgoing automatic saves',async()=>{
 const h=fixture();
 h.dialog._playerConfig.getValue=key=>key==='resume.recordEnabled'?false:false;
 h.dialog._savePlaybackPosition('sm1',85);
 assert.deepEqual(h.remote,[],'disabled automatic recording must not submit');
 await h.dialog.open('sm2',{openNow:true});
 assert.deepEqual(h.remote,[],'switch must not submit while recording is disabled');
});
for(const target of ['sm2','sm1'])test(`acknowledged automatic deletion survives open(${target}) final outgoing save`,async()=>{
 const h=fixture();
 const outcome=await h.dialog._deleteAutomaticResume();
 assert.equal(outcome.remote,'acknowledged');
 assert.deepEqual(h.remote,[['sm1',0,6,0]]);
 await h.dialog.open(target,{openNow:true});
 assert.notEqual(h.dialog._requestId,'request-A');
 assert.deepEqual(h.remote,[['sm1',0,6,0]],'opening must not restore deleted outgoing position');
 assert.deepEqual(h.events,['player-close']);
});
test('ordinary outgoing video still saves its final nonzero position on switch',async()=>{
 const h=fixture();await h.dialog.open('sm2',{openNow:true});
 assert.deepEqual(h.remote,[['sm1',85,6,0]]);
});
test('an old deletion owner cannot suppress a different current outgoing video',async()=>{
 const h=fixture();await h.dialog._deleteAutomaticResume();
 h.dialog._requestId='request-B';h.dialog._watchId='sm2';
 h.dialog._videoInfo={watchId:'sm2',contextWatchId:'sm2',videoId:'sm2',duration:300,
  msgInfo:{frontendId:6,frontendVersion:0}};
 await h.dialog.open('sm3',{openNow:true});
 assert.deepEqual(h.remote,[['sm1',0,6,0],['sm2',85,6,0]]);
});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});
 return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
test('delete zero waits for an earlier nonzero transport commit for the same video',async()=>{
 const old=deferred(),commits=[];
 const h=fixture({record:async(id,seconds)=>{
  if(seconds>0)await old.promise;commits.push([id,seconds]);return {status:204};
 }});
 h.dialog._savePlaybackPosition('sm1',85);
 const deleting=h.dialog._deleteAutomaticResume();await flush();
 assert.deepEqual(h.remote,[['sm1',85,6,0]],'zero must wait for prior same-video PUT');
 old.resolve();const result=await deleting;
 assert.equal(result.remote,'acknowledged');
 assert.deepEqual(commits,[['sm1',85],['sm1',0]],'acknowledged zero must be final server commit');
});
test('a failed prior save does not prevent delete zero or hide its own failure',async()=>{
 const old=deferred();const h=fixture({record:async(id,seconds)=>{
  if(seconds>0)await old.promise;return {status:204};
 }});
 h.dialog._savePlaybackPosition('sm1',85);
 const deleting=h.dialog._deleteAutomaticResume();await flush();
 assert.equal(h.remote.length,1);
 old.reject(Error('prior save failed'));
 assert.equal((await deleting).remote,'acknowledged');
 assert.deepEqual(h.remote,[['sm1',85,6,0],['sm1',0,6,0]]);
 assert(h.warnings.some(x=>x[0]==='save playback fail'));
});
test('unrelated videos do not wait behind another video transport',()=>{
 const old=deferred();const h=fixture({record:(id)=>id==='sm1'?old.promise:Promise.resolve({status:204})});
 h.dialog._savePlaybackPosition('sm1',85);
 h.dialog._requestId='request-B';h.dialog._watchId='sm2';
 h.dialog._videoInfo={watchId:'sm2',contextWatchId:'sm2',videoId:'sm2',duration:300,
  msgInfo:{frontendId:6,frontendVersion:0}};
 h.dialog._savePlaybackPosition('sm2',65);
 assert.deepEqual(h.remote,[['sm1',85,6,0],['sm2',65,6,0]]);
 old.resolve({status:204});
});
test('a queued clear does not dispatch after another playback request takes ownership',async()=>{
 const old=deferred();const h=fixture({record:(id,seconds)=>seconds>0?old.promise:Promise.resolve({status:204})});
 h.dialog._savePlaybackPosition('sm1',85);
 const deleting=h.dialog._deleteAutomaticResume();await flush();
 h.dialog._requestId='request-B';h.dialog._watchId='sm2';
 h.dialog._videoInfo={watchId:'sm2',contextWatchId:'sm2',videoId:'sm2',duration:300,
  msgInfo:{frontendId:6,frontendVersion:0}};
 old.resolve({status:204});
 const result=await deleting;
 assert.equal(result.remote,'stale-video');assert.equal(result.fullyAcknowledged,false);
 assert.deepEqual(h.remote,[['sm1',85,6,0]]);
});
test('queued server-zero rejection remains a reported failed deletion',async()=>{
 const old=deferred();const h=fixture({record:async(id,seconds)=>{
  if(seconds>0)return old.promise;throw Error('server-zero failed');
 }});
 h.dialog._savePlaybackPosition('sm1',85);
 const deleting=h.dialog._deleteAutomaticResume();await flush();old.resolve({status:204});
 const result=await deleting;
 assert.equal(result.remote,'failed');assert.equal(result.fullyAcknowledged,false);
 assert.equal(result.retryRemote,true);
});
for(const target of ['sm2','sm1'])test(`outgoing pause during open(${target}) cannot restore the deleted position`,async()=>{
 const h=fixture();await h.dialog._deleteAutomaticResume();
 await h.dialog.open(target,{openNow:true});
 // The incoming Watch promise remains pending, so this is still the outgoing
 // model when native video.pause() from close() delivers its pause event.
 h.dialog._onVideoPause();
 assert.deepEqual(h.remote,[['sm1',0,6,0]]);
});
test('a newly loaded model of the same video starts its own ordinary save ownership',async()=>{
 const h=fixture();await h.dialog._deleteAutomaticResume();
 await h.dialog.open('sm1',{openNow:true});
 h.dialog._videoInfo={...h.dialog._videoInfo};
 h.dialog._savePlaybackPosition('sm1',90);
 assert.deepEqual(h.remote,[['sm1',0,6,0],['sm1',90,6,0]]);
});
test('two community or mymemory watch aliases serialize PUTs to their shared videoId',async()=>{
 const old=deferred(),commits=[];
 const h=fixture({record:async(id,seconds)=>{
  if(seconds>0)await old.promise;commits.push([id,seconds]);return {status:204};
 }});
 // VideoInfoModel.watchId/contextWatchId can be a community or mymemory
 // thread ID, while videoId remains the canonical _videoDetail.id PUT target.
 h.dialog._watchId='1234567890';
 h.dialog._videoInfo={...h.dialog._videoInfo,watchId:'1234567890',contextWatchId:'1234567890'};
 h.dialog._savePlaybackPosition('1234567890',85);
 h.dialog._requestId='request-B';h.dialog._watchId='1234567891';
 h.dialog._videoInfo={...h.dialog._videoInfo,watchId:'1234567891',contextWatchId:'1234567891'};
 const deleting=h.dialog._deleteAutomaticResume();await flush();
 assert.deepEqual(h.remote,[['sm1',85,6,0]],'alias change must not bypass the same-resource queue');
 old.resolve();const result=await deleting;
 assert.equal(result.remote,'acknowledged');
 assert.deepEqual(commits,[['sm1',85],['sm1',0]]);
});
