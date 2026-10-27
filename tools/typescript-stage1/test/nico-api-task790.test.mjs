// Task790: fixes recorded during the TypeScript migration (TextLabel, messageUtil).
// Each case runs the pre-fix fixture ("old") and the fixed runtime ("new") on the same
// fakes and asserts the intended difference.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,legacySection} from './nico-api-harness.mjs';

emitNico();
const versions=name=>{const s=NICO_API_BY_NAME[name];return {old:read(s.fixture),new:read(s.runtime)};};
const emitterSection=legacySection(read('packages/lib/src/Emitter.js'));
const withEmitter=code=>'//===BEGIN===\n'+emitterSection+'\n'+legacySection(code)+'\n//===END===';
const flush=async(n=30)=>{for(let i=0;i<n;i++)await Promise.resolve();};

// ---- TextLabel (in-page fallback, no OffscreenCanvas) ----
function labelWorld(){
  const made=[];
  const ctx={beginPath(){},clearRect(){},measureText:t=>({width:t.length*7}),fillText(){},
    set font(v){},set fillStyle(v){},set textAlign(v){},set textBaseline(v){}};
  const globals={HTMLCanvasElement:{prototype:{}},window:{getComputedStyle:()=>({fontSize:'12px'}),devicePixelRatio:1},
    workerUtil:{createCrossMessageWorker(){throw new Error('unused');}},Math,Object,Promise,Error,
    document:{body:{},createElement:()=>{const c={width:300,height:150,style:{},dataset:{},getContext:()=>ctx};made.push(c);return c;}}};
  return {globals,made,container:{offsetWidth:40,offsetHeight:20,append(){}}};
}

test('TEXTLABEL-SIZE-001: an unset size falls back to 100% instead of "undefinedpx"',async()=>{
  const v=versions('TextLabel');
  const sizes={};
  for(const k of ['old','new']){
    const w=labelWorld();
    const T=loadLegacy(v[k],'TextLabel',w.globals);
    T.create({container:w.container,style:{fontSizePx:12}});
    T.create({container:w.container,style:{widthPx:44,heightPx:16}});
    await flush();
    sizes[k]=w.made.map(c=>[c.style.width,c.style.height]);
  }
  assert.deepEqual(sizes.old,[['undefinedpx','undefinedpx'],['44px','16px']]);
  assert.deepEqual(sizes.new,[['100%','100%'],['44px','16px']]);
});

test('TEXTLABEL-DISPOSE-001: dispose sends the label id and frees it',async()=>{
  const v=versions('TextLabel');
  const out={};
  for(const k of ['old','new']){
    const w=labelWorld();
    const T=loadLegacy(v[k],'TextLabel',w.globals);
    const label=T.create({container:w.container,style:{widthPx:10,heightPx:10}});
    await label.drawText('a');
    const disposed=await Promise.resolve().then(()=>label.dispose()).then(()=>'ok',e=>e.name);
    const after=await label.drawText('b').then(()=>'drawn',e=>e.message);
    out[k]=[disposed,after];
  }
  assert.deepEqual(out.old,['TypeError','drawn']);
  assert.deepEqual(out.new,['ok','unknown id']);
});

// ---- messageUtil ----
function msgWorld(){
  const log=[];let tid=0;const timers=new Map();const bcListeners=new Map();
  class BroadcastChannel{postMessage(){}addEventListener(t,f){bcListeners.set(t,f);}}
  const setTimeout=(f,ms)=>{const i=++tid;timers.set(i,{f,ms});return i;};
  const globals={PRODUCT:'ZenzaWatch',global:{config:{props:{}},debug:{},external:{}},Config:{setValue(){}},
    NicoVideoApi:undefined,window:{addEventListener(){},setTimeout,console:{}},self:{BroadcastChannel},
    location:{host:'www.nicovideo.jp',href:'https://www.nicovideo.jp/'},document:{title:''},Math,Date,
    setTimeout,clearTimeout:i=>timers.delete(i),Object,Promise,Error,JSON,Map,Set,Array,Symbol,WeakMap,
    console:{log(){},warn:(...a)=>log.push(['warn',a[0]]),error(){},trace(){}}};
  const run=pick=>{for(const [i,t] of [...timers.entries()].filter(([,t])=>pick(t.ms))){timers.delete(i);t.f();}};
  return {log,globals,bcListeners,run};
}

test('MSGUTIL-BCAST-GUARD-001: malformed channel data is dropped instead of throwing',()=>{
  const v=versions('messageUtil');
  const bad=[{data:'{broken'},{data:null},{data:{}},{data:{body:{command:'message'}}},{data:JSON.stringify({sessionId:1})}];
  const out={};
  for(const k of ['old','new']){
    const w=msgWorld();
    loadLegacy(withEmitter(v[k]),'messageUtil',w.globals);
    const on=w.bcListeners.get('message');
    out[k]=bad.map(e=>{try{on(e);return 'dropped';}catch(err){return err.name;}});
    on({data:{body:{command:'other',params:{command:'x'}}}});
    out[k].push(w.log.length);
  }
  assert.deepEqual(out.old,['SyntaxError','TypeError','TypeError','TypeError','TypeError',1]);
  // new: objects without a usable body still log "unknown broadcast format" (3) + the valid
  // but unknown command (1); unparsable / non-object data is dropped silently.
  assert.deepEqual(out.new,['dropped','dropped','dropped','dropped','dropped',4]);
});

test('MSGUTIL-PING-UNHANDLED-001: an unanswered ping leaves no unhandled rejection',async()=>{
  // Only the fixed runtime is run here: the old one's stray rejection would fail this file.
  const unhandled=[];const onUnhandled=reason=>unhandled.push(String(reason));
  process.on('unhandledRejection',onUnhandled);
  try{
    const w=msgWorld();
    const m=loadLegacy(withEmitter(versions('messageUtil').new),'messageUtil',w.globals);
    const ping=m.BroadcastEmitter.ping({timeout:5});
    w.run(ms=>ms===5);
    assert.equal(await ping.then(()=>'ok',e=>e),'timeout 5ms');
    w.run(ms=>ms===60000);
    await flush();
    await new Promise(r=>setImmediate(r));
    assert.deepEqual(unhandled,[]);
  }finally{process.off('unhandledRejection',onUnhandled);}
  // The old source really lacked the handler (checked statically, see above).
  assert.match(versions('messageUtil').old,/\.then\(resolve\);/);
});
