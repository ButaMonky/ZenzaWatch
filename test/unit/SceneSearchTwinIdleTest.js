'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
const {nativePreview}=require('../helpers/nativeCommentPreviewFixture');
function harness(id='02'){
 let now=0,next=0,native;const timers=new Map();
 const clock={setTimeout(fn,ms){timers.set(++next,{fn,at:now+ms});return next;},clearTimeout:id=>timers.delete(id)};
 const h=fixture(id,'normal',{clock,beforeAttach({dom,bar,config}){
  native=nativePreview(dom);bar._commentPreview._view._view.remove();bar._commentPreview=native.preview;
  native.preview.chatList=native.chats;native.preview.currentTime=11;
  config.onkey('enableCommentPreview',v=>{native.preview.mode=v?'list':'hover';});
  config.setValue('sceneSearch.idleHideSeconds',2);
 }});
 h.move(400);h.config.setValue('enableCommentPreview',true);
 const bridge=h.binding.adapter.bridge;
 return {...h,bridge,native,timers,clock,
  tick(ms){const end=now+ms;for(;;){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();}now=end;},
  fire(node,type){node.dispatchEvent(new h.dom.window.Event(type,{bubbles:true}));},
  close(){h.close();native.preview._view.dispose();}
 };
}
describe('Task791 shared idle visibility and active native surfaces',()=>{
 it('the configured two seconds hide both live views and pointer movement restores both',()=>{
  const h=harness();try{
   const mini=h.native.preview._view._view,list=h.host.querySelector('.zenzaSceneTwinList');
   h.tick(1999);assert(list.classList.contains('is-scui-active'));assert(mini.classList.contains('is-scui-active'));
   h.tick(1);assert(!h.bridge.state.shown);assert(!list.classList.contains('is-scui-active'));
   assert(!mini.classList.contains('is-scui-active'));assert.strictEqual(h.bridge._previewRects().length,0);
   h.move(410);assert(list.classList.contains('is-scui-active'));assert(mini.classList.contains('is-scui-active'));
  }finally{h.close();}assert.strictEqual(h.timers.size,0);
 });
 for(const id of ['01','02','03','04','05','06','07','08','09','10']){
  it('UI'+id+' preserves keyboard focus after pointer leaves its native list',()=>{
   const h=harness(id);try{
    const panel=id==='02'?h.host.querySelector('.zenzaSceneTwinList'):h.native.preview._view._view;
    h.fire(panel,'mouseenter');h.fire(panel,'focusin');h.fire(panel,'mouseleave');
    h.fire(h.seek,'mouseleave');h.tick(4000);assert(h.bridge.state.shown);
    h.fire(panel,'focusout');h.tick(451);assert(!h.bridge.state.shown);
   }finally{h.close();}assert.strictEqual(h.timers.size,0);
  });
 }
 it('list pointer drag keeps the preview visible outside all surfaces until release',()=>{
  const h=harness();try{
   const list=h.host.querySelector('.zenzaSceneTwinList');
   h.fire(list,'mouseenter');h.fire(list,'pointerdown');h.fire(list,'mouseleave');h.fire(h.seek,'mouseleave');
   h.tick(4000);assert(h.bridge.state.shown,'native scrollbar drag must hold the group');
   h.fire(h.d,'pointerup');h.tick(451);assert(!h.bridge.state.shown);
  }finally{h.close();}assert.strictEqual(h.timers.size,0);
 });
 it('mode change disposes the old list, and teardown cancels every bridge timer',()=>{
  const h=harness();try{
   const old=h.host.querySelector('.zenzaSceneTwinList');h.fire(old,'mouseenter');
   h.setMode('fullscreen');h.move(420);
   assert(!old.isConnected);assert(h.host.querySelector('.zenzaSceneTwinList'));
   assert.strictEqual(h.native.preview._model.listenerCount('vpos'),2);
  }finally{h.close();}assert.strictEqual(h.timers.size,0);
 });
});
