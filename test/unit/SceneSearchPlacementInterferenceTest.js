'use strict';
// Non-fullscreen interactive blockers are real, even when their z-index is low.
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');
const Placement=loadClass('packages/zenza/src/sceneSearch/SceneSearchPlacement.js',
 'SceneSearchPlacement',createContext());
const rect=(left,top,width,height)=>({left,top,width,height});
const fixture=(p={})=>({
 layout:'follow',context:'normal',viewport:rect(0,0,1024,800),
 player:rect(100,100,824,500),seekbar:rect(0,752,1024,24),
 previewAnchorTop:738,obstacles:[],anchorX:512,
 imageSize:{width:180,height:90},requestedScale:100,listScale:100,
 listOpen:false,previous:null,hold:false,footerHeight:64,...p
});
const overlap=Placement.overlap.bind(Placement);
describe('scene placement: interactive obstacles and compact viewports',()=>{
 it('keeps follow preview level while clearing active normal/small popups',()=>{
  for(const context of ['normal','small','fullscreen']){
   const input=fixture({context});
   const base=Placement.compute(input);
   const popup=rect(base.rect.left+40,base.rect.top+15,110,70);
   const actual=Placement.compute({...input,obstacles:[popup]});
   assert(overlap(base.rect,popup)>0);
   assert.equal(overlap(actual.rect,popup),0,context+': interactive popup covered');
   assert.equal(actual.rect.top,base.rect.top,context+': vertical jump');
   assert.equal(overlap(actual.rect,input.seekbar),0,context+': seek blocked');
  }
 });
 it('avoids a visible menu near a normal fixed preview without changing default placement',()=>{
  const input=fixture({layout:'fixed',viewport:rect(0,0,1024,900),
   player:rect(100,50,800,350),seekbar:rect(100,430,800,24)});
  const base=Placement.compute(input);
  const menu=rect(base.rect.left+25,base.rect.top+5,125,80);
  const actual=Placement.compute({...input,obstacles:[menu]});
  assert.equal(overlap(actual.rect,menu),0,'open fixed menu must stay clickable');
  assert.equal(overlap(actual.rect,input.seekbar),0);
  assert.deepStrictEqual(Placement.compute({...input,obstacles:[]}),base);
 });
 it('preserves seek ownership and view bounds over mode, edge, scale and hold matrix',()=>{
  let cases=0;
  for(const width of [320,768,1280,1920])
   for(const height of [240,480,900])
    for(const context of ['normal','small','fullscreen'])
     for(const layout of ['follow','fixed'])
      for(const listOpen of [false,true])
       for(const requestedScale of [50,100,200])
        for(const anchorX of [0,width/2,width-1]){
         const v=rect(0,0,width,height);
         const seek=rect(0,height-40,width,40);
         const input=fixture({layout,context,viewport:v,
          player:rect(10,30,Math.max(100,width-20),Math.max(80,height-125)),
          seekbar:seek,previewAnchorTop:height-54,anchorX,
          requestedScale,listOpen});
         const prior=Placement.compute(input);
         for(const hold of [false,true]){
          const next={...input,previous:prior,hold};
          const before=JSON.stringify(next);
          const r=Placement.compute(next),b=r.rect;
          assert(Number.isFinite(b.left)&&Number.isFinite(b.top));
          assert(b.left>=v.left+8-.01 && b.left+b.width<=width-8+.01,
           'panel exceeds width '+JSON.stringify({width,height,context,layout,hold,b}));
          assert(b.top>=8-.01&&b.top+b.height<=height-8+.01);
          assert.equal(overlap(b,seek),0,
           'seek collision '+JSON.stringify({width,height,context,layout,hold,b}));
          assert.equal(JSON.stringify(next),before,'placement input mutated');
          cases++;
         }
        }
  assert.equal(cases,2592);
 });
 it('does not jump vertically while the seekbar changes on hover',()=>{
  const input=fixture();
  const expanded=fixture({seekbar:rect(0,738,1024,24)});
  for(const x of [0,100,512,900,1023]){
   const a=Placement.compute({...input,anchorX:x});
   const b=Placement.compute({...expanded,anchorX:x});
   assert.equal(a.rect.top,b.rect.top);assert.equal(a.rect.height,b.rect.height);
  }
 });
});