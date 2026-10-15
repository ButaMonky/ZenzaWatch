'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass}=require('../helpers/extractSource');
function setup(){
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+
   '<div id="container" style="width:800px;height:450px"></div></body></html>');
 const Registry=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js',
  'SceneSearchLayoutRegistry',createContext());
 const Card=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js',
  'SceneSearchLayoutCard',createContext());
 const registry=new Registry(),actions=[];
 registry.register({id:'01',label:'クラシック追従',factory:o=>new Card(o)});
 registry.register({id:'02',label:'左右ツイン',factory:o=>new Card({...o,layoutClass:'twin'})});
 const host=dom.window.document.getElementById('container');
 const shared={document:dom.window.document,container:host,onAction:(a,c)=>actions.push([a,c])};
 return {dom,Registry,Card,registry,actions,host,shared};
}
const state={mode:'normal',layoutId:'01',shown:true,pinned:false,
 seekStepSeconds:5,commentPreviewVisible:true,time:75};
describe('SCUI-11 lazy layout registry, shared card and disposal',()=>{
 it('accepts only unique 01–10 and exposes compact read-only labels',()=>{
   const h=setup();
   assert.strictEqual(h.registry.has('01'),true);
   assert.strictEqual(h.registry.has('10'),false);
   assert.deepStrictEqual(h.registry.list().map(x=>x.id).join(','),'01,02');
   assert.throws(()=>h.registry.register({id:'01',label:'duplicate',factory:()=>{}}));
   assert.throws(()=>h.registry.register({id:'11',label:'unknown',factory:()=>{}}));
   assert.throws(()=>h.registry.create({...h.shared,id:'03'}),/not registered/);
   h.dom.window.close();
 });
 it('starts only one card and removes its styles/event listeners on disposal',()=>{
   const h=setup(),card=h.registry.create({...h.shared,id:'01',mode:'normal'});
   assert.strictEqual(h.host.children.length,0);
   card.mount(state);
   assert.strictEqual(h.host.children.length,1);
   assert.strictEqual(h.dom.window.document.querySelectorAll('style[data-scui-layout-style]').length,1);
   assert.strictEqual(card.root.dataset.layout,'01');
   assert.strictEqual(card.root.dataset.mode,'normal');
   card.dispose();card.dispose();
   assert.strictEqual(h.host.children.length,0);
   assert.strictEqual(h.dom.window.document.querySelectorAll('style[data-scui-layout-style]').length,0);
   h.dom.window.close();
 });
 it('supports semantic controls, expand by click, Escape and focus recovery',()=>{
   const h=setup(),card=h.registry.create({...h.shared,id:'02',mode:'fullscreen'});
   card.mount({...state,mode:'fullscreen',layoutId:'02',pinned:true});
   const more=card.root.querySelector('[data-scui-action="more"]');
   more.click();
   assert(card.root.classList.contains('is-expanded'));
   assert.strictEqual(more.getAttribute('aria-expanded'),'true');
   card.root.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   assert(!card.root.classList.contains('is-expanded'));
   assert.strictEqual(h.dom.window.document.activeElement,more);
   card.root.querySelector('[data-scui-action="pin"]').click();
   assert.deepStrictEqual(h.actions.map(x=>x[0]),['more','pin']);
   assert.strictEqual(h.actions[1][1].mode,'fullscreen');
   card.dispose();h.dom.window.close();
 });
 it('keeps collapsed auxiliary buttons outside the card flow and reachable from More',()=>{
   const h=setup(),card=h.registry.create({...h.shared,id:'01'});
   card.mount(state);
   const buttons=[...card.root.querySelectorAll('.zenzaSceneActions > button[data-scui-action]')];
   const ids=buttons.map(n=>n.dataset.scuiAction);
   assert(ids.indexOf('more')<ids.indexOf('pin'),
     'More must precede hidden controls in keyboard Tab order');
   const more=card.root.querySelector('[data-scui-action="more"]');
   assert.strictEqual(more.getAttribute('aria-haspopup'),'true');
   assert.strictEqual(more.getAttribute('aria-expanded'),'false');
   const pin=card.root.querySelector('[data-scui-action="pin"]');
   assert.strictEqual(h.dom.window.getComputedStyle(pin).position,'absolute',
     'hidden controls should not permanently occupy a 124px card');
   more.focus();more.click();
   assert(card.root.classList.contains('is-expanded'));
   assert.strictEqual(more.getAttribute('aria-expanded'),'true');
   card.root.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',
     {key:'Escape',bubbles:true}));
   assert.strictEqual(more.getAttribute('aria-expanded'),'false');
   card.dispose();h.dom.window.close();
 });
 it('toggles 0 second arrows/hitboxes, updates pin, comment state and time',()=>{
   const h=setup(),card=h.registry.create({...h.shared,id:'01'});
   card.mount(state);
   card.render({...state,time:600,seekStepSeconds:0,pinned:true,
     commentPreviewVisible:false});
   assert(card.root.classList.contains('is-compact'));
   assert.strictEqual(card.root.querySelector('.zenzaSceneTime').textContent,'10:00');
   for(const a of ['seek-back','seek-forward']){
     const button=card.root.querySelector('[data-scui-action="'+a+'"]');
     assert.strictEqual(button.hidden,true);assert.strictEqual(button.disabled,true);
     assert.strictEqual(button.style.display,'none');
   }
   assert.strictEqual(card.root.style.getPropertyValue('--scene-preview-min-width'),'124px');
   assert.strictEqual(card.root.querySelector('[data-scui-action="comment-toggle"]').getAttribute('aria-pressed'),'false');
   assert.strictEqual(card.root.querySelector('[data-scui-action="pin"]').getAttribute('aria-pressed'),'true');
   card.render({...state,seekStepSeconds:30,pinned:false});
   assert.strictEqual(card.root.querySelector('[data-scui-action="seek-back"]').hidden,false);
   assert.strictEqual(card.root.style.getPropertyValue('--scene-preview-min-width'),'180px');
   card.render({...state,shown:false});
   assert.strictEqual(card.root.hidden,true);
   card.dispose();h.dom.window.close();
 });
 it('renders image URLs only into image elements and never parses comment HTML',()=>{
   const h=setup(),card=h.registry.create({...h.shared,id:'01'});
   card.mount(state);
   const img=card.root.querySelector('img');
   card.onPreview({imageUrl:'https://img.example.invalid/frame.jpg'});
   assert.strictEqual(img.hidden,false);
   assert(img.getAttribute('src').includes('frame.jpg'));
   card.onPreview({imageUrl:'javascript:alert(1)'});
   assert.strictEqual(img.hidden,true);
   assert.strictEqual(img.hasAttribute('src'),false);
   assert.strictEqual(card.root.querySelectorAll('script').length,0);
   card.dispose();h.dom.window.close();
 });
 it('switches all ten layouts in both screen modes without leaving hidden DOM or styles',()=>{
   const h=setup();
   const registry=new h.Registry();
   const prefs={'sceneSearch.layout.normal':'01',
     'sceneSearch.layout.fullscreen':'01',
     'sceneSearch.layout.linkFullscreen':false,
     'sceneSearch.seekStepSeconds':5,
     'sceneSearch.commentPreviewVisible':true};
   for(let i=1;i<=10;i++){
     const id=String(i).padStart(2,'0');
     registry.register({id,label:'layout '+id,
       factory:o=>new h.Card({...o,layoutClass:'layout-'+id})});
   }
   const Controller=loadClass('packages/zenza/src/sceneSearch/SceneSearchController.js',
     'SceneSearchController',createContext());
   const c=new Controller({getPreference:k=>prefs[k],
     createLayout:registry.makeFactory(h.shared)});
   c.start('normal');c.show(true);c.onVideoChange('sm9');
   for(const mode of ['normal','fullscreen']){
     c.setMode(mode);
     for(let i=1;i<=10;i++){
       const id=String(i).padStart(2,'0');
       prefs['sceneSearch.layout.'+mode]=id;
       c.onPreferencesChanged('sceneSearch.layout.'+mode);
       c.show(true);
       assert.strictEqual(c.snapshot.layoutId,id);
       assert.strictEqual(h.host.querySelectorAll('.zenzaSceneSearchHost').length,1,
         mode+' '+id);
       assert.strictEqual(h.dom.window.document.querySelectorAll('style[data-scui-layout-style]').length,1);
     }
   }
   c.dispose();
   assert.strictEqual(h.host.children.length,0);
   assert.strictEqual(h.dom.window.document.querySelectorAll('style[data-scui-layout-style]').length,0);
   h.dom.window.close();
 });
 it('rejects factories with no cleanup contract',()=>{
   const h=setup();
   h.registry.register({id:'03',label:'bad',factory:()=>({mount(){},render(){}})});
   assert.throws(()=>h.registry.create({...h.shared,id:'03'}),/dispose/);
   h.dom.window.close();
 });
});
