// Task515: offline legacy/new parity. No HTTP requests or real video playback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {renderNicoLegacy} from '../scripts/sync-nico-api.mjs';
import {emitNico,read,loadLegacy,snapshot} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.VideoItemObserver;
const before=read(spec.fixture),after=read(spec.runtime);

function harness(payload,{noIO=false,noMO=false,reject=false}={}){
  const trace=[], instances={io:[],mo:[]};
  const item={
    dataset:{videoId:'sm9'},
    classList:{
      contains:token=>token==='is-fetch-ignore'&&payload?.ignore===true,
      add:(...tokens)=>trace.push(['class-add',...tokens.map(String)]),
      remove:(...tokens)=>trace.push(['class-remove',...tokens.map(String)])
    }
  };
  const container={querySelectorAll:query=>{
    trace.push(['query',query]);return [item];
  }};
  class IO {
    constructor(cb,settings){this.cb=cb;trace.push(['io-new',settings.rootMargin]);instances.io.push(this);}
    observe(el){trace.push(['io-observe',el.dataset.videoId]);}
    unobserve(el){trace.push(['io-unobserve',el.dataset.videoId]);}
    trigger(){this.cb([{isIntersecting:false,target:item},{isIntersecting:true,target:item}]);}
  }
  class MO {
    constructor(cb){this.cb=cb;trace.push(['mo-new']);instances.mo.push(this);}
    observe(c,opts){trace.push(['mo-observe',c===container,opts.childList,opts.subtree]);}
    disconnect(){trace.push(['mo-disconnect']);}
    trigger(){this.cb([{addedNodes:[{}]}]);}
  }
  const ThumbInfoLoader={load:id=>{
    trace.push(['thumb-load',id]);
    return reject?Promise.reject(new Error('offline')):Promise.resolve(structuredClone(payload));
  }};
  const globals={
    ThumbInfoLoader,
    _: {throttle:(fn,ms)=>{trace.push(['throttle',ms]);return fn;}},
    window:{IntersectionObserver:noIO?undefined:IO,MutationObserver:noMO?undefined:MO},
    MutationObserver:MO,
    document:container
  };
  return {trace,instances,item,container,globals};
}
async function scenario(source,payload,opts,run){
  const h=harness(payload,opts);
  const api=loadLegacy(source,'VideoItemObserver',h.globals);
  await run(api,h);
  // drain microtasks including ThumbInfoLoader rejection catch and final DOM update
  for(let i=0;i<5;i++)await Promise.resolve();
  return snapshot({trace:h.trace,dataset:h.item.dataset,io:h.instances.io.length,
    mo:h.instances.mo.length});
}
async function compare(label,payload,options={},run=async(api,h)=>{
  api.observe({container:h.container});h.instances.mo[0].trigger();
  h.instances.io[0].trigger();}){
  assert.deepEqual(await scenario(after,payload,options,run),
    await scenario(before,payload,options,run),label);
}
test('isolated emitter preserves IIFE shape and refuses arbitrary top-level code',()=>{
  assert.equal(spec.shape,'iife');
  assert.match(after,/GENERATED FROM.*VideoItemObserver.ts/);
  assert.throws(()=>renderNicoLegacy(spec,
    'const VideoItemObserver = (() => {\n})();\nconst injected = true;\nexport { VideoItemObserver };'),
    /UNEXPECTED_TOP_LEVEL/);
});
test('thumbnail results preserve dataset and failed-class behavior',async()=>{
  for(const [label,payload,options] of [
    ['normal',{id:'sm9',code:'OK'},{}],
    ['empty',{},{}],['string primitive','ok',{}],
    ['deleted',{code:'DELETED'},{}],
    ['bad',{status:'fail',code:'BANNED'},{}],
    ['community',{status:'fail',code:'COMMUNITY'},{}],
    ['failure without code',{status:'fail'},{}],
    ['null',null,{}],['false',false,{}],['zero',0,{}],
    ['rejection',null,{reject:true}],['ignored',{ignore:true},{}]
  ]){
    await compare(label,payload,options);
  }
});
test('lifetime: repeated observe, unobserve and re-observe match legacy',async()=>{
  await compare('duplicate',null,{},async(api,h)=>{
    api.observe({query:'.video',container:h.container});
    api.observe({query:'.other',container:h.container});
    h.instances.mo[0].trigger();
    h.instances.io[0].trigger();
    api.unobserve({container:h.container});
    api.unobserve({container:h.container});
    api.observe({container:h.container});
    h.instances.mo[1].trigger();
  });
});
test('missing browser APIs and missing container never subscribe',async()=>{
  const noContainer=async(api,h)=>{
    api.observe();
    api.observe({query:'.video'});
    api.unobserve({container:h.container});
  };
  await compare('no container',null,{},noContainer);
  for(const opt of [{noIO:true},{noMO:true}]){
    await compare('missing observer',null,opt,async(api,h)=>api.observe({container:h.container}));
  }
});
