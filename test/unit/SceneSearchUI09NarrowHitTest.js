'use strict';
const assert=require('assert');
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,
 'packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts08_09.js'),'utf8');
const context=createContext();
const Registry=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutRegistry.js',
 'SceneSearchLayoutRegistry',context);
const Card=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayoutCard.js',
 'SceneSearchLayoutCard',context);
const Layout=loadClass('packages/zenza/src/sceneSearch/layouts/SceneSearchLayouts08_09.js',
 'SceneSearchLayouts08_09',context);
const css=Layout.CSS;
describe('UI09 narrow detached remote hit ownership',()=>{
 it('scopes measured native seek clearance to stacked normal UI09',()=>{
  assert(!css.includes('@media(max-width:480px)'),
   'actual player stacking must work in wider-browser small mode');
  assert.match(css,/\.zenzaSceneSearchHost\.zenzaSceneDetachedRemote\[data-mode="normal"\]\[data-scui-side="stack"\]\s*\{[^}]*transform:translateY\(var\(--scui-ui09-native-clearance,0px\)\)/);
  assert(!css.includes('translateY(-56px)'),
   'a fixed lift can cover the seek input in the original small fixture');
  assert(!css.includes('2147483647'),'never boost to an absolute maximum z-index');
 });
 it('keeps hidden-image remote at the compact top dock, not stale above root',()=>{
  assert.match(css,/\.zenzaSceneDetachedRemote\[data-scui-side="stack"\]\.is-preview-suppressed\s+\.zenzaSceneRemoteControls\s*\{[^}]*top:0;bottom:auto/);
 });
 it('does not change VideoControlBar range or UI08 CSS ownership',()=>{
  const start=source.indexOf('/* UI09 only: shift the image');
  assert(start>=0,'UI09-only native seek clearance CSS present');
  const end=source.indexOf('/* When the image is auto-hidden',start);
  const newSegment=source.slice(start,end);
  assert(newSegment.includes('.zenzaSceneDetachedRemote'));
  assert(!newSegment.includes('seekRange'));
  assert(!newSegment.includes('pointer-events:none!important'));
  assert(!newSegment.includes('.zenzaSceneEdgeDrawer .zenzaSceneActions'));
  assert(!/z-index\s*:\s*\d/.test(newSegment),'no new z-index override');
 });
 it('retains separate UI08 and UI09 registry entries and native button owner',()=>{
  const dom=new JSDOM('<!doctype html><html><body><div id="player"></div></body></html>');
  const doc=dom.window.document,host=doc.getElementById('player');
  host.getBoundingClientRect=()=>({left:0,right:360,top:16,bottom:566,
   width:360,height:550});
  const registry=new Registry();Layout.install(registry,Card);
  const state={shown:true,pinned:false,time:15,seekStepSeconds:5,
   commentListMode:false,commentPreviewVisible:true};
  for(const id of ['08','09']){
   const layout=registry.create({id,document:doc,container:host,
    mode:'normal',onAction:()=>{},settings:{}});
   try{
    layout.mount(state);
    assert(layout.root,'mounted card');
    assert.equal(layout.root.dataset.layout,id);
    assert.equal(layout.root.querySelectorAll('.zenzaSceneRemoteControls').length,
     id==='09'?1:0);
    assert.equal(layout.root.querySelectorAll('.zenzaSceneActions').length,1);
    assert.equal(layout.root.dataset.scuiSide,id==='09'?'stack':'right');
   }finally{layout.dispose();}
   assert.equal(host.querySelectorAll('.zenzaSceneSearchHost').length,0);
  }
  dom.window.close();
 });
 it('measures real native range interference, clears stale lift and stays stable',()=>{
  const dom=new JSDOM('<!doctype html><div id="player">'+
   '<input class="seekRange"><div id="card"><aside id="dock"></aside></div></div>');
  const doc=dom.window.document,host=doc.getElementById('player');
  const card=doc.getElementById('card'),dock=doc.getElementById('dock');
  const native=host.querySelector('input.seekRange');
  const layout=new Layout({Card,layoutId:'09',document:doc,container:host,
   mode:'normal',onAction:()=>{},settings:{}});
  layout.root=card;layout._remote=dock;
  let seekTop=629,seekX=2;
  const rect=(left,top,width,height)=>({left,top,width,height,
   right:left+width,bottom:top+height});
  native.getBoundingClientRect=()=>rect(seekX,seekTop,360,22);
  card.getBoundingClientRect=()=>rect(28,492-layout._nativeSeekClearance,205,119);
  dock.getBoundingClientRect=()=>rect(29,610-layout._nativeSeekClearance,203,38);
  layout._syncNativeSeekClearance('stack');
  assert.equal(layout._nativeSeekClearance,51);
  assert.equal(card.style.getPropertyValue('--scui-ui09-native-clearance'),'-51px');
  layout._syncNativeSeekClearance('stack');
  assert.equal(layout._nativeSeekClearance,51,'repeat render does not oscillate');
  seekTop=620;layout._syncNativeSeekClearance('stack');
  assert.equal(layout._nativeSeekClearance,60,'real input movement is tracked');
  seekTop=306;layout._syncNativeSeekClearance('stack');
  assert.equal(layout._nativeSeekClearance,0,'seek already above card stays free');
  seekTop=629;seekX=700;layout._syncNativeSeekClearance('stack');
  assert.equal(layout._nativeSeekClearance,0,'horizontal separation stays free');
  seekX=2;card.classList.add('is-preview-suppressed');
  layout._syncNativeSeekClearance('stack');
  assert.equal(layout._nativeSeekClearance,0,'hidden preview does not keep a stale offset');
  card.classList.remove('is-preview-suppressed');
  layout._syncNativeSeekClearance('stack');
  assert.equal(layout._nativeSeekClearance,51,'revealing measures again');
  layout._syncNativeSeekClearance('dock');
  assert.equal(layout._nativeSeekClearance,0,'wide player resets the offset');
  layout.mode='fullscreen';layout._syncNativeSeekClearance('stack');
  assert.equal(layout._nativeSeekClearance,0,'fullscreen retains its own placement');
  layout.mode='normal';native.remove();layout._syncNativeSeekClearance('stack');
  assert.equal(layout._nativeSeekClearance,0,'no native range causes no forced lift');
  dom.window.close();
 });
 it('maintains the original seven actions and layout-only CSS implementation',()=>{
  assert.equal((source.match(/\.zenzaSceneDetachedRemote/g)||[]).length>0,true);
  assert(css.includes('width:174px'),'original remote width preserved');
  assert(css.includes('width:100%;box-sizing:border-box;max-width:100%'),
   'original narrow remote sizing preserved');
  assert(!source.includes('setInterval('),'no new pointer polling');
  assert(!source.includes('addEventListener('),'no new event owner');
 });
});