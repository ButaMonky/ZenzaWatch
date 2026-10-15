'use strict';
const assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const {createContext,loadClass,run,beginSection}=require('../helpers/extractSource');
function fixture(){
 const errors=[],vc=new VirtualConsole();
 vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+
   '<div id="host" style="position:relative;width:900px;height:520px"></div>'+
   '</body></html>',{virtualConsole:vc});
 const ctx=createContext({document:dom.window.document});
 run(beginSection('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js'),ctx);
 run(beginSection('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js'),ctx);
 run('globalThis.Card=SceneSearchLayoutCard;globalThis.Registry=SceneSearchLayoutRegistry;',ctx);
 run(beginSection('packages/zenza/src/sceneSearch/SceneSearchLayouts01_02.js')+
   ';globalThis.registerClassic=registerSceneLayouts01_02;',ctx);
 const SideShelf=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts03_04.js',
   'SceneSearchLayouts03_04',ctx);
 const PlaybackDeck=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts05_06.js',
   'SceneSearchLayouts05_06',ctx);
 const Filmstrip=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayout07.js',
   'SceneSearchLayout07',ctx);
 const SmartAvoid=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayout10.js',
   'SceneSearchLayout10',ctx);
 const Catalog=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutCatalog.js',
   'SceneSearchLayoutCatalog',ctx);
 const host=dom.window.document.getElementById('host');
 host.getBoundingClientRect=()=>({x:0,y:0,left:0,top:0,right:900,bottom:520,
   width:900,height:520});
 const opts={Card:ctx.Card,registerClassic:ctx.registerClassic,
   SideShelf,PlaybackDeck,Filmstrip,SmartAvoid,
   clock:{now:()=>500}};
 const makeRegistry=()=>new ctx.Registry();
 const stubDrawer={
   register(registry,{Card}={}){
     for(const id of ['08','09']){
       registry.register({id,label:'UI prototype '+id,
         factory:options=>new Card({...options,layoutClass:'temporary-'+id})});
     }
   }
 };
 return {dom,errors,host,opts,Catalog,makeRegistry,stubDrawer};
}
const state={shown:true,pinned:false,time:245,
  seekStepSeconds:5,commentPreviewVisible:true};
describe('SCUI-18 catalog registration for real scene layout implementations',()=>{
 it('blocks incomplete ten-layout publication before mutating registry',()=>{
   const h=fixture(),reg=h.makeRegistry();
   assert.throws(()=>h.Catalog.install(reg,h.opts),/08\/09/);
   assert.strictEqual(reg.list().length,0,'strict install must be all-or-nothing at input gate');
   const result=h.Catalog.install(reg,{...h.opts,allowPartial:true});
   assert.strictEqual(result.complete,false);
   assert.strictEqual(result.registered.length,8);
   assert.strictEqual(result.missing.join(','),'08,09');
   assert.strictEqual(reg.list().length,8);
   h.dom.window.close();
 });
 it('registers exactly ten with an explicit 08/09 test double',()=>{
   const h=fixture(),reg=h.makeRegistry();
   const result=h.Catalog.install(reg,{...h.opts,Drawer:h.stubDrawer});
   assert.strictEqual(result.complete,true);
   assert.strictEqual(result.registered.join(','),
     '01,02,03,04,05,06,07,08,09,10');
   assert.strictEqual(result.missing.length,0);
   h.dom.window.close();
 });
 it('mounts all eight real variants across both modes without styling or cleanup errors',()=>{
   const h=fixture(),reg=h.makeRegistry();
   const result=h.Catalog.install(reg,{...h.opts,allowPartial:true});
   let mountCount=0;
   for(const mode of ['normal','fullscreen']){
     for(const id of result.registered){
       const card=reg.create({id,mode,document:h.dom.window.document,
         container:h.host,settings:{getDuration:()=>1000}});
       const s={...state,mode,layoutId:id};
       card.mount(s);
       assert.strictEqual(h.host.querySelectorAll('.zenzaSceneSearchHost').length,
         1,'one host for '+mode+' '+id);
       card.render({...s,seekStepSeconds:0});
       assert.strictEqual(card.root.querySelector('[data-scui-action="seek-back"]').hidden,
         true,id+' collapses seek hitbox');
       card.render({...s,seekStepSeconds:5});
       assert.strictEqual(card.root.querySelector('[data-scui-action="seek-back"]').disabled,
         false,id+' restores seek hitbox');
       card.dispose();
       assert.strictEqual(h.host.querySelectorAll('.zenzaSceneSearchHost').length,0);
       assert.strictEqual(h.dom.window.document.querySelectorAll('style[data-scui-layout-style]').length,0);
       mountCount++;
     }
   }
   assert.strictEqual(mountCount,16);
   assert.strictEqual(h.errors.length,0,JSON.stringify(h.errors));
   h.dom.window.close();
 });
 it('refuses a provider with wrong or duplicate IDs',()=>{
   const h=fixture(),reg=h.makeRegistry();
   const invalid={
     install(registry,Card){
       registry.register({id:'09',label:'one half',factory:o=>new Card(o)});
     }
   };
   assert.throws(()=>h.Catalog.install(reg,{
     ...h.opts,Drawer:invalid}),/instead of/);
   assert.strictEqual(reg.list().length,0,
     'a broken plugin must not leave half of the ten layouts installed');
   h.dom.window.close();
 });
});
