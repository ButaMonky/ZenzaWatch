'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');

const data=(id='A',status='ok')=>({
  status,format:'dmc',duration:120,
  storyboard:{version:'1',thumbnail:{width:160,height:90},
    columns:3,rows:2,interval:10000,count:12,
    images:[{url:id+'-p0'},{url:id+'-p1'}]}
});
const files=[
  ['source','packages/zenza/src/storyboard/StoryboardInfoModel.js',
    'packages/zenza/src/storyboard/SeekBarThumbnail.js',
    'packages/zenza/src/storyboard/StoryboardWorker.js'],
  ['dist','dist/ZenzaWatch-dev.user.js',
    'dist/ZenzaWatch-dev.user.js','dist/ZenzaWatch-dev.user.js']
];
function environment([,modelFile,seekFile,workerFile]) {
  const context=createContext({Emitter:class {emit(){}},console:{log(){},warn(){}}});
  const Model=loadClass(modelFile,'StoryboardInfoModel',context);
  context.StoryboardInfoModel=Model;
  const Seek=loadClass(seekFile,'SeekBarThumbnail',context);
  const Thumbnail=loadClass(workerFile,'ThumbnailView',context);
  return {Model,Seek,Thumbnail};
}
function seekHarness(env){
  const calls={hide:0,show:0,info:[],times:[]};
  const seek=Object.create(env.Seek.prototype);
  seek._model=new env.Model(data('A'));
  seek.isAvailable=true;
  seek.hide=()=>{calls.hide++;};
  seek.show=()=>{calls.show++;};
  seek.thumbnail={
    setInfo(info){calls.info.push(info);return Promise.resolve();},
    set currentTime(sec){calls.times.push(sec);}
  };
  return {seek,calls};
}
function thumbnailHarness(env){
  const draws=[],released=[];
  let resolveA;
  const deferredA=new Promise(resolve=>{resolveA=resolve;});
  const worker=Object.create(env.Thumbnail.prototype);
  worker._info=new env.Model(data('A'));
  worker._currentTime=-1;
  worker._drawSeq=0;
  worker.lastPos={};
  worker.canvas={width:160,height:90};
  worker.ctx={clearRect(){},drawImage:(img)=>draws.push(img.src)};
  worker.images={
    async get(url){return url.startsWith('A-')?deferredA:{src:url};},
    has(){return true;},release(url){released.push(url);}
  };
  worker.prefetch=()=>{};
  return {worker,draws,released,resolveA};
}
describe('Task327 AUD-56 storyboard thumbnail reset + async ownership',()=>{
  for(const variant of files){
    const label=variant[0];
    it(label+' clears old seekbar visibility and model on reset',async()=>{
      const h=seekHarness(environment(variant));
      h.seek._onStoryboardReset();
      h.seek.currentTime=30;
      assert.strictEqual(h.seek.isAvailable,false);
      assert.strictEqual(h.seek._model,null);
      assert.strictEqual(h.calls.hide,1);
      assert.deepStrictEqual(h.calls.times,[]);
      assert.deepStrictEqual(h.calls.info,[null]);
    });
    it(label+' accepts new video after reset, with no old time forwarding',async()=>{
      const env=environment(variant),h=seekHarness(env);
      h.seek._onStoryboardReset();
      const B=new env.Model(data('B'));
      h.seek._onStoryboardUpdate(B);
      h.seek.currentTime=45;
      assert.strictEqual(h.seek._model,B);
      assert.strictEqual(h.seek.isAvailable,true);
      assert.strictEqual(h.calls.show,1);
      assert.strictEqual(h.calls.info[1],B.rawData);
      assert.deepStrictEqual(h.calls.times,[45]);
    });
    it(label+' clears worker information on unavailable update',async()=>{
      const env=environment(variant),h=seekHarness(env);
      h.seek._onStoryboardUpdate(new env.Model(null));
      h.seek.currentTime=50;
      assert.strictEqual(h.seek.isAvailable,false);
      assert.strictEqual(h.seek._model,null);
      assert.strictEqual(h.calls.hide,1);
      assert.deepStrictEqual(h.calls.info,[null]);
      assert.deepStrictEqual(h.calls.times,[]);
    });
    it(label+' ignores late A image after B info replaces it',async()=>{
      const env=environment(variant),h=thumbnailHarness(env);
      const pending=h.worker.setCurrentTime(30);
      h.worker.info=data('B');
      h.resolveA({src:'A-p0'});
      await pending;
      assert.deepStrictEqual(h.draws,[],'no A draw after B update');
      // Only A-p0 was acquired; never release an unowned sibling page.
      assert.deepStrictEqual(h.released,['A-p0']);
      await h.worker.setCurrentTime(45);
      assert.deepStrictEqual(h.draws,['B-p0'],'B still renders');
    });
    it(label+' ignores image completion after worker reset to unavailable',async()=>{
      const env=environment(variant),h=thumbnailHarness(env);
      const pending=h.worker.setCurrentTime(20);
      h.worker.info=null;
      h.resolveA({src:'A-p0'});
      await pending;
      assert.deepStrictEqual(h.draws,[]);
      assert.strictEqual(h.worker.info.isAvailable,false);
    });
    it(label+' preserves normal same-video thumbnail rendering',async()=>{
      const env=environment(variant),h=thumbnailHarness(env);
      // A image resolves before the current task completes.
      const pending=h.worker.setCurrentTime(15);
      h.resolveA({src:'A-p0'});
      await pending;
      assert.deepStrictEqual(h.draws,['A-p0']);
    });
  }
});
