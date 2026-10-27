// Task870: PlayList moved to TypeScript. Behaviour parity is covered by the root playlist
// suites (they run the generated file); this file checks the three recorded fixes old vs new.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.PlayList;
const versions={old:read(spec.fixture),new:read(spec.runtime)};

function world(){
  const emitted=[];const log=[];
  class VideoList{on(){return this;}emit(...a){emitted.push(a.map(x=>typeof x==='object'?'obj':x));}
    _initializeAdDecoration(){}_onDeflistAdd(){}}
  const items=new Map([[1,{itemId:1,watchId:'sm1'}]]);
  const model={items:[],length:0,maxItems:100,on(){},findByItemId:id=>items.get(id),findByWatchId:()=>null,indexOf:()=>-1,
    getItemByIndex:()=>null,appendItem:()=>{log.push('append');},removeItem(){},serialize:()=>[]};
  const globals={VideoList,PlayListModel:class{constructor(){return model;}},PlayListSession:{save(){}},
    PlayListView:class{on(){}scrollToItem(){}scrollTop(){}},VideoListItem:{createBlankInfo:id=>({watchId:id})},
    global:{api:{},debug:{},emitter:{on(){}}},_:{debounce:f=>f},window:{console:{time:()=>log.push('time'),timeEnd(){},error(){}}},
    setTimeout:()=>0,Promise,PlaylistApiLoader:{load:()=>Promise.resolve([])},textUtil:{}};
  return {emitted,log,globals};
}
const make=(k,w)=>{const P=loadLegacy(versions[k],'PlayList',w.globals);const p=new P();p.initialize({container:{}});return p;};

test('PLAYLIST-SELECT-MISSING-001: selecting an unknown item id no longer throws',()=>{
  const out={};
  for(const k of ['old','new']){const w=world();const p=make(k,w);
    let r;try{p._onCommand('select',null,99);r='ok';}catch(e){r=e.name;}
    p._onCommand('select',null,1);out[k]=[r,w.emitted.filter(e=>e[0]==='command')];}
  assert.equal(out.old[0],'TypeError');assert.equal(out.new[0],'ok');
  assert.deepEqual(out.new[1],out.old[1]);
});

test('PLAYLIST-LOAD-TIMEKEY-001: load() with options null and no id builds its timer label',async()=>{
  const out={};
  for(const k of ['old','new']){const w=world();const p=make(k,w);
    try{await p.load({type:'user-uploaded',options:null},{}).catch(e=>e);out[k]='ok';}catch(e){out[k]=e.name;}}
  assert.equal(out.old,'TypeError');assert.equal(out.new,'ok');
});

test('PLAYLIST-APPEND-FAIL-REFRESH-001: a failed append refreshes once, update count unchanged',async()=>{
  const out={};
  for(const k of ['old','new']){const w=world();const p=make(k,w);
    p._thumbInfoLoader={load:()=>Promise.reject(new Error('net'))};
    w.emitted.length=0;
    await p.append('sm77');
    out[k]=w.emitted.filter(e=>e[0]==='update').length;}
  // old: two refreshes (each setIndex(force) emits update); new: one refresh + explicit update.
  assert.deepEqual([out.old,out.new],[2,2]);
});
