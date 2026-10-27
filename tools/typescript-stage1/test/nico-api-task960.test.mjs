// Task960: CustomElements, ShortcutKeyEmitter and YouTubeWrapper moved to TypeScript.
// Behaviour is covered by the root suites; this file checks the recorded fixes old vs new
// on the generated files.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return {old:read(s.fixture),new:read(s.runtime)};};

test('SHORTCUT-UNSET-ZERO-001: an unset (0) legacy key never matches a keyCode-0 event',async()=>{
  const out={};
  for(const k of ['old','new']){
    const emitted=[];
    class Emitter{emit(...a){emitted.push(a.slice(0,2));}}
    const S=loadLegacy(pair('ShortcutKeyEmitter')[k],'ShortcutKeyEmitter',{Emitter,SHORTCUT_ACTIONS:[],document:{}});
    const handlers={};
    const element={addEventListener:(type,fn)=>{handlers[type]=fn;}};
    const config={props:{KEY_CLOSE:0,KEY_SEEK_LEFT:37,KEY_TOGGLE_PLAY:32},on(){}};
    S.create(config,element,{promise:async()=>{},on(){}});
    await new Promise(r=>setTimeout(r,0));
    const key=keyCode=>({keyCode,repeat:false,composedPath:()=>[],target:{}});
    handlers.keydown(key(0));
    handlers.keydown(key(37));
    handlers.keydown(key(32));
    out[k]=emitted;
  }
  assert.deepEqual(out.old,[['keyDown','ESC'],['keyDown','SEEK_BY'],['keyDown','TOGGLE_PLAY']]);
  assert.deepEqual(out.new,[['keyDown','SEEK_BY'],['keyDown','TOGGLE_PLAY']]);
});

function elementWorld(){
  const defined={};
  class HTMLElement{
    attachShadow(){
      const shadow={html:'',set innerHTML(v){this.html=v;},get innerHTML(){return this.html;},
        set textContent(v){this.html=v;},get firstChild(){return this.html?{}:null;},
        querySelector:()=>({style:{},classList:{toggle(){}},textContent:''})};
      return shadow;
    }
    getAttribute(){return null;}
    setAttribute(){}
  }
  return {defined,globals:{HTMLElement,window:{customElements:{define:(n,c)=>{defined[n]=c;}}},
    _:{debounce:f=>f}}};
}

test('CUSTOMELEMENTS-RECONNECT-001: a moved playlist-append button is rebuilt on reconnect',()=>{
  const out={};
  for(const k of ['old','new']){
    const w=elementWorld();
    const C=loadLegacy(pair('CustomElements')[k],'CustomElements',w.globals);
    C.initialize();
    const Append=w.defined['zenza-playlist-append'];
    const el=new Append();
    const first=!!el._shadow.firstChild;
    el.disconnectedCallback();
    el.connectedCallback?.();
    out[k]={first,afterMove:!!el._shadow.firstChild,hasConnected:typeof el.connectedCallback};
  }
  assert.deepEqual(out.old,{first:true,afterMove:false,hasConnected:'undefined'});
  assert.deepEqual(out.new,{first:true,afterMove:true,hasConnected:'function'});
});

test('YOUTUBE-CURRENTTIME-UNIT-001: playing time is interpolated in seconds, capped at the duration',()=>{
  const out={};
  for(const k of ['old','new']){
    let now=0;
    class Emitter{emit(){}emitAsync(){}}
    const Y=loadLegacy(pair('YouTubeWrapper')[k],'YouTubeWrapper',{Emitter,_:{debounce:f=>f},
      global:{debug:{}},textUtil:{},performance:{now:()=>now},window:{}});
    const yt=new Y({parentNode:null});
    let raw=10;
    yt._player={getPlayerState:()=>1,getCurrentTime:()=>raw,getDuration:()=>100};
    const t0=yt.currentTime;
    now=500;
    const t1=yt.currentTime;
    raw=99.9; yt.currentTime; now=5500;
    const capped=yt.currentTime;
    out[k]={t0,t1:Math.round(t1*1e4)/1e4,capped:Math.round(capped*1e4)/1e4};
  }
  assert.deepEqual(out.old,{t0:10,t1:10.0005,capped:99.905});
  assert.deepEqual(out.new,{t0:10,t1:10.5,capped:100});
});
