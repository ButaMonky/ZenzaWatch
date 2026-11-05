'use strict';
const assert=require('assert');
const {capturePaintedCanvas}=require('../browser/scene-vcb-preview-paint.cjs');
const viewport={left:0,top:0,right:768,bottom:740};
const scene=box=>({canvas:box,viewport});
const canvas=(left=10,top=20)=>({left,top,right:left+160,bottom:top+90,
 width:160,height:90});
const harness=pixels=>{
 const calls=[];
 return {calls,send:async(method,args)=>{calls.push({method,args});
  return {data:'aGVsbG8='};},
 evaluate:async(code,opts)=>{calls.push({code,opts});return pixels;}};
};
describe('scene preview screenshot paint oracle',()=>{
 it('does not claim painted pixels for a missing or off-screen canvas',async()=>{
  for(const box of [null,canvas(800,900),{...canvas(),width:0}]){
   const c=harness([]);
   const result=await capturePaintedCanvas(c,scene(box));
   assert.equal(result.measured,false);
   assert.equal(c.calls.length,0,'must not capture screenshot for no target');
  }
 });
 it('requires a screenshot pixel with a distinct green signal',async()=>{
  const c=harness([{r:0,g:200,b:104,alpha:255},{r:80,g:80,b:80,alpha:255}]);
  const result=await capturePaintedCanvas(c,scene(canvas()));
  assert.equal(result.measured,true);
  assert.equal(result.greenSamples,1);
  assert.equal(result.hasPaintedThumbnail,true);
  assert.equal(c.calls[0].method,'Page.captureScreenshot');
  assert.equal(c.calls[0].args.captureBeyondViewport,false);
  assert.equal(c.calls[1].opts.awaitPromise,true);
 });
 it('rejects a canvas whose compositor screenshot is only background',async()=>{
  const c=harness([{r:15,g:20,b:35,alpha:255},{r:160,g:170,b:180,alpha:255}]);
  const result=await capturePaintedCanvas(c,scene(canvas()));
  assert.equal(result.measured,true);
  assert.equal(result.greenSamples,0);
  assert.equal(result.hasPaintedThumbnail,false);
 });
});
