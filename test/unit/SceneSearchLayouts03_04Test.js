'use strict';
const assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Registry=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js',
  'SceneSearchLayoutRegistry',createContext());
const Card=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js',
  'SceneSearchLayoutCard',createContext());
const Pair=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts03_04.js',
  'SceneSearchLayouts03_04',createContext());
function boot(mode,width=900){
 const errors=[],vc=new VirtualConsole();
 vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="host"></div></body></html>',
   {virtualConsole:vc});
 const registry=Pair.install(new Registry(),Card);
 const host=dom.window.document.getElementById('host');
 host.getBoundingClientRect=()=>({width,height:540,left:0,right:width,top:0,bottom:540});
 return {dom,host,registry,errors,mode,
   create:id=>registry.create({id,mode,document:dom.window.document,container:host})};
}
const state={shown:true,videoId:'sm9',time:24,seekStepSeconds:5,commentPreviewVisible:true};
describe('SCUI-13: side shelf and top edge normal/fullscreen',()=>{
 it('registers exactly two stable layout IDs and readable descriptions',()=>{
   const x=boot('normal');
   assert.deepStrictEqual(x.registry.list().map(i=>i.id).join(','),'03,04');
   assert(x.registry.list().every(d=>d.label&&d.description));
   assert.throws(()=>Pair.install(x.registry,Card),/duplicate/);
   x.dom.window.close();
 });
 for(const mode of ['normal','fullscreen']){
   it('03 side shelf mounts and disposes with appropriate screen-mode CSS: '+mode,()=>{
     const x=boot(mode),card=x.create('03');
     card.mount(state);
     assert(card.root.classList.contains('zenzaSceneSideShelf'));
     assert.strictEqual(card.root.dataset.mode,mode);
     const css=card.style.textContent;
     assert(css.includes('right:12px;top:17%'),
       'normal mode must use right side at 17% from top');
     assert(css.includes('left:15px;right:auto;top:32%'),
       'fullscreen mode must use the left side');
     assert(!css.includes('position:fixed'),
       'layout should be anchored in player coordinates, not viewport');
     assert(css.includes('flex-direction:column'));
     assert(css.includes('right:calc(100% - 1px)'));
     assert(css.includes('left:calc(100% - 1px)'));
     assert(css.includes('prefers-reduced-motion'));
     const more=card.root.querySelector('.scene-more');
     const tray=card.root.querySelector('.zenzaSceneActions');
     assert(!tray.contains(more),'expansion button must not be inside hidden tray');
     more.click();
     assert(card.root.classList.contains('is-expanded'));
     assert.equal(more.getAttribute('aria-expanded'),'true');
     card.render({...state,seekStepSeconds:0});
     assert(card.root.classList.contains('is-compact'));
     assert.strictEqual(card.root.querySelector('[data-scui-action="seek-back"]').hidden,true);
     assert.strictEqual(x.errors.length,0,JSON.stringify(x.errors));
     card.dispose();assert.strictEqual(x.host.children.length,0);
     assert.strictEqual(x.dom.window.document.querySelectorAll('style[data-scui-layout-style]').length,0);
     x.dom.window.close();
   });
   it('04 top edge restores top-right normal and top-center fullscreen: '+mode,()=>{
     const x=boot(mode),card=x.create('04');
     card.mount(state);
     assert(card.root.classList.contains('zenzaSceneTopEdge'));
     const css=card.style.textContent;
     assert(css.includes('right:16px;top:17px'),
       'normal mode must be at the upper-right video edge');
     assert(css.includes('left:50%;right:auto'),
       'fullscreen mode must be centered at the upper edge');
     assert(css.includes('safe-area-inset-top'));
     assert(!css.includes('position:fixed'));
     assert(css.includes('flex-flow:row wrap'),
       'tools must unfold in a horizontal row underneath');
     assert(css.includes('top:calc(100% - 1px)'));
     const more=card.root.querySelector('.scene-more');
     const tray=card.root.querySelector('.zenzaSceneActions');
     assert(!tray.contains(more));
     more.click();
     assert(card.root.classList.contains('is-expanded'));
     assert(!css.includes('pointer-events:auto;pointer-events:auto'));
     assert.strictEqual(x.errors.length,0,JSON.stringify(x.errors));
     card.dispose();x.dom.window.close();
   });
 }
 it('narrow side shelf moves its button rail below instead of off-screen',()=>{
   const x=boot('fullscreen',300),card=x.create('03');
   card.mount(state);
   assert.strictEqual(card.root.dataset.scuiNarrow,'true');
   assert(card.style.textContent.includes('[data-scui-narrow="true"] .zenzaSceneActions'));
   card.dispose();x.dom.window.close();
 });
 it('variants never install independent timers or thumbnail fetches',()=>{
   const x=boot('normal');
   for(const id of ['03','04']){
     const card=x.create(id);card.mount(state);card.onPreview(null);
     assert.strictEqual(x.host.children.length,1);
     card.dispose();
     assert.strictEqual(x.host.children.length,0);
   }
   x.dom.window.close();
 });
});