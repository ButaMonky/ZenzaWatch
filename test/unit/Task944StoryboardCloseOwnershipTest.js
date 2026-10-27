'use strict';
// Task944: the actual VideoControlBar.close event must invalidate Task943's
// retained current-video storyboard ownership, not just the heatmap.
const assert=require('assert');
const {loadClass,createContext,read}=require('../helpers/extractSource');

function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function harness(masterEnabled=true){
  const queue=[],callbacks=new Map(),requests=[],effects=[];
  const values={enableStoryboard:masterEnabled,enableStoryboardBar:true,videoServerType:'domand'};
  const config={
    props:new Proxy(values,{set(obj,key,value){
      if(obj[key]!==value){obj[key]=value;queue.push(String(key));}
      return true;
    }}),
    onkey(key,fn){
      if(!callbacks.has(key))callbacks.set(key,new Set());
      callbacks.get(key).add(fn);
    }
  };
  class Emitter{
    on(){return this;}
    emit(name){effects.push(name);}
    emitResolve(){}
    promise(){return Promise.resolve();}
  }
  class Model{
    constructor(){this.isAvailable=false;}
    update(data){this.isAvailable=!!data?.ready;}
    reset(){this.isAvailable=false;effects.push('modelReset');}
  }
  class View{
    constructor(opts){this.isEnable=!!opts.enable;effects.push('viewNew');}
    enable(){this.isEnable=true;}
    disable(){this.isEnable=false;effects.push('viewDisable');}
    toggle(){this.isEnable=!this.isEnable;}
  }
  const storyboardContext=createContext({
    Emitter,StoryboardInfoModel:Model,StoryboardView:View,
    StoryboardInfoLoader:{load(){throw Error('Unexpected global loader');}},
    global:{debug:{}},console:{log(){},warn(){}},performance:{now:()=>10}
  });
  const SB=loadClass('packages/zenza/src/storyboard/Storyboard.js','Storyboard',storyboardContext);
  const state={isStoryboardAvailable:false};
  const loader={load(serverType,info){
    const p=deferred();
    requests.push({...p,serverType,info});
    return p.promise;
  }};
  const board=new SB({playerConfig:config,container:{},state,loader});
  const Bar=loadClass('src/VideoControlBar.js','VideoControlBar',
    createContext({Emitter:class{}}));
  const bar=Object.create(Bar.prototype);
  bar.storyboard=board;
  // _onPlayerOpen normally has a complete range UI. Keep those unrelated DOM
  // setters inert in this isolated close/reopen integration test.
  Object.defineProperty(bar,'duration',{value:0,writable:true,configurable:true});
  Object.defineProperty(bar,'currentTime',{value:0,writable:true,configurable:true});
  bar._stopTimer=()=>effects.push('timerStop');
  bar._startTimer=()=>effects.push('timerStart');
  bar._cancelStoryboardLongPress=()=>effects.push('holdCancel');
  bar._commentParsedHandler={cancel(){}};
  bar._commentChangeHandler={cancel(){}};
  bar._heatMapWatchId='sm100';
  bar.resetBufferedRange=()=>effects.push('bufferReset');
  bar.heatMap={reset(){effects.push('heatmapReset');}};
  bar.player={watchId:'sm100',duration:60,chatList:[]};
  bar._playerState={videoInfo:{duration:60}};
  bar._$view=[];
  const drain=()=>{
    while(queue.length){
      const key=queue.shift();
      for(const fn of callbacks.get(key)||[])fn(values[key]);
    }
  };
  const settle=async()=>{
    for(let i=0;i<8;i++)await Promise.resolve();
  };
  const video=id=>({watchId:id,hasStoryboard:true,duration:60});
  return {board,bar,config,state,requests,effects,drain,settle,video};
}

describe('Task944 real player-close storyboard ownership',function(){
  this.timeout(15000);
  it('closing while master OFF must discard remembered video metadata',()=>{
    const h=harness(false);
    h.board.load('sm100',h.video('sm100'));
    assert.strictEqual(h.requests.length,0);
    h.bar._onPlayerClose();
    assert.strictEqual(h.board._currentVideoInfo,null,
      'close left Task943 videoInfo retained');
    assert.strictEqual(h.board._currentVideoWatchId,null);
    h.config.props.enableStoryboard=true;
    h.drain();
    assert.strictEqual(h.requests.length,0,
      'setting ON after player close must not fetch a closed video');
  });
  it('a pending old video result must not appear after close',async()=>{
    const h=harness(true);
    h.board.load('sm100',h.video('sm100'));
    assert.strictEqual(h.requests.length,1);
    h.bar._onPlayerClose();
    h.requests[0].resolve({ready:true});await h.settle();
    assert.strictEqual(h.board.model.isAvailable,false,
      'stale pending loader overwrote the closed player');
    assert.strictEqual(h.state.isStoryboardAvailable,false);
    assert.strictEqual(h.board._requestId,null);
    assert.strictEqual(h.board._currentVideoInfo,null);
  });
  it('closing a loaded video hides thumbnails immediately and clears timers',async()=>{
    const h=harness(true);
    h.board.load('sm100',h.video('sm100'));
    h.requests[0].resolve({ready:true});await h.settle();
    assert.strictEqual(h.state.isStoryboardAvailable,true);
    h.bar._onPlayerClose();
    assert.strictEqual(h.board.model.isAvailable,false);
    assert.strictEqual(h.state.isStoryboardAvailable,false);
    assert(h.effects.includes('modelReset'));
    assert(h.effects.includes('holdCancel'));
    assert(h.effects.includes('timerStop'));
    assert(h.effects.includes('heatmapReset'));
  });
  it('close then open a new video does not fetch or mix the previous one',async()=>{
    const h=harness(true);
    h.board.load('sm100',h.video('sm100'));
    h.bar._onPlayerClose();
    // No extra request for closed sm100 even after a preference roundtrip.
    h.config.props.enableStoryboard=false;h.drain();
    h.config.props.enableStoryboard=true;h.drain();
    assert.strictEqual(h.requests.length,1);
    h.bar._onPlayerOpen('sm200');
    h.board.load('sm200',h.video('sm200'));
    assert.strictEqual(h.requests.length,2);
    h.requests[0].resolve({ready:true});await h.settle();
    assert.strictEqual(h.board.model.isAvailable,false);
    h.requests[1].resolve({ready:true});await h.settle();
    assert.strictEqual(h.board.model.isAvailable,true);
    assert.strictEqual(h.board._currentVideoWatchId,'sm200');
  });
  it('legacy partially initialized bar can still close safely',()=>{
    const Bar=loadClass('src/VideoControlBar.js','VideoControlBar',
      createContext({Emitter:class{}}));
    const b=Object.create(Bar.prototype);
    b._stopTimer=()=>{};
    b._cancelStoryboardLongPress=()=>{};
    assert.doesNotThrow(()=>b._onPlayerClose());
    assert.strictEqual(b._heatMapWatchId,null);
  });
  it('does not change Task943 master and bar independent keys',()=>{
    const source=read('tools/typescript-stage1/nico-src/Storyboard.ts');
    const player=read('src/VideoControlBar.js');
    assert(source.includes('_currentVideoInfo'));
    assert(source.includes("onkey?.('enableStoryboard'"));
    assert(player.includes('this.storyboard.reset()'),
      'player open must keep the established reset contract');
  });
});
