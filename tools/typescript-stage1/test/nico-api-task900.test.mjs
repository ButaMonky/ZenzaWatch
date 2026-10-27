// Task900: playlist views moved to TypeScript. Behaviour is covered by the root playlist
// suites; this file checks the recorded fixes old vs new on the generated files.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return {old:read(s.fixture),new:read(s.runtime)};};

test('VIDEOITEM-DROPPED-CLASS-001 / VIDEOITEM-CSS-TYPO-001',()=>{
  const out={};
  for(const k of ['old','new']){
    let classes;
    const dll={lit:{html:(s,...v)=>({s,v})},directives:{classMap:m=>{classes=m;return 'c';}}};
    const V=loadLegacy(pair('VideoListItemView')[k],'VideoListItemView',{dll,textUtil:{secToTime:()=>'0:00'},WeakMap,Number,Date});
    V.build({title:'t',count:{view:1,comment:2,mylist:3},itemId:1,watchId:'sm1',isLazy:false,isDropped:true,
      timestamp:1,postedAt:'2020/01/01',duration:1,thumbnail:'x'},0);
    out[k]={dropped:classes['is-dropped'],typo:classes['is-drropped'],css:/box-shaow/.test(V.CSS)};
  }
  assert.deepEqual(out.old,{dropped:undefined,typo:true,css:true});
  assert.deepEqual(out.new,{dropped:true,typo:undefined,css:false});
});

function dropWorld(){
  const emitted=[];
  class Emitter{on(){return this;}emit(...a){emitted.push(a);}}
  class FileReader{readAsText(f){this.onload({target:{result:'DATA:'+f.name}});}}
  return {emitted,globals:{Emitter,FileReader,window:{console:{log(){}}},FrameLayer:class{wait(){return new Promise(()=>{});}},
    VideoListItemView:{CSS:''},bounce:{time:f=>f},_:{debounce:f=>f,throttle:f=>f},global:{emitter:{on(){}}},
    cssUtil:{addStyle(){}},uq:Object.assign(()=>({on(){return this;}}),{html:()=>({mapQuery:()=>({e:{},$:{}}),0:{},on(){return this;}})}),
    ClassList:()=>({add(){},remove(){},toggle(){}}),VideoListView:class{on(){}},CONSTANT:{}}};
}
const ev=files=>({preventDefault(){},stopPropagation(){},dataTransfer:{files},target:{files}});

test('VIDEOLISTVIEW-DROPFILE-001: dropping a playlist file on the list reads the native event',()=>{
  const out={};
  for(const k of ['old','new']){
    const w=dropWorld();
    const V=loadLegacy(pair('VideoListView')[k],'VideoListView',w.globals);
    const view=Object.create(V.prototype);view.removeClass=()=>{};view.emit=(...a)=>w.emitted.push(a);
    const r=[];
    for(const files of [[{name:'a.playlist.json'}],[{name:'b.txt'}],[]]){
      try{view._onBodyDropFile(ev(files));r.push('ok');}catch(e){r.push(e.name);}
    }
    out[k]={r,emitted:w.emitted.map(e=>e.slice(0,2))};
  }
  assert.deepEqual(out.old,{r:['TypeError','TypeError','TypeError'],emitted:[]});
  assert.deepEqual(out.new,{r:['ok','ok','ok'],emitted:[['filedrop','DATA:a.playlist.json']]});
});

test('PLAYLISTVIEW-DROP-NOFILE-001: a drop or selection without a file is ignored',()=>{
  const out={};
  for(const k of ['old','new']){
    const w=dropWorld();
    const P=loadLegacy(pair('PlayListView')[k],'PlayListView',w.globals);
    const view=Object.create(P.prototype);view._$fileDrop={removeClass(){}};view.emit=(...a)=>w.emitted.push(a);
    const r=[];
    for(const fn of ['_onDropFile','_onImportFileSelect'])for(const files of [[{name:'x.playlist.json'}],[]]){
      try{view[fn](ev(files));r.push('ok');}catch(e){r.push(e.name);}
    }
    out[k]={r,emitted:w.emitted.length};
  }
  assert.deepEqual(out.old,{r:['ok','TypeError','ok','TypeError'],emitted:2});
  assert.deepEqual(out.new,{r:['ok','ok','ok','ok'],emitted:2});
});
