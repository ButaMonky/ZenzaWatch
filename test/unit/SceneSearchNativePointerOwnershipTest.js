'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const root=path.resolve(__dirname,'../..');
function harness(){
 const dom=new JSDOM('<!doctype html><html><body></body></html>');
 const snapshot={pinned:false,shown:false};
 const controller={
  snapshot,
  show(value){snapshot.shown=value!==false;},
  pin(value){snapshot.pinned=!!value;return {...snapshot};}
 };
 const Interaction=loadClass('packages/zenza/src/sceneSearch/SceneSearchInteraction.js',
   'SceneSearchInteraction',createContext());
 const interaction=new Interaction({controller,getPreviewRect:()=>null,
  subscribePointerMove:()=>()=>{},
  clock:{setTimeout:()=>1,clearTimeout:()=>{}}});
 let add=0,remove=0;
 const doc=dom.window.document,realAdd=doc.addEventListener.bind(doc);
 const realRemove=doc.removeEventListener.bind(doc);
 doc.addEventListener=(name,listener,capture)=>{
  if(name==='pointerup'||name==='pointercancel')add++;
  return realAdd(name,listener,capture);
 };
 doc.removeEventListener=(name,listener,capture)=>{
  if(name==='pointerup'||name==='pointercancel')remove++;
  return realRemove(name,listener,capture);
 };
 const release=(type,id)=>{
  const e=new dom.window.Event(type,{bubbles:true});
  Object.defineProperty(e,'pointerId',{value:id});
  doc.dispatchEvent(e);
 };
 return {interaction,doc,snapshot,release,
  get add(){return add;},get remove(){return remove;},
  close(){interaction.dispose();dom.window.close();}
 };
}
describe('P13-09a one Interaction-owned native pointer session',()=>{
 it('captures two IDs once and only releases on the final pointerup',()=>{
  const h=harness();let stop=0;
  const done=()=>{stop++;h.interaction.clearNativePointers();h.interaction.setDragging(false);};
  h.interaction.startNativePointer({pointerId:1},h.doc,done);
  h.interaction.startNativePointer({pointerId:2},h.doc,done);
  assert.strictEqual(h.add,2);
  assert.strictEqual(h.interaction.holdingPreview,true);
  h.release('pointerup',1);
  assert.strictEqual(stop,0);
  assert.strictEqual(h.interaction.holdingPreview,true);
  h.release('pointerup',2);
  assert.strictEqual(stop,1);
  assert.strictEqual(h.remove,2);
  assert.strictEqual(h.interaction.holdingPreview,false);
  h.release('pointercancel',2);
  assert.strictEqual(stop,1,'a released session cannot fire twice');
  h.close();
 });
 it('supports the legacy main pointer and pointercancel',()=>{
  const h=harness();let stop=0;
  h.interaction.startNativePointer(null,h.doc,()=>{
   stop++;h.interaction.clearNativePointers();h.interaction.setDragging(false);
  });
  h.release('pointercancel',undefined);
  assert.strictEqual(stop,1);
  assert.strictEqual(h.add,2);
  assert.strictEqual(h.remove,2);
  h.close();
 });
 it('dispose releases listeners, cannot retain stale pointer capture',()=>{
  const h=harness();let stop=0;
  h.interaction.startNativePointer({pointerId:42},h.doc,()=>stop++);
  h.interaction.dispose();
  assert.strictEqual(h.remove,2);
  h.release('pointerup',42);
  assert.strictEqual(stop,0);
  h.interaction.startNativePointer({pointerId:43},h.doc,()=>stop++);
  assert.strictEqual(h.add,2);
  h.close();
 });
 it('Bridge delegates pointer lifecycle and does not own a duplicate ID set',()=>{
  const js=fs.readFileSync(path.join(root,
   'packages/zenza/src/sceneSearch/SceneSearchIntegrationBridge.js'),'utf8');
  assert(!js.includes('this._activePointers'));
  assert(!js.includes('this._onPointerFinish'));
  assert(js.includes('this.interaction.startNativePointer('));
  assert(js.includes('this.interaction.clearNativePointers()'));
  assert(!js.includes("this.document.addEventListener('pointerup'"));
 });
});
