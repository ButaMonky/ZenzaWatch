'use strict';
const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

const data = ({duration=120,count=12,cols=3,rows=2,interval=10000}={}) => ({
  status:'ok', format:'dmc', duration,
  storyboard:{
    version:'1', thumbnail:{width:160,height:90},
    columns:cols,rows,interval,count,
    images:[{url:'page0'},{url:'page1'}]
  }
});
function subject(file, raw=data()) {
  const c=createContext({Emitter:class {emit() {}},console:{log(){},warn(){}}});
  const Model=loadClass(file,'StoryboardInfoModel',c);
  c.StoryboardInfoModel=Model;
  return {c,Model,model:new Model(raw)};
}
async function drawEnd(file) {
  const modelFile=file==='dist'?'dist/ZenzaWatch-dev.user.js':'packages/zenza/src/storyboard/StoryboardInfoModel.js';
  const workerFile=file==='dist'?'dist/ZenzaWatch-dev.user.js':'packages/zenza/src/storyboard/StoryboardWorker.js';
  const h=subject(modelFile);
  const Thumbnail=loadClass(workerFile,'ThumbnailView',h.c);
  const view=Object.create(Thumbnail.prototype),draws=[];
  view._info=h.model;
  view._currentTime=-1;
  view.lastPos={};
  view.canvas={width:160,height:90};
  view.ctx={clearRect(){},drawImage:(img,sx,sy,sw,sh)=>draws.push({url:img.url,sx,sy,sw,sh})};
  view.images={get:async url=>({url}),has:()=>true};
  view.prefetch=()=>{};
  await view.setCurrentTime(120);
  return draws;
}
describe('Task326 AUD-65 StoryboardInfoModel final-cell bounds',()=>{
  for(const [label,file] of [
    ['source','packages/zenza/src/storyboard/StoryboardInfoModel.js'],
    ['dist','dist/ZenzaWatch-dev.user.js']
  ]) {
    it(label+' uses last valid cell at exact end and beyond',()=>{
      const {model}=subject(file);
      for(const ms of [120000,121000,999999]) {
        assert.strictEqual(model.getIndex(ms),11,'end='+ms);
        const pos=model.getThumbnailPosition(ms);
        assert.strictEqual(pos.index,11);
        assert.deepStrictEqual([pos.page,pos.row,pos.col],[1,1,2]);
      }
    });
    it(label+' preserves valid interior, negative and fractional times',()=>{
      const {model}=subject(file);
      for(const [ms,index] of [[-1000,0],[0,0],[10000,1],[60000,6],[119000,11],[119999,11]]) {
        assert.strictEqual(model.getIndex(ms),index,'ms='+ms);
      }
    });
    it(label+' clamps one-cell and zero-cell metadata without a negative index',()=>{
      const single=subject(file,data({duration:1,count:1,cols:1,rows:1})).model;
      assert.strictEqual(single.getIndex(1000),0);
      assert.strictEqual(single.getIndex(999999),0);
      const empty=subject(file,data({duration:1,count:0,cols:1,rows:1})).model;
      assert.strictEqual(empty.getIndex(1000),0);
    });
    it(label+' clamps fractional duration and retains prior interior',()=>{
      const fractional=subject(file,data({duration:1.5,count:3,cols:3,rows:1,interval:500})).model;
      assert.strictEqual(fractional.getIndex(1000),2);
      assert.strictEqual(fractional.getIndex(1500),2);
      assert.strictEqual(fractional.getIndex(2000),2);
    });
    it(label+' paints the last cell rather than the first cell at exact end',async()=>{
      const draws=await drawEnd(label);
      assert.strictEqual(draws.length,1);
      assert.deepStrictEqual(draws[0],{url:'page1',sx:320,sy:90,sw:160,sh:90});
    });
  }
});
