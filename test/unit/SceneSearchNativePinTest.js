'use strict';
const assert=require('assert'),{EventEmitter}=require('events');
const {loadClass,createContext}=require('../helpers/extractSource');
describe('native preview pin preserves scene without blocking seek',()=>{
 it('keeps native mini/image scene pinned for pointer, wheel and input actions',()=>{
  const seen=[],seeks=[],board=[];
  const Bar=loadClass('src/VideoControlBar.js','VideoControlBar',createContext({
   Emitter:EventEmitter,global:{innerWidth:1000},window:{innerWidth:1000},
   util:{dispatchCommand:(node,c,v)=>seeks.push([c,v])}}));
  const bar=Object.create(Bar.prototype);
  Object.assign(bar,{state:{isDragging:false,isWheelSeeking:true},_duration:100,
   _seekBarMouseX:120,_sceneSearchPinnedTime:()=>12,_posToTime:x=>x/10,
   _commentPreview:{update(){},set currentTime(v){seen.push(['mini',v]);}},
   _seekBarToolTip:{update(v){seen.push(['image',v]);}},storyboard:{setCurrentTime:v=>board.push(v)}});
  bar._onSeekBarMouseMove({offsetX:900,stopPropagation(){}});
  bar._onWheelSeek(80);
  bar._onSeekRangeInput({target:{value:'70',max:'100'}});
  assert(seen.every(([,time])=>time===12),JSON.stringify(seen));
  assert.deepStrictEqual(seeks,[['seek',70]]);assert.deepStrictEqual(board,[80,70]);
 });
});
