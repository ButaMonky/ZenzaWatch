'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Binding=loadClass('packages/zenza/src/sceneSearch/SceneSearchPlayerBinding.js',
  'SceneSearchPlayerBinding',createContext());
function emitter(){
 const m=new Map();
 return {on(k,f){if(!m.has(k))m.set(k,new Set());m.get(k).add(f);},
  off(k,f){m.get(k)?.delete(f);},
  emit(k,...args){for(const fn of [...m.get(k)||[]])fn(...args);},
  count(){return [...m.values()].reduce((s,fs)=>s+fs.size,0);}};
}
function harness(){
 const dom=new JSDOM('<!doctype html><html><body><div id="host">'+
  '<div class="qaPseudoOwner" id="owner">'+
  '<div class="commandPopover" id="popup"><button id="action">Open</button></div></div>'+
  '<div class="videoControlBar"><div class="controlItemContainer right">'+
  '<button class="controlButton" id="barButton">Play</button></div></div>'+
  '<div class="playbackRateMenu" id="native"><div class="zenzaPopupMenu" id="menu">'+
  '<button id="nativeButton">Rate</button></div></div>'+
  '<div class="commentInputPanel" id="comment"><input id="draft"></div>'+
  '<div class="videoPlayer" id="video"></div></div></body></html>',{
   url:'https://example.invalid/',pretendToBeVisual:true
  });
 const d=dom.window.document,win=dom.window,host=d.getElementById('host');
 let counter=0;const queued=new Map();
 win.requestAnimationFrame=cb=>{const id=++counter;queued.set(id,cb);return id;};
 win.cancelAnimationFrame=id=>queued.delete(id);
 const dialog=Object.assign(emitter(),{isOpen:true,screenMode:'normal'}),events=emitter();
 const updates=[],errors=[],created=[];
 class Adapter {
  constructor(){this.bridge={updatePlacementContext:ctx=>updates.push(ctx)};created.push(this);}
  start(){return this.bridge;}
  screenModeChanged(){}
  dispose(){this.disposed=true;}
 }
 const binding=new Binding({view:{videoControlBar:{}},dialog,events,
  document:d,container:host,isFullscreen:()=>false,Adapter,Bridge:class {},
  createRegistry:()=>({}),classes:{},onError:e=>errors.push(e)});
 binding.attach();
 const flush=()=>{const jobs=[...queued.values()];queued.clear();for(const cb of jobs)cb();};
 const fire=(id,type,related=null)=>{
  const node=d.getElementById(id);
  const init={bubbles:true,relatedTarget:related&&d.getElementById(related)};
  const e=/focus/.test(type)?new win.FocusEvent(type,init):
   /mouse/.test(type)?new win.MouseEvent(type,init):new win.Event(type,init);
  node.dispatchEvent(e);
 };
 flush();updates.length=0;
 return {dom,d,win,host,binding,dialog,events,errors,created,updates,queued,
  flush,fire,close(){binding.dispose();dom.window.close();}};
}
describe('P4-02 CSS pseudo-state geometry invalidation',()=>{
 it('invalidates a popup revealed only by hover on its parent, once per RAF',()=>{
  const h=harness();
  try{
   h.fire('owner','pointerover');
   h.fire('owner','mouseover');
   assert.strictEqual(h.queued.size,1,'pointer + mouse boundary events coalesce');
   h.flush();
   assert.strictEqual(h.updates.length,1);
   assert.strictEqual(h.updates[0].context,'normal');
  }finally{h.close();}
 });
 it('does not recalculate on mousemove or transfers inside one popup owner',()=>{
  const h=harness();
  try{
   h.fire('owner','mouseover');h.flush();h.updates.length=0;
   h.fire('action','mouseover','owner');
   h.fire('owner','mouseout','action');
   for(let i=0;i<120;i++)h.fire('action','mousemove');
   assert.strictEqual(h.queued.size,0,'same owner should not invalidate repeatedly');
   assert.strictEqual(h.updates.length,0);
  }finally{h.close();}
 });
 it('invalidates on leaving the interactive owner, including pointerout',()=>{
  const h=harness();
  try{
   h.fire('owner','pointerout','video');
   assert.strictEqual(h.queued.size,1);
   h.flush();
   assert.strictEqual(h.updates.length,1);
  }finally{h.close();}
 });
 it('invalidates focus-in and focus-out around a CSS :focus-within menu',()=>{
  const h=harness();
  try{
   h.fire('action','focusin');h.flush();
   assert.strictEqual(h.updates.length,1);
   h.fire('action','focusout','video');h.flush();
   assert.strictEqual(h.updates.length,2);
  }finally{h.close();}
 });
 it('covers native playback menu and actual fullscreen control rows',()=>{
  const h=harness();
  try{
   h.fire('native','mouseover');h.flush();
   h.fire('barButton','focusin');h.flush();
   assert.strictEqual(h.updates.length,2);
  }finally{h.close();}
 });
 it('continues protecting focused/hovered native comment inputs',()=>{
  const h=harness();
  try{
   h.fire('draft','focusin');h.flush();
   h.fire('comment','mouseover');h.flush();
   assert.strictEqual(h.updates.length,2);
  }finally{h.close();}
 });
 it('refreshes after pseudo-state transition completion on popup itself',()=>{
  const h=harness();
  try{
   h.fire('popup','transitionend');h.flush();
   assert.strictEqual(h.updates.length,1);
  }finally{h.close();}
 });
 it('ignores non-interaction mouse events over the unrelated video surface',()=>{
  const h=harness();
  try{
   h.fire('video','mouseover');h.fire('video','focusin');
   h.fire('video','pointerout');
   h.flush();
   assert.strictEqual(h.updates.length,0);
  }finally{h.close();}
 });
 it('removes pseudo-state listeners and cancels RAF on video close and dispose',()=>{
  const h=harness();
  try{
   h.fire('owner','mouseover');
   assert.strictEqual(h.queued.size,1);
   h.dialog.emit('close');
   assert.strictEqual(h.queued.size,0);
   assert(h.created[0].disposed);
   h.fire('owner','mouseover');h.fire('action','focusin');
   assert.strictEqual(h.queued.size,0,'disposed observer must not schedule');
   h.dialog.isOpen=true;h.dialog.emit('open');
   assert.strictEqual(h.created.length,2,'reopened video installs fresh owner');
   h.flush();h.updates.length=0;
   h.fire('owner','mouseover');h.flush();
   assert.strictEqual(h.updates.length,1);
   h.binding.dispose();
   h.fire('owner','mouseout');
   assert.strictEqual(h.queued.size,0);
   assert.strictEqual(h.dialog.count(),0);
  }finally{h.close();}
 });
});
