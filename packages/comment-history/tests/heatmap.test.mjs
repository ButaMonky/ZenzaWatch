import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CommentHistoryRenderer} from '../src/renderer.mjs';
const require=createRequire(import.meta.url);
const {beginSection,createContext,run}=require('../../../test/helpers/extractSource.js');
function subject(){
  const events=[];const context=createContext({HTMLCanvasElement:{prototype:{}},workerUtil:{},global:{emitter:{emit:(...x)=>events.push(x)}},console:{log(){},time(){},timeEnd(){}}});
  run(beginSection('packages/zenza/src/heatMap/HeatMapWorker.js')+';globalThis.HM=HeatMap;',context);
  const canvas={width:200,height:10,getContext:()=>({fillRect(){},beginPath(){}}),toDataURL:()=>''};
  const hm=new context.HM({canvas});
  class Chat{static TYPE={TOP:'ue',NAKA:'naka',BOTTOM:'shita'};static SIZE={SMALL:'small'};static SORT_FUNCTION=(a,b)=>a.vpos-b.vpos;static create(p){return {...p,threadId:p.thread,type:'naka'};}}
  let seq=0;class VM{static create(c){return new VM(c);}constructor(c){this.id=++seq;this.chat=c;this.beginLeftTiming=c.vpos/100;this.endRightTiming=this.beginLeftTiming+4;}get bulkLayoutData(){return {id:this.id,ypos:0,isOverflow:false};}set bulkLayoutData(v){this.layout=v;}reset(){}}
  const normal=Chat.create({thread:'10',fork:0,no:1,text:'selected baseline',date:1200000000,vpos:10000,user_id:'base'});
  const excluded=new Set();const filter={applyFilter:xs=>xs.filter(c=>!excluded.has(c.user_id))};
  const groups=['ue','naka','shita'].map(type=>({_members:type==='naka'?[normal]:[],get members(){return filter.applyFilter(this._members);},onChange(){}}));
  const model={_options:{duration:200,mainThreadId:'10'},topGroup:groups[0],nakaGroup:groups[1],bottomGroup:groups[2],_nicoChatFilter:filter,nicoScripter:{isEmpty:true},promise:()=>Promise.resolve(),emit(){hm.setData({watchId:'sm1',duration:200,chatList:{top:groups[0].members,naka:groups[1].members,bottom:groups[2].members}});}};
  const views=groups.map(g=>({_members:g._members.map(c=>new VM(c)),_offScreen:{},_lastUpdate:0,_layoutWorker:{post:async({params:p})=>({...p,members:p.members.map(m=>({...m,ypos:0,isOverflow:false}))})}}));
  const player={_model:model,_viewModel:{getGroup:t=>views[['ue','naka','shita'].indexOf(t)]},_view:{clear(){},refresh(){}}};
  const renderer=new CommentHistoryRenderer({player,Chat,ChatViewModel:VM,yieldControl:()=>Promise.resolve()});
  const data=n=>({threads:[{id:'10',info:{fork:0,layer:{index:0},label:'default'},comments:Array.from({length:n},(_,i)=>({no:i+2,body:'historic',commands:[],postedAt:'2008-01-01T00:00:00Z',isPremium:false,userId:'history',vposMs:100000,isMyPost:false,nicoruCount:0}))}]});
  return {hm,renderer,groups,views,model,data,excluded,normal};
}
test('HM-01 actual history apply -> active filtered heatmap: 15000/7500/0/15000/OFF',async()=>{
  const h=subject();for(const n of [15000,7500,0,15000]){await h.renderer.apply(h.data(n));assert.equal(h.hm.model.map[100],n+1);assert.equal(h.groups[1]._members[0],h.normal);}
  h.renderer.clear();assert.equal(h.hm.model.map[100],1);assert.equal(h.renderer.retainedCount,0);
});
test('HM-01 all-NG becomes zero without destroying retained history',async()=>{
  const h=subject();await h.renderer.apply(h.data(100));h.excluded.add('history');h.excluded.add('base');h.model.emit('change');assert.equal(h.hm.model.map[100],0);assert(h.hm.map.every(n=>n===0));
  h.excluded.clear();h.model.emit('change');assert.equal(h.hm.model.map[100],101);
});
test('HM-01 failed history layout does not update heatmap before atomic apply',async()=>{
  const h=subject();await h.renderer.apply(h.data(20));const original=h.hm.map.slice();h.views[1]._layoutWorker.post=async()=>{throw Error('synthetic layout failure');};await assert.rejects(h.renderer.apply(h.data(200)));assert.deepEqual(h.hm.map,original);assert.equal(h.hm.model.map[100],21);
});
test('HM-01 reducing application preserves cache but excludes it from the histogram',async()=>{
  const h=subject();await h.renderer.apply(h.data(100));await h.renderer.apply(h.data(0));assert.equal(h.renderer.retainedCount,100);assert.equal(h.hm.model.map[100],1);await h.renderer.apply(h.data(100));assert.equal(h.hm.model.map[100],101);
});

test('HM-01 the relative color peak follows history at a different playback time',async()=>{
  const h=subject();h.model.emit('change');assert.equal(h.hm.map[100],255);assert.equal(h.hm.map[150],0);
  const later=h.data(100);for(const c of later.threads[0].comments)c.vposMs=150000;
  await h.renderer.apply(later);assert(h.hm.map[150]>=254 && h.hm.map[150]<=255);assert(h.hm.map[100]<h.hm.map[150]);
  await h.renderer.apply(h.data(0));assert.equal(h.hm.map[150],0);assert.equal(h.hm.map[100],255);assert.equal(h.renderer.retainedCount,100);
});
