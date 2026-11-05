import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const source=stripTypeScriptTypes(fs.readFileSync(new URL('../nico-src/NicoVideoPlayerDialog.ts',import.meta.url),'utf8'));
const start=source.indexOf('class NicoVideoPlayerDialog extends');
const code=source.slice(start,source.indexOf('\n}',start)+2);
const MARK='SYNTHETIC_PRIVATE_DIALOG_SENTINEL';
function contains(value,seen=new Set()){
 if(typeof value==='string')return value.includes(MARK);
 if(!value||typeof value!=='object'||seen.has(value))return false;
 seen.add(value);
 return Reflect.ownKeys(value).some(key=>{
  const descriptor=Object.getOwnPropertyDescriptor(value,key);
  return descriptor&&Object.hasOwn(descriptor,'value')&&contains(descriptor.value,seen);
 });
}
function fixture(){
 const logs=[],events=[],messages=[],timers=[],diagnostics=[];
 const console=Object.fromEntries(['log','warn','error','info','time','timeEnd'].map(name=>[name,(...args)=>logs.push(args)]));
 const context=vm.createContext({Emitter:class{},console,Date,Number,Promise,Math,
  window:{console,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){}},
  global:{emitter:{emitAsync:(...args)=>events.push(args),emitResolve(){}}},
  VideoInfoModel:class{constructor(data){Object.assign(this,data);}},
  VideoWatchOptions:class{constructor(){this.videoLoadOptions={};}},
  VideoInfoLoader:{load:async()=>({})},WatchInfoCacheDb:{get:async()=>null},
  util:{fullscreen:{now:()=>false}}});
 vm.runInContext(code+';globalThis.Dialog=NicoVideoPlayerDialog;',context);
 const subject=Object.create(context.Dialog.prototype);
 Object.assign(subject,{_requestId:'current',_watchId:MARK,_lastOpenAt:Date.now(),
  _state:{isError:false,isOpen:true,setState(value){Object.assign(this,value);},
   setVideoErrorOccurred(){this.isError=true;},resetVideoLoadingStatus(){}},
  _videoInfo:{isDmcAvailable:false,isDomandAvailable:false},
  _videoSession:{getState:async()=>({isDomand:false,isDmc:false,isDeleted:false,isAbnormallyClosed:false})},
  _videoWatchOptions:{reloadCount:5},_playlist:{isEnable:false},
  _recordDiagnostic:entry=>diagnostics.push(entry),_setErrorMessage:message=>messages.push(message),
  _setVideoTimer:fn=>timers.push(fn),emit:(...args)=>events.push(args),emitResolve(){},
  _playerConfig:{getValue:()=>false},_view:{clearPanel(){}},
  refreshLastPlayerId(){},_cancelCommentLoad(){},_abortCommonsTreeJob(){},_clearVideoTimers(){},
  _saveFinalPlaybackPosition(){},_initializePlaylist:async()=>{},show(){}});
 return {subject,context,logs,events,messages,timers,diagnostics};
}
const secretError=()=>new Error(MARK,{cause:{nested:MARK}});

test('stale Watch success never logs raw payload or request/video identifiers',async()=>{
 const h=fixture();await h.subject._onVideoInfoLoaderLoad('stale',[
  {private:MARK,error:secretError()},null]);
 assert.equal(contains(h.logs),false);
});

test('loader failure console excludes opaque error fields while preserving UI and event behavior',()=>{
 const h=fixture(),error={watchId:MARK,message:MARK,reason:MARK,type:MARK,name:MARK};
 h.subject._onVideoInfoLoaderFail('current',error);
 assert.equal(contains(h.logs),false);
 assert.equal(h.messages[0],MARK);assert.equal(h.subject._state.isError,true);
 assert(h.events.some(event=>event[0]==='loadVideoInfoFail'&&event[1]===error));
});

test('session failure logs a fixed classification without the raw result or server label',()=>{
 const h=fixture();h.subject._onVideoSessionFail(MARK,{message:MARK,error:secretError()});
 assert.equal(contains(h.logs),false);
 assert(h.messages[0].includes(MARK),'existing UI message stays intact');
 assert.equal(h.subject._state.isError,true);
});

test('play rejection keeps approved classification without Error.message/name/cause logging',()=>{
 const h=fixture(),error=secretError();error.name=MARK;
 h.subject._onVideoPlayStartFail(error);
 assert.equal(contains(h.logs),false);
 assert(h.events.some(event=>event[0]==='loadVideoPlayStartFail'&&event[1]==='unknown'));
});

for(const errorCode of [3,MARK])test(`media error console excludes Event graphs and bounds ${typeof errorCode==='number'?'numeric':'opaque'} codes`,async()=>{
 const h=fixture(),event={type:'normal',target:{error:{code:errorCode,cause:secretError()}}};
 await h.subject._onVideoError(event);
 assert.equal(contains(h.logs),false);
 assert(h.events.some(entry=>entry[0]==='error'&&entry[1]===event&&entry[2]===errorCode));
});

test('YouTube error console excludes payload while preserving fallback and emitted event',()=>{
 const h=fixture(),event={description:MARK,reason:MARK,fallback:true,cause:secretError()};
 h.subject._onYouTubeVideoError(event);
 assert.equal(contains(h.logs),false);assert.equal(h.messages[0],MARK);
 assert(h.events.some(entry=>entry[0]==='error'&&entry[1]===event));
 assert.equal(h.timers.length,1);
});

test('optional startup failure retains fallback without logging the Error or selected video',async()=>{
 const h=fixture();h.subject._videoInfo=null;h.subject._videoSession=null;
 h.subject._lastOpenAt=0;h.subject._nicoVideoPlayer={close(){}};
 h.context.WatchInfoCacheDb.get=async()=>{throw secretError();};
 let loaded;
 h.subject._onVideoInfoLoaderLoad=(_requestId,result)=>{loaded=result;};
 await h.subject.open(MARK);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(contains(h.logs),false);
 assert.equal(loaded[1],null,'cache failure still permits the metadata result');
});
