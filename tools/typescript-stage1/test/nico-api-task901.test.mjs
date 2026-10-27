// Task901: storyboard models, the seek-bar thumbnail, AudioAdjuster and initCssProps moved to
// TypeScript. Behaviour is covered by the root storyboard/audio suites; this file checks the
// recorded fixes old vs new on the generated files.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return {old:read(s.fixture),new:read(s.runtime)};};

test('SEEKBARTHUMB-SETINFO-UNHANDLED-001: a rejected worker setInfo on update is handled',async()=>{
  const out={};
  for(const k of ['old','new']){
    {
      const warned=[];
      const S=loadLegacy(pair('SeekBarThumbnail')[k],'SeekBarThumbnail',{
        cssUtil:{addStyle(){}},uQuery:{},global:{debug:{}},StoryboardWorker:{},ClassList:()=>({}),
        _:{isNumber:v=>typeof v==='number'},console:{warn:(...a)=>warned.push(a[0]),log(){}}});
      const thumb=new S({container:null,storyboard:{on(){}}});
      // A thenable rejection: it records whether anyone subscribed instead of leaking a real one.
      thumb.thumbnail={setInfo:()=>({then(ok,fail){fail(new Error('worker setup failed'));}})};
      thumb._onStoryboardUpdate({isAvailable:true,rawData:{}});
      await new Promise(r=>setTimeout(r,20));
      out[k]={warned,isAvailable:thumb.isAvailable};
    }
  }
  assert.deepEqual(out.old,{warned:[],isAvailable:true});
  assert.deepEqual(out.new,{warned:['SeekBarThumbnail setInfo failed'],isAvailable:true});
});

test('INITCSSPROPS-DEAD-001: only the registered CSS values are created',()=>{
  const out={};
  for(const k of ['old','new']){
    const calls=[];let registered,set;
    const cssUtil={
      // Issue3 adds a fullscreen stylesheet; property-registration assertions stay unchanged.
      addStyle(){},
      s:v=>(calls.push(['s',v]),`${v}s`),px:v=>(calls.push(['px',v]),`${v}px`),number:v=>`n${v}`,
      registerProps:(...defs)=>{registered=defs.map(d=>({...d,window:d.window&&d.window.name}));},
      setProps:(...entries)=>{set=entries.map(e=>e.slice(1));}};
    const f=loadLegacy(pair('inintCssProps')[k],'initCssProps',{cssUtil,CONSTANT:{SIDE_PLAYER_WIDTH:400},
      global:{innerWidth:1280,innerHeight:720},window:{name:'top'},document:{documentElement:{}}});
    f();
    out[k]={calls,registered:JSON.stringify(registered),set:JSON.stringify(set)};
  }
  assert.deepEqual(out.old.calls,[['s',1],['px',0],['px',48],['px',64],['px',424],['px',76]]);
  assert.deepEqual(out.new.calls,[['px',48],['px',64],['px',424],['px',76]]);
  assert.equal(out.new.registered,out.old.registered);
  assert.equal(out.new.set,out.old.set);
  assert.match(out.new.registered,/"window":"top"/);
});
