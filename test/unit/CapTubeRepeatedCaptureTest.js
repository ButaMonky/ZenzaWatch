'use strict';
// Task966 QA: consecutive captures must draw into the same OffscreenCanvas.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const quiet={time() {}, timeEnd() {}, warn() {}, log() {}};
function harness(source, offscreenAvailable=true) {
  const canvases=[]; const transferred=[]; const frames=[];
  const makeCanvas=(width=0,height=0,isOffscreen=false)=>{
    const frame={width,height,ctxCreated:false,isOffscreen};
    frame.getContext=()=>{frame.ctxCreated=true;return {drawImage:(image)=>frames.push({canvas:frame,image})};};
    frame.transferToImageBitmap=()=>{
      if(!frame.ctxCreated)throw new Error('Cannot transfer from a canvas with no context');
      const image={width:frame.width,height:frame.height};
      transferred.push(image);return image;
    };
    canvases.push(frame);return frame;
  };
  const OffscreenCanvas=offscreenAvailable ? function(width,height){return makeCanvas(width,height,true);} : undefined;
  const window={};
  const doc={createElement(tag){
    if(tag!=='canvas')throw Error('Unexpected tag '+tag);
    return makeCanvas();
  }};
  const c=createContext({OffscreenCanvas,window,document:doc,console:quiet});
  const code='const getTransferCanvas='+extract(source,'getTransferCanvas','var')+';\n'+
    'const createCanvasFromVideo='+extract(source,'createCanvasFromVideo','var')+';\n'+
    'globalThis.canvasProvider=getTransferCanvas;globalThis.capture=createCanvasFromVideo;';
  run(code,c);
  return {canvasProvider:c.canvasProvider,capture:c.capture,canvases,frames,transferred};
}
for(const source of ['src/_captube.js','dist/CapTube.user.js']){
  describe('Task966 repeated screenshot canvas '+source,()=>{
    it('preserves the canvas and context across multiple screenshots',()=>{
      const h=harness(source);
      const video={videoWidth:320,videoHeight:240};
      assert.doesNotThrow(()=>h.capture(video));
      assert.doesNotThrow(()=>h.capture(video));
      const working=h.canvases.filter(x=>x.isOffscreen && x.ctxCreated);
      assert.strictEqual(working.length,1,'repeated captures must reuse a single initialized canvas');
      assert.strictEqual(h.transferred.length,2,'two image bitmaps must be created');
      assert.strictEqual(h.frames.length,4,'both video and preview must render twice');
    });
    it('can capture with HTML canvas fallback if OffscreenCanvas is unavailable',()=>{
      const h=harness(source,false);
      const video={videoWidth:320,videoHeight:240};
      const shot=h.capture(video);
      assert(shot.canvas && shot.thumbnail);
      assert.strictEqual(h.capture(video).canvas,shot.canvas);
    });
  });
}
