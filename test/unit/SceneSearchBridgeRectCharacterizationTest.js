'use strict';
// P10-04 baseline before extracting Bridge's read-only visible-rectangle collection.
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
const Bridge=loadClass('packages/zenza/src/sceneSearch/SceneSearchIntegrationBridge.js',
 'SceneSearchIntegrationBridge',createContext());
const box=(left,width=30)=>({left,top:10,width,height:20,right:left+width,bottom:30});
function node(left,classes=[],options={}){
 const names=new Set(classes);
 const n={
  hidden:!!options.hidden,paint:options.paint||{},
  classList:{contains:name=>names.has(name)},
  closest:()=>options.ancestorHidden?{}:null,
  getBoundingClientRect:()=>options.rect||box(left),
  querySelector:()=>null
 };
 return n;
}
function state({root=null,comment=null,twin=null,style}={}){
 return {_active:root?{root}:null,_commentPreviewElement:comment,
  _twinList:twin?{element:twin}:null,
  document:{defaultView:{getComputedStyle:n=>style?.(n)||n.paint}}};
}
describe('P10 Bridge visible rects (pre-extraction contract)',()=>{
 it('preserves the active layout-owned getRects result untouched',()=>{
  const expected=[box(8),box(55)],receiver=state();
  receiver._active={getRects:()=>expected,root:node(2)};
  assert.strictEqual(Bridge.prototype._previewRects.call(receiver),expected);
 });
 it('filters hidden, idle, inactive comment and transparent surfaces',()=>{
  const root=node(10),actions=node(40);
  const remote=node(70,[],{paint:{opacity:'0'}});
  root.querySelector=selector=>selector==='.zenzaSceneActions'?actions:
   selector==='.zenzaSceneRemoteControls'?remote:null;
  const inactive=node(100,['zenzaSceneCommentAttached']);
  const visible=node(130,['zenzaSceneCommentAttached','is-scui-active']);
  const h=state({root,comment:inactive,twin:visible});
  const result=Bridge.prototype._previewRects.call(h);
  assert.deepEqual(result.map(r=>r.left),[10,40,130]);
  h._commentPreviewElement=visible; h._twinList={element:visible};
  const dedup=Bridge.prototype._previewRects.call(h);
  assert.deepEqual(dedup.map(r=>r.left),[10,40,130]);
 });
 it('does not report rectangles from hidden or zero-area surfaces',()=>{
  const root=node(10,[],{hidden:true}),child=node(40,[],{ancestorHidden:true});
  const twin=node(90,[],{rect:box(90,0)});
  root.querySelector=sel=>sel==='.zenzaSceneActions'?child:null;
  const h=state({root,twin});
  assert.equal(Bridge.prototype._previewRects.call(h).length,0);
 });
 it('delegates fallback read-only collection without moving native owners',()=>{
  const calls=[],expected=[box(95)];
  const ctx=createContext({SceneSearchVisibleRectCollector:{
   collect(input){calls.push(input);return expected;}
  }});
  const Wired=loadClass('packages/zenza/src/sceneSearch/SceneSearchIntegrationBridge.js',
   'SceneSearchIntegrationBridge',ctx);
  const root=node(4),comment=node(20),twin=node(40);
  const owner=state({root,comment,twin});
  assert.strictEqual(Wired.prototype._previewRects.call(owner),expected);
  assert.equal(calls.length,1);
  assert.strictEqual(calls[0].root,root);
  assert.strictEqual(calls[0].comment,comment);
  assert.strictEqual(calls[0].twin,twin);
  assert.strictEqual(calls[0].document,owner.document);
 });
});
