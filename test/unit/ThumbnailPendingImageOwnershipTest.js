'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');
const variants = [
  ['source', 'packages/zenza/src/storyboard/StoryboardWorker.js',
    'packages/zenza/src/storyboard/StoryboardInfoModel.js'],
  ['generated dev', 'dist/ZenzaWatch-dev.user.js', 'dist/ZenzaWatch-dev.user.js']
];
const info = prefix => ({status:'ok', format:'dmc', duration:30,
  storyboard:{thumbnail:{width:160,height:90}, columns:1, rows:1,
    interval:10000, count:3, images:[0,1,2].map(i=>({url:prefix+i}))}});
function harness(workerFile, modelFile) {
  const requests = [], draws = [];
  const images = {
    get(url) {
      let resolve;
      const promise = new Promise(yes => { resolve = yes; });
      requests.push({url, resolve});
      return promise;
    },
    has() { return true; }, release() {}
  };
  const context = createContext({Emitter:class {emit(){}}, ImageCacheMap:images});
  context.StoryboardInfoModel = loadClass(modelFile, 'StoryboardInfoModel', context);
  const Thumbnail = loadClass(workerFile, 'ThumbnailView', context);
  const canvas = {width:160,height:90,getContext(){return {
    clearRect(){}, drawImage(image){draws.push(image.id);}
  };}};
  const view = new Thumbnail({canvas, info:info('A'), name:'pending-image'});
  return {view, requests, draws, resolve(index){
    requests[index].resolve({id:requests[index].url});
  }};
}
for (const [label, workerFile, modelFile] of variants) {
  describe('Task409 pending thumbnail ownership ('+label+')', () => {
    it('keeps one in-flight image while updating the same-cell clock', async () => {
      const h=harness(workerFile,modelFile);
      const first=h.view.setCurrentTime(1);
      await h.view.setCurrentTime(2);
      assert.strictEqual(h.view.currentTime,2);
      assert.strictEqual(h.requests.length,1);
      h.resolve(0); await first;
      assert.deepStrictEqual(h.draws,['A0']);
      assert.strictEqual(h.view.currentTime,2);
    });
    it('does not draw an older image after moving into a different cell', async () => {
      const h=harness(workerFile,modelFile);
      const first=h.view.setCurrentTime(1);
      await h.view.setCurrentTime(2);
      const second=h.view.setCurrentTime(11);
      assert.deepStrictEqual(h.requests.map(r=>r.url),['A0','A1']);
      h.resolve(0); await first;
      assert.deepStrictEqual(h.draws,[]);
      h.resolve(1); await second;
      assert.deepStrictEqual(h.draws,['A1']);
      assert.strictEqual(h.view.currentTime,11);
    });
    it('discards an old-video image after the model is replaced', async () => {
      const h=harness(workerFile,modelFile);
      const first=h.view.setCurrentTime(1);
      await h.view.setCurrentTime(2);
      h.view.info=info('B');
      const second=h.view.setCurrentTime(3);
      h.resolve(0); await first;
      assert.deepStrictEqual(h.draws,[]);
      h.resolve(1); await second;
      assert.deepStrictEqual(h.draws,['B0']);
      assert.strictEqual(h.view.currentTime,3);
    });
    it('retains the clamped zero clock without cancelling the pending image', async () => {
      const h=harness(workerFile,modelFile);
      const first=h.view.setCurrentTime(1);
      await h.view.setCurrentTime(-5);
      assert.strictEqual(h.view.currentTime,0);
      h.resolve(0); await first;
      await h.view.setCurrentTime(0);
      assert.strictEqual(h.requests.length,1);
      assert.deepStrictEqual(h.draws,['A0']);
    });
    it('coalesces repeated same-cell seeks without losing the newest clock', async () => {
      const h=harness(workerFile,modelFile);
      const first=h.view.setCurrentTime(1);
      for(let i=1;i<100;i++) { await h.view.setCurrentTime(i/10); }
      assert.strictEqual(h.view.currentTime,9.9);
      assert.strictEqual(h.requests.length,1);
      h.resolve(0); await first;
      assert.deepStrictEqual(h.draws,['A0']);
      assert.strictEqual(h.view.currentTime,9.9);
    });
    it('never draws a pending image after a reset to unavailable metadata', async () => {
      const h=harness(workerFile,modelFile);
      const first=h.view.setCurrentTime(1);
      await h.view.setCurrentTime(2);
      h.view.info=null;
      h.resolve(0); await first;
      assert.deepStrictEqual(h.draws,[]);
      assert.strictEqual(h.view.currentTime,-1);
      assert.strictEqual(h.view.info.isAvailable,false);
    });
  });
}
