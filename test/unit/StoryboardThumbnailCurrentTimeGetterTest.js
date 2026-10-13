'use strict';
const assert = require('assert');
const {loadClass,createContext} = require('../helpers/extractSource');

const files = [
  ['source','packages/zenza/src/storyboard/StoryboardWorker.js'],
  ['generated dev','dist/ZenzaWatch-dev.user.js']
];

function createView(file) {
  const context = createContext({console:{log(){},warn(){}}});
  const ThumbnailView = loadClass(file,'ThumbnailView',context);
  const view = Object.create(ThumbnailView.prototype);
  const gets = [];
  view._currentTime = -1;
  view._info = {
    duration: 60, cellWidth: 160, cellHeight: 90, pageCount: 1,
    getThumbnailPosition: ms => ({url:'P0',page:0,row:0,col:0,index:Math.floor(ms/1000)})
  };
  view.lastPos = {};
  view.canvas = {width:160,height:90};
  view.ctx = {clearRect(){},drawImage(){}};
  view.images = {get:async url => {gets.push(url);return {url};},has:()=>true};
  view.prefetch = () => {};
  return {view,gets};
}
describe('AUD-56 ThumbnailView currentTime getter consistency',()=>{
  for (const [label,file] of files) {
    it(label+' exposes the backing clock without recursion',()=>{
      const {view} = createView(file);
      assert.strictEqual(view.currentTime,-1);
      view._currentTime=12;
      assert.strictEqual(view.currentTime,12);
      view._currentTime=0;
      assert.strictEqual(view.currentTime,0);
    });
    it(label+' exposes the most recent seek/clamped time',async()=>{
      const {view,gets}=createView(file);
      await view.setCurrentTime(7);
      assert.strictEqual(view.currentTime,7);
      view.currentTime=80;
      await Promise.resolve();
      assert.strictEqual(view.currentTime,60);
      await view.setCurrentTime(-5);
      assert.strictEqual(view.currentTime,0);
      // Clock updates across cells must not reacquire the same page lease.
      assert.deepStrictEqual(gets,['P0']);
    });
    it(label+' preserves the latest seek time within one storyboard cell',async()=>{
      const {view,gets}=createView(file);
      view._info.getThumbnailPosition = ms => ({
        url:'P0',page:0,row:0,col:0,index:Math.floor(ms/10000)
      });
      await view.setCurrentTime(1);
      await view.setCurrentTime(2);
      assert.strictEqual(view.currentTime,2,'clock must reflect the newest seek');
      assert.deepStrictEqual(gets,['P0'],'unchanged cell must not reload the same image');
    });
  }
});
