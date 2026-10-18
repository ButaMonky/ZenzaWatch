'use strict';
const assert=require('assert'),fs=require('fs');
const {loadClass,createContext}=require('../helpers/extractSource');
const path='packages/zenza/src/sceneSearch/SceneSearchPlacement.js';
const rect=(left,top,width,height)=>({left,top,width,height});
const overlap=(a,b)=>Math.max(0,Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left))*
 Math.max(0,Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top));
const fixture=(o={})=>({layout:'fixed',context:'small',viewport:rect(0,0,1280,720),
 player:rect(840,430,400,225),seekbar:rect(0,680,1280,40),obstacles:[],anchorX:0,
 imageSize:{width:180,height:90},requestedScale:100,listOpen:true,previous:null,hold:false,...o});
let Placement;
function compute(input){assert(fs.existsSync(path),'placement source must be generated');
 Placement=Placement||loadClass(path,'SceneSearchPlacement',createContext());
 return Placement.compute(input);}
describe('scene placement in viewport coordinates',()=>{
 it('keeps a safe fixed position across seeking and holds during drag',()=>{
  const input=fixture(),a=compute(input),b=compute({...input,anchorX:1279,previous:a});
  assert.deepStrictEqual(a,b);assert.strictEqual(overlap(a.rect,input.seekbar),0);
  assert.strictEqual(overlap(a.rect,input.player),0);
  const moved=fixture({player:rect(0,430,400,225),previous:a});
  const held=compute({...moved,hold:true});assert.deepStrictEqual(held.rect,a.rect);
  const released=compute(moved);assert.strictEqual(overlap(released.rect,moved.player),0);
  assert.notDeepStrictEqual(released.rect,a.rect);
 });
 it('fits all widths/scales/positions without changing saved preferences',()=>{
  for(const width of [320,768,1536])for(const scale of [50,100,150,200])
   for(const listOpen of [false,true])for(const anchorX of [0,width/2,width]){
    const input=fixture({layout:'follow',viewport:rect(0,0,width,720),
     seekbar:rect(0,680,width,40),requestedScale:scale,listOpen,anchorX});
    const before=JSON.stringify(input),r=compute(input),b=r.rect;
    assert(b.left>=8&&b.top>=8&&b.left+b.width<=width-8+.001&&b.top+b.height<=712);
    assert(r.imageScale>0&&r.imageScale<=scale/100);assert.strictEqual(JSON.stringify(input),before);
    if(listOpen)assert(r.listWidth>=120);
    assert.strictEqual(overlap(b,input.seekbar),0);
   }
 });
 it('avoids close/resize/menu/input controls and actual moved video, not its old parent',()=>{
  for(const [x,y,w,h] of [[0,0,400,225],[880,0,400,225],[0,430,400,225],
   [880,430,400,225],[440,240,400,225],[550,280,160,90],[450,50,250,550],[0,0,1000,600]]){
   for(const inputTop of [y-36,y+h]){
    const input=fixture({player:rect(x,y,w,h),obstacles:[rect(x,inputTop,w,32),
     rect(x+w-20,y,20,20),rect(x+w-20,y+h-20,20,20)]});
    const r=compute(input);
    assert.strictEqual(overlap(r.rect,input.seekbar),0);
    for(const obstacle of input.obstacles)assert.strictEqual(overlap(r.rect,obstacle),0);
   }
  }
 });
 it('uses available space below normal video and always stays inside fullscreen',()=>{
  const normal=fixture({context:'normal',player:rect(100,80,800,350),seekbar:rect(100,390,800,40)});
  const a=compute(normal);assert(a.rect.top>=430);
  const full=compute({...normal,context:'fullscreen',player:rect(0,0,1280,720),
   seekbar:rect(0,680,1280,40)});
  assert(full.rect.top+full.rect.height<=672);
 });
 it('clamps a held panel when viewport shrinks, keeping horizontal mini/list',()=>{
  const previous=compute(fixture({player:rect(0,430,400,225)}));
  const input=fixture({viewport:rect(0,0,320,240),seekbar:rect(0,200,320,40),previous,hold:true});
  const result=compute(input);
  assert(result.rect.left>=8&&result.rect.left+result.rect.width<=312);
  assert(result.rect.top>=8&&result.rect.top+result.rect.height<=232);
  assert(result.listWidth>=120&&result.imageScale>0);
 });
});
