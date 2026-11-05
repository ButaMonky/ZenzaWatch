'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
describe('scene preview native relatedTarget ownership',()=>{
 for(const [layout,eventType] of [['00','mouseleave'],['00','focusout'],['01','focusout']]){
  it(layout+' releases '+eventType+' to the window without DOM ownership errors',()=>{
   const h=fixture(layout);
   try{
    h.move(200);
    const bridge=h.binding.adapter.bridge,root=bridge._active.root;
    const entering=eventType==='mouseleave'?'mouseenter':'focusin';
    const EventClass=eventType==='mouseleave'?h.dom.window.MouseEvent:h.dom.window.FocusEvent;
    root.dispatchEvent(new EventClass(entering,{bubbles:true}));
    assert.strictEqual(bridge.interaction.holdingPreview,true);
    root.dispatchEvent(new EventClass(eventType,{bubbles:true,relatedTarget:h.dom.window}));
    assert.deepStrictEqual(h.errors,[],'Window is an EventTarget, not a DOM Node');
    assert.strictEqual(bridge.interaction.holdingPreview,false,
     'leaving the document must release the old preview hold');
   }finally{h.close();}
  });
 }
 it('keeps native UI00 focus while moving between the tooltip and its comment sibling',()=>{
  const h=fixture('00');
  try{
   h.move(200);
   const bridge=h.binding.adapter.bridge,root=bridge._active.root;
   const comments=h.d.querySelector('.zenzaCommentPreview');
   const canvas=h.d.querySelector('canvas');
   root.dispatchEvent(new h.dom.window.FocusEvent('focusin',{bubbles:true}));
   root.dispatchEvent(new h.dom.window.FocusEvent('focusout',{
    bubbles:true,relatedTarget:comments
   }));
   assert.strictEqual(bridge.interaction.holdingPreview,true);
   comments.dispatchEvent(new h.dom.window.FocusEvent('focusout',{
    bubbles:true,relatedTarget:h.d.body
   }));
   assert.strictEqual(bridge.interaction.holdingPreview,false);
   assert.strictEqual(h.d.querySelector('canvas'),canvas,'do not replace native canvas');
   assert.deepStrictEqual(h.errors,[]);
  }finally{h.close();}
 });
});
