'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const parser=require('@babel/parser');
const {JSDOM}=require('jsdom');
const {createContext,run}=require('../helpers/extractSource');
const emitted='tools/typescript-stage1/.generated/nico/NicoVideoPlayerDialog.js';
function compiledView(){
 const text=fs.readFileSync(path.resolve(emitted),'utf8');
 const parsed=parser.parse(text,{sourceType:'module',allowUndeclaredExports:true,
  plugins:['classProperties']});
 const node=parsed.program.body.find(x=>
  x.type==='ClassDeclaration'&&x.id?.name==='NicoVideoPlayerDialogView');
 assert(node,'NicoVideoPlayerDialogView missing from real TS emission');
 return text.slice(node.start,node.end);
}
function setup({mountError=false}={}){
 const dom=new JSDOM('<!doctype html><html><body>'+
  '<div class="zenzaPlayerContainer"><input class="nativeSeek" type="range"/>'+
  '<zenza-seekbar-label class="resumePointer"></zenza-seekbar-label></div></body></html>');
 const container=dom.window.document.querySelector('.zenzaPlayerContainer');
 const nativeSeek=container.querySelector('.nativeSeek');
 const marker=container.querySelector('.resumePointer');
 const calls=[];
 const dock={activate:async(...a)=>{calls.push(['activate',...a]);return {status:'applied'};},
  deactivate(){calls.push(['deactivate']);},dispose(){calls.push(['dispose']);}};
 const ctx=createContext({
  Emitter:class{},window:dom.window,
  ManualBookmarkDock:{mount:(...a)=>{calls.push(['mount',...a]);
    if(mountError)throw Error('private mount failure details');
    return dock;}},
  ManualBookmarkSession:class{constructor(repo){this.repo=repo;}
    dispose(){calls.push(['sessionDispose']);}},
  ManualBookmarkRepository:class{constructor(db){this.db=db;}},
  IndexedDbManualBookmarkBackend:class{constructor(idb){this.idb=idb;}},
  VideoInfoPanel:class{constructor(){this.on=()=>{};}
   update(info){calls.push(['update',info.watchId]);}
   onLoadFail(){calls.push(['fail']);}}
 });
 run(compiledView()+';globalThis.__view=NicoVideoPlayerDialogView;',ctx);
 const view=Object.create(ctx.__view.prototype);
 view._$playerContainer=[container];
 view._state={videoInfo:{watchId:'sm1'}};
 view._currentTimeGetter=()=>75;
 view._onCommand=()=>{};
 view._clearActionFeedback=()=>{};
 view._clearHoverUiActive=()=>{};
 view._setThumbnail=()=>{};
 const close=()=>dom.window.close();
 return {ctx,view,dom,calls,container,nativeSeek,marker,close};
}
describe('P12 compiled DialogView manual-bookmark isolated mount ownership',()=>{
 it('failed optional dock mount releases its session without breaking the player info panel',()=>{
  const h=setup({mountError:true});
  assert(h.view._initializeVideoInfoPanel());
  assert.equal(h.calls.filter(x=>x[0]==='mount').length,1);
  assert.equal(h.calls.filter(x=>x[0]==='sessionDispose').length,1);
  assert.equal(h.view.manualBookmarkDock,undefined);
  assert.strictEqual(h.container.querySelector('.nativeSeek'),h.nativeSeek);
  assert.strictEqual(h.container.querySelector('.resumePointer'),h.marker);
  h.close();
 });
 it('mounts once in the info panel and follows video load/switch/failure',async()=>{
  const h=setup();
  const p=h.view._initializeVideoInfoPanel();
  assert(p,'VideoInfoPanel still created');
  assert.strictEqual(h.calls.filter(x=>x[0]==='mount').length,1);
  h.view._initializeVideoInfoPanel();
  assert.strictEqual(h.calls.filter(x=>x[0]==='mount').length,1);
  await h.view._onVideoInfoLoad({watchId:'sm1',duration:300});
  assert(h.calls.some(x=>x[0]==='activate'&&x[1]==='sm1'&&x[2]===300));
  h.view._onBeforeVideoOpen();
  assert(h.calls.some(x=>x[0]==='deactivate'));
  h.view._onVideoInfoFail();
  assert(h.calls.some(x=>x[0]==='fail'));
  assert(h.calls.filter(x=>x[0]==='deactivate').length>=2);
  assert.strictEqual(h.container.querySelector('.nativeSeek'),h.nativeSeek);
  assert.strictEqual(h.container.querySelector('.resumePointer'),h.marker);
  h.close();
 });
});
