'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');

function classes(initial=[]){
  const members=new Set(initial);
  return {
    members,
    add(...values){for(const value of values)members.add(value);},
    remove(...values){for(const value of values)members.delete(value);},
    contains(value){return members.has(value);}
  };
}
function harness(file){
  const events=[];
  const c=createContext({
    Emitter:class {},
    window:{console:{error(){}}},
    global:{emitter:{emitAsync:(...args)=>events.push(['global',...args])}},
    VideoInfoModel:class {constructor(data){Object.assign(this,data);}}
  });
  const Dialog=loadClass(file,'NicoVideoPlayerDialog',c);
  const obj=Object.create(Dialog.prototype);
  obj._requestId='reqB';
  obj._watchId='smB';
  obj._videoInfo={watchId:'smA'};
  obj._state={isLoading:true,isError:false,videoInfo:{watchId:'smA'},errorMessage:'',
    setState(value){Object.assign(this,value);}};
  obj.emit=(...args)=>events.push(args);
  obj._setErrorMessage=msg=>obj._state.errorMessage=msg;
  obj._setVideoTimer=(fn,ms)=>events.push(['timer',fn,ms]);
  obj.playNextVideo=()=>events.push(['next']);
  Object.defineProperty(obj,'isPlaylistEnable',{value:false,configurable:true});
  return {c,obj,events};
}
function panelHarness(file){
  const c=createContext({Emitter:class {}});
  const Panel=loadClass(file,'VideoInfoPanel',c);
  const panel=Object.create(Panel.prototype);
  const calls=[],cl=classes(['initializing','userVideo']);
  panel.classList=cl;
  panel._videoInfo={watchId:'smA'};
  panel._videoHeaderPanel={clear:()=>calls.push('header-clear')};
  panel._$ownerIcon={raf:{
    addClass:name=>calls.push('icon-add:'+name),
    removeClass:name=>calls.push('icon-remove:'+name)
  }};
  panel._description={textContent:'old info'};
  panel._descriptionGeneration=1;
  return {panel,cl,calls};
}
describe('Task353 AUD-58 terminal video-info failure finalization',()=>{
  for(const [label,file] of [
    ['source','src/NicoVideoPlayerDialog.js'],
    ['dist','dist/ZenzaWatch-dev.user.js']
  ]){
    it(label+' ends loading on terminal failure without metadata',()=>{
      const h=harness(file);
      h.obj._onVideoInfoLoaderFail('reqB',{message:'network failed'});
      assert.strictEqual(h.obj._state.isError,true);
      assert.strictEqual(h.obj._state.isLoading,false);
      assert.strictEqual(h.obj._state.errorMessage,'network failed');
      assert.strictEqual(h.obj._state.videoInfo,null);
      assert.strictEqual(h.obj._videoInfo,null);
      assert.strictEqual(h.events.filter(e=>e[0]==='loadVideoInfoFail').length,1);
    });
    it(label+' ends loading but keeps failing video metadata',()=>{
      const h=harness(file);
      h.obj._onVideoInfoLoaderFail('reqB',{
        message:'unavailable',reason:'forbidden',info:{watchId:'smB',isPlayable:false}
      });
      assert.strictEqual(h.obj._state.isLoading,false);
      assert.strictEqual(h.obj._state.isError,true);
      assert.strictEqual(h.obj._videoInfo.watchId,'smB');
      assert.strictEqual(h.obj._state.videoInfo,h.obj._videoInfo);
      assert.strictEqual(h.events.filter(e=>e[0]==='loadVideoInfoFail').length,1);
    });
    it(label+' ignores late failure after switching to a new request',()=>{
      const h=harness(file);
      h.obj._onVideoInfoLoaderFail('reqA',{message:'obsolete'});
      assert.strictEqual(h.obj._state.isLoading,true);
      assert.strictEqual(h.obj._state.isError,false);
      assert.strictEqual(h.obj._videoInfo.watchId,'smA');
      assert.strictEqual(h.events.length,0);
    });
    it(label+' preserves forbidden auto-next timing',()=>{
      const h=harness(file);
      Object.defineProperty(h.obj,'isPlaylistEnable',{value:true,configurable:true});
      h.obj._onVideoInfoLoaderFail('reqB',{reason:'forbidden',message:'deleted'});
      const timer=h.events.find(e=>e[0]==='timer');
      assert.ok(timer);
      assert.strictEqual(timer[2],3000);
      timer[1]();
      assert.ok(h.events.some(e=>e[0]==='next'));
    });
    it(label+' clears pending detail/header on no-info failure',()=>{
      const viewCtx=createContext({Emitter:class {}});
      const View=loadClass(file,'NicoVideoPlayerDialogView',viewCtx);
      const view=Object.create(View.prototype),calls=[];
      view.videoInfoPanel={update:()=>calls.push('update'),
        onLoadFail:()=>calls.push('failure')};
      view._onVideoInfoFail();
      view._onVideoInfoFail({watchId:'smB'});
      assert.deepStrictEqual(calls,['failure','update']);
    });
  }
});
describe('Task353 AUD-58 VideoInfoPanel failed loading visual ownership',()=>{
  for(const [label,file] of [
    ['source','src/VideoInfoPanel.js'],
    ['dist','dist/ZenzaWatch-dev.user.js']
  ]){
    it(label+' stops the loading spinner without exposing stale details',()=>{
      const h=panelHarness(file);
      h.panel.onLoadFail();
      assert.strictEqual(h.cl.contains('initializing'),false);
      assert.strictEqual(h.cl.contains('is-loadFailed'),true);
      assert.strictEqual(h.panel._videoInfo,null);
      assert.deepStrictEqual(h.calls,['header-clear','icon-remove:is-loading']);
    });
    it(label+' returns to loading state after a subsequent video open',()=>{
      const h=panelHarness(file);
      h.panel.onLoadFail();
      h.panel.clear();
      assert.strictEqual(h.cl.contains('initializing'),true);
      assert.strictEqual(h.cl.contains('is-loadFailed'),false);
      assert.strictEqual(h.panel._description.textContent,'');
      assert.strictEqual(h.panel._descriptionGeneration,3);
      assert.deepStrictEqual(h.calls,[
        'header-clear','icon-remove:is-loading',
        'header-clear','icon-add:is-loading'
      ]);
    });
  }
});
