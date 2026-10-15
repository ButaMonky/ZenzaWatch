'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');
const Adapter=loadClass('packages/zenza/src/sceneSearch/SceneSearchLegacyAdapter.js',
  'SceneSearchLegacyAdapter',createContext());

function emitter(){
 const map=new Map();
 return {
  on(event,callback){
   const set=map.get(event)||new Set();
   set.add(callback);map.set(event,set);
   return this;
  },
  off(event,callback){
   map.get(event)?.delete(callback);
   if(map.get(event)?.size===0)map.delete(event);
  },
  emit(event,...args){for(const fn of [...(map.get(event)||[])])fn(...args);},
  count(){return [...map.values()].reduce((n,set)=>n+set.size,0);}
 };
}
function harness(opts={}){
 const player=Object.assign(emitter(),{
   watchId:'sm424',
   duration:180,
   chatList:[{text:'raw comment',vpos:1234,uniqNo:'raw'}]
 });
 const storyboard=emitter();
 const commands=[],updates=[],deferred=[],errors=[];
 const config={getValue:key=>key,setValue:()=>{},onkey:()=>{},offkey:()=>{}};
 const tooltip={nodeType:1},thumbnail={nodeType:1};
 const seek={
  getBoundingClientRect:()=>({left:100,top:900,width:800,height:18})
 };
 const model={_chatList:[{text:'filtered',vpos:2000,uniqNo:'filtered'}]};
 const controlBar={
  _seekBar:seek,_playerConfig:config,player,
  _duration:200,
  _seekBarToolTip:{
   _$view:[tooltip],_seekBarThumbnail:{_view:thumbnail}
  },
  _commentPreview:{_view:{_view:{nodeType:1}},_model:model},
  storyboard
 };
 const dialog={execCommand:(cmd,param)=>commands.push([cmd,param])};
 class FakeBridge {
  constructor(options){this.options=options;this.disposed=false;updates.push(['create']);}
  start(mode){updates.push(['start',mode]);if(opts.failStart){throw new Error('bridge unavailable');}}
  setVideo(id){updates.push(['video',id]);}
  setMode(mode){updates.push(['mode',mode]);}
  refreshSharedThumbnail(){updates.push(['thumb']);return true;}
  dispose(){this.disposed=true;updates.push(['dispose']);}
 }
 const input={
  Bridge:FakeBridge,classes:{},registry:{},controlBar,dialog,
  document:{},container:{},
  defer:fn=>deferred.push(fn),
  onError:(error,key)=>errors.push([key,error.message])
 };
 const adapter=new Adapter(input);
 const flush=()=>{
  while(deferred.length){deferred.shift()();}
 };
 return {adapter,input,player,storyboard,controlBar,model,dialog,
   commands,updates,deferred,flush,errors};
}

describe('SCUI-18 non-invasive original ZenzaWatch control binding',()=>{
 it('converts screen coordinates to time without offsetX or global.innerWidth',()=>{
  const seek={getBoundingClientRect:()=>({left:100,width:800})};
  const t=(x)=>Adapter.seekTime(seek,{clientX:x},1000);
  assert.strictEqual(t(100),0);
  assert.strictEqual(t(108),10);
  assert.strictEqual(t(500),500);
  assert.strictEqual(t(892),990);
  assert.strictEqual(t(900),1000);
  assert.strictEqual(t(940),1000);
  assert.strictEqual(t(50),0);
  assert.strictEqual(Adapter.seekTime(seek,{clientX:500},0),null);
  assert.strictEqual(Adapter.seekTime(seek,{clientX:NaN},100),null);
  assert.strictEqual(Adapter.seekTime({getBoundingClientRect:()=>({left:0,width:0})},
    {clientX:20},100),null);
 });
 it('maps exact legacy player/state/command owners without new media requests',()=>{
  const h=harness(),a=h.adapter;
  assert.strictEqual(a.seekElement,h.controlBar._seekBar);
  assert.strictEqual(a.currentVideoId,'sm424');
  assert.strictEqual(a.duration,200);
  assert.strictEqual(a.commentData,h.model._chatList,
    'use the comment-preview model, not a duplicated unfiltered dataset');
  const b=a.start('normal');
  assert.strictEqual(b.options.config,h.controlBar._playerConfig);
  assert.strictEqual(b.options.legacyTooltipElement,
    h.controlBar._seekBarToolTip._$view[0]);
  assert.strictEqual(b.options.getThumbnailElement(),
    h.controlBar._seekBarToolTip._seekBarThumbnail._view);
  assert.strictEqual(b.options.commentPreviewElement,h.controlBar._commentPreview._view._view);
  assert.strictEqual(b.options.seekElement,h.controlBar._seekBar);
  assert.strictEqual(b.options.getSeekTime({clientX:892}),198,
    '99% is computed against real seek width and duration');
  b.options.onSeekRelative(-5);
  b.options.onSeekAbsolute(100);
  assert.deepStrictEqual(h.commands,[['seekBy',-5],['seek',100]]);
  assert.deepStrictEqual(h.updates.slice(0,3),[
    ['create'],['start','normal'],['video','sm424']]);
  a.dispose();
 });
 it('falls back to already loaded player comments when filtered model unavailable',()=>{
  const h=harness();
  h.model._chatList=null;
  assert.strictEqual(h.adapter.commentData,h.player.chatList);
  h.player.chatList=null;
  assert.strictEqual(h.adapter.commentData.length,0);
  h.adapter.dispose();
 });
 it('wires only one video and storyboard event owner, cleans up on dispose',()=>{
  const h=harness();
  h.adapter.start();
  h.adapter.start();
  assert.strictEqual(h.player.count(),2,'open and close subscription only');
  assert.strictEqual(h.storyboard.count(),2,'update and reset subscription only');
  h.player.watchId='sm2';
  h.player.emit('open','sm2');
  h.player.emit('close');
  assert(h.updates.some(e=>e[0]==='video'&&e[1]==='sm2'));
  assert.strictEqual(h.updates.at(-1)[1],null);
  h.storyboard.emit('update');
  h.storyboard.emit('reset');
  assert.strictEqual(h.deferred.length,2);
  h.flush();
  assert.strictEqual(h.updates.filter(e=>e[0]==='thumb').length,2);
  h.adapter.dispose();
  h.adapter.dispose();
  assert.strictEqual(h.player.count(),0);
  assert.strictEqual(h.storyboard.count(),0);
  const length=h.updates.length;
  h.player.emit('open','after');
  h.storyboard.emit('update');
  assert.strictEqual(h.updates.length,length);
 });
 it('ignores outdated storyboard signals after mode switches and disposal',()=>{
  const h=harness();
  h.adapter.start();
  h.storyboard.emit('update');
  h.adapter.screenModeChanged('fullscreen');
  h.flush();
  assert.strictEqual(h.updates.filter(e=>e[0]==='thumb').length,1,
    'only immediate new-mode refresh; delayed old update ignored');
  h.storyboard.emit('update');
  h.adapter.dispose();
  h.flush();
  assert.strictEqual(h.updates.filter(e=>e[0]==='thumb').length,1);
 });
 it('cleans up partially started bridge after a failure',()=>{
  const h=harness({failStart:true});
  assert.throws(()=>h.adapter.start('normal'),/bridge unavailable/);
  assert.strictEqual(h.player.count(),0);
  assert.strictEqual(h.storyboard.count(),0);
  assert(h.updates.some(e=>e[0]==='dispose'));
  assert.throws(()=>h.adapter.start(),/disposed/);
 });
 it('does not bypass input validation when required legacy API is absent',()=>{
  const h=harness();
  const invalid={...h.input,controlBar:{...h.controlBar,_seekBar:null}};
  assert.throws(()=>new Adapter(invalid),/requires the real seekbar/);
  h.adapter.dispose();
 });
});
