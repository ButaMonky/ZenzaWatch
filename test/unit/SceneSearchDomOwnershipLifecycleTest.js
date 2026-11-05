'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const file='packages/zenza/src/sceneSearch/SceneSearchPreviewView.js';

function previewFixture(options={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="owner"><span id="before"></span><div id="image" class="zenzaSeekThumbnail is-visible"><canvas width="160" height="90"></canvas></div><aside id="mini" style="font-family:monospace;opacity:.7"><span class="nicoChat"><span class="text">\u884c\u3000\u3000\uff21\n\u3000\uff22</span></span></aside><span id="after"></span></div><main id="host"></main></body></html>');
 const d=dom.window.document,owner=d.getElementById('owner'),image=d.getElementById('image'),mini=d.getElementById('mini');
 mini.style.cssText=mini.style.cssText;
 const original=[...owner.childNodes],miniStyle=mini.getAttribute('style');
 const View=loadClass(file,'SceneSearchPreviewView',createContext({document:d,window:dom.window}));
 let attempts=0;
 const listElement=d.createElement('aside');listElement.className='native-list';owner.append(listElement);
 const list={element:listElement,dispose(){attempts++;if(options.listFailure&&attempts===1)throw new Error('list-dispose-failed');listElement.remove();}};
 const view=new View({document:d,host:d.getElementById('host'),image,mini,listView:options.withList?list:null});
 return {dom,d,owner,image,mini,original,miniStyle,list,listElement,view,get attempts(){return attempts;},
  done(){try{view.dispose();}finally{dom.window.close();}}};
}
describe('scene DOM ownership lifecycle',function(){
 this.timeout(20000);
 it('returns borrowed DOM and removes the shell even when owned list disposal fails, then retries that handle',()=>{
  const h=previewFixture({withList:true,listFailure:true});
  try{
   h.view.mount();
   assert.throws(()=>h.view.dispose(),/list-dispose-failed/);
   assert.strictEqual(h.image.parentNode,h.owner,'Canvas must return despite independent list failure');
   assert.strictEqual(h.mini.parentNode,h.owner,'mini comments must return despite independent list failure');
   assert.strictEqual(h.mini.getAttribute('style'),h.miniStyle);
   assert.strictEqual(h.d.querySelector('.zenzaSceneSharedPreview'),null);
   assert.strictEqual(h.d.querySelector('style[data-scui-shared-style]'),null);
   assert.doesNotThrow(()=>h.view.dispose());
   assert.strictEqual(h.attempts,2);
   assert.deepStrictEqual([...h.owner.childNodes],h.original);
   h.view.dispose();assert.strictEqual(h.attempts,2);
  }finally{h.done();}
 });
 it('retains a failed native return for retry and still restores the other native node',()=>{
  const h=previewFixture();h.view.mount();
  const insert=h.owner.insertBefore;let blocked=true;
  h.owner.insertBefore=function(node,next){if(node===h.mini&&blocked){blocked=false;throw new Error('owner-return-failed');}return insert.call(this,node,next);};
  try{
   assert.throws(()=>h.view.dispose(),/owner-return-failed/);
   assert.strictEqual(h.image.parentNode,h.owner,'a mini return failure must not strand the image');
   assert.doesNotThrow(()=>h.view.dispose());
   assert.deepStrictEqual([...h.owner.childNodes].filter(n=>n!==h.listElement),h.original);
   assert.strictEqual(h.mini.getAttribute('style'),h.miniStyle);
  }finally{h.owner.insertBefore=insert;h.done();}
 });
 it('rolls back a partially completed mount including native nodes, style and shell',()=>{
  const h=previewFixture(),proto=h.dom.window.Element.prototype,nodeProto=h.dom.window.Node.prototype;
  const append=proto.append,prepend=proto.prepend,insertBefore=nodeProto.insertBefore;
  const failAfterAttach=(target,nodes)=>{
   if(target.classList&&target.classList.contains('zenzaSceneLogical')&&nodes.includes(h.mini))throw new Error('mini-attach-failed');
  };
  proto.append=function(...nodes){const result=append.apply(this,nodes);failAfterAttach(this,nodes);return result;};
  proto.prepend=function(...nodes){const result=prepend.apply(this,nodes);failAfterAttach(this,nodes);return result;};
  nodeProto.insertBefore=function(node,next){const result=insertBefore.call(this,node,next);failAfterAttach(this,[node]);return result;};
  try{
   assert.throws(()=>h.view.mount(),/mini-attach-failed/);
   assert.strictEqual(h.image.parentNode,h.owner);
   assert.strictEqual(h.mini.parentNode,h.owner);
   assert.strictEqual(h.d.querySelector('.zenzaSceneSharedPreview'),null);
   assert.strictEqual(h.d.querySelector('style[data-scui-shared-style]'),null);
   assert.strictEqual(h.mini.getAttribute('style'),h.miniStyle);
  }finally{proto.append=append;proto.prepend=prepend;nodeProto.insertBefore=insertBefore;h.done();}
 });
 it('preserves native renderer updates made while the image and comment DOM are borrowed',()=>{
  const h=previewFixture();
  try{
   const canvas=h.image.querySelector('canvas'),text=h.mini.querySelector('.text');
   h.view.mount();
   h.image.classList.remove('is-visible');h.image.classList.add('native-updated');
   h.image.style.setProperty('--worker-frame','8');
   h.mini.classList.add('native-comment-update');h.mini.style.setProperty('--native-tick','9');
   text.textContent='\u884c\u3000\u3000\uff21\n\u3000\uff22\u3000\u3000\uff23';
   h.view.dispose();
   assert.strictEqual(h.image.classList.contains('is-visible'),false);
   assert(h.image.classList.contains('native-updated'));
   assert.strictEqual(h.image.style.getPropertyValue('--worker-frame'),'8');
   assert(h.mini.classList.contains('native-comment-update'));
   assert.strictEqual(h.mini.style.getPropertyValue('--native-tick'),'9');
   assert.strictEqual(h.image.querySelector('canvas'),canvas);
   assert.strictEqual(h.mini.querySelector('.text'),text);
   assert.strictEqual(text.textContent,'\u884c\u3000\u3000\uff21\n\u3000\uff22\u3000\u3000\uff23');
   assert.strictEqual(h.mini.classList.contains('zenzaSceneNativeMini'),false);
  }finally{h.done();}
 });
 it('rolls back a failed image replacement without changing the existing preview image',()=>{
  const h=previewFixture();h.view.mount();
  const oldStage=h.image.parentNode,replacement=h.d.createElement('div');
  replacement.className='zenzaSeekThumbnail is-visible';replacement.innerHTML='<canvas width="160" height="90"></canvas>';
  h.owner.append(replacement);
  const insert=oldStage.insertBefore,prepend=oldStage.prepend;
  oldStage.insertBefore=function(node,next){const value=insert.call(this,node,next);if(node===replacement)throw new Error('replacement-attach-failed');return value;};
  oldStage.prepend=function(...nodes){const value=prepend.apply(this,nodes);if(nodes.includes(replacement))throw new Error('replacement-attach-failed');return value;};
  try{
   assert.throws(()=>h.view.setImage(replacement),/replacement-attach-failed/);
   assert.strictEqual(replacement.parentNode,h.owner);
   assert.strictEqual(h.image.parentNode,oldStage);
   assert.strictEqual(oldStage.querySelectorAll('canvas').length,1);
  }finally{oldStage.insertBefore=insert;oldStage.prepend=prepend;h.done();}
 });
});
