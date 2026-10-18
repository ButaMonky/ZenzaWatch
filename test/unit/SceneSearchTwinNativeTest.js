'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {nativePreview}=require('../helpers/nativeCommentPreviewFixture');
const {fixture}=require('../helpers/scenePlayerFixture');
describe('Task791 real native simultaneous mini and list',()=>{
 it('retains hover rows over the image while the separate native list opens and seeks',()=>{
  const dom=new JSDOM('<!doctype html><body></body>');
  const h=nativePreview(dom),p=h.preview;
  try{
   p.chatList=h.chats;p.currentTime=11;p.mode='list';
   const panel=p.createListView(h.owner);
   assert.strictEqual(p._view._mode,'hover');
   assert.strictEqual(p._view._view.dataset.commentPreviewMode,'hover');
   assert.strictEqual(panel.element.dataset.commentPreviewMode,'list');
   assert(p._view._view.querySelector('.text').textContent.includes('行'));
   assert(panel.element.querySelector('.text').textContent.includes('行'));
   p.mode='hover';p.mode='list';
   assert.strictEqual(p._view._mode,'hover','button must never replace the miniature with list rows');
   const row=panel.element.querySelector('.nicoChat');
   row.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));
   assert.deepStrictEqual(h.commands,[['seek',Number(row.dataset.vpos)/100]]);
   p.currentTime=12;
   assert.strictEqual(panel.element.style.getPropertyValue('--current-time'),'12s');
   const primaryCount=p._model.listenerCount('vpos');
   panel.dispose();panel.dispose();
   assert(!panel.element.isConnected);
   assert.strictEqual(p._model.listenerCount('vpos'),primaryCount-1);
   assert.strictEqual(p._view._mode,'list','restore original configured mode');
  }finally{p._view.dispose?.();dom.window.close();}
 });
 it('does not receive delayed updates after secondary teardown or duplicate row IDs',async()=>{
  const dom=new JSDOM('<!doctype html><body></body>');
  const h=nativePreview(dom),p=h.preview;
  try{
   p.chatList=h.chats;p.currentTime=11;
   const panel=p.createListView(h.owner);
   const ids=[...h.owner.querySelectorAll('[id]')].map(n=>n.id);
   assert.strictEqual(new Set(ids).size,ids.length,'two live native views must not duplicate document IDs');
   p.chatList=h.chats;panel.dispose();
   await new Promise(r=>setTimeout(r,20));
   assert.strictEqual(panel.element.querySelectorAll('.nicoChat').length,0);
   assert.strictEqual(p._model.listenerCount('update'),1);
  }finally{p._view.dispose?.();dom.window.close();}
 });
 it('UI02 button keeps the ORIGINAL miniature in the image and opens a separate list',()=>{
  let n;
  const h=fixture('02','normal',{beforeAttach({dom,bar,config}){
   n=nativePreview(dom);bar._commentPreview._view._view.remove();
   bar._commentPreview=n.preview;n.preview.chatList=n.chats;n.preview.currentTime=11;
   config.onkey('enableCommentPreview',v=>{n.preview.mode=v?'list':'hover';});
  }});
  try{
   h.move(400);
   const root=h.host.querySelector('.zenzaSceneSearchHost'),mini=n.preview._view._view;
   assert.strictEqual(mini.parentNode,root.querySelector('.zenzaSceneImageBox'));
   root.querySelector('[data-scui-action="comment-toggle"]').click();
   assert.strictEqual(mini.parentNode,root.querySelector('.zenzaSceneImageBox'));
   const list=h.host.querySelector('.zenzaSceneTwinList');
   assert(list&&list!==mini);
   assert(list.classList.contains('is-scui-active'));
   assert.strictEqual(mini.dataset.commentPreviewMode,'hover');
   root.querySelector('[data-scui-action="comment-toggle"]').click();
   assert(!list.classList.contains('is-scui-active'));
   h.config.setValue('sceneSearch.layout.normal','01');
   assert(!h.host.querySelector('.zenzaSceneTwinList'));
   assert.strictEqual(n.preview._model.listenerCount('vpos'),1);
  }finally{h.close();n.preview._view.dispose?.();}
 });
 it('reset cannot hydrate the new list from old-video comments, even after pending updates',async()=>{
  const dom=new JSDOM('<!doctype html><body></body>');
  const h=nativePreview(dom),p=h.preview;
  try{
   p.chatList=h.chats;p.currentTime=11;p._view._onUpdate();
   p.reset();const panel=p.createListView(h.owner);
   assert.strictEqual(panel.element.querySelectorAll('.nicoChat').length,0);
   await new Promise(r=>setTimeout(r,25));
   assert.strictEqual(panel.element.querySelectorAll('.nicoChat').length,0);
   assert.strictEqual(p._view._view.querySelectorAll('.nicoChat').length,0);
   p.chatList={top:[],bottom:[],naka:[{...h.chats.naka[0],uniqNo:'fresh',text:'new-video'}]};
   p.currentTime=1;await new Promise(r=>setTimeout(r,25));
   assert(panel.element.textContent.includes('new-video'));
   panel.dispose();
  }finally{p._view.dispose();dom.window.close();}
 });

});
