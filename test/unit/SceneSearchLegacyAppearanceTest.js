'use strict';
const assert=require('assert'),{JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
describe('legacy scene appearance retains native sibling ownership',()=>{
 it('fits image and sibling mini with the same scale and restores styles on disposal',()=>{
  const dom=new JSDOM('<body><div id="player"><div id="seek" class="seekBarContainer"><input class="seekRange">'+
   '<div id="tip"><div class="seekBarThumbnailContainer"><div class="zenzaSeekThumbnail is-visible"><div class="zenzaSeekThumbnail-image"><canvas width="160" height="90"></canvas></div></div></div></div>'+
   '<div id="mini" class="zenzaCommentPreview"></div></div></div>');
  const d=dom.window.document,player=d.getElementById('player'),seek=d.getElementById('seek'),
   tip=d.getElementById('tip'),mini=d.getElementById('mini');
  seek.getBoundingClientRect=()=>({left:0,top:400,right:800,bottom:440,width:800,height:40});
  tip.querySelector('.zenzaSeekThumbnail-image').getBoundingClientRect=()=>({left:10,top:300,right:330,bottom:480,width:320,height:180});
  const Layout=loadClass('packages/zenza/src/sceneSearch/SceneSearchLayout00.js','SceneSearchLayout00',createContext());
  let appearance={scale:200,opacity:40,miniEnabled:true,miniStyle:'flow'};
  const view=new Layout({document:d,container:player,settings:{getLegacyTooltip:()=>tip,
   getLegacyComment:()=>mini,getSeekBarContainer:()=>seek,getAppearance:()=>appearance}});
  try{
   view.mount({shown:true,commentListMode:false});
   assert.strictEqual(seek.style.getPropertyValue('--scene-thumbnail-scale'),'2');
   assert.strictEqual(seek.style.getPropertyValue('--scene-list-alpha'),'0.4');
   assert.strictEqual(mini.parentNode,seek);assert.strictEqual(tip.parentNode,seek);
   appearance={...appearance,miniEnabled:false};view.render({shown:true,commentListMode:false});
   assert(player.classList.contains('is-scui00-mini-hidden'));
   view.dispose();assert.strictEqual(seek.style.getPropertyValue('--scene-thumbnail-scale'),'');
   assert.strictEqual(seek.style.getPropertyValue('--scene-list-alpha'),'');
  }finally{view.dispose();dom.window.close();}
 });
});
