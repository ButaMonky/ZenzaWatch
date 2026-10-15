'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
describe('SCUI-18 complete real bridge/player integration',()=>{
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
