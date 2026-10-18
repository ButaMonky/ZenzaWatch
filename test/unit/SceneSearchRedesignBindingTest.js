'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
const {nativePreview}=require('../helpers/nativeCommentPreviewFixture');
const {loadClass,createContext}=require('../helpers/extractSource');
const Pref=loadClass('packages/zenza/src/sceneSearch/SceneSearchPreferences.js','SceneSearchPreferences',createContext());
function harness(layout='follow'){
 let native,now=0,next=0;const timers=new Map(),saved=new Set();
 const clock={setTimeout(fn,ms){timers.set(++next,{fn,at:now+ms});return next;},clearTimeout:id=>timers.delete(id)};
 const h=fixture('00','normal',{clock,beforeAttach({dom,d,bar,config,seek}){
  native=nativePreview(dom);bar._commentPreview._view._view.remove();bar._commentPreview=native.preview;
  seek.append(native.preview._view._view);
  native.preview.chatList=native.chats;native.preview.currentTime=11;
  const set=config.setValue.bind(config);config.setValue=(k,v)=>{saved.add(k);set(k,v);};
  config.resolveSceneSearch=()=>Pref.resolve(k=>config.getValue(k),k=>saved.has(k));
  config.setValue('sceneSearch.presentation.normal',layout);config.setValue('sceneSearch.presentation.fullscreen','fixed');
  config.setValue('sceneSearch.idleHideSeconds',2);
  config.onkey('enableCommentPreview',v=>{native.preview.mode=v?'list':'hover';});
 }});
 const bridge=h.binding.adapter?.bridge;
 return {...h,native,bridge,timers,
  tick(ms){const end=now+ms;for(;;){const due=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!due)break;now=due[1].at;timers.delete(due[0]);due[1].fn();}now=end;},
  fire(node,type){node.dispatchEvent(new h.dom.window.Event(type,{bubbles:true}));},
  close(){h.close();native.preview._view.dispose();}
 };
}
describe('semantic scene preview production binding',()=>{
 for(const action of ['comment-toggle','seek-back','seek-forward'])it(action+' releases mouse focus on leave so tracking and idle resume',()=>{
  const h=harness();try{
   h.move(400);h.config.setValue('enableCommentPreview',true);
   const root=h.bridge._active.root,button=root.querySelector('[data-scui-action="'+action+'"]');
   h.fire(h.seek,'mouseleave');h.fire(root,'mouseenter');h.fire(button,'pointerdown');
   button.focus();button.click();h.fire(h.d,'pointerup');
   h.fire(root,'mouseleave');
   assert.strictEqual(h.bridge.interaction.holdingPreview,false,'mouse focus must not hold the preview after leaving');
   const before=root.style.left;h.move(800);
   assert.notStrictEqual(root.style.left,before,'following must resume without another click');
   h.tick(2000);assert(root.hidden,'idle timeout must resume without clicking elsewhere');
  }finally{h.close();}
 });
 it('retains focus holds when a pointer user switches to keyboard or edits search',()=>{
  const h=harness();try{
   h.move(400);const root=h.bridge._active.root,button=root.querySelector('[data-scui-action="comment-toggle"]');
   h.fire(h.seek,'mouseleave');h.fire(root,'mouseenter');h.fire(button,'pointerdown');button.focus();h.fire(h.d,'pointerup');
   h.d.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));
   h.fire(root,'mouseleave');h.tick(5000);
   assert(h.bridge.interaction.holdingPreview&&!root.hidden);
   h.config.setValue('enableCommentPreview',true);
   const search=root.querySelector('[data-scui-action="comment-search"]');
   h.fire(root,'mouseenter');h.fire(search,'pointerdown');search.focus();search.click();h.fire(h.d,'pointerup');
   assert.strictEqual(h.d.activeElement.tagName,'INPUT');
   h.fire(root,'mouseleave');h.tick(5000);
   assert(h.bridge.interaction.holdingPreview&&!root.hidden);
  }finally{h.close();}
 });
 it('keeps search inside the list and uses settings for the three icon controls',()=>{
  const h=harness();try{
   h.move(400);const root=h.bridge._active.root;
   assert.strictEqual(root.querySelector('.zenzaSceneStepPopup'),null);
   h.config.setValue('sceneSearch.seekStepSeconds',10);
   root.querySelector('[data-scui-action="seek-back"]').click();
   root.querySelector('[data-scui-action="seek-forward"]').click();
   assert.deepStrictEqual(h.commands.slice(-2),[['seekBy',-10],['seekBy',10]]);
   h.config.setValue('sceneSearch.seekStepSeconds',0);
   assert(root.querySelector('[data-scui-action="seek-back"]').hidden);
   assert(!root.querySelector('[data-scui-action="comment-toggle"]').hidden);
   root.querySelector('[data-scui-action="comment-toggle"]').click();
   const search=root.querySelector('[data-scui-action="comment-search"]');search.click();
   const panel=root.querySelector('.zenzaSceneCommentSearch');
   assert(panel.closest('.zenzaSceneListSlot'));assert(!panel.hidden);
   assert.strictEqual(search.getAttribute('aria-expanded'),'true');
   h.tick(5000);assert(!root.hidden,'typing focus must keep the preview visible');
   root.querySelector('[data-scui-action="comment-toggle"]').click();
   assert(panel.hidden);assert(panel.closest('[hidden]'));
   assert.strictEqual(h.d.activeElement.dataset.scuiAction,'comment-toggle');
   root.querySelector('[data-scui-action="comment-toggle"]').click();
   assert(panel.hidden,'reopening the list must not resurrect a hidden search');
  }finally{h.close();}
 });
 for(const layout of ['follow','fixed'])it(layout+' mounts native mini and adjacent list with effective child settings',()=>{
  const h=harness(layout);try{
   assert.deepStrictEqual(h.errors,[]);assert.strictEqual(h.bridge.state.layoutId,layout);
   h.move(400);const root=h.bridge._active.root,mini=h.native.preview._view._view;
   root.querySelector('[data-scui-action="comment-toggle"]').click();
   const list=root.querySelector('.zenzaSceneNativeList');
   assert(list&&!list.hidden);assert.strictEqual(mini.parentNode,h.d.getElementById('thumb').parentNode);
   h.config.setValue('sceneSearch.commentPreviewVisible',false);
   assert(list.hidden&&mini.hidden);assert.strictEqual(h.config.getValue('enableCommentPreview'),true);
   h.config.setValue('sceneSearch.commentPreviewVisible',true);assert(!list.hidden&&!mini.hidden);
   h.config.setValue('sceneSearch.miniCommentVisible',false);assert(mini.hidden&&!list.hidden);
   h.config.setValue('sceneSearch.commentListVisible',false);assert(list.hidden);
   h.config.setValue('sceneSearch.commentListVisible',true);assert(!list.hidden);
   h.config.setValue('sceneSearch.thumbnailScale',200);assert(root.querySelector('.zenzaSceneLogical').style.transform.includes('2'));
   h.config.setValue('sceneSearch.commentListBackgroundOpacity',40);assert.strictEqual(list.style.getPropertyValue('--scene-list-alpha'),'0.4');
   const row=list.querySelector('.nicoChat');row.click();assert.strictEqual(h.native.commands.length,1);
  }finally{h.close();}
 });
 it('hides every surface after shared idle and preserves focus/drag/pin with zero disabling timeout',()=>{
  const h=harness();try{
   h.move(400);h.config.setValue('enableCommentPreview',true);
   const root=h.bridge._active.root,list=root.querySelector('.zenzaSceneNativeList');
   h.tick(2000);assert(root.hidden);assert.strictEqual(h.bridge._previewRects().length,0);
   h.move(410);assert(!root.hidden);
   h.fire(root,'focusin');h.fire(h.seek,'mouseleave');h.tick(5000);assert(!root.hidden);
   h.fire(root,'focusout');h.tick(900);assert(root.hidden);
   h.move(420);h.fire(root,'pointerdown');h.fire(root,'mouseleave');h.fire(h.seek,'mouseleave');
   h.tick(5000);assert(!root.hidden);h.fire(h.d,'pointercancel');h.tick(900);assert(root.hidden);
   h.move(430);h.bridge.interaction.togglePin();const time=h.bridge.state.time;h.move(900);
   assert.strictEqual(h.bridge.state.time,time);h.tick(5000);assert(!root.hidden);
   h.bridge.interaction.togglePin();h.config.setValue('sceneSearch.idleHideSeconds',0);
   h.move(440);h.tick(60000);assert(!root.hidden);assert(list.isConnected);
  }finally{h.close();}assert.strictEqual(h.timers.size,0);
 });
 it('uses actual small video geometry, freezes during manipulation and returns from fullscreen',()=>{
  const h=harness('fixed');try{
   h.move(400);h.config.setValue('enableCommentPreview',true);
   const video=h.d.createElement('div');video.className='videoPlayer';h.host.append(video);
   let x=600,reads=0;video.getBoundingClientRect=()=>{reads++;return {left:x,top:300,width:400,height:225,right:x+400,bottom:525};};
   h.bridge.updatePlacementContext({context:'small',interactionActive:false});
   const root=h.bridge._active.root,before=root.style.left;
   for(let i=0;i<20;i++)h.move(400+i);
   assert.strictEqual(root.style.left,before);assert(reads<=2,'seek-time updates must use cached obstacles');
   const previousTop=root.style.top;
   h.bridge.updatePlacementContext({context:'small',interactionActive:true});x=0;
   h.bridge.updatePlacementContext({context:'small',interactionActive:true});assert.strictEqual(root.style.left,before);
   h.bridge.updatePlacementContext({context:'small',interactionActive:false});
   assert(root.style.left!==before||root.style.top!==previousTop,'release must find a new safe rectangle');
   assert.strictEqual(h.bridge._placementResult.overlapsVideo,false);
   Object.defineProperty(h.d,'fullscreenElement',{configurable:true,value:h.host});
   h.setMode('fullscreen');h.bridge.updatePlacementContext({context:'fullscreen',interactionActive:false});
   assert(h.host.contains(h.bridge._active.root));
   Object.defineProperty(h.d,'fullscreenElement',{configurable:true,value:null});
   h.setMode('normal');h.bridge.updatePlacementContext({context:'small',interactionActive:false});
   assert.strictEqual(h.bridge.state.layoutId,'fixed');
  }finally{h.close();}assert.strictEqual(h.timers.size,0);
 });
 it('cycles semantic layouts, restores native owners on legacy and disposes late storyboard work',async()=>{
  const h=harness();try{
   h.move(400);h.config.setValue('enableCommentPreview',true);
   h.bridge.handleShortcut('sceneSearch-nextLayout');assert.strictEqual(h.bridge.state.layoutId,'fixed');
   h.bridge.handleShortcut('sceneSearch-nextLayout');assert.strictEqual(h.bridge.state.layoutId,'legacy');
   assert.strictEqual(h.native.preview._view._view.parentNode,h.seek);
   h.config.setValue('sceneSearch.presentation.normal','follow');h.storyboard.emit('update');
   h.binding.dispose();await Promise.resolve();
   assert.strictEqual(h.d.querySelectorAll('.zenzaSceneSharedPreview').length,0);
   assert.strictEqual(h.d.getElementById('thumb').closest('#old')?.id,'old');
   assert.strictEqual(h.native.preview._model.listenerCount('vpos'),1);
  }finally{h.close();}assert.strictEqual(h.timers.size,0);
 });
});
module.exports={harness};
