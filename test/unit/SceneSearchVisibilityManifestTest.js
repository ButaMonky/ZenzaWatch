'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass}=require('../helpers/extractSource');
const Registry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',createContext());
const names=['panel','pin','seekArrows','seekSeconds','commentToggle','commentSearch','more'];
describe('SCUI-07 scene-search display-only visibility registry',()=>{
 it('provides exactly seven unique scene controls and no loss of legacy controls',()=>{
   const entries=Registry.list('scene');
   assert.strictEqual(entries.length,7);
   assert.deepStrictEqual(Array.from(entries,x=>String(x.key)),names.map(n=>'ui.scene.'+n));
   assert.strictEqual(new Set(entries.map(e=>e.key)).size,7);
   for(const e of entries){
     assert.strictEqual(Registry.defaults()[e.key],true);
     assert(Registry.get(e.key)?.selector);
   }
   for(const key of ['ui.bar.pin','ui.bar.storyboard','ui.bar.fullscreen']){
     assert(Registry.get(key),key);
   }
   assert.strictEqual(Registry.assertValidManifest(),true);
 });
 it('exposes new controls under display visibility without creating duplicate settings',()=>{
   const descriptors=Registry.descriptors().filter(d=>d.visibilityScope==='scene');
   assert.strictEqual(descriptors.length,7);
   assert(descriptors.every(d=>d.category==='画面・映像'&&
     d.subcategory==='表示・非表示'&&d.type==='boolean'));
 });
 it('hides controls and their click hitbox, restores existing inline styles',()=>{
   const dom=new JSDOM('<!doctype html><html><body><div id="root"><section class="zenzaSceneSearchHost">'+
     '<button class="zenzaSceneSearchPin" style="display:inline-flex">Pin</button>'+
     '<div class="zenzaSceneSeekStepControl"><button data-scui="back">back</button>'+
     '<button data-scui="forward">forward</button><button data-scui="open">seconds</button></div>'+
     '<button class="zenzaSceneCommentToggle">comments</button>'+
     '<button class="zenzaSceneCommentSearchToggle">search</button>'+
     '<button class="zenzaSceneSearchMore">more</button></section></div></body></html>');
   const root=dom.window.document.getElementById('root');
   const values=Registry.defaults(),listeners=new Map();
   const cfg={
     getValue:k=>values[k],onkey(k,fn){listeners.set(k,fn);},
     offkey(k){listeners.delete(k);}
   };
   const api=Registry.connect(cfg,root,'scene');
   const pin=root.querySelector('.zenzaSceneSearchPin');
   assert.strictEqual(pin.hidden,false);
   const earlier=pin.style.display;
   values['ui.scene.pin']=false;
   listeners.get('ui.scene.pin')();
   assert.strictEqual(pin.hidden,true);
   assert.strictEqual(pin.style.getPropertyValue('display'),'none');
   assert.strictEqual(pin.style.getPropertyPriority('display'),'important');
   values['ui.scene.pin']=true;
   listeners.get('ui.scene.pin')();
   assert.strictEqual(pin.hidden,false);
   assert.strictEqual(pin.style.display,earlier);
   values['ui.scene.seekArrows']=false;
   listeners.get('ui.scene.seekArrows')();
   assert.strictEqual(root.querySelector('[data-scui="back"]').hidden,true);
   assert.strictEqual(root.querySelector('[data-scui="forward"]').hidden,true);
   assert.strictEqual(root.querySelector('[data-scui="open"]').hidden,false);
   api.dispose();
   assert.strictEqual(listeners.size,0);
   dom.window.close();
 });
 it('recovers a fully hidden card with persisted visibility enabled',()=>{
   const dom=new JSDOM('<!doctype html><html><body><div id="root">'+
     '<section class="zenzaSceneSearchHost"><button class="zenzaSceneSearchMore">...</button></section>'+
     '</div></body></html>');
   const root=dom.window.document.getElementById('root');
   const values={...Registry.defaults(),'ui.scene.panel':false};
   const handlers=new Map();
   const config={getValue:k=>values[k],onkey:(k,h)=>handlers.set(k,h),offkey:k=>handlers.delete(k)};
   const sub=Registry.connect(config,root,'scene');
   const panel=root.querySelector('.zenzaSceneSearchHost');
   assert.strictEqual(panel.hidden,true);
   values['ui.scene.panel']=true;handlers.get('ui.scene.panel')();
   assert.strictEqual(panel.hidden,false);
   sub.dispose();dom.window.close();
 });
});
