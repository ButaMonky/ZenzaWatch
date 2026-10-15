'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Registry=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js',
  'SceneSearchLayoutRegistry',createContext());
const Card=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js',
  'SceneSearchLayoutCard',createContext());
const Smart=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayout10.js',
  'SceneSearchLayout10',createContext());
const defaults={width:1000,height:600,sceneWidth:180,sceneHeight:105,cursorX:500,obstacles:[]};
function fixture(mode='normal',extra={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="host"></div></body></html>');
 let now=0,calls=0;const metrics={...defaults,...extra};
 const registry=new Registry();
 Smart.register(registry,{Card,clock:{now:()=>now}});
 const host=dom.window.document.getElementById('host');
 const card=registry.create({id:'10',mode,container:host,document:dom.window.document,
   settings:{measure:()=>{calls++;return metrics;}}});
 return {dom,registry,card,metrics,now:v=>{now=v;},
   get calls(){return calls;},dispose(){card.dispose();dom.window.close();}};
}
const state=(step=5)=>({shown:true,pinned:false,time:42,seekStepSeconds:step});
describe('SCUI-17 smart position avoiding comment preview without polling',()=>{
 it('registers only layout10 and preserves the old layout registry',()=>{
   const r=new Registry();
   Smart.register(r,{Card});
   assert.strictEqual(r.has('10'),true);
   assert.strictEqual(r.list().length,1);
   assert.throws(()=>Smart.register(r,{Card}),/duplicate/);
 });
 it('prefers the cursor when there are no comment obstructions',()=>{
   const choice=Smart.choose(defaults);
   assert.strictEqual(choice.slot,'cursor');
   assert.strictEqual(choice.overlap,0);
   assert.strictEqual(choice.x,500);
 });
 it('moves the scene card away from a centered comment preview',()=>{
   const choice=Smart.choose({...defaults,
     obstacles:[{x:390,y:410,width:240,height:135}]});
   assert(choice);
   assert.strictEqual(choice.overlap,0,'chosen placement must avoid comments');
   assert.notStrictEqual(choice.slot,'cursor');
 });
 it('stabilizes placement with a previous choice instead of jumping',()=>{
   const original=Smart.choose({...defaults,cursorX:510,
     obstacles:[{x:410,y:400,width:200,height:140}]});
   const after=Smart.choose({...defaults,cursorX:515,previous:original,
     obstacles:[{x:410,y:400,width:200,height:140}]});
   assert.strictEqual(after.slot,original.slot);
 });
 it('ignores invalid geometry and does not invent a position',()=>{
   assert.strictEqual(Smart.choose({width:0,height:200,sceneWidth:180,sceneHeight:100}),null);
   assert.strictEqual(Smart.choose({width:NaN,height:200,sceneWidth:180,sceneHeight:100}),null);
   assert.strictEqual(Smart.validRect({x:0,y:0,width:20,height:30}),true);
   assert.strictEqual(Smart.validRect({x:0,y:0,width:-1,height:30}),false);
 });
 for(const mode of ['normal','fullscreen']){
  it('mounts only one '+mode+' card and throttles placement to >=160ms',()=>{
    const h=fixture(mode,{obstacles:[{x:390,y:400,width:250,height:135}]});
    try{
      h.card.mount(state());
      assert.strictEqual(h.calls,1,'first render measures once');
      assert.strictEqual(h.card.root.dataset.layout,'10');
      assert(h.card.root.style.getPropertyValue('--scene-x'));
      h.now(50);h.card.render(state());
      h.now(120);h.card.render(state());
      assert.strictEqual(h.calls,1,'rapid hover renders must not reflow on each event');
      h.now(161);h.card.render(state());
      assert.strictEqual(h.calls,2);
      h.card.render(state(0));
      assert.strictEqual(h.card.root.querySelector('[data-scui-action="seek-back"]').hidden,true);
      h.card.dispose();h.card.dispose();
      assert.strictEqual(h.dom.window.document.querySelector('.zenzaSceneSearchHost'),null);
      assert.strictEqual(h.dom.window.document.querySelector('[data-scui-layout-style="10"]'),null);
    }finally{h.dom.window.close();}
  });
 }
 it('moves when comment geometry changes, without touching the provider or timers',()=>{
   const h=fixture();
   try{
     h.card.mount(state());
     const first=h.card.root.style.getPropertyValue('--scene-x');
     h.metrics.obstacles=[{x:370,y:400,width:280,height:150}];
     h.now(200);h.card.render(state());
     const second=h.card.root.style.getPropertyValue('--scene-x');
     assert.notStrictEqual(second,first);
     assert.strictEqual(h.calls,2);
   }finally{h.dispose();}
 });
});
