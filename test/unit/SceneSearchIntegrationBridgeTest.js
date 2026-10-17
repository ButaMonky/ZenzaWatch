'use strict';
const assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
function cls(path,name){
 return loadClass(path,name,createContext());
}
const classes={
 Controller:cls('packages/zenza/src/sceneSearch/SceneSearchController.js','SceneSearchController'),
 Interaction:cls('packages/zenza/src/sceneSearch/SceneSearchInteraction.js','SceneSearchInteraction'),
 IdleLimiter:cls('packages/zenza/src/sceneSearch/ScenePreviewIdleLimiter.js','ScenePreviewIdleLimiter'),
 SeekStepControl:cls('packages/zenza/src/sceneSearch/SceneSeekStepControl.js','SceneSeekStepControl'),
 CommentSearch:cls('packages/zenza/src/sceneSearch/SceneCommentSearch.js','SceneCommentSearch'),
 CommentSearchPanel:cls('packages/zenza/src/sceneSearch/SceneCommentSearchPanel.js','SceneCommentSearchPanel'),
 ShortcutRouter:cls('packages/zenza/src/sceneSearch/SceneSearchShortcutRouter.js','SceneSearchShortcutRouter'),
 VisibilityRegistry:cls('src/UiVisibilityRegistry.js','UiVisibilityRegistry')
};
const Bridge=cls('packages/zenza/src/sceneSearch/SceneSearchIntegrationBridge.js',
 'SceneSearchIntegrationBridge');
const Registry=cls('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js',
 'SceneSearchLayoutRegistry');
const Card=cls('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js',
 'SceneSearchLayoutCard');
function harness(options={}){
 const errors=[],vc=new VirtualConsole();
 vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+
 '<div id="player"><div id="seek"></div><div id="mount"></div>'+
 '<aside class="zenzaCommentPreview" style="opacity:0.8">comments</aside>'+
 '<div id="legacy-tip" style="display:inline-flex"><div id="legacy-container">'+
 '<div id="legacy-thumb" class="zenzaSeekThumbnail">'+
 '<div class="zenzaSeekThumbnail-image">'+
 '<canvas id="legacy-canvas" class="zenzaSeekThumbnail-thumbnail" width="160" height="90"></canvas></div></div>'+
 '<span id="legacy-after">after</span></div></div></div></body></html>',
 {virtualConsole:vc,url:'https://example.invalid'});
 const d=dom.window.document;
 const values={
  'sceneSearch.layout.normal':'01',
  'sceneSearch.layout.fullscreen':'02',
  'sceneSearch.layout.linkFullscreen':false,
  'sceneSearch.seekStepSeconds':5,
  'sceneSearch.commentPreviewVisible':true,
  'sceneSearch.idleHideSeconds':2
 };
 Object.assign(values,classes.VisibilityRegistry.defaults());
 const listeners=new Map(),writes=[],delta=[],absolute=[],watch=[];
 const config={
  getValue:key=>values[key],
  setValue:(key,value)=>{
    values[key]=value;writes.push([key,value]);
    for(const fn of listeners.get(key)||[]){fn(value);}
  },
  onkey:(key,fn)=>listeners.set(key,[...(listeners.get(key)||[]),fn]),
  offkey:(key,fn)=>{
    const remainder=(listeners.get(key)||[]).filter(item=>item!==fn);
    if(remainder.length){listeners.set(key,remainder);}else{listeners.delete(key);}
  }
 };
 const registry=new Registry();
 for(const id of ['01','02']){
  registry.register({id,label:'Test layout '+id,
    factory:options=>new Card({...options,layoutClass:'demo-'+id})});
 }
 let sharedCanvasReady=options.deferCanvas!==true;
 const timers=new Map();let now=0,sequence=0;
 const clock={
  setTimeout(fn,ms){const id=++sequence;timers.set(id,{fn,at:now+ms});return id;},
  clearTimeout(id){timers.delete(id);}
 };
 const bridge=new Bridge({
  classes,registry,document:d,
  container:d.getElementById('mount'),
  seekElement:d.getElementById('seek'),
  commentPreviewElement:d.querySelector('.zenzaCommentPreview'),
  legacyTooltipElement:options.withSharedCanvas?d.getElementById('legacy-tip'):null,
  getThumbnailElement:options.brokenThumb?
    ()=>{throw new Error('Thumbnail owner blocked');}:
    options.withSharedCanvas?()=>sharedCanvasReady?d.getElementById('legacy-thumb'):null:null,
  loadPreview:options.loadPreview||null,
  config,clock,
  getChats:()=>[
   {text:'HELLO from comment',vpos:1200,uniqNo:'A',no:1},
   {text:'another comment',vpos:2000,uniqNo:'B',no:2}
  ],
  getSeekTime:event=>event.clientX/10,
  onSeekRelative:step=>delta.push(step),
  onSeekAbsolute:sec=>absolute.push(sec),
  onError:(e,k)=>errors.push('callback '+String(k)+':'+String(e))
 });
 const tick=ms=>{
  now+=ms;
  for(const [id,t] of [...timers]){
    if(t.at<=now){timers.delete(id);t.fn();}
  }
 };
 const send=(type,x=500,y=900)=>d.getElementById('seek').dispatchEvent(
   new dom.window.MouseEvent(type,{bubbles:true,clientX:x,clientY:y}));
 const button=id=>d.querySelector('[data-scui-action="'+id+'"]');
 return {dom,d,config,values,listeners,writes,delta,absolute,watch,bridge,
  timers,tick,send,button,errors,
  enableShared:()=>{sharedCanvasReady=true;},
  disableShared:()=>{sharedCanvasReady=false;},
  close(){bridge.dispose();dom.window.close();}};
}
describe('SCUI-18 standalone bridge preflight without touching legacy player',()=>{
 it('mounts only selected mode/card and leaves seek clicks owned by player',()=>{
  const h=harness();let clicks=0;
  h.d.getElementById('seek').addEventListener('mousedown',()=>clicks++);
  h.bridge.start('normal');
  assert.strictEqual(h.d.querySelectorAll('.zenzaSceneSearchHost').length,1);
  h.send('mouseenter',400);h.send('mousemove',450);
  assert.strictEqual(h.bridge.state.shown,true);
  assert.strictEqual(h.bridge.state.time,45);
  h.send('mousedown',450);
  assert.strictEqual(clicks,1,'bridge never intercepts seek mousedown');
  h.bridge.setMode('fullscreen');
  assert.strictEqual(h.bridge.state.layoutId,'02');
  assert.strictEqual(h.d.querySelectorAll('.zenzaSceneSearchHost').length,1);
  assert.strictEqual(h.d.querySelectorAll('style[data-scui-layout-style]').length,1);
  h.bridge.setMode('normal');
  assert.strictEqual(h.bridge.state.layoutId,'01');
  assert.strictEqual(h.d.querySelectorAll('.zenzaSceneSearchHost').length,1);
  h.close();
 });
 it('dispatches clicked filmstrip frame timestamps through the real absolute seek callback',()=>{
  const h=harness();h.bridge.start();
  h.bridge._onCardAction('frame-seek',{time:82.5});
  h.bridge._onCardAction('frame-seek',{time:-1});
  h.bridge._onCardAction('frame-seek',{time:NaN});
  assert.deepStrictEqual(h.absolute,[82.5]);
  h.close();
 });
 it('pins/unpins and exposes keyboard-safe scene actions and shortcut routing',()=>{
  const h=harness();h.bridge.start();h.send('mouseenter');
  h.button('pin').click();
  assert.strictEqual(h.bridge.state.pinned,true);
  assert.strictEqual(h.button('pin').getAttribute('aria-pressed'),'true');
  assert.strictEqual(h.bridge.handleShortcut('sceneSearch-togglePin'),true);
  assert.strictEqual(h.bridge.state.pinned,false);
  h.button('seek-back').click();h.button('seek-forward').click();
  assert.deepStrictEqual(h.delta,[-5,5]);
  h.button('comment-toggle').click();
  assert.strictEqual(h.values.enableCommentPreview,true);
  assert.strictEqual(h.values['sceneSearch.commentPreviewVisible'],true);
  assert.strictEqual(h.button('comment-toggle').getAttribute('aria-pressed'),'true');
  h.close();
 });
 it('selects 0 seconds, really hides seek buttons and restores them',()=>{
  const h=harness();h.bridge.start();h.send('mouseenter');
  h.button('seek-step').click();
  const input=h.d.querySelector('.zenzaSceneSeekStepControl [data-scui="custom"]');
  assert(input);
  assert.strictEqual(h.d.querySelector('.zenzaSceneStepPopup').hidden,false);
  input.value='0';
  h.d.querySelector('.zenzaSceneStepPopup [data-scui="save"]').click();
  assert.strictEqual(h.values['sceneSearch.seekStepSeconds'],0);
  assert.strictEqual(h.button('seek-back').hidden,true);
  assert.strictEqual(h.button('seek-back').disabled,true);
  assert.strictEqual(h.bridge.state.seekStepSeconds,0);
  assert.strictEqual(h.bridge.handleShortcut('sceneSearch-seekForward'),false);
  h.values['sceneSearch.seekStepSeconds']=10;
  h.config.setValue('sceneSearch.seekStepSeconds',10);
  assert.strictEqual(h.button('seek-back').hidden,false);
  h.close();
 });
 it('hides a static thumbnail after 2 seconds, moves 4px to resume, pin suspends',()=>{
  const h=harness();h.bridge.start();h.send('mouseenter',500);
  h.tick(1999);assert.strictEqual(h.bridge.state.shown,true);
  h.tick(1);assert.strictEqual(h.bridge.state.shown,false);
  h.send('mousemove',504);
  assert.strictEqual(h.bridge.state.shown,true);
  h.button('pin').click();
  assert.strictEqual(h.bridge.state.pinned,true);
  h.tick(6000);
  assert.strictEqual(h.bridge.state.shown,true);
  h.close();
 });
 it('filters loaded comments and seeks to result without injecting HTML',()=>{
  const h=harness();h.bridge.start();h.bridge.setVideo('sm9');h.send('mouseenter');
  h.button('comment-search').click();
  const input=h.d.querySelector('.zenzaSceneCommentSearch input');
  input.value='hello';input.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
  assert.strictEqual(h.d.querySelectorAll('.zenzaSceneCommentSearch li').length,1);
  h.d.querySelector('.zenzaSceneCommentSearch [data-scui="result"]').click();
  assert.deepStrictEqual(h.absolute,[12]);
  h.close();
 });
 it('reuses the legacy storyboard Canvas and restores its DOM after mode changes',()=>{
  const h=harness({withSharedCanvas:true});
  const thumb=h.d.getElementById('legacy-thumb');
  const canvas=h.d.getElementById('legacy-canvas');
  const source=h.d.getElementById('legacy-container');
  const oldTip=h.d.getElementById('legacy-tip');
  const savedDisplay=oldTip.style.display;
  h.bridge.start();
  assert.strictEqual(thumb.querySelector('canvas'),canvas,
    'do not allocate a second thumbnail canvas or worker');
  assert(h.d.querySelector('.zenzaSceneImageBox').contains(thumb),
    'move original thumbnail into the selected scene card');
  assert.strictEqual(oldTip.style.getPropertyValue('display'),'none');
  assert.strictEqual(oldTip.style.getPropertyPriority('display'),'important');
  h.config.setValue('sceneSearch.seekStepSeconds',0);
  assert.strictEqual(h.dom.window.getComputedStyle(canvas).width,'112px',
    'compact card must scale the original 160px canvas instead of cropping it');
  h.bridge.setMode('fullscreen');
  assert(h.d.querySelector('.zenzaSceneImageBox').contains(thumb),
    'mode switch must transfer the same Canvas, not clone it');
  assert.strictEqual(h.d.querySelectorAll('#legacy-canvas').length,1);
  h.bridge.dispose();
  assert.strictEqual(thumb.parentNode,source,'disposal restores the old owner');
  assert.strictEqual(source.firstElementChild,thumb,'preserve original sibling order');
  assert.strictEqual(oldTip.style.display,savedDisplay);
  assert.strictEqual(oldTip.style.getPropertyPriority('display'),'');
  h.dom.window.close();
 });
 it('adopts a thumbnail created asynchronously after the preview started',()=>{
  const h=harness({withSharedCanvas:true,deferCanvas:true});
  const thumb=h.d.getElementById('legacy-thumb');
  const source=h.d.getElementById('legacy-container');
  h.bridge.start();
  assert.strictEqual(thumb.parentNode,source);
  assert.strictEqual(h.d.getElementById('legacy-tip').style.display,'none',
    'only the new card should be visible while the storyboard is loading');
  h.enableShared();
  assert.strictEqual(h.bridge.refreshSharedThumbnail(),true);
  assert(h.d.querySelector('.zenzaSceneImageBox').contains(thumb));
  h.close();
  assert.strictEqual(thumb.parentNode,source);
 });
 it('returns an unavailable storyboard canvas to its owner and restores the placeholder',()=>{
  const h=harness({withSharedCanvas:true});
  const thumb=h.d.getElementById('legacy-thumb');
  const source=h.d.getElementById('legacy-container');
  h.bridge.start();
  const preview=h.d.querySelector('.zenzaSceneImageBox');
  assert.strictEqual(preview.contains(thumb),true);
  h.disableShared();
  assert.strictEqual(h.bridge.refreshSharedThumbnail(),false);
  assert.strictEqual(thumb.parentNode,source,'reset returns stale canvas to original owner');
  assert.strictEqual(h.d.querySelector('.zenzaSceneImagePlaceholder').hidden,false);
  assert.strictEqual(h.d.getElementById('legacy-tip').style.display,'none',
    'the old tooltip must not reappear while new UI is active');
  h.enableShared();
  assert.strictEqual(h.bridge.refreshSharedThumbnail(),true);
  assert.strictEqual(preview.contains(thumb),true);
  assert.strictEqual(h.d.querySelector('.zenzaSceneImagePlaceholder').hidden,true);
  h.close();
  assert.strictEqual(thumb.parentNode,source);
 });
 it('keeps worker Canvas primary when a preview provider also returns a picture',async()=>{
  const h=harness({withSharedCanvas:true,loadPreview:async()=>({
    imageUrl:'https://img.example.invalid/alternative.jpg',time:45
  })});
  h.bridge.start();h.bridge.setVideo('sm9');
  const updated=await h.bridge.previewAt(45,'frame45');
  assert.strictEqual(updated,true);
  const slot=h.d.querySelector('.zenzaSceneImageBox');
  const legacy=h.d.getElementById('legacy-thumb');
  assert(slot.contains(legacy));
  const other=slot.querySelector('.zenzaSceneImage');
  assert.strictEqual(other.hidden,true,
    'do not show two conflicting current-time thumbnails');
  h.close();
 });
 it('isolates failure to obtain the original thumbnail and keeps playback operational',()=>{
  const h=harness({brokenThumb:true});
  h.bridge.start();h.send('mouseenter');
  assert.strictEqual(h.bridge.state.shown,true);
  assert(h.errors.some(e=>e.includes('Thumbnail owner blocked')));
  assert.strictEqual(h.d.querySelectorAll('.zenzaSceneSearchHost').length,1);
  h.close();
 });
 it('keeps seek gestures visible during pointer drag and releases on document pointerup',()=>{
  const h=harness();
  h.bridge.start();h.send('mouseenter',500);
  h.send('pointerdown',500);
  h.tick(6000);
  assert.strictEqual(h.bridge.state.shown,true,
    'dragging must not trigger the two-second idle timeout');
  h.d.dispatchEvent(new h.dom.window.Event('pointerup',{bubbles:true}));
  h.tick(2000);
  assert.strictEqual(h.bridge.state.shown,false,
    'idle timeout must resume once a drag ends, even if mouseup occurs off seekbar');
  h.close();
 });
 it('cancels active pointer gesture across fullscreen changes and disposal',()=>{
  const h=harness();
  h.bridge.start();h.send('mouseenter');
  const event=(name,id)=>{
    const e=new h.dom.window.Event(name,{bubbles:true});
    Object.defineProperty(e,'pointerId',{value:id});
    return e;
  };
  const seek=h.d.getElementById('seek');
  seek.dispatchEvent(event('pointerdown',4));
  seek.dispatchEvent(event('pointerdown',7));
  h.d.dispatchEvent(event('pointerup',4));
  h.tick(2300);
  assert.strictEqual(h.bridge.state.shown,true,
    'second pointer is still active');
  h.bridge.setMode('fullscreen');
  h.send('mouseenter',520);
  h.tick(2000);
  assert.strictEqual(h.bridge.state.shown,false,
    'fullscreen transition must clear old pointer ownership');
  seek.dispatchEvent(event('pointerdown',8));
  h.bridge.dispose();
  h.d.dispatchEvent(event('pointercancel',8));
  assert.strictEqual(h.timers.size,0);
  assert.strictEqual(h.listeners.size,0);
  h.dom.window.close();
 });
 it('does not retain the preview forever after the step menu is closed',()=>{
  const h=harness();
  h.bridge.start();
  h.send('mouseenter');
  h.send('mouseleave');
  h.button('seek-step').click();
  const panel=h.d.querySelector('.zenzaSceneStepPopup');
  assert.strictEqual(panel.hidden,false);
  h.tick(2200);
  assert.strictEqual(h.bridge.state.shown,true,'active step menu suspends idle hiding');
  panel.querySelector('[data-scui="cancel"]').click();
  assert.strictEqual(panel.hidden,true);
  h.tick(451);
  assert.strictEqual(h.bridge.state.shown,false,
    'closing the popup must release its hold and resume normal hiding');
  h.close();
 });
 it('hides comment preview independently of hover/list mode and restores prior style',()=>{
  const h=harness();
  const element=h.d.querySelector('.zenzaCommentPreview');
  const opacity=element.style.opacity;
  h.bridge.start();
  assert.strictEqual(element.hidden,false);
  h.config.setValue('sceneSearch.commentPreviewVisible',false);
  assert.strictEqual(h.values.enableCommentPreview,undefined,
    'do not change the existing hover/list mode setting');
  assert.strictEqual(element.hidden,true);
  assert.strictEqual(element.style.getPropertyValue('display'),'none');
  assert.strictEqual(element.style.getPropertyPriority('display'),'important',
    'the real CSS hover selector must not override the off switch');
  h.config.setValue('sceneSearch.commentPreviewVisible',true);
  assert.strictEqual(element.hidden,false);
  assert.strictEqual(element.style.getPropertyValue('display'),'');
  assert.strictEqual(element.style.opacity,opacity);
  h.config.setValue('sceneSearch.commentPreviewVisible',false);
  h.bridge.dispose();
  assert.strictEqual(element.hidden,false,'dispose restores previous owner styling');
  assert.strictEqual(element.style.getPropertyPriority('display'),'');
  h.dom.window.close();
 });
 it('honors a previously hidden or inline-styled comment panel when disposing',()=>{
  const h=harness();
  const element=h.d.querySelector('.zenzaCommentPreview');
  element.hidden=true;
  element.style.setProperty('display','inline-flex');
  h.bridge.start();
  h.config.setValue('sceneSearch.commentPreviewVisible',false);
  assert.strictEqual(element.style.display,'none');
  h.bridge.dispose();
  assert.strictEqual(element.hidden,true);
  assert.strictEqual(element.style.display,'inline-flex');
  h.dom.window.close();
 });
 it('comment visibility false on startup is applied immediately and kept on mode changes',()=>{
  const h=harness();
  h.values['sceneSearch.commentPreviewVisible']=false;
  h.bridge.start();
  const element=h.d.querySelector('.zenzaCommentPreview');
  assert.strictEqual(element.hidden,true);
  h.bridge.setMode('fullscreen');
  assert.strictEqual(element.hidden,true);
  h.config.setValue('sceneSearch.commentPreviewVisible',true);
  assert.strictEqual(element.hidden,false);
  h.close();
 });
 it('visibility hides only one button; reset and dispose do not leak handlers',()=>{
  const h=harness();h.bridge.start();h.send('mouseenter');
  h.config.setValue('ui.scene.pin',false);
  assert.strictEqual(h.button('pin').hidden,true);
  h.config.setValue('ui.scene.pin',true);
  assert.strictEqual(h.button('pin').hidden,false);
  h.bridge.setVideo('sm9');
  h.bridge.setMode('fullscreen');
  h.bridge.dispose();h.bridge.dispose();
  assert.strictEqual(h.d.querySelectorAll('style').length,0);
  assert.strictEqual(h.d.querySelectorAll('.zenzaSceneSearchHost').length,0);
  assert.strictEqual(h.listeners.size,0);
  assert.strictEqual(h.timers.size,0);
  assert.strictEqual(h.errors.length,0,JSON.stringify(h.errors));
  h.dom.window.close();
 });
});
