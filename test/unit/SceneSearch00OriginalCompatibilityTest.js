'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Layout=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayout00.js',
  'SceneSearchLayout00',createContext());
function native(){
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+
  '<div id="player"><div id="seek" class="seekBarContainer">'+
  '<div class="seekBar"><input class="seekRange" id="range"></div>'+
  '<div id="tooltip" class="seekBarToolTip"><div class="seekBarThumbnailContainer">'+
  '<div class="zenzaSeekThumbnail is-visible"><div class="zenzaSeekThumbnail-image" id="image">'+
  '<canvas width="160" height="90"></canvas></div></div></div>'+
  '<div class="seekBarToolTipButtonContainer"><button class="toggleCommentPreview" title="original"></button></div></div>'+
  '<div id="comments" class="zenzaCommentPreview">'+
  '<div class="listContainer"><ul><li class="nicoChat" data-vpos="500">00:05 comment</li></ul></div>'+
  '</div></div></div></body></html>');
 const d=dom.window.document,player=d.getElementById('player'),
   tip=d.getElementById('tooltip'),chat=d.getElementById('comments'),
   seek=d.getElementById('seek');
 const view=new Layout({document:d,container:player,settings:{
  getLegacyTooltip:()=>tip,getLegacyComment:()=>chat,
  getSeekBarContainer:()=>seek
 }});
 return {dom,d,player,tip,chat,seek,view};
}
describe('Task621 UI00 original VideoControlBar parity',()=>{
 it('preserves two native sibling owners in both modes and never reparents comments',()=>{
  const h=native();
  const image=h.d.getElementById('image');
  const nativeParent=h.chat.parentNode, originalButton=h.tip.querySelector('.toggleCommentPreview');
  h.view.mount({commentListMode:false});
  assert.strictEqual(h.chat.parentNode,nativeParent,'native view owns its original DOM');
  assert.equal(image.contains(h.chat),false,'do not transplant the list into Storyboard canvas');
  assert.equal(h.d.querySelectorAll('.zenzaCommentPreview').length,1);
  h.view.render({commentListMode:true});
  assert.strictEqual(h.chat.parentNode,nativeParent);
  assert.equal(h.tip.querySelector('.toggleCommentPreview'),originalButton);
  assert.equal(originalButton.getAttribute('title'),'original',
    'the existing player, not the scene card, owns the button and its tooltip');
  h.view.render({commentListMode:false});
  assert.strictEqual(h.chat.parentNode,nativeParent);
  h.view.dispose();h.view.dispose();
  assert.equal(h.d.querySelectorAll('.zenzaCommentPreview').length,1);
  assert(!h.player.classList.contains('is-scui00-active'));
  assert.equal(h.d.querySelectorAll('[data-scui00-style]').length,0);
  h.dom.window.close();
 });
 it('keeps native list scrolling/click targets and flowing text animation CSS intact',()=>{
  const h=native();h.view.mount({commentListMode:false});
  const css=Layout.CSS;
  assert(!css.includes('zenzaSeekThumbnail-image>.zenzaCommentPreview'),
    'forcing the whole CommentPreview inside 160x90 destroys native modes');
  assert(!css.includes('is-scui00-list .seekBarThumbnailContainer'),
    'native enableCommentPreview already controls thumbnail visibility');
  assert(css.includes('--scui00-comment-x'),
    'both native siblings must track the same full-width seek bar');
  const originalFlowRules=css.slice(0,css.indexOf('/* Static mini cards'));
  assert(!originalFlowRules.includes('animation:none!important'),
    'legacy flow must keep animating when flow is selected');
  assert(css.includes('.is-scui00-mini-static'),
    'only explicitly selected static mode may stop animation');
  assert(h.chat.querySelector('[data-vpos="500"]'),'original comment click seeks remain in same node');
  h.view.dispose();h.dom.window.close();
 });
 it('the 00 picker label is readable Japanese instead of placeholder question marks',()=>{
  const Registry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',createContext());
  const Model=loadClass('src/ModernAdvancedSettingsModel.js',
    'ModernAdvancedSettingsModel',createContext({UiVisibilityRegistry:Registry}));
  const defaults={'sceneSearch.layout.normal':'00',
    'sceneSearch.layout.fullscreen':'00','sceneSearch.layout.linkFullscreen':false,
    ...Registry.defaults()};
  const model=new Model({config:{default:defaults,getValue:k=>defaults[k],
    setValue:(k,v)=>{defaults[k]=v;},options:{validateImport:()=>true}}});
  for(const mode of ['normal','fullscreen']){
   const item=model.descriptor('sceneSearch.layout.'+mode).options.find(x=>x.value==='00');
   assert(item,'layout 00 missing');
   assert.match(item.label,/^00 旧式/);
   assert(!item.label.includes('?'),item.label);
  }
 });
});
