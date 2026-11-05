'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Cls=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayout00.js',
 'SceneSearchLayout00',createContext());
const domFixture=(mode='normal')=>{
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+
 '<div id="player"><div class="seekBarContainer" id="seek">'+
 '<input class="seekRange" id="range">'+
 '<div class="seekBarToolTip" id="tip"><div class="seekBarThumbnailContainer">'+
 '<div class="zenzaSeekThumbnail is-visible">'+
 '<div class="zenzaSeekThumbnail-image"><canvas></canvas></div></div></div>'+
 '<div class="seekBarToolTipInner">'+
 '<div class="controlButton toggleCommentPreview" tabindex="0" id="toggle">'+
 '<span class="menuButtonInner">💬</span></div></div></div>'+
 '<div class="zenzaCommentPreview" id="comments"></div>'+
 '</div><div class="videoControlBar"><div class="controlItemContainer">'+
 '<button class="controlButton" id="native"></button></div></div>'+
 '</div></body></html>',{pretendToBeVisual:true});
 const d=dom.window.document,host=d.getElementById('player'),
  seek=d.getElementById('seek'),tip=d.getElementById('tip'),
  comment=d.getElementById('comments');
 let forwarded=0;seek.addEventListener('input',()=>forwarded++);
 const props=['--scui00-fullscreen-clearance'];
 for(const name of props)seek.style.setProperty(name,'23px');
 const settings={getLegacyTooltip:()=>tip,getLegacyComment:()=>comment,
  getSeekBarContainer:()=>seek,getMiniCommentMode:()=> 'flow'};
 const view=new Cls({document:d,container:host,mode,settings});
 view.mount({shown:true,pinned:false,commentListMode:false});
 return {dom,d,host,seek,tip,comment,view,settings,props,
  get forwarded(){return forwarded;},
  close(){view.dispose();dom.window.close();}};
};
describe('P5-02 UI00 pinned native tooltip and fullscreen hit ownership',()=>{
 it('reveals original tooltip and flowing mini-comments while pinned outside native hover',()=>{
  const h=domFixture();
  try{
   h.view.render({shown:true,pinned:true,commentListMode:false});
   assert(h.host.classList.contains('is-scui00-pinned'),'pin must become CSS-visible state');
   assert(Cls.CSS.includes('.is-scui00-pinned'));
   assert(Cls.CSS.includes('visibility:visible!important'));
   assert(Cls.CSS.includes('opacity:1!important'));
   assert(Cls.CSS.includes('.zenzaCommentPreview'),
    'pinned native mini-comment view should remain visible with its tooltip');
   assert.strictEqual(h.comment.parentElement,h.seek,'retain native comment ownership');
   assert.strictEqual(h.tip.querySelector('.zenzaSeekThumbnail-image canvas').parentElement.className,
    'zenzaSeekThumbnail-image');
  }finally{h.close();}
 });
 it('unpin, idle hidden and disposal restore native hover behavior and original CSS owners',()=>{
  const h=domFixture();
  try{
   h.view.render({shown:true,pinned:true});assert(h.host.classList.contains('is-scui00-pinned'));
   h.view.render({shown:true,pinned:false});
   assert(!h.host.classList.contains('is-scui00-pinned'),'unpin must release pin override');
   h.view.render({shown:false,pinned:true});
   assert(!h.host.classList.contains('is-scui00-pinned'),'idle hiding overrides pin exposure');
   assert(h.host.classList.contains('is-scui00-inactive'));
   h.view.render({shown:true,pinned:true});
   h.view.dispose();
   assert(!h.host.classList.contains('is-scui00-pinned'));
   assert(!h.host.classList.contains('is-scui00-inactive'));
   assert.strictEqual(h.comment.parentElement,h.seek);
   assert.strictEqual(h.tip.parentElement,h.seek);
   assert(!h.d.querySelector('[data-scui00-style]'));
  }finally{h.close();}
 });
 it('keeps native list/mini modes and original click/focus handling during pin',()=>{
  const h=domFixture(),btn=h.d.getElementById('toggle');
  let clicked=0;btn.addEventListener('click',()=>clicked++);
  try{
   btn.focus();h.view.render({shown:true,pinned:true,commentListMode:true});
   assert.strictEqual(h.d.activeElement,btn,'keyboard focus should survive render');
   assert.strictEqual(h.comment.parentElement,h.seek);
   assert.strictEqual(h.tip.parentElement,h.seek);
   btn.click();
   assert.strictEqual(clicked,1,'original native control click listener survives');
   h.view.render({shown:true,pinned:true,commentListMode:false});
   assert.strictEqual(h.comment.parentElement,h.seek);
   h.seek.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
   assert.strictEqual(h.forwarded,1,'native seek input is not replaced');
  }finally{h.close();}
 });
 it('moves only UI00 fullscreen tooltip clear of native toolbar, not the whole video controls',()=>{
  const h=domFixture('fullscreen');
  try{
   assert(h.host.classList.contains('is-scui00-fullscreen'));
   const css=Cls.CSS;
   assert(css.includes('.is-scui00-fullscreen'));
   assert(css.includes('bottom:'),'native tooltip is elevated without z-index forcing');
   assert(!css.includes('.videoControlBar .controlButton{z-index:'));
   assert(h.d.getElementById('native').parentElement.classList.contains('controlItemContainer'));
  }finally{h.close();}
 });
 it('does not apply fullscreen positioning to normal layout and restores on dispose',()=>{
  const h=domFixture('normal');
  try{
   assert(!h.host.classList.contains('is-scui00-fullscreen'));
   h.view.render({shown:true,pinned:true});
   h.view.dispose();
   assert(!h.host.classList.contains('is-scui00-fullscreen'));
   assert.strictEqual(h.seek.style.getPropertyValue('--scui00-fullscreen-clearance'),'23px');
  }finally{h.close();}
 });
});
