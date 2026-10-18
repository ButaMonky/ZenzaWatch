'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
const move=(h,x)=>h.seek.dispatchEvent(new h.dom.window.MouseEvent('mousemove',
 {clientX:x,bubbles:true}));
describe('Task729 native-priority scene pointer following',()=>{
 for(const id of ['01','06']){
  it(id+' moves before the native comment/thumbnail bubble handler runs',()=>{
   const observed=[];
   const h=fixture(id,'normal',{beforeAttach({d,seek}){
    seek.addEventListener('mousemove',()=>{
     observed.push(d.querySelector('.zenzaSceneSearchHost')?.style.getPropertyValue('--scene-x'));
    });
   }});
   try{
    h.move(220);observed.length=0;
    move(h,420);
    assert.strictEqual(observed[0],'420px',
     'legacy UI00 follows in capture phase; current position must be visible before native work');
    assert.strictEqual(h.binding.adapter.bridge.state.time,420/900*1000);
   }finally{h.close();}
  });
 }
 it('updates pointer position while a preview request remains unresolved',async()=>{
  const h=fixture('01');let resolve;
  try{
   const controller=h.binding.adapter.bridge.controller;
   controller._loadPreview=()=>new Promise(r=>{resolve=r;});
   const pending=controller.previewAt(10);
   h.move(220);move(h,420);
   assert.strictEqual(h.d.querySelector('.zenzaSceneLayout01').style.getPropertyValue('--scene-x'),'420px');
   resolve(null);await pending;
  }finally{h.close();}
 });
 it('updates the time label without rewriting unchanged pin button attributes',()=>{
  const h=fixture('01');
  try{
   h.move(220);
   const root=h.d.querySelector('.zenzaSceneLayout01');
   const pin=root.querySelector('.scene-pin');
   const set=pin.setAttribute.bind(pin);let writes=0;
   pin.setAttribute=(...args)=>{writes++;return set(...args);};
   move(h,420);
   assert.strictEqual(root.querySelector('.zenzaSceneTime').textContent,'7:46');
   assert.strictEqual(writes,0,'a time-only move must not reconstruct unchanged controls');
  }finally{h.close();}
 });
 for(const id of ['01','06']){
  it(id+' skips native preview docking work when the flowing overlay only moves',()=>{
   const h=fixture(id);
   try{
    h.move(220);
    const bridge=h.binding.adapter.bridge;
    let docks=0;
    const old=bridge._syncCommentPreviewDock;
    bridge._syncCommentPreviewDock=function(...args){
     docks++;return old.apply(this,args);
    };
    for(let x=221;x<=240;x++)move(h,x);
    assert.strictEqual(docks,0,
     'native VideoControlBar owns moving text; do not mutate its DOM every mousemove');
    h.config.setValue('enableCommentPreview',true);
    docks=0;
    move(h,300);
    assert(docks>0,'separate list may need current pointer-relative geometry');
   }finally{h.close();}
  });
 }
 it('does not refresh visibility on an ordinary time-only move',()=>{
  const h=fixture('01');
  try{
   h.move(220);
   const bridge=h.binding.adapter.bridge;
   let refreshes=0;
   const refresh=bridge._visibility.refresh;
   bridge._visibility.refresh=function(){refreshes++;return refresh.call(this);};
   for(let x=221;x<=240;x++)move(h,x);
   assert.strictEqual(refreshes,0,'pointer updates must not rerun the display preference tree');
  }finally{h.close();}
 });
});
