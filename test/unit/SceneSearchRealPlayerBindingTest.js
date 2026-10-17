'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
describe('SCUI-18 complete real bridge/player integration',()=>{
 it('UI01 portal escapes narrow video layer and keeps scene LEFT of comments at every seek',()=>{
  const h=fixture('01','normal',{portal:true});try{
   const dialog=h.d.querySelector('.zenzaVideoPlayerDialog');
   const root=h.d.querySelector('.zenzaSceneLayout01');
   const comment=h.d.querySelector('.zenzaCommentPreview');
   assert.strictEqual(root.parentElement,dialog,
     'scene must leave the clipping video box and paint above the sidebar');
   assert.strictEqual(root.contains(comment),true,
     'the original comment model remains owned by the preview card');
   assert.equal(h.dom.window.getComputedStyle(root).position,'fixed');
   h.move(80);
   assert.strictEqual(root.dataset.scuiSidePlacement,'right');
   h.move(899);
   assert.strictEqual(root.dataset.scuiSidePlacement,'right',
     'never switch left/right order mid-seek');
   assert.notStrictEqual(root.style.getPropertyValue('--scene-viewport-x'),'',
     'scene must use viewport coordinates for the full seek track');
   h.setMode('fullscreen');
   assert.strictEqual(h.d.querySelector('.zenzaSceneLayout01').parentElement,dialog);
   h.player.emit('close');
   assert.equal(h.d.querySelector('.zenzaSceneSearchHost'),null);
  }finally{h.close();}
 });
 it('UI01 docks native flowing and list comments beside, never inside thumbnail',()=>{
  const h=fixture('01');try{
   h.move(450);
   const root=h.host.querySelector('.zenzaSceneLayout01');
   const comment=h.d.querySelector('.zenzaCommentPreview');
   const image=root.querySelector('.zenzaSceneImageBox');
   assert.strictEqual(comment.parentNode,root,'classic comments must be a sibling of image');
   assert.strictEqual(image.contains(comment),false);
   assert(comment.classList.contains('is-scui-classic-side'));
   assert(comment.classList.contains('is-scui-flow'));
   h.config.setValue('enableCommentPreview',true);
   assert.strictEqual(comment.parentNode,root,'list must remain a separate side pane');
   assert(comment.classList.contains('is-scui-list'));
   assert(comment.classList.contains('is-scui-classic-side'));
   h.config.setValue('enableCommentPreview',false);
   assert.strictEqual(comment.parentNode,root);
   h.setMode('fullscreen');
   assert.strictEqual(h.host.querySelector('.zenzaSceneImageBox').contains(comment),false);
   h.player.emit('close');
   assert.strictEqual(comment.parentNode,h.host,'dispose restores original comment owner');
   assert.strictEqual(comment.classList.contains('is-scui-classic-side'),false);
  }finally{h.close();}
 });
 it('UI01 remeasures the actual image box after a late storyboard resize',()=>{
  const h=fixture('01');try{
   const bridge=h.binding.adapter.bridge;
   const root=h.host.querySelector('.zenzaSceneLayout01');
   const image=root.querySelector('.zenzaSceneImageBox');
   Object.defineProperty(root,'offsetWidth',{configurable:true,value:180});
   root.getBoundingClientRect=()=>({left:320,right:500,width:180,top:400,height:140});
   image.getBoundingClientRect=()=>({left:324,right:496,width:172,top:405,height:90});
   bridge._positionClassicCommentSide(root,false);
   assert.strictEqual(root.style.getPropertyValue('--scui-mini-top'),'5.00px');
   assert.strictEqual(root.style.getPropertyValue('--scui-mini-height'),'90.00px');
   image.getBoundingClientRect=()=>({left:324,right:496,width:172,top:408,height:112});
   bridge._positionClassicCommentSide(root,false);
   assert.strictEqual(root.style.getPropertyValue('--scui-mini-top'),'8.00px');
   assert.strictEqual(root.style.getPropertyValue('--scui-mini-height'),'112.00px');
   assert.equal(h.host.querySelectorAll('#thumb canvas').length,1,
     'thumbnail owner must remain single');
  }finally{h.close();}
 });
 it('follows the actual seek position using the real player duration',()=>{
  const h=fixture('01');try{h.move(891);
   const card=h.host.querySelector('.zenzaSceneSearchHost');assert(card);
   assert.equal(h.binding.adapter.bridge.state.time,990);
   assert(parseFloat(card.style.getPropertyValue('--scene-x'))>700,
     '99% preview must follow the seek cursor, not stay at 50%');
  }finally{h.close();}
 });
 it('applies animation and reveal settings to the mounted card immediately',()=>{
  const h=fixture('08');try{h.move(450);const card=h.host.querySelector('.zenzaSceneSearchHost');
   h.config.setValue('sceneSearch.controlsReveal','always');
   h.config.setValue('sceneSearch.animation','off');
   assert.equal(card.dataset.sceneReveal,'always');assert.equal(card.dataset.sceneAnimation,'off');
  }finally{h.close();}
 });
 for(const id of ['01','02','03','04','05','06','07','08','09','10']){
  it('uses one original Canvas, routes actions, restores owners across modes: '+id,()=>{
   const h=fixture(id);try{h.move(450);const thumb=h.d.getElementById('thumb');
    assert(h.host.querySelector('.zenzaSceneImageBox').contains(thumb));
    h.host.querySelector('.scene-seek-forward').click();assert.deepEqual(h.commands,[['seekBy',5]]);
    h.setMode('fullscreen');assert.equal(h.host.querySelectorAll('.zenzaSceneSearchHost').length,1);
    h.player.emit('close');assert(h.d.getElementById('old').contains(thumb));
    assert.equal(h.host.querySelectorAll('.zenzaSceneSearchHost').length,0);
    assert.deepEqual(h.errors,[]);
   }finally{h.close();}
  });
 }
});

describe('SCUI live visibility preferences during scene redraw',()=>{
 it('keeps hidden arrow hitboxes disabled across cursor motion and fullscreen',()=>{
  const h=fixture('01');try{
   h.config.setValue('ui.scene.seekArrows',false);h.move(891);
   let arrow=h.host.querySelector('.scene-seek-back');
   assert.equal(arrow.style.getPropertyValue('display'),'none',
    'render must not override the disabled arrow preference');
   h.setMode('fullscreen');h.move(450);arrow=h.host.querySelector('.scene-seek-back');
   assert.equal(arrow.style.getPropertyValue('display'),'none');
   h.config.setValue('ui.scene.seekArrows',true);
   assert.notEqual(arrow.style.getPropertyValue('display'),'none');
  }finally{h.close();}
 });
});
