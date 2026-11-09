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
  const model={items:[],length:0,maxItems:100,on(){},findByItemId:id=>items.get(id),
    findByWatchId:id=>model.items.find(x=>x.watchId===id),indexOf:item=>model.items.indexOf(item),
    getItemByIndex:i=>model.items[i]||null,_dedupe:(old,items)=>items,
    setItem(next){model.items=next;model.length=next.length;},
    unserialize(next){model.setItem(next.map(i=>new VideoListItem(i)));},
    appendItem(item){log.push('append');model.items.push(item);model.length=model.items.length;},
    removeItem(){},serialize:()=>[]};
  class VideoListItem{
    constructor(raw){if(!raw||typeof raw.id!=='string')throw TypeError('invalid id');
      this.watchId=raw.id;this.itemId=raw.id;this.title=raw.title||'';}
    static createBlankInfo(id){return {watchId:id,itemId:id};}
    static createByThumbInfo(info){return new VideoListItem({...info,id:info.id});}
  }
  const textUtil={isValidJson:s=>{try{JSON.parse(s);return true;}catch{return false;}},
    dateToString:x=>String(x),escapeToZenkaku:x=>x};
  const globals={VideoList,PlayListModel:class{constructor(){return model;}},PlayListSession:{save(){}},
    PlayListView:class{on(){}scrollToItem(){}scrollTop(){}},VideoListItem,
    global:{api:{},debug:{},emitter:{on(){}}},_:{debounce:f=>f},window:{console:{time:()=>log.push('time'),timeEnd(){},error(){}},
      setTimeout:()=>0},
    setTimeout:()=>0,Promise,PlaylistApiLoader:{load:()=>Promise.resolve([])},textUtil};
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

test('#242: invalid imported item never pauses or replaces the active playlist',()=>{
  const w=world(),p=make('new',w);
  const preserved={watchId:'smExisting',itemId:'smExisting'};
  p.model.setItem([preserved]);
  const invalid=JSON.stringify({items:[{id:{toString:null},title:'bad'}],index:0});
  p._onImportFileCommand(invalid);
  assert.deepEqual(p.model.items,[preserved]);
  assert.equal(w.emitted.some(e=>e[0]==='command'&&e[1]==='pause'),false);
  assert.equal(w.emitted.some(e=>e[0]==='command'&&e[1]==='alert'),true);
  p._onImportFileCommand(JSON.stringify({items:[{id:'sm9',title:'Valid'}],index:0}));
  assert.equal(p.model.items[0].watchId,'sm9');
  assert.equal(w.emitted.filter(e=>e[0]==='command'&&e[1]==='pause').length,1);
});
test('#259: pending append completion cannot restore a cleared playlist',async()=>{
  const w=world(),p=make('new',w);
  let finish;
  p._thumbInfoLoader={load:()=>new Promise(resolve=>{finish=resolve;})};
  const pending=p.append('smOld');
  p.unserialize({items:[{id:'smNew',title:'B'}],index:-1});
  finish({id:'smOld',title:'A'});
  await pending;
  assert.deepEqual(p.model.items.map(item=>item.watchId),['smNew']);
  assert.equal(w.log.includes('append'),false);
});
test('#259: pending append failure cannot add a blank item after import',async()=>{
  const w=world(),p=make('new',w);
  let reject;
  p._thumbInfoLoader={load:()=>new Promise((resolve,fail)=>{reject=fail;})};
  const pending=p.append('smOld');
  p.unserialize({items:[{id:'smNew',title:'B'}],index:-1});
  reject(Error('test offline'));
  await pending;
  assert.deepEqual(p.model.items.map(item=>item.watchId),['smNew']);
  assert.equal(w.log.includes('append'),false);
  assert.equal(w.emitted.some(e=>e[0]==='command'&&e[1]==='alert'),false);
});
