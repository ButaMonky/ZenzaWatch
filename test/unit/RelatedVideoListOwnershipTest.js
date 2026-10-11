'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function apiItems(...ids){
  return {items:ids.map(id=>({id,content:{
    title:'title '+id,duration:60,count:{comment:1,mylist:2,view:3},
    thumbnail:{url:'https://example.com/'+id+'.jpg'},registeredAt:'2026-01-01'
  }}))};
}
function setup([label,relatedFile,modelFile]){
  const pending=[],scrolls=[];
  let itemCount=0;
  class Item {
    constructor(data){this.watchId=data.id;this.uniqId='unique-'+data.id;
      this.itemId=++itemCount;this.title=data.title||data.id;
      this.isBlankData=false;this.isActive=false;this.state={};this.groupList=null;}
    serialize(){return {id:this.watchId,title:this.title};}
    static createByVideoInfoModel(info){return new Item({id:info.watchId||info.videoId,title:info.title});}
  }
  class Emitter{on(){} emit(){} emitAsync(){}}
  const c=createContext({Emitter,VideoListItem:Item,throttle:{raf:fn=>fn},_:{isNumber:Number.isFinite}});
  const Model=loadClass(modelFile,'VideoListModel',c);
  c.VideoListModel=Model;
  c.VideoList=class{
    constructor(){this.model=new Model({uniq:true,maxItems:100});
      this.view={scrollTop:n=>scrolls.push(n)};}
    _initializeView(){this.view={scrollTop:n=>scrolls.push(n)};}
  };
  c.RecommendAPILoader={load:({videoId})=>{
    const d=deferred();pending.push({videoId,...d});return d.promise;
  }};
  const Related=loadClass(relatedFile,'RelatedVideoList',c);
  const list=new Related();
  return {label,list,pending,scrolls};
}
const paths=[
  ['source','packages/zenza/src/Playlist/RelatedVideoList.js','packages/zenza/src/Playlist/VideoListModel.js'],
  ['generated dev dist','dist/ZenzaWatch-dev.user.js','dist/ZenzaWatch-dev.user.js']
];
const ids=list=>Array.from(list.model.items,x=>x.watchId);
describe('Task359 AUD-31 RelatedVideoList per-video replacement',()=>{
  for(const path of paths){
    const label=path[0];
    it(label+' atomically replaces A with B including updated lookup maps',()=>{
      const h=setup(path);
      h.list.update([{id:'sm100'},{id:'sm101'}],'smA');
      assert.deepStrictEqual(ids(h.list),['sm100','sm101']);
      const old=Array.from(h.list.model.items);
      h.list.update([{id:'sm200'},{id:'sm201'}],'smB');
      assert.deepStrictEqual(ids(h.list),['sm200','sm201']);
      assert.strictEqual(h.list._watchId,'smB');
      assert.strictEqual(h.list.model.findByWatchId('sm100'),undefined);
      assert.strictEqual(old[0].groupList,null);
      assert.strictEqual(h.scrolls.length,2);
    });
    it(label+' removes prior A items when B is empty or missing valid ids',()=>{
      const h=setup(path);
      h.list.update([{id:'sm100'}],'smA');
      h.list.update([],'smB');
      assert.deepStrictEqual(ids(h.list),[]);
      assert.strictEqual(h.list._watchId,'smB');
      h.list.update([{id:'smC'},{}],'smC');
      assert.deepStrictEqual(ids(h.list),['smC']);
      h.list.update([{},null,{id:''}].filter(Boolean),'smD');
      assert.deepStrictEqual(ids(h.list),[]);
    });
    it(label+' clears old rows while new recommendation request is pending',async()=>{
      const h=setup(path);
      h.list.update([{id:'smOld'}],'smOld');
      const p=h.list.fetchRecommend('smB','smB',{watchId:'smB',videoId:'smB',title:'B'});
      assert.deepStrictEqual(ids(h.list),['smB']);
      assert.strictEqual(h.list._watchId,'smB');
      h.pending[0].resolve(apiItems('smB-rec1','smB-rec2'));
      await p;
      assert.deepStrictEqual(ids(h.list),['smB','smB-rec1','smB-rec2']);
    });
    it(label+' ignores late response for A after B finishes',async()=>{
      const h=setup(path);
      const a=h.list.fetchRecommend('smA','smA',{watchId:'smA',videoId:'smA'});
      const b=h.list.fetchRecommend('smB','smB',{watchId:'smB',videoId:'smB'});
      assert.deepStrictEqual(ids(h.list),['smB']);
      h.pending[1].resolve(apiItems('smB-rec'));
      await b;
      assert.deepStrictEqual(ids(h.list),['smB','smB-rec']);
      h.pending[0].resolve(apiItems('smA-rec'));
      await a;
      assert.deepStrictEqual(ids(h.list),['smB','smB-rec']);
      assert.strictEqual(h.list._watchId,'smB');
    });
    it(label+' retains current request on old request failure',async()=>{
      const h=setup(path);
      const a=h.list.fetchRecommend('smA');
      const b=h.list.fetchRecommend('smB');
      h.pending[0].reject(new Error('A network fail'));
      await a;
      assert.deepStrictEqual(ids(h.list),[]);
      h.pending[1].resolve(apiItems('smB-rec'));
      await b;
      assert.deepStrictEqual(ids(h.list),['smB-rec']);
      assert.strictEqual(h.list._watchId,'smB');
    });
    it(label+' treats empty B response as replacement, not retained A',async()=>{
      const h=setup(path);
      h.list.update([{id:'smA-rec'}],'smA');
      const b=h.list.fetchRecommend('smB');
      h.pending[0].resolve(apiItems());
      await b;
      assert.deepStrictEqual(ids(h.list),[]);
      assert.strictEqual(h.list._watchId,'smB');
    });
    it(label+' keeps only newest same-video refresh results',async()=>{
      const h=setup(path);
      const first=h.list.fetchRecommend('smA');
      const second=h.list.fetchRecommend('smA');
      h.pending[1].resolve(apiItems('smA-new'));
      await second;
      h.pending[0].resolve(apiItems('smA-old'));
      await first;
      assert.deepStrictEqual(ids(h.list),['smA-new']);
    });
    it(label+' preserves video watchId if videoId is a different identifier',async()=>{
      const h=setup(path);
      const p=h.list.fetchRecommend('sm900','so123',{videoId:'sm900',watchId:'so123'});
      h.pending[0].resolve(apiItems());
      await p;
      assert.strictEqual(h.list._watchId,'so123');
    });
    it(label+' handles current recommendation error with only self video',async()=>{
      const h=setup(path);
      const p=h.list.fetchRecommend('smA','smA',{watchId:'smA',videoId:'smA'});
      h.pending[0].reject(new Error('offline'));
      await p;
      assert.deepStrictEqual(ids(h.list),['smA']);
    });
  }
});
describe('Task359 AUD-31 stale canplay idle ownership',()=>{
  for(const [label,file] of [
    ['source','src/VideoInfoPanel.js'],
    ['generated dev dist','dist/ZenzaWatch-dev.user.js']
  ]) {
    it(label+' discards A idle continuation after B becomes active',async()=>{
      const idleQueue=[],calls=[];
      const sleep=()=>Promise.resolve();
      sleep.idle=()=>{
        const d=deferred();idleQueue.push(d);return d.promise;
      };
      const c=createContext({Emitter:class{},sleep});
      const Panel=loadClass(file,'VideoInfoPanel',c);
      const panel=Object.create(Panel.prototype);
      const a={watchId:'smA',videoId:'smA'};
      const b={watchId:'smB',videoId:'smB'};
      panel._videoInfo=a;panel._relatedVideoList={fetchRecommend:(...args)=>calls.push(args)};
      panel._config={props:{autoZenTube:false}};
      const aPending=panel._onVideoCanPlay('smA',a,{});
      panel._videoInfo=b;
      const bPending=panel._onVideoCanPlay('smB',b,{});
      idleQueue[1].resolve();await bPending;
      idleQueue[0].resolve();await aPending;
      assert.strictEqual(calls.length,1);
      assert.deepStrictEqual(calls[0],[b.videoId,b.watchId,b]);
    });
  }
});
