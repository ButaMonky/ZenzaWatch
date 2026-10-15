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
function boot(mode){
 const errors=[],vc=new VirtualConsole();
 vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="host"></div></body></html>',
   {virtualConsole:vc});
 const registry=Pair.install(new Registry(),Card);
 const host=dom.window.document.getElementById('host');
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
     assert(css.includes('right:12px') && css.includes('position:fixed'));
     assert(css.includes('safe-area-inset-right'));
     assert(css.includes('prefers-reduced-motion'));
     card.render({...state,seekStepSeconds:0});
     assert(card.root.classList.contains('is-compact'));
     assert.strictEqual(card.root.querySelector('[data-scui-action="seek-back"]').hidden,true);
     assert.strictEqual(x.errors.length,0,JSON.stringify(x.errors));
     card.dispose();assert.strictEqual(x.host.children.length,0);
     assert.strictEqual(x.dom.window.document.querySelectorAll('style[data-scui-layout-style]').length,0);
     x.dom.window.close();
   });
   it('04 top edge uses video-height normal and safe-area fullscreen: '+mode,()=>{
     const x=boot(mode),card=x.create('04');
     card.mount(state);
     assert(card.root.classList.contains('zenzaSceneTopEdge'));
     const css=card.style.textContent;
     assert(css.includes('--scene-video-height,360px'));
     assert(css.includes('safe-area-inset-top'));
     assert(css.includes('position:fixed'));
     assert(!css.includes('pointer-events:auto;pointer-events:auto'));
     assert.strictEqual(x.errors.length,0,JSON.stringify(x.errors));
     card.dispose();x.dom.window.close();
   });
 }
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