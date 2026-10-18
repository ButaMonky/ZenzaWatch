'use strict';
const assert=require('assert'),fs=require('fs'),{JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const {nativePreview}=require('../helpers/nativeCommentPreviewFixture');
function setup(){
 const file='packages/zenza/src/sceneSearch/SceneSearchPreviewView.js';
 assert(fs.existsSync(file),'shared native preview must be generated from TypeScript');
 const dom=new JSDOM('<!doctype html><body></body>');
 const n=nativePreview(dom),d=dom.window.document;
 n.preview.chatList=n.chats;n.preview.currentTime=11;n.preview._view._onUpdate();
 const mini=n.preview._view._view,owner=mini.parentNode;
 const image=d.createElement('div');image.className='zenzaSeekThumbnail is-visible';
 image.innerHTML='<div class="zenzaSeekThumbnail-image"><canvas width="160" height="90"></canvas></div>';
 image.style.margin='3px';owner.insertBefore(image,mini);
 const before={image:owner.innerHTML,miniStyle:mini.getAttribute('style')};
 const list=n.preview.createListView(owner);
 const View=loadClass(file,'SceneSearchPreviewView',createContext({document:d,window:dom.window}));
 const actions=[];const view=new View({document:d,host:d.body,image,mini,listView:list,
  onAction:action=>actions.push(action)});
 view.mount();
 return {dom,d,n,mini,image,owner,list,view,actions,before,
  done(){view.dispose();n.preview._view.dispose();dom.window.close();}};
}
const state={shown:true,miniEnabled:true,listOpen:true,listAllowed:true,opacity:90,scale:100,miniStyle:'flow'};
describe('shared scene native preview',function(){
 this.timeout(20000);
 it('scales original image and mini together without scaling list, controls or canvas backing store',()=>{
  const h=setup();try{
   h.view.render(state);
   for(const scale of [.5,1,1.5,2]){
    h.view.fit({imageScale:scale,listWidth:180,listMaxHeight:240});
    assert.strictEqual(h.image.parentNode,h.mini.parentNode);
    assert.strictEqual(h.image.parentNode.style.transform,'scale('+scale+')');
    assert.strictEqual(h.image.parentNode.contains(h.list.element),false);
    assert.strictEqual(h.image.parentNode.contains(h.view.root.querySelector('button')),false);
    const canvas=h.image.querySelector('canvas');
    assert.deepStrictEqual([canvas.width,canvas.height],[160,90]);
   }
   assert.strictEqual(h.mini.querySelector('.text').textContent.includes('行'),true);
   const row=h.list.element.querySelector('.nicoChat');
   row.dispatchEvent(new h.dom.window.MouseEvent('click',{bubbles:true}));
   assert.deepStrictEqual(h.n.commands,[['seek',Number(row.dataset.vpos)/100]]);
  }finally{h.done();}
 });
 it('changes only the background alpha and hides all input surfaces when idle',()=>{
  const h=setup();try{
   for(const opacity of [0,40,90,100]){
    h.view.render({...state,opacity});
    const cs=h.dom.window.getComputedStyle(h.list.element);
    assert.strictEqual(cs.opacity,'1');
    assert.strictEqual(h.list.element.style.getPropertyValue('--scene-list-alpha'),String(opacity/100));
   }
   h.view.render({...state,shown:false});
   assert.strictEqual(h.view.root.hidden,true);assert.strictEqual(h.view.getRects().length,0);
   h.view.render({...state,miniEnabled:false,listOpen:false});
   assert.strictEqual(h.mini.hidden,true);assert.strictEqual(h.list.element.hidden,true);
   assert.strictEqual(h.view.root.hidden,false);
  }finally{h.done();}
 });
 it('keeps child state independent and restores native parents, typography and subscriptions on dispose',()=>{
  const h=setup();try{
   h.view.render({...state,miniStyle:'static'});
   assert.strictEqual(h.view.root.dataset.miniStyle,'static');
   h.view.render({...state,miniEnabled:false});
   h.view.render({...state,miniStyle:'static'});
   assert.strictEqual(h.mini.hidden,false);
   const count=h.n.preview._model.listenerCount('vpos');
   h.view.dispose();h.view.dispose();
   assert.strictEqual(h.owner.innerHTML,h.before.image);
   assert.strictEqual(h.mini.getAttribute('style'),h.before.miniStyle);
   assert.strictEqual(h.n.preview._model.listenerCount('vpos'),count-1);
   h.view.render(state);assert.strictEqual(h.view.root,null);
  }finally{h.done();}
 });
 it('refreshes mini availability when native storyboard reuses its image element',()=>{
  const h=setup();try{
   h.image.classList.remove('is-visible');h.view.render({...state,pinned:true});
   assert(h.mini.hidden);
   h.image.classList.add('is-visible');h.view.setImage(h.image);
   assert.strictEqual(h.mini.hidden,false);
   h.image.classList.remove('is-visible');h.view.setImage(h.image);
   assert.strictEqual(h.mini.hidden,true);
  }finally{h.done();}
 });
 it('accepts a later native image and restores both old and replacement image owners',()=>{
  const h=setup();try{
   h.view.render(state);
   const next=h.d.createElement('div');next.className='zenzaSeekThumbnail is-visible';
   next.innerHTML='<canvas width="160" height="90">';h.owner.append(next);
   h.view.setImage(next);
   assert.strictEqual(h.image.parentNode,h.owner);
   assert.strictEqual(next.parentNode,h.mini.parentNode);
   h.view.dispose();assert.strictEqual(next.parentNode,h.owner);
  }finally{h.done();}
 });
});
