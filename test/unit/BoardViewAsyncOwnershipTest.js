'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');

const data=(id,urls=[id+'-page0'])=>({
  status:'ok',format:'dmc',duration:120,
  storyboard:{version:'1',thumbnail:{width:160,height:90},
    columns:3,rows:2,interval:10000,count:urls.length*6,
    images:urls.map(url=>({url}))}
});
const unavailable={status:'fail'};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{
  resolve=yes;reject=no;
});return {promise,resolve,reject};};
function fakeCanvas(width=320,height=90) {
  const canvas={width,height,drawn:[],cleared:0};
  canvas.getContext=()=>({
    beginPath(){},
    drawImage(src){canvas.drawn.push(src?.id||src?.source||src?.drawn?.[0]||'unknown');},
    strokeRect(){},
    clearRect(){canvas.cleared++;},
    fillRect(){},
    transferFromImageBitmap(){},
    strokeStyle:'',shadowColor:'',shadowOffsetX:0,fillStyle:''
  });
  return canvas;
}
function harness(pages={}, variant='source') {
  const gets=[],releases=[],allocated=[];
  const cache={
    get(url){gets.push(url);return pages[url]||Promise.resolve({id:url});},
    release(url){releases.push(url);},
    has(){return false}
  };
  const ctx=createContext({
    Emitter:class{emit(){}},ImageCacheMap:cache,SCROLL_BAR_WIDTH:8,
    getCanvas(w,h){const c=fakeCanvas(w,h);allocated.push(c);return c;},
    console:{time(){},timeEnd(){},warn(){},log(){}},
    requestAnimationFrame(cb){cb();}
  });
  const Model=loadClass('packages/zenza/src/storyboard/StoryboardInfoModel.js',
    'StoryboardInfoModel',ctx);
  ctx.StoryboardInfoModel=Model;
  const Board=loadClass(variant==='dist'?'dist/ZenzaWatch-dev.user.js':
    'packages/zenza/src/storyboard/StoryboardWorker.js',
    'BoardView',ctx);
  const view=new Board({canvas:fakeCanvas(320,90),name:'AUD66',info:null});
  return {view,cache,gets,releases,allocated,Model,ctx};
}
const content=view=>view.boards.map(b=>b.image.drawn[0]);

describe('Task351 AUD-66 storyboard BoardView concurrent ownership',()=>{
  for(const variant of ['source','dist']) {
  describe(variant,()=>{
  it('keeps newer B when older A image resolves after B',async()=>{
    const A=deferred(),h=harness({'A-page0':A.promise},variant);
    const old=h.view.setInfo(data('A'));
    const newer=h.view.setInfo(data('B'));
    await newer;
    assert.strictEqual(h.view.info.rawData.storyboard.images[0].url,'B-page0');
    assert.deepStrictEqual(content(h.view),['B-page0','B-page0']);
    A.resolve({id:'A-page0'});
    await old;
    assert.deepStrictEqual(content(h.view),['B-page0','B-page0'],
      'stale image must not overwrite boards');
    assert.strictEqual(h.view.isReady,true);
    assert.deepStrictEqual(h.releases.sort(),['A-page0','B-page0']);
  });
  it('never recreates images or readiness when late request finishes after dispose',async()=>{
    const C=deferred(),h=harness({'C-page0':C.promise},variant);
    const pending=h.view.setInfo(data('C'));
    h.view.dispose();
    assert.strictEqual(h.view.isReady,false);
    assert.strictEqual(h.view.boards.length,0);
    C.resolve({id:'C-page0'});
    await pending;
    assert.strictEqual(h.view.isReady,false);
    assert.strictEqual(h.view.boards.length,0);
    assert.strictEqual(h.releases.filter(x=>x==='C-page0').length,1);
  });
  it('invalid info cancels an earlier load and keeps the canvas blank',async()=>{
    const A=deferred(),h=harness({'A-page0':A.promise},variant);
    const old=h.view.setInfo(data('A'));
    await h.view.setInfo(unavailable);
    A.resolve({id:'A-page0'});
    await old;
    assert.strictEqual(h.view.isReady,false);
    assert.strictEqual(h.view.boards.length,0);
    assert.strictEqual(h.view.info.isAvailable,false);
    assert.deepStrictEqual(h.releases,['A-page0']);
  });
  it('handles one failed image load without poisoning newer boards or leaking refs',async()=>{
    const h=harness({'bad-page0':Promise.reject(new Error('network'))},variant);
    await h.view.setInfo(data('bad'));
    assert.strictEqual(h.view.isReady,true,'failed image should leave a blank board');
    assert.strictEqual(h.releases.filter(x=>x==='bad-page0').length,1);
    await h.view.setInfo(data('next'));
    assert.deepStrictEqual(content(h.view),['next-page0','next-page0']);
    assert.strictEqual(h.view.isReady,true);
  });
  it('keeps both pages and their correct order on an ordinary complete update',async()=>{
    const h=harness({},variant);
    await h.view.setInfo(data('B',['B-page0','B-page1']));
    assert.deepStrictEqual(content(h.view),[
      'B-page0','B-page0','B-page1','B-page1'
    ]);
    assert.strictEqual(h.view.isReady,true);
    assert(h.view.totalWidth>0);
    assert.deepStrictEqual(h.releases,['B-page0','B-page1']);
    const oldBoards=h.view.boards.slice();
    await h.view.setInfo(data('D'));
    assert.deepStrictEqual(content(h.view),['D-page0','D-page0']);
    assert(oldBoards.every(b=>b.image.width===0),
      'old generated board canvas must relinquish its pixel buffer');
  });
  it('closes partially prepared stale pages after a slower second image resolves',async()=>{
    const slow=deferred();
    const h=harness({'A-page1':slow.promise},variant);
    const old=h.view.setInfo(data('A',['A-page0','A-page1']));
    await new Promise(resolve=>setImmediate(resolve));
    assert.strictEqual(h.allocated.filter(c=>c.drawn.includes('A-page0')).length,2,
      'first A image must be prepared while the second image is still pending');
    await h.view.setInfo(data('B'));
    assert.deepStrictEqual(content(h.view),['B-page0','B-page0']);
    slow.resolve({id:'A-page1'});
    await old;
    assert.deepStrictEqual(content(h.view),['B-page0','B-page0']);
    const oldBoards=h.allocated.filter(c=>c.drawn.includes('A-page0'));
    assert.strictEqual(oldBoards.length,2);
    assert(oldBoards.every(c=>c.width===0 && c.height===0),
      'stale already-generated buffers should be reclaimed');
    assert.deepStrictEqual(h.releases.sort(),['A-page0','A-page1','B-page0']);
  });
  it('never schedules a late stopAnimation redraw after disposal',async()=>{
    const h=harness({},variant);
    await h.view.setInfo(data('A'));
    const waiting=[];
    h.ctx.requestAnimationFrame=callback=>waiting.push(callback);
    const scrollBefore=h.view._scrollLeft;
    const stopping=h.view.stopAnimation();
    h.view.dispose();
    assert.strictEqual(waiting.length,1);
    waiting[0]();
    await stopping;
    assert.strictEqual(h.view.boards.length,0);
    assert.strictEqual(h.view.isReady,false);
    assert.strictEqual(h.view._scrollLeft,scrollBefore);
  });
  it('prevents operations from resurrecting a disposed instance',async()=>{
    const h=harness({},variant);
    await h.view.setInfo(data('A'));
    h.view.dispose();
    h.view.dispose();
    await h.view.setInfo(data('D'));
    assert.strictEqual(h.view.isReady,false);
    assert.strictEqual(h.view.boards.length,0);
    assert.strictEqual(h.gets.includes('D-page0'),false);
  });
  });
  }
});
