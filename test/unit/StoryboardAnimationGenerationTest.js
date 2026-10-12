'use strict';
const assert = require('assert');
const {createContext,loadClass} = require('../helpers/extractSource');
const source = 'packages/zenza/src/storyboard/StoryboardWorker.js';
const tick = () => new Promise(resolve => setImmediate(resolve));
function makeBoard() {
  const pending = [];
  const ctx = createContext({
    Emitter: class { emit() {} },
    ImageCacheMap: {get(){return Promise.resolve(null);},release(){}},
    SCROLL_BAR_WIDTH:8,
    getCanvas(w,h){return canvas(w,h);},
    requestAnimationFrame(cb){pending.push(cb);}
  });
  function canvas(width=320,height=90) {
    return {width,height,getContext(){return {
      clearRect(){},drawImage(){},fillRect(){},beginPath(){},strokeRect(){}
    };}};
  }
  ctx.StoryboardInfoModel = loadClass('packages/zenza/src/storyboard/StoryboardInfoModel.js','StoryboardInfoModel',ctx);
  const Board = loadClass(source,'BoardView',ctx);
  const view = new Board({canvas:canvas(),name:'generation',info:null});
  let reads=0;
  view.buffer={get currentTime(){return ++reads;},get paused(){return false;},wait(){}};
  view.isReady=true;
  view.reDraw=()=>{};
  return {view,pending,reads:()=>reads};
}
describe('Task405 AUD-66 animation stop/start generation',()=>{
  it('does not let a stale RAF continuation schedule another loop',async()=>{
    const h=makeBoard();
    h.view.startAnimation();
    await tick();
    assert.strictEqual(h.pending.length,1);
    h.view.stopAnimation();
    h.view.startAnimation();
    await tick();
    const before=h.reads();
    h.pending.shift()();
    await tick();
    assert.strictEqual(h.reads(),before,'old loop must not read after restart');
    h.view.dispose();
    while(h.pending.length) h.pending.shift()();
  });
});
