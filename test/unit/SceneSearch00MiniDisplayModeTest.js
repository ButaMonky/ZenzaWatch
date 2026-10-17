'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Layout=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayout00.js',
 'SceneSearchLayout00',createContext());
const Registry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',createContext());
const Model=loadClass('src/ModernAdvancedSettingsModel.js',
 'ModernAdvancedSettingsModel',createContext({UiVisibilityRegistry:Registry}));
function native(){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="player">'+
  '<div class="seekBarContainer" id="seek"><input class="seekRange" type="range">'+
  '<div class="seekBarToolTip" id="tip"><div class="seekBarThumbnailContainer">'+
  '<div class="zenzaSeekThumbnail is-visible"><div class="zenzaSeekThumbnail-image">'+
  '<canvas width="160" height="90"></canvas></div></div></div>'+
  '<div class="seekBarToolTipButtonContainer"><button class="toggleCommentPreview"></button></div>'+
  '</div><div class="zenzaCommentPreview" id="comments"><div class="listContainer">'+
  '<li class="nicoChat" data-vpos="100"><span class="text">old native text</span></li>'+
  '</div></div></div></div></body></html>');
 const d=dom.window.document,player=d.getElementById('player'),tip=d.getElementById('tip'),
  seek=d.getElementById('seek'),comments=d.getElementById('comments');
 let current='flow';
 const view=new Layout({document:d,container:player,settings:{
  getLegacyTooltip:()=>tip,getLegacyComment:()=>comments,
  getSeekBarContainer:()=>seek,getMiniCommentMode:()=>current
 }});
 return {dom,d,player,seek,tip,comments,view,setMode:value=>{current=value;}};
}
describe('Task636 UI00 mini-comment mode is independent of native comment list',()=>{
 it('starts with legacy flowing comments and switches live among flow/static/hidden',()=>{
  const h=native();try{
   const oldNode=h.comments,seek=h.seek;
   h.view.mount({commentListMode:false});
   assert.equal(h.player.classList.contains('is-scui00-mini-static'),false);
   assert.equal(h.player.classList.contains('is-scui00-mini-hidden'),false);
   h.setMode('static');h.view.render({commentListMode:false});
   assert.equal(h.player.classList.contains('is-scui00-mini-static'),true);
   assert.equal(h.player.classList.contains('is-scui00-mini-hidden'),false);
   h.setMode('hidden');h.view.render({commentListMode:false});
   assert.equal(h.player.classList.contains('is-scui00-mini-static'),false);
   assert.equal(h.player.classList.contains('is-scui00-mini-hidden'),true);
   assert.strictEqual(oldNode.parentElement,seek,'must keep native comment row ownership');
   h.setMode('flow');h.view.render({commentListMode:false});
   assert.equal(h.player.classList.contains('is-scui00-mini-hidden'),false);
   assert.equal(h.player.classList.contains('is-scui00-mini-static'),false);
   h.view.dispose();
   assert.equal(h.player.classList.contains('is-scui00-mini-hidden'),false);
   assert.equal(h.player.classList.contains('is-scui00-mini-static'),false);
  }finally{h.dom.window.close();}
 });
 it('always keeps the list visible when list mode is active even if mini is hidden',()=>{
  const h=native();try{
   h.setMode('hidden');h.view.mount({commentListMode:false});
   const style=Layout.CSS;
   assert(style.includes('.is-scui00-mini-hidden'));
   assert(style.includes('.is-scui00-mini-static'));
   assert(style.includes('.seekBarContainer:not(.enableCommentPreview)'));
   assert(!style.includes('.seekBarContainer.enableCommentPreview>.zenzaCommentPreview{display:none'));
   h.seek.classList.add('enableCommentPreview');
   h.view.render({commentListMode:true});
   assert.strictEqual(h.comments.parentElement,h.seek);
   assert(h.comments.querySelector('.nicoChat'));
   assert(!h.player.querySelector('.zenzaSceneSearchHost'));
  }finally{h.view.dispose();h.dom.window.close();}
 });
 it('static text is really visible and positioned rather than paused invisible',()=>{
  const css=Layout.CSS;
  assert(css.includes('animation:none!important'));
  assert(css.includes('visibility:visible!important'));
  assert(css.includes('transform:none!important'));
  assert(css.includes('position:relative!important'));
  assert(css.includes('nth-child(n+6)'), 'limit mini static overlay to five readable rows');
 });
 it('advanced setting offers three documented independent choices and saves only itself',()=>{
  const defaults={'sceneSearch.miniCommentMode':'flow',
   'sceneSearch.layout.normal':'00','sceneSearch.layout.fullscreen':'00',
   'sceneSearch.layout.linkFullscreen':false,'sceneSearch.commentPreviewVisible':true,
   'enableCommentPreview':false,...Registry.defaults()};
  const values={...defaults},writes=[];
  const model=new Model({config:{default:defaults,getValue:k=>values[k],
   setValue:(k,v)=>{values[k]=v;writes.push([k,v]);},
   options:{validateImport:(k,v)=>
    k==='sceneSearch.miniCommentMode'?['flow','static','hidden'].includes(v):true}}});
  const d=model.descriptor('sceneSearch.miniCommentMode');
  assert(d);assert.equal(d.type,'select');
  assert.deepStrictEqual(Array.from(d.options,x=>x.value),['flow','static','hidden']);
  model.set('sceneSearch.miniCommentMode','static');
  assert.equal(model.get('enableCommentPreview'),false);
  assert.equal(model.get('sceneSearch.commentPreviewVisible'),true);
  model.save();
  assert.deepStrictEqual(writes,[['sceneSearch.miniCommentMode','static']]);
 });
 it('reacts to real config updates in attached UI00 without layout recreation',()=>{
  const h=fixture('00');try{
   const b=h.binding.adapter.bridge;
   assert.equal(b.state.layoutId,'00');
   const old=b.controller._active;
   const nativeComment=h.d.querySelector('.zenzaCommentPreview');
   h.config.setValue('sceneSearch.miniCommentMode','hidden');
   assert(h.host.classList.contains('is-scui00-mini-hidden'));
   assert.strictEqual(b.controller._active,old);
   h.config.setValue('sceneSearch.miniCommentMode','static');
   assert(h.host.classList.contains('is-scui00-mini-static'));
   assert(!h.host.classList.contains('is-scui00-mini-hidden'));
   h.config.setValue('enableCommentPreview',true);
   assert.strictEqual(nativeComment.parentElement,h.seek);
   h.config.setValue('sceneSearch.miniCommentMode','flow');
   assert(!h.host.classList.contains('is-scui00-mini-static'));
  }finally{h.close();}
 });
});
