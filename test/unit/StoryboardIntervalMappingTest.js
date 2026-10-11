'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');

const modelData=({duration=101,interval=20000,count=6,cols=3,rows=2}={})=>({
  status:'ok',format:'dmc',duration,
  storyboard:{version:'1',thumbnail:{width:160,height:90},
    columns:cols,rows,interval,count,images:[{url:'page0'},{url:'page1'}]}
});
const paths=[
  ['source','packages/zenza/src/storyboard/StoryboardInfoModel.js',
    'packages/zenza/src/storyboard/StoryboardWorker.js'],
  ['dist','dist/ZenzaWatch-dev.user.js','dist/ZenzaWatch-dev.user.js']
];
function subject([,modelFile,workerFile],raw=modelData()) {
  const c=createContext({Emitter:class{emit(){}},console:{log(){},warn(){}}});
  const Model=loadClass(modelFile,'StoryboardInfoModel',c);
  c.StoryboardInfoModel=Model;
  const model=new Model(raw);
  return {c,Model,model,workerFile};
}
async function renderAt(data,sec,path) {
  const h=subject(path,data);
  const Thumbnail=loadClass(h.workerFile,'ThumbnailView',h.c);
  const view=Object.create(Thumbnail.prototype),draws=[];
  view._info=h.model;view._currentTime=-1;view.lastPos={};
  view.canvas={width:160,height:90};
  view.ctx={clearRect(){},drawImage:(image,x,y,w,h)=>
    draws.push({page:image.page,x,y,w,h})};
  view.images={get:async url=>({page:url}),has:()=>true};
  view.prefetch=()=>{};
  await view.setCurrentTime(sec);
  return draws;
}
describe('Task355 AUD-65 declared storyboard interval mapping',()=>{
  for(const path of paths){
    const label=path[0];
    it(label+' maps non-divisible duration using declared 20s interval',()=>{
      const model=subject(path).model;
      const pairs=[[0,0],[17000,0],[19999,0],[20000,1],
        [33000,1],[99999,4],[100000,5],[101000,5],[102000,5]];
      for(const [ms,want] of pairs){
        assert.strictEqual(model.getIndex(ms),want,'timestamp '+ms);
      }
    });
    it(label+' honors subsecond 500ms frame boundaries',()=>{
      const model=subject(path,modelData({duration:4,interval:500,count:8})).model;
      const pairs=[[0,0],[499,0],[500,1],[750,1],[999,1],
        [1000,2],[1750,3],[2750,5],[3999,7],[4000,7],[5000,7]];
      for(const [ms,want] of pairs){
        assert.strictEqual(model.getIndex(ms),want,'timestamp '+ms);
      }
    });
    it(label+' retains end clamp and ordinary ten-second positions',()=>{
      const model=subject(path,modelData({duration:120,interval:10000,count:12})).model;
      for(const [ms,want] of [[-1,0],[0,0],[5000,0],[10000,1],
        [60000,6],[119999,11],[120000,11],[121000,11],[1000000,11]]){
        assert.strictEqual(model.getIndex(ms),want,'timestamp '+ms);
      }
    });
    it(label+' handles zero and one cell and invalid interval gracefully',()=>{
      const one=subject(path,modelData({duration:1,interval:500,count:1})).model;
      assert.strictEqual(one.getIndex(-1),0);
      assert.strictEqual(one.getIndex(1000),0);
      const empty=subject(path,modelData({duration:1,interval:500,count:0})).model;
      assert.strictEqual(empty.getIndex(1000),0);
      const invalid=subject(path,modelData({duration:120,interval:0,count:12})).model;
      assert.strictEqual(invalid.getIndex(110000),11,
        'retain safe legacy ratio fallback for invalid interval');
    });
    it(label+' maps actual thumbnail canvas rows for a partial final frame',async()=>{
      const data=modelData();
      assert.deepStrictEqual(await renderAt(data,17,path),
        [{page:'page0',x:0,y:0,w:160,h:90}]);
      assert.deepStrictEqual(await renderAt(data,33,path),
        [{page:'page0',x:160,y:0,w:160,h:90}]);
      assert.deepStrictEqual(await renderAt(data,99,path),
        [{page:'page0',x:160,y:90,w:160,h:90}]);
      assert.deepStrictEqual(await renderAt(data,101,path),
        [{page:'page0',x:320,y:90,w:160,h:90}]);
    });
    it(label+' draws 500ms interval thumbnails on the correct final page',async()=>{
      const data=modelData({duration:4,interval:500,count:8});
      assert.deepStrictEqual(await renderAt(data,0.75,path),
        [{page:'page0',x:160,y:0,w:160,h:90}]);
      assert.deepStrictEqual(await renderAt(data,3.999,path),
        [{page:'page1',x:160,y:0,w:160,h:90}]);
    });
  }
});
