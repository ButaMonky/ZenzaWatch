'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const load=()=>loadClass('packages/zenza/src/sceneSearch/SceneSearchLayout00.js',
  'SceneSearchLayout00',createContext());
function scene(){
 const dom=new JSDOM('<!doctype html><html><head></head><body><div id="player">'+
  '<div class="seekBarContainer" id="seek">'+
  '<div class="seekBar" id="bar"><input class="seekRange" id="range"></div>'+
  '<div class="seekBarToolTip" id="old"><div class="seekBarThumbnailContainer">'+
  '<div class="zenzaSeekThumbnail is-visible" id="thumb">'+
  '<div class="zenzaSeekThumbnail-image" id="image"><canvas width="160" height="90"></canvas></div></div>'+
  '</div><div class="seekBarToolTipButtonContainer">'+
  '<button class="backwardSeek"></button><span class="currentTime">02:00</span>'+
  '<button class="toggleCommentPreview" title="original"></button>'+
  '<button class="forwardSeek"></button></div></div>'+
  '<div class="zenzaCommentPreview" id="comments"><div class="listContainer">'+
  '<div class="nicoChat" data-vpos="500">native clickable comment</div></div></div>'+
  '</div></div></body></html>');
 const d=dom.window.document,p=d.getElementById('player');
 const tooltip=d.getElementById('old'),comments=d.getElementById('comments');
 const seek=d.getElementById('seek');
 const settings={getLegacyTooltip:()=>tooltip,getLegacyComment:()=>comments,
  getSeekBarContainer:()=>seek};
 return {dom,d,p,tooltip,comments,seek,settings};
}
function setGeometry(h){
 Object.defineProperty(h.dom.window,'innerWidth',{value:1460,configurable:true});
 Object.defineProperty(h.seek,'offsetWidth',{value:900,configurable:true});
 Object.defineProperty(h.tooltip,'offsetWidth',{value:180,configurable:true});
 h.seek.getBoundingClientRect=()=>({left:0,right:900,top:540,bottom:557,width:900,height:17});
 const track=h.d.getElementById('range');
 track.getBoundingClientRect=()=>({left:0,right:1460,top:540,bottom:557,width:1460,height:17});
 return track;
}
describe('SCUI 00 real native experience is TypeScript-backed',()=>{
 it('keeps the original thumbnail and comment list as separate siblings',()=>{
  const h=scene(),C=load(),node=h.comments,button=h.tooltip.querySelector('.toggleCommentPreview');
  const v=new C({document:h.d,container:h.p,settings:h.settings});
  v.mount({commentListMode:false});
  assert.strictEqual(v.root,h.tooltip);
  assert.strictEqual(h.comments,node);
  assert.strictEqual(node.parentNode,h.seek);
  assert.equal(h.d.getElementById('image').contains(node),false);
  assert.equal(h.d.querySelectorAll('.zenzaCommentPreview').length,1);
  v.render({commentListMode:true});
  assert.strictEqual(node.parentNode,h.seek);
  assert(!h.tooltip.classList.contains('is-scui00-list'));
  assert.equal(button.title,'original','native VideoControlBar still owns button label');
  v.render({commentListMode:false});
  assert.strictEqual(node.parentNode,h.seek);
  v.dispose();v.dispose();
  assert.equal(h.d.querySelectorAll('style[data-scui00-style]').length,0);
  assert.equal(button.title,'original');
  h.dom.window.close();
 });
 it('follows entire seekbar for both thumbnail and native flowing comments',()=>{
  const h=scene(),C=load(),track=setGeometry(h);
  const v=new C({document:h.d,container:h.p,settings:h.settings});
  v.mount({commentListMode:false});
  for(const [x,left] of [[0,0],[150,60],[730,640],[900,810],
    [1100,1010],[1350,1260],[1410,1280],[1460,1280]]){
    track.dispatchEvent(new h.dom.window.MouseEvent('mousemove',
      {clientX:x,clientY:548,bubbles:true}));
    assert.equal(h.tooltip.style.getPropertyValue('--scui00-position'),left+'px');
    assert.equal(h.seek.style.getPropertyValue('--scui00-comment-x'),left+'px');
  }
  assert(v.constructor.CSS.includes('--scui00-comment-x'));
  assert(v.constructor.CSS.includes('transition:none'));
  v.dispose();
  assert.equal(h.seek.style.getPropertyValue('--scui00-comment-x'),'');
  assert.equal(h.tooltip.style.getPropertyValue('--scui00-position'),'');
  h.dom.window.close();
 });
 it('does not chase pointer when hovering the old tooltip buttons',()=>{
  const h=scene(),C=load(),track=setGeometry(h);
  const v=new C({document:h.d,container:h.p,settings:h.settings});
  v.mount({commentListMode:false});
  track.dispatchEvent(new h.dom.window.MouseEvent('mousemove',
    {clientX:600,bubbles:true}));
  assert.equal(h.tooltip.style.getPropertyValue('--scui00-position'),'510px');
  h.tooltip.querySelector('.toggleCommentPreview').dispatchEvent(
    new h.dom.window.MouseEvent('mousemove',{clientX:1120,bubbles:true}));
  assert.equal(h.tooltip.style.getPropertyValue('--scui00-position'),'510px');
  v.dispose();h.dom.window.close();
 });
 it('retains the native list width and seek interaction rather than generating new rows',()=>{
  const h=scene(),C=load(),track=setGeometry(h);
  const v=new C({document:h.d,container:h.p,settings:h.settings});
  const chat=h.comments.querySelector('.nicoChat'),parent=h.comments.parentNode;
  v.mount({commentListMode:false});
  track.dispatchEvent(new h.dom.window.MouseEvent('mousemove',
    {clientX:600,bubbles:true}));
  assert.equal(h.seek.style.getPropertyValue('--scui00-comment-x'),'510px');
  v.render({commentListMode:true});
  assert.equal(h.seek.style.getPropertyValue('--scui00-comment-x'),'425px',
    'the 350px native list centers under the cursor');
  assert.strictEqual(h.comments.parentNode,parent);
  assert.strictEqual(h.comments.querySelector('.nicoChat'),chat);
  v.render({commentListMode:false});
  assert.equal(h.seek.style.getPropertyValue('--scui00-comment-x'),'510px');
  v.dispose();h.dom.window.close();
 });
 it('waits for native Storyboard without creating/moving a second comment view',()=>{
  const h=scene(),C=load(),image=h.d.getElementById('image');
  image.parentElement.remove();
  const v=new C({document:h.d,container:h.p,settings:h.settings});
  v.mount({commentListMode:false});
  assert.equal(h.comments.parentNode,h.seek);
  const next=h.d.createElement('div');
  next.className='zenzaSeekThumbnail-image';
  h.d.querySelector('.seekBarThumbnailContainer').append(next);
  v.render({commentListMode:false});
  assert.equal(h.comments.parentNode,h.seek);
  assert.equal(next.contains(h.comments),false);
  v.dispose();h.dom.window.close();
 });
 it('retains fullscreen lifecycle and refuses incomplete native player DOM',()=>{
  const h=scene(),C=load();
  const v=new C({document:h.d,container:h.p,mode:'fullscreen',settings:h.settings});
  v.mount({commentListMode:false});
  assert(h.p.classList.contains('is-scui00-active'));
  v.dispose();
  assert.equal(h.p.classList.contains('is-scui00-active'),false);
  assert.throws(()=>new C({document:h.d,container:h.p,settings:{}})
    .mount({commentListMode:false}),/native|legacy|missing/i);
  h.dom.window.close();
 });
});
describe('SCUI00 integrates without taking over original VideoControlBar',()=>{
 const {fixture}=require('../helpers/scenePlayerFixture');
 it('preserves native owners through saved list mode, fullscreen and 00→01→00',()=>{
  const h=fixture('00');try{
   const old=h.d.getElementById('old'),c=h.d.querySelector('.zenzaCommentPreview');
   assert.equal(h.binding.adapter.bridge.state.layoutId,'00');
   assert.equal(h.host.querySelectorAll('.zenzaSceneSearchHost').length,0);
   assert.strictEqual(c.parentNode,h.seek);
   assert(!old.hidden);
   h.move(410);
   h.config.setValue('enableCommentPreview',true);
   assert.strictEqual(c.parentNode,h.seek);
   assert.equal(h.binding.adapter.bridge.state.commentListMode,true);
   h.config.setValue('enableCommentPreview',false);
   h.setMode('fullscreen');
   assert.strictEqual(c.parentNode,h.seek);
   h.config.setValue('sceneSearch.layout.fullscreen','01');
   assert(h.host.querySelector('.zenzaSceneSearchHost'));
   assert(old.hidden);
   h.config.setValue('sceneSearch.layout.fullscreen','00');
   assert.equal(h.binding.adapter.bridge.state.layoutId,'00');
   assert(!old.hidden);
   assert.strictEqual(c.parentNode,h.seek);
   h.player.emit('close');
   assert.strictEqual(c.parentNode,h.seek);
   assert.equal(h.d.querySelectorAll('style[data-scui00-style]').length,0);
   assert.deepEqual(h.errors,[]);
  }finally{h.close();}
 });
});
