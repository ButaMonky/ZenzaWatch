// Task852: playlist core (VideoListModel / VideoList / VideoListItem) moved to TypeScript.
// Behaviour parity is covered by the root playlist suites (38 files run the generated
// files); this file checks the generated code against the legacy fixture for the
// recorded fixes and for the count getters' equivalence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return {old:read(s.fixture),new:read(s.runtime)};};
const itemGlobals=()=>({throttle:{raf:f=>f},textUtil:{dateToString:v=>String(v),convertKansuEi:s=>String(s)},
  performance:{now:()=>1},Date,Number,Object,parseInt,isNaN,JSON});
const loadItem=k=>loadLegacy(pair('VideoListItem')[k],'VideoListItem',itemGlobals());

test('VideoListItem counts: the direct getters equal the old count-object path',()=>{
  const raws=[{id:'sm1',num_res:'12',mylist_counter:3,view_counter:'4500'},{id:'sm2'},
    {id:'sm3',num_res:'x',mylist_counter:null,view_counter:7,like:5},{id:'sm4',num_res:0,count:{like:2}}];
  for(const raw of raws){
    const o=new (loadItem('old'))({...raw}),n=new (loadItem('new'))({...raw});
    assert.deepEqual([n.commentCount,n.mylistCount,n.viewCount],[o.commentCount,o.mylistCount,o.viewCount],raw.id);
    assert.deepEqual(snapshot(n.count),snapshot(o.count),raw.id+' count');
    assert.deepEqual(snapshot(n.serialize()),snapshot(o.serialize()),raw.id+' serialize');
  }
});

test('MYLISTITEM-GUARD-001: a riapi mylist item without count/thumbnail no longer throws',()=>{
  const bad={content:{id:'sm9',title:'t',duration:5,registeredAt:'2020'}};
  const good={content:{id:'sm8',title:'g',duration:5,registeredAt:'2020',count:{comment:1,mylist:2,view:3,like:4},thumbnail:{url:'u'}}};
  const out={};
  for(const k of ['old','new']){
    const I=loadItem(k);
    let badResult;try{const it=I.createByMylistItem(bad);badResult=[it.watchId,it.title,it.thumbnail];}catch(e){badResult=['threw',e.name];}
    const g=I.createByMylistItem(good);
    out[k]={bad:badResult,good:snapshot(g.serialize())};
  }
  assert.deepEqual(out.old.bad,['threw','TypeError']);
  assert.deepEqual(out.new.bad,['sm9','t',undefined]);
  assert.deepEqual(out.new.good,out.old.good);
});

test('VIDEOLIST-SELECT-MISSING-001 / VIDEOLIST-MAXITEMS-KEY-001',()=>{
  const out={};
  for(const k of ['old','new']){
    const emitted=[];let modelParams;
    class Emitter{on(){return this;}emit(...a){emitted.push(a);}}
    const items=new Map([[1,{watchId:'sm1'}]]);
    const VideoListModel=class{constructor(p){modelParams=p;this.items=[];}on(){}findByItemId(id){return items.get(id);}findByWatchId(){}setItemData(){}};
    const VideoListView=class{on(){}};
    const VideoList=loadLegacy(pair('VideoList')[k],'VideoList',{Emitter,VideoListModel,VideoListView,
      bounce:{time:f=>f},ThumbInfoLoader:{},AdDecorationLoader:{load:async()=>new Map()},window:{console:{info(){},warn(){}}},Set,Map});
    const list=new VideoList({container:{}});
    list._onCommand('select',1);
    let missing;try{list._onCommand('select',99);missing='ok';}catch(e){missing=e.name;}
    list._onCommand('other','p');
    out[k]={emitted,missing,modelParams:snapshot(modelParams)};
  }
  assert.equal(out.old.missing,'TypeError');assert.equal(out.new.missing,'ok');
  assert.deepEqual(out.new.emitted,out.old.emitted);
  assert.deepEqual(out.old.modelParams,{uniq:true,maxItem:100});
  assert.deepEqual(out.new.modelParams,{uniq:true,maxItems:100});
});
