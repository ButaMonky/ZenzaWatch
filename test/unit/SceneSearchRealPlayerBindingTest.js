'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
describe('SCUI-18 complete real bridge/player integration',()=>{
 it('UI01 portal preserves the original video-relative bottom across vertical moves',()=>{
  const h=fixture('01','normal',{portal:true});try{
   const root=h.d.querySelector('.zenzaSceneLayout01');
   const host=h.host,dialog=h.d.querySelector('.zenzaVideoPlayerDialog');
   dialog.getBoundingClientRect=()=>({top:0,bottom:960,height:960,width:1450,left:0,right:1450});
   host.getBoundingClientRect=()=>({left:0,right:900,width:900,top:180,bottom:700,height:520});
   h.move(480);
   assert.strictEqual(root.style.getPropertyValue('--scene-viewport-bottom'),'298px',
     'original video-bottom offset 38px must be preserved, not viewport-bottom 38px');
   host.getBoundingClientRect=()=>({left:0,right:900,width:900,top:220,bottom:740,height:520});
   h.move(485);
   assert.strictEqual(root.style.getPropertyValue('--scene-viewport-bottom'),'258px',
     'resize and video movement must update the offset');
  }finally{h.close();}
 });
 it('UI01 fullscreen keeps preview inside the real fullscreen video subtree',()=>{
  const h=fixture('01','normal',{portal:true});
  try{
    const dialog=h.d.querySelector('.zenzaVideoPlayerDialog');
    const original=h.d.querySelector('.zenzaSceneLayout01');
    assert.strictEqual(original.parentElement,dialog,
      'normal mode must still escape the right info panel');
    h.setMode('fullscreen');
    const full=h.d.querySelector('.zenzaSceneLayout01');
    assert(full,'UI01 must still be mounted in fullscreen');
    assert.strictEqual(full.parentElement,h.host,
      'native requestFullscreen targets NicoVideoPlayer._parentNode = player container');
    assert(h.host.contains(full),'fullscreen subtree must own the card');
    assert(h.host.contains(h.d.querySelector('.zenzaCommentPreview')),
      'native CommentPreviewView also must appear in fullscreen subtree');
    h.setMode('normal');
    assert.strictEqual(h.d.querySelector('.zenzaSceneLayout01').parentElement,dialog,
      'normal mode must return to the viewport overlay');
  } finally {h.close();}
 });
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
   assert.strictEqual(root.dataset.scuiSidePlacement,'overlay',
     'flow mode must overlay the thumbnail from the first seek position');
   h.move(899);
   assert.strictEqual(root.dataset.scuiSidePlacement,'overlay',
     'flowing mini-comments never detach from the thumbnail near the edge');
   h.config.setValue('enableCommentPreview',true);
   assert.strictEqual(root.dataset.scuiSidePlacement,'right',
     'only the comment LIST should become a right-side panel');
   h.config.setValue('enableCommentPreview',false);
   assert.strictEqual(root.dataset.scuiSidePlacement,'overlay');
   assert.notStrictEqual(root.style.getPropertyValue('--scene-viewport-x'),'',
     'scene must use viewport coordinates for the full seek track');
   h.setMode('fullscreen');
   assert.strictEqual(h.d.querySelector('.zenzaSceneLayout01').parentElement,h.host,
     'native Fullscreen API displays only the player-container subtree');
   h.player.emit('close');
   assert.equal(h.d.querySelector('.zenzaSceneSearchHost'),null);
  }finally{h.close();}
 });
 it('UI01 overlays native flowing mini-comments on the actual storyboard image and keeps list beside it',()=>{
  const h=fixture('01');try{
   h.move(450);
   const root=h.host.querySelector('.zenzaSceneLayout01');
   const comment=h.d.querySelector('.zenzaCommentPreview');
   const image=root.querySelector('.zenzaSceneImageBox');
   assert.strictEqual(comment.parentNode,image,
     'flowing mini-comments MUST overlay the thumbnail image, not sit to the right');
   assert(image.contains(comment));
   assert(comment.classList.contains('is-scui-flow'));
   assert(!comment.classList.contains('is-scui-classic-side'));
   assert.strictEqual(root.dataset.scuiSidePlacement,'overlay');
   h.config.setValue('enableCommentPreview',true);
   assert.strictEqual(comment.parentNode,root,
     'list view alone uses a separate right-side panel');
   assert(!image.contains(comment));
   assert(comment.classList.contains('is-scui-list'));
   assert(comment.classList.contains('is-scui-classic-side'));
   assert.strictEqual(root.dataset.scuiSidePlacement,'right');
   h.config.setValue('enableCommentPreview',false);
   assert.strictEqual(comment.parentNode,image,
     'restoring flow must put original native DOM back on the image');
   assert(!comment.classList.contains('is-scui-classic-side'));
   h.setMode('fullscreen');
   assert(h.host.querySelector('.zenzaSceneImageBox').contains(comment),
     'fullscreen flow must retain original comment overlay');
   h.player.emit('close');
   assert.strictEqual(comment.parentNode,h.host,'dispose restores original owner');
   assert.strictEqual(comment.classList.contains('is-scui-classic-side'),false);
  }finally{h.close();}
 });
 it('UI01 flow overlay follows its image box without any independent mini-coordinate offsets',()=>{
  const h=fixture('01');try{
   const root=h.host.querySelector('.zenzaSceneLayout01');
   const image=root.querySelector('.zenzaSceneImageBox');
   const comment=h.d.querySelector('.zenzaCommentPreview');
   assert.strictEqual(comment.parentNode,image);
   image.getBoundingClientRect=()=>({left:324,right:496,width:172,top:408,height:112});
   h.move(460);
   assert.strictEqual(comment.parentNode,image,
     'native mini flow overlay must remain image-owned after storyboard resize');
   assert.strictEqual(root.style.getPropertyValue('--scui-mini-top'),'');
   assert.strictEqual(root.style.getPropertyValue('--scui-mini-height'),'');
   assert.strictEqual(root.style.getPropertyValue('--scui-side-width'),'',
     'no independent sidepane width is needed without viewport portal');
   h.config.setValue('enableCommentPreview',true);
   assert.strictEqual(comment.parentNode,root);
   h.config.setValue('enableCommentPreview',false);
   assert.strictEqual(comment.parentNode,image);
   assert.equal(h.host.querySelectorAll('#thumb canvas').length,1,
     'only one original storyboard canvas may exist');
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
