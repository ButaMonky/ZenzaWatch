// Task786: parity of MediaTimeline and css moved to TypeScript (legacy fixture vs
// generated runtime, identical fakes, results and side effects compared).
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return [read(s.fixture),read(s.runtime)];};
const flush=async(n=10)=>{for(let i=0;i<n;i++)await Promise.resolve();};

async function compare(name,symbol,makeWorld,run,label){
  const out=[];
  for(const code of pair(name)){
    const w=makeWorld();
    const subject=loadLegacy(code,symbol,w.globals);
    const r=await settle(()=>run(subject,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log)});
  }
  assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' side effects');
}

function timelineWorld({animate=true,sharable=false}={}){
  const log=[];let rafId=0;const rafs=new Map();let iid=0;const intervals=new Map();let now=1000;
  const clock={currentTime:0,playbackRate:1,pause(){log.push(['anime.pause']);},play(){log.push(['anime.play']);}};
  const span={animate:animate?((k,o)=>{log.push(['animate',o.duration]);return clock;}):undefined};
  const self=sharable?{SharedArrayBuffer:ArrayBuffer}:{};
  const globals={self,document:{createElement:()=>span,documentElement:animate?{animate(){}}:{}},
    ArrayBuffer,Float32Array,Int32Array,Map,Math,isNaN,
    Atomics:{store:(a,i,v)=>{a[i]=v;log.push(['atomics.store',i]);},notify:()=>log.push(['atomics.notify'])},
    objUtil:{toMap:o=>new Map(Object.entries(o))},sleep:{resolve:Promise.resolve()},Object,Promise,
    performance:{now:()=>now},
    setInterval:(f,ms)=>{const i=++iid;intervals.set(i,f);log.push(['setInterval',ms]);return i;},
    clearInterval:i=>{intervals.delete(i);log.push(['clearInterval',i]);},
    requestAnimationFrame:f=>{const i=++rafId;rafs.set(i,f);log.push(['raf',i]);return i;},
    cancelAnimationFrame:i=>{rafs.delete(i);log.push(['cancelRaf',i]);}};
  const media={currentTime:5,duration:120,playbackRate:1,paused:true,l:new Map(),
    addEventListener(n,f,o){this.l.set(n,f);log.push(['m.add',n,o]);},removeEventListener(n){this.l.delete(n);log.push(['m.remove',n]);}};
  return {log,globals,clock,media,rafs,intervals,tick:ms=>{now+=ms;}};
}
const state=t=>[t.currentTime,t.duration,t.playbackRate,t.paused,t.timestamp,t.isWAAvailable,t.interval];

test('MediaTimeline: attach, events, timer correction, raf loop, detach', async()=>{
  for(const animate of [true,false]){
    await compare('MediaTimeline','MediaTimeline',()=>timelineWorld({animate}),async(MT,w)=>{
      const t=new MT({media:w.media,interval:100});
      const r=[state(t)];
      w.media.paused=false;w.media.l.get('play')();
      r.push(state(t));
      w.clock.currentTime=6200;
      for(const f of [...w.rafs.values()]){f();}await flush();
      for(const f of [...w.rafs.values()]){f();}await flush();
      r.push(state(t));
      w.media.currentTime=30;w.media.l.get('seeking')();w.media.l.get('seeked')();
      w.media.playbackRate=1.5;w.media.l.get('ratechange')();
      w.media.duration=121;w.media.l.get('durationchange')();w.media.l.get('durationChange')();
      r.push(state(t));
      w.clock.currentTime=0;[...w.intervals.values()][0]();
      w.media.paused=true;w.media.l.get('pause')();
      r.push(state(t));
      t.currentTime=NaN;t.currentTime=10;t.currentTime=10.2;
      r.push(state(t),w.clock.currentTime);
      // The clock follows only when the gap exceeds 1 s (1.3 s here; 0.2 s above did not).
      t.currentTime=11.5;
      r.push(w.clock.currentTime);
      t.detach();
      r.push(state(t),t.media);
      return r;
    },'animate='+animate);
  }
});

test('MediaTimeline: register/get share one instance per name; SharedArrayBuffer path', async()=>{
  await compare('MediaTimeline','MediaTimeline',()=>timelineWorld({sharable:true}),(MT,w)=>{
    const a=MT.register('main'),b=MT.get('main'),c=MT.register('main',w.media),d=MT.get('sub');
    a.timestamp=5;a.timestamp=5;
    return [MT.isSharable,a===b,a===c,a===d,MT.MAP,a.timestamp,state(c)];
  },'register');
});

function cssWorld(){
  const log=[];const raf=[];
  const make=tag=>({tag,id:'',type:'',disabled:false,dataset:{},classList:{add:c=>log.push(['class',c])},
    append:t=>log.push(['style.append',String(t).length])});
  const doc={createElement:make,head:{append:e=>log.push(['head.append',e.id,e.type,e.disabled,e.dataset.switch])}};
  const CSS={escape:s=>'E:'+s,px:v=>'PX'+v,registerProperty:d=>{if(d.bad)throw Error('dup');log.push(['register',d.name]);},
    paintWorklet:{addModule:async u=>log.push(['addModule',u])}};
  const throttle={raf:f=>{const r=()=>{raf.push(f);return Promise.resolve('queued');};r.cancel=()=>{};return r;}};
  const globals={window:{document:doc,CSS},global:{PRODUCT:'ZW'},throttle,CSS,Object,JSON,Promise,WeakMap,
    Blob:class{constructor(p){log.push(['blob',p.join('').length]);}},
    URL:{createObjectURL:()=>'blob:1',revokeObjectURL:u=>log.push(['revoke',u])},
    self:{},console:{warn:(...a)=>log.push(['warn',a[0]])}};
  return {log,raf,globals,doc};
}

test('css: addStyle options, setProps batching, registerProps, addModule cache, unit helpers', async()=>{
  await compare('css','({css, cssUtil})',cssWorld,async({css,cssUtil},w)=>{
    const r=[css===cssUtil];
    r.push(css.addStyle('a{}').tag,css.addStyle('b{}','named').id,css.addStyle('c{}',{id:'o',disabled:true}).dataset.switch);
    const el={style:{setProperty:(p,v)=>{if(p==='--bad')throw Error('x');w.log.push(['set',p,v]);}}};
    r.push(await css.setProps([el,'--a',1],[el,'--bad',2]));
    w.raf.forEach(f=>f());
    css.registerProps({name:'--p'},{name:'--q',bad:true});
    const mod=function(){};
    r.push(await css.addModule(mod,{config:{a:1}}),await css.addModule(mod));
    r.push(css.escape('a.b'),css.px(3),css.s(2),css.ms(5),css.percent(9),css.vh(1),css.vw(2),css.number(4),css.pt(7),
      css.trans('scale(2)'),css.word('auto'),css.image('none'));
    return r;
  },'css');
});
