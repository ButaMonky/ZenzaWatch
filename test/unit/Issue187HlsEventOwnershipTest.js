'use strict';
const assert=require('assert');
const {extract,createContext,run}=require('../helpers/extractSource');
function fixture(){
 const engines=[];
 class Hls{
  constructor(){this.listeners={};this.levels=[];engines.push(this);}
  on(event,callback){this.listeners[event]=callback;}
  loadSource(){} attachMedia(){} stopLoad(){} detachMedia(){}
  destroy(){this.listeners.destroy?.();}
 }
 Hls.Events={DESTROYING:'destroy',MANIFEST_PARSED:'manifest',LEVEL_LOADED:'level',
  LEVEL_SWITCHED:'switch',ERROR:'error',FRAG_LOADED:'frag',BUFFER_EOS:'eos'};
 const c=createContext({HTMLElement:class{},Hls,CustomEvent,Event,
  createFragmentLoader:()=>class{},console:{info(){},warn(){},error(){}}});
 run(`const PLAYER_MODE=${extract('packages/zenza/src/hls/HlsVideoElement.js','PLAYER_MODE','var')};
 ${extract('packages/zenza/src/hls/HlsVideoElement.js','ZenzaVideoElement')};globalThis.Subject=ZenzaVideoElement;`,c);
 const p=Object.create(c.Subject.prototype),events=[];
 Object.assign(p,{_hls:null,_hlsConfig:{},_videoCount:1,_src:'fixture',_video:{},
  _bufferStats:[],_levelData:[],dispatchEvent:e=>events.push(e),_markReadiness(){}});
 p._initHLSJS('fixture');return {p,engine:engines[0],events};
}
describe('Issue187 HLS events belong to their original engine',()=>{
 it('ignores callbacks retained from a destroyed engine after replacement',()=>{
  const {p,engine,events}=fixture();p._initHLSJS('replacement');
  engine.listeners.manifest('manifest',{levels:[]});
  engine.listeners.level('level',{level:0,details:{endSN:12}});
  assert.equal(events.filter(e=>e.type==='canplay').length,0);
  assert.equal(p._bufferStats.length,0);
 });
 it('ignores malformed manifest, level and error payloads',()=>{
  const {engine,events}=fixture();
  for(const data of [null,undefined,42,{}, {levels:null}, {level:'x',details:null}]){
   assert.doesNotThrow(()=>engine.listeners.manifest('manifest',data));
   assert.doesNotThrow(()=>engine.listeners.level('level',data));
   assert.doesNotThrow(()=>engine.listeners.error('error',data));
  }
  assert.equal(events.filter(e=>e.type==='canplay').length,0);
 });
});
