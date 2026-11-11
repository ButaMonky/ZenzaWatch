'use strict';
// P12 #219: terminal B must intercept before any SupporterCredit startup.
const assert=require('assert'),fs=require('fs'),path=require('path');
const parser=require('@babel/parser');
const {createContext,run}=require('../helpers/extractSource');
function compiled(name,file){
  const src=fs.readFileSync(path.resolve('tools/typescript-stage1/.generated/nico/'+file+'.js'),'utf8');
  const ast=parser.parse(src,{sourceType:'module',allowUndeclaredExports:true,plugins:['classProperties']});
  const node=ast.program.body.find(x=>x.type==='ClassDeclaration'&&x.id?.name===name);
  assert(node,name+' not emitted');
  return src.slice(node.start,node.end);
}
async function build(){
  let created;
  class StubNicoPlayer{
    constructor(){created=this;}
    on(){return this;}
  }
  const ctx=createContext({
    Emitter:class{},NicoVideoPlayer:StubNicoPlayer,
    AudioAdjuster:{initialize(){},gain:1,onChange(){}},
    ThreadLoader:class{},
    _:{debounce:fn=>fn}
  });
  run(compiled('NicoVideoPlayerDialog','NicoVideoPlayerDialog')+
      ';globalThis.__dialog=NicoVideoPlayerDialog;',ctx);
  const dialog=Object.create(ctx.__dialog.prototype);
  const calls={play:0,repeat:0,credit:0,load:0,ended:0};
  const dock={isRepeating:true,repeatAtEnd(){calls.repeat++;return true;}};
  dialog._view={promise:async()=>{},manualBookmarkDock:dock};
  dialog._playerConfig={props:{volume:0.5,loop:false}};
  dialog._state={isOpen:true};
  dialog._$playerContainer=[];
  dialog.emitResolve=()=>{};
  dialog.play=()=>{calls.play++;};
  Object.defineProperty(dialog,'isOpen',{value:true,configurable:true});
  await dialog._initializeNicoVideoPlayer();
  assert(created,'dialog must create NicoVideoPlayer');
  const ctx2=createContext({Emitter:class{},performance:{now:()=>100},console:{warn(){}}});
  run(compiled('NicoVideoPlayer','NicoVideoPlayer')+
      ';globalThis.__nico=NicoVideoPlayer;',ctx2);
  const nico=Object.create(ctx2.__nico.prototype);
  nico.beforeSupporterCreditEnd=created.beforeSupporterCreditEnd;
  nico._playerConfig={props:{'supporterCredit.enable':true}};
  nico._videoPlayer={_isYouTube:false,currentTime:120};
  nico._tryStartSupporterCredit=()=>{calls.credit++;return true;};
  nico._kickSupporterCreditLoad=()=>{calls.load++;return Promise.resolve();};
  nico.emit=()=>{calls.ended++;};
  return {dialog,nico,dock,calls};
}
describe('P12 AB terminal credit ownership (#219)',()=>{
  it('loops before even a ready credit overlay can start',async()=>{
    const h=await build();
    h.nico._onEnded();
    assert.equal(h.calls.repeat,1);
    assert.equal(h.calls.play,1);
    assert.equal(h.calls.credit,0);
    assert.equal(h.calls.load,0);
    assert.equal(h.calls.ended,0,'AB end must not advance the playlist');
  });
  it('preserves ordinary credit and ended handling when no live AB interval owns the video',async()=>{
    const h=await build();
    h.dock.isRepeating=false;
    h.nico._onEnded();
    assert.equal(h.calls.repeat,0);
    assert.equal(h.calls.play,0);
    assert.equal(h.calls.credit,1,'normal ending still starts credit');
    h.dock.isRepeating=true;h.dock.repeatAtEnd=()=>false;
    h.nico._onEnded();
    assert.equal(h.calls.credit,2,'stale AB owner cannot suppress ordinary credit');
  });
});
