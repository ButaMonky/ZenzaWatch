'use strict';
const assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Registry=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js',
  'SceneSearchLayoutRegistry',createContext());
const Card=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js',
  'SceneSearchLayoutCard',createContext());
const Film=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayout07.js',
  'SceneSearchLayout07',createContext());
function harness(mode='normal'){
 const errors=[],vc=new VirtualConsole();
 vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="stage"></div></body></html>',
   {virtualConsole:vc});
 const registry=Film.install(new Registry(),Card);
 const stage=dom.window.document.getElementById('stage');
 const card=registry.create({id:'07',mode,document:dom.window.document,container:stage});
 const state={shown:true,time:70,pinned:false,
   seekStepSeconds:5,commentPreviewVisible:true};
 card.mount(state);
 return {dom,errors,registry,card,stage,state,close(){card.dispose();dom.window.close();}};
}
describe('SCUI-15 optional cached three-frame filmstrip',()=>{
 it('registers only 07 and provides no extra network dependencies',()=>{
   const h=harness();
   assert.deepStrictEqual(h.registry.list().map(x=>x.id).join(','),'07');
   assert(h.registry.get('07').description.includes('キャッシュ'));
   assert.strictEqual(h.card.root.dataset.layout,'07');
   h.close();
 });
 for(const mode of ['normal','fullscreen']){
   it('renders 3 frame slots and removes them cleanly in '+mode,()=>{
     const h=harness(mode);
     assert.strictEqual(h.card.root.querySelectorAll('.zenzaSceneFilmFrame').length,3);
     assert.strictEqual(h.card.root.querySelectorAll('img').length,3);
     assert.strictEqual(h.card.root.dataset.mode,mode);
     assert(h.card.style.textContent.includes('calc(100vw - 24px)'));
     assert.strictEqual(h.errors.length,0,JSON.stringify(h.errors));
     h.card.dispose();
     assert.strictEqual(h.stage.children.length,0);
     assert.strictEqual(h.dom.window.document.querySelectorAll('style').length,0);
     h.dom.window.close();
   });
 }
 it('renders supplied preloaded frames only, with true timestamps',()=>{
   const h=harness();
   h.card.onPreview({
     imageUrl:'https://img.example.invalid/current.jpg',time:70,
     frames:{
       previous:{imageUrl:'https://img.example.invalid/previous.jpg',time:61},
       next:{imageUrl:'https://img.example.invalid/next.jpg',time:82}
     }
   });
   const frame=id=>h.card.root.querySelector('[data-frame="'+id+'"]');
   assert(frame('previous').querySelector('img').src.includes('previous.jpg'));
   assert(frame('current').querySelector('img').src.includes('current.jpg'));
   assert(frame('next').querySelector('img').src.includes('next.jpg'));
   assert.strictEqual(frame('previous').querySelector('figcaption').textContent,'1:01');
   assert.strictEqual(frame('current').querySelector('figcaption').textContent,'1:10');
   assert.strictEqual(frame('next').querySelector('figcaption').textContent,'1:22');
   h.close();
 });
 it('keeps only one thumbnail if side images are missing or unsafe',()=>{
   const h=harness();
   h.card.onPreview({imageUrl:'https://img.example.invalid/current.jpg',
     frames:{previous:{imageUrl:'javascript:alert(1)',time:30}}});
   for(const side of ['previous','next']){
     const fig=h.card.root.querySelector('[data-frame="'+side+'"]');
     assert.strictEqual(fig.querySelector('img').hidden,true);
     assert.strictEqual(fig.querySelector('img').hasAttribute('src'),false);
   }
   assert.strictEqual(h.card.root.querySelectorAll('script').length,0);
   h.close();
 });
 it('collapses to one narrow picture when the seek step is zero',()=>{
   const h=harness();
   h.card.render({...h.state,seekStepSeconds:0,time:80});
   assert(h.card.root.classList.contains('is-compact'));
   assert.strictEqual(h.card.root.style.getPropertyValue('--scene-preview-min-width'),'124px');
   assert.strictEqual(h.card.root.querySelector('[data-frame="previous"]').hidden,true);
   assert.strictEqual(h.card.root.querySelector('[data-frame="next"]').hidden,true);
   assert.strictEqual(h.card.root.querySelector('[data-scui-action="seek-back"]').hidden,true);
   h.card.render({...h.state,seekStepSeconds:10});
   assert.strictEqual(h.card.root.querySelector('[data-frame="previous"]').hidden,false);
   h.close();
 });
 it('handles many existing preview updates without spawning new DOM or styles',()=>{
   const h=harness();
   for(let i=0;i<100;i++){
     h.card.onPreview({imageUrl:'https://img.example.invalid/f'+i+'.jpg'});
   }
   assert.strictEqual(h.card.root.querySelectorAll('img').length,3);
   assert.strictEqual(h.dom.window.document.querySelectorAll('style').length,1);
   h.close();
 });
});