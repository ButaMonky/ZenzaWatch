'use strict';
const assert = require('assert');
const {createContext,loadClass} = require('../helpers/extractSource');

function fixture(file) {
  const events=[],cache=[];
  let release;
  const ready=new Promise(resolve=>{release=resolve;});
  const log={log(){},timeEnd(){},warn(){},error(){}};
  const context=createContext({Emitter:class {},
    console:log,WatchInfoCacheDb:{putBestEffort:(id,info)=>cache.push([id,info])}});
  const Dialog=loadClass(file,'NicoVideoPlayerDialog',context);
  const dialog=Object.create(Dialog.prototype);
  const infoA={watchId:'smA',videoId:'smA',msgInfo:{}};
  const optionsA={eventType:'playlist',isPlaylistStartRequest:false};
  const state={isLoading:true,setVideoCanPlay(){events.push(['stateReady']);}};
  dialog._requestId='request-A';
  dialog._watchId='smA';
  dialog._videoInfo=infoA;
  dialog._videoWatchOptions=optionsA;
  dialog._state=state;
  dialog._playerConfig={props:{lastWatchId:null,enableNicosJumpVideo:true}};
  dialog._playlist={insertCurrentVideo:info=>events.push(['insert',info.watchId]),
    findByWatchId:()=>null,removeItemByWatchId:id=>events.push(['remove',id])};
  dialog._nextVideo='smANext';
  Object.defineProperty(dialog,'isOpen',{configurable:true,value:true});
  dialog.promise=name=>{assert.strictEqual(name,'playlist-ready');return ready;};
  dialog.emitAsync=(...args)=>events.push(['emitAsync',...args]);
  dialog.emitResolve=(...args)=>events.push(['emitResolve',...args]);
  dialog.play=()=>events.push(['play']);
  dialog.execCommand=(...args)=>events.push(['command',...args]);

  const swap=()=>{
    dialog._requestId='request-B';dialog._watchId='smB';
    dialog._videoInfo={watchId:'smB',videoId:'smB',msgInfo:{}};
    dialog._videoWatchOptions={eventType:'playlist',isPlaylistStartRequest:false};
    dialog._nextVideo='smBNext';
    state.isLoading=true;
  };
  return {dialog,infoA,optionsA,state,events,cache,release,swap};
}
function noLateEvents(h) {
  assert.deepStrictEqual(h.events,[]);
  assert.strictEqual(h.dialog._nextVideo,'smBNext');
  assert.strictEqual(h.dialog._playerConfig.props.lastWatchId,'smA');
  assert.strictEqual(h.cache.length,1);
  assert.strictEqual(h.cache[0][0],'smA');
}
describe('Task323 AUD-47 canPlay playlist-ready generation ownership',()=>{
  for(const file of ['src/NicoVideoPlayerDialog.js','dist/ZenzaWatch-dev.user.js']){
    it(file+' drops A continuation after switching to B',async()=>{
      const h=fixture(file),pending=h.dialog._onVideoCanPlay();
      h.swap();h.release();await pending;
      noLateEvents(h);
    });
    it(file+' drops stale request ID even when watch ID and object match',async()=>{
      const h=fixture(file),pending=h.dialog._onVideoCanPlay();
      h.dialog._requestId='request-new';
      h.dialog._nextVideo='smBNext';h.release();await pending;
      assert.deepStrictEqual(h.events,[]);
      assert.strictEqual(h.dialog._nextVideo,'smBNext');
    });
    it(file+' drops same-ID replacement model after the wait',async()=>{
      const h=fixture(file),pending=h.dialog._onVideoCanPlay();
      h.dialog._videoInfo={...h.infoA};
      h.dialog._nextVideo='smBNext';h.release();await pending;
      assert.deepStrictEqual(h.events,[]);
      assert.strictEqual(h.dialog._nextVideo,'smBNext');
    });
    it(file+' does not revive loading after a terminal stop',async()=>{
      const h=fixture(file),pending=h.dialog._onVideoCanPlay();
      h.state.isLoading=false;h.dialog._nextVideo='smBNext';
      h.release();await pending;assert.deepStrictEqual(h.events,[]);
    });
    it(file+' retains normal canPlay, autoplay and jump on same generation',async()=>{
      const h=fixture(file),pending=h.dialog._onVideoCanPlay();
      h.release();await pending;
      assert.deepStrictEqual(h.events.map(e=>e[0]),[
        'insert','stateReady','emitAsync','emitResolve','play','command','command']);
      assert.strictEqual(h.dialog._nextVideo,null);
      assert.strictEqual(h.events[0][1],'smA');
      assert.strictEqual(h.events[2][2],'smA');
      assert.strictEqual(h.events[3][2],'smA');
      assert.deepStrictEqual(h.events.slice(-2),[
        ['command','notify','@ジャンプ: smANext'],['command','playlistInsert','smANext']]);
    });
    it(file+' skips work when already not loading',async()=>{
      const h=fixture(file);h.state.isLoading=false;
      await h.dialog._onVideoCanPlay();
      assert.deepStrictEqual(h.events,[]);assert.strictEqual(h.cache.length,0);
    });
  }
});
