'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');
function harness(rects){
 let now=0,id=0;const timers=new Map(),snapshot={pinned:false,shown:true};
 const controller={snapshot,show:v=>{snapshot.shown=v;},pin:v=>{
  snapshot.pinned=v===undefined?!snapshot.pinned:v;return snapshot;}};
 const clock={setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id)};
 const C=loadClass('packages/zenza/src/sceneSearch/SceneSearchInteraction.js','SceneSearchInteraction',createContext());
 const obj=new C({controller,clock,getPreviewRect:()=>rects,subscribePointerMove:()=>()=>{}});
 return {obj,snapshot,tick(ms){now+=ms;for(const [key,t]of [...timers])if(t.at<=now){timers.delete(key);t.fn();}}};
}
describe('Task791 independent active surfaces',()=>{
 it('mouse leave cannot hide controls that still have keyboard focus',()=>{
  const h=harness(null);h.obj.previewEnter('card');h.obj.previewFocus(true,'card');
  h.obj.previewLeave('card');h.tick(1000);assert(h.snapshot.shown);
  h.obj.previewFocus(false,'card');h.tick(451);assert(!h.snapshot.shown);
 });
 it('blur cannot hide the panel while its pointer remains inside',()=>{
  const h=harness(null);h.obj.previewEnter('list');h.obj.previewFocus(true,'list');
  h.obj.previewFocus(false,'list');h.tick(1000);assert(h.snapshot.shown);
  h.obj.previewLeave('list');h.tick(451);assert(!h.snapshot.shown);
 });
 it('leaving one surface cannot clear another surface hold',()=>{
  const h=harness(null);h.obj.previewEnter('card');h.obj.previewEnter('list');
  h.obj.previewLeave('card');h.tick(1000);assert(h.snapshot.shown);
  h.obj.previewLeave('list');h.tick(451);assert(!h.snapshot.shown);
 });
 it('corridor can reach a separated list without treating the entire gap as a surface',()=>{
  const h=harness([{left:10,right:190,top:400,bottom:500},{left:700,right:880,top:400,bottom:500}]);
  h.obj.seekEnter();h.obj.seekLeave({clientX:790,clientY:600});
  h.obj.pointerMove({clientX:790,clientY:550});h.tick(500);assert(h.snapshot.shown);
  h.obj.pointerMove({clientX:400,clientY:450});h.tick(181);assert(!h.snapshot.shown);
 });
 it('allows slow horizontal travel from the card to the separate list, but expires off path',()=>{
  const h=harness([{left:10,right:190,top:400,bottom:500},{left:700,right:880,top:400,bottom:500}]);
  h.obj.previewEnter('card');h.obj.previewLeave('card',{clientX:190,clientY:450});
  for(const x of [230,350,470,590,700]){
   h.obj.pointerMove({clientX:x,clientY:450});h.tick(400);assert(h.snapshot.shown);
  }
  h.obj.pointerMove({clientX:450,clientY:250});h.tick(181);assert(!h.snapshot.shown);
 });

});
