'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Registry=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js',
  'SceneSearchLayoutRegistry',createContext());
const Card=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js',
  'SceneSearchLayoutCard',createContext());
const Pair=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts05_06.js',
  'SceneSearchLayouts05_06',createContext());
function fixture(mode='normal',id='05'){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="container"></div></body></html>');
 const document=dom.window.document,actions=[];
 const registry=new Registry();
 Pair.register(registry,{Card});
 const container=document.getElementById('container');
 const card=registry.create({id,mode,document,container,
   onAction:(name,meta)=>actions.push([name,meta.layoutId,meta.mode])});
 return {dom,document,registry,container,card,actions,dispose(){card.dispose();dom.window.close();}};
}
const state=(step=5)=>({shown:true,time:123,pinned:false,seekStepSeconds:step,commentPreviewVisible:true});
describe('SCUI-14 05 playback deck / 06 micro capsule',()=>{
 it('registers two independent strategies with stable IDs, labels and no extra layouts',()=>{
   const registry=new Registry();
   Pair.register(registry,{Card});
   assert.deepStrictEqual(Array.from(registry.list(),r=>r.id),['05','06']);
   assert.throws(()=>Pair.register(registry,{Card}),/duplicate/);
   assert.throws(()=>Pair.register(null,{Card}),/required/);
 });
 for(const id of ['05','06']){
  for(const mode of ['normal','fullscreen']){
   it('mounts '+id+' in '+mode+' with functional shared controls and releases styles',()=>{
     const h=fixture(mode,id);
     try{
       h.card.mount(state());
       assert.strictEqual(h.container.querySelectorAll('.zenzaSceneSearchHost').length,1);
       assert.strictEqual(h.card.root.dataset.layout,id);
       assert.strictEqual(h.card.root.dataset.mode,mode);
       assert(h.document.querySelector('[data-scui-layout-style="'+id+'"]'));
       assert.strictEqual(h.card.root.querySelector('.zenzaSceneTime').textContent,'2:03');
       const forward=h.card.root.querySelector('[data-scui-action="seek-forward"]');
       forward.click();
       h.card.root.querySelector('[data-scui-action="pin"]').click();
       assert.deepStrictEqual(h.actions.map(x=>x[0]),['seek-forward','pin']);
       assert(h.actions.every(x=>x[1]===id&&x[2]===mode));
       h.card.render(state(0));
       assert.strictEqual(h.card.root.classList.contains('is-compact'),true);
       assert.strictEqual(forward.hidden,true);
       assert.strictEqual(forward.disabled,true);
       h.card.render(state(3));
       assert.strictEqual(forward.hidden,false);
       assert.strictEqual(forward.disabled,false);
       h.card.root.querySelector('[data-scui-action="more"]').click();
       assert.strictEqual(h.card.root.classList.contains('is-expanded'),true);
       h.card.dispose();h.card.dispose();
       assert.strictEqual(h.container.childElementCount,0);
       assert.strictEqual(h.document.querySelector('[data-scui-layout-style="'+id+'"]'),null);
     }finally{h.dom.window.close();}
   });
  }
 }
 it('05 uses a responsive two-column deck with a 0-second compact mode',()=>{
   const css=Pair.CSS_05;
   assert(css.includes('grid-template-columns'));
   assert(css.includes('[data-mode="fullscreen"]'));
   assert(css.includes('.is-compact'));
   assert(css.includes('325px'));
   assert(css.includes('max-width:calc(100% - 20px)'));
 });
 it('06 is a small capsule with controls hidden until hovered/focused',()=>{
   const css=Pair.CSS_06;
   assert(css.includes('width:min(180px'));
   assert(css.includes('width:min(124px'));
   assert(css.includes(':focus-within'));
   assert(css.includes('pointer-events:none'));
 });
 it('never mounts an unselected layout and preserves focus escape affordance',()=>{
   const registry=new Registry();
   Pair.register(registry,{Card});
   const dom=new JSDOM('<!doctype html><html><head></head><body><div id="mount"></div></body></html>');
   const host=dom.window.document.getElementById('mount');
   assert.strictEqual(host.children.length,0);
   const selected=registry.create({id:'06',mode:'normal',document:dom.window.document,container:host});
   selected.mount(state());
   assert.strictEqual(host.children.length,1);
   assert.strictEqual(host.firstChild.dataset.layout,'06');
   const more=selected.root.querySelector('[data-scui-action="more"]');
   more.click();
   more.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   assert.strictEqual(selected.root.classList.contains('is-expanded'),false);
   selected.dispose();dom.window.close();
 });
});
