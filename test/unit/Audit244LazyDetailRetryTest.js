'use strict';
const assert=require('assert');
const {createPlaylistContext,flush}=require('../helpers/playlistHarness');
const {extract,run}=require('../helpers/extractSource');
function fixture(path){
  const h=createPlaylistContext();
  const P=path==='packages/zenza/src/Playlist/PlayList.js'?
    h.PlayList:run('('+extract(path,'PlayList','class')+')',h.c);
  P.DETAIL_CONCURRENCY=h.PlayList.DETAIL_CONCURRENCY;
  P.DETAIL_FILL_DELAY_MS=h.PlayList.DETAIL_FILL_DELAY_MS;
  const p=new P();p.initialize({loop:false,container:null,loader:{}});
  p.view={scrollToItem(){},scrollTop(){},hasFocus:false};
  return {h,p};
}
describe('Audit #244: bounded retry for visible lazy playlist details',()=>{
  for(const path of ['packages/zenza/src/Playlist/PlayList.js','dist/ZenzaWatch-dev.user.js']){
    it(path+' retries transient failures after backoff without rebuilding the playlist',async()=>{
      const {p}=fixture(path);
      await p.appendWatchIds(['sm319'],{deferDetails:true});
      const item=p.model.items[0];item.isLazy=false;
      let attempts=0;
      p._thumbInfoLoader={load:async id=>{
        attempts++;
        if(attempts===1)throw Error('synthetic timeout');
        return {id,title:'Recovered',duration:130,commentCount:0,
          mylistCount:0,viewCount:0,thumbnail:'https://example.invalid/thumb.jpg',
          postedAt:'2020/01/01 00:00:00'};
      }};
      p._fillDetails();await flush(5);
      assert.strictEqual(attempts,1);
      assert.strictEqual(item.state.detailFailed,true);
      assert.strictEqual(item.state.detailRequested,false);
      assert(item.state.detailRetryAt>Date.now());
      item.state.detailRetryAt=0;
      p._fillDetails();await flush(5);
      assert.strictEqual(attempts,2);
      assert.strictEqual(item.isBlankData,false);
      assert.strictEqual(item.state.detailFailed,false);
      assert.strictEqual(item.state.detailAttempts,0);
    });
    it(path+' limits permanent failure to three attempts',async()=>{
      const {p}=fixture(path);
      await p.appendWatchIds(['sm420'],{deferDetails:true});
      const item=p.model.items[0];item.isLazy=false;
      let attempts=0;p._thumbInfoLoader={load:async()=>{attempts++;throw Error('404');}};
      for(let k=0;k<6;k++){
        item.state.detailRetryAt=0;
        p._fillDetails();await flush(5);
      }
      assert.strictEqual(attempts,3,'bounded attempts');
      assert.strictEqual(item.state.detailFailed,true);
      assert.strictEqual(item.state.detailAttempts,3);
      assert.strictEqual(item.isBlankData,true);
    });
  }
});
