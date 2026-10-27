// Task800: Emitter moved to TypeScript. Parity of everything except the three recorded
// fixes (EMITTER-ON-WARN-001 / EMITTER-TOTALCOUNT-001 / EMITTER-CLEAR-CASE-001), which
// are asserted as old-vs-new differences below.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.Emitter;
const versions={old:read(spec.fixture),new:read(spec.runtime)};
const flush=async(n=20)=>{for(let i=0;i<n;i++)await Promise.resolve();};

function world(){
  const log=[];let tid=0;const timers=new Map();
  const globals={console:{warn:(...a)=>log.push(['warn',a[0],a[1]]),log(){},error(){}},
    setTimeout:(f,ms)=>{const i=++tid;timers.set(i,f);log.push(['setTimeout',ms]);return i;},
    Promise,Map,Symbol,Object,Error};
  return {log,globals,run(){const l=[...timers.values()];timers.clear();l.forEach(f=>f());}};
}
const load=(k,w)=>loadLegacy(versions[k],'EmitterInitFunc',w.globals)();

async function compare(run,label){
  const out=[];
  for(const k of ['old','new']){
    const w=world();
    const lib=load(k,w);
    const r=await settle(()=>run(lib,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log)});
  }
  assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' side effects');
}

test('Emitter: on/off/once/emit order, case folding, removal during emit',{timeout:20000},async()=>{
  await compare(({Emitter},w)=>{
    const e=new Emitter();const calls=[];
    const a=(...x)=>calls.push(['a',...x]),b=(...x)=>calls.push(['b',...x]);
    const selfRemove=()=>{calls.push(['self']);e.off('Ev',selfRemove);e.off('ev',b);};
    e.on('Ev',a);e.on('EV',b);e.on('ev',a);e.on('ev',selfRemove);
    e.emit('eV',1,2);e.emit('ev',3);
    e.once('one',(...x)=>calls.push(['once',...x]));e.emit('one',4);e.emit('one',5);
    const o=x=>calls.push(['offOnce',x]);e.once('two',o);e.off('two',o);e.emit('two',6);
    e.addEventListener('dom',a);e.emit('dom','d');e.removeEventListener('dom',a);e.emit('dom','x');
    const r=[e.off('nothing'),e.emit('nothing'),new Emitter().emit('x'),new Emitter().off('x'),new Emitter().clear()];
    e.off('ev');e.emit('ev',7);
    e.on('async',a);e.emitAsync('async',8);calls.push('before-timer');w.run();
    e.clear('async');e.emit('async',9);
    e.clear();e.emit('Ev',10);
    return [calls,r.map(x=>x===undefined?'u':x===e?'self':'other'),!!e._events];
  },'events');
});

test('Emitter: promise / emitResolve / emitReject / addCallback / resetPromise',{timeout:20000},async()=>{
  await compare(async({Emitter})=>{
    const e=new Emitter();const r=[];
    const p1=e.promise('a');e.emitResolve('a',1,2);r.push(await p1,p1===e.promise('a'),e.hasPromise('a'));
    e.emitResolve('b','early');r.push(await e.promise('b'));
    const p3=e.promise('c',(res)=>{r.push('cb');res('viaCallback');});r.push(await p3);
    const p4=e.promise('c',(res)=>{r.push('added');res('ignored');});r.push('after-addCallback');r.push(p4===p3,await p4);
    e.emitReject('d',new Error('boom'));r.push(await e.promise('d').then(()=>'ok',x=>x.message));
    const p5=e.promise('e');setTimeout(()=>{},0);e.emitReject('e','late');r.push(await p5.catch(x=>['caught',x]));
    e.resetPromise('a');r.push(e.hasPromise('a'),new Emitter().hasPromise('x'));new Emitter().resetPromise('x');
    const chained=e.promise('f').then(v=>v*2);e.emitResolve('f',21);r.push(await chained,chained.constructor.name);
    r.push(p1.key.status,p1.key.value,p5.key.status);
    return r;
  },'promises');
});

test('Handler: exec order, execMethod, iteration, add/remove/clear, nop',{timeout:20000},async()=>{
  await compare(({Handler})=>{
    const out=[];const f=x=>out.push(['f',x]),g=x=>out.push(['g',x]);
    const h=new Handler(f);h.add(g).add(f);h.exec(1);
    const objs=[{run:x=>out.push(['o1',x])},{run:x=>out.push(['o2',x])}];
    const hm=new Handler(...objs);hm.execMethod('run',2);
    out.push([...h].length,h.length,h.isEmpty,[...h.next()].length);
    h.remove(f);h.exec(3);h.clear();out.push(h.isEmpty,typeof Handler.nop,Handler.nop());
    const thisSeen=[];new Handler(function(){thisSeen.push(Array.isArray(this));}).exec();
    return [out,thisSeen];
  },'handler');
});

test('fixes: listener warning, totalCount, clear(name) case',{timeout:20000},()=>{
  const out={};
  for(const k of ['old','new']){
    const w=world();const {Emitter}=load(k,w);
    const e=new Emitter();
    for(let i=0;i<12;i++)e.on('many',()=>{});
    const warns=w.log.filter(x=>x[0]==='warn').length;
    const base=Emitter.totalCount;
    const x=new Emitter();const f=()=>{};x.on('a',f);x.off('a',f);x.on('b',f);x.off('b');
    const countAfterOff=Emitter.totalCount-base;
    const y=new Emitter();let hit=0;y.on('MixedCase',()=>hit++);y.clear('MixedCase');y.emit('mixedcase');
    out[k]={warns,countAfterOff,hitAfterClear:hit};
  }
  // On first registration the old code compared Map.length (undefined) — no visible change.
  assert.equal(out.old.warns,2);assert.equal(out.new.warns,2);
  assert.deepEqual([out.old.countAfterOff,out.new.countAfterOff],[2,0]);
  assert.deepEqual([out.old.hitAfterClear,out.new.hitAfterClear],[1,0]);
});

test('EmitterInitFunc stays self-contained for toString() injection',()=>{
  const {EmitterInitFunc}=(()=>{const w=world();return {EmitterInitFunc:loadLegacy(versions.new,'EmitterInitFunc',w.globals)};})();
  const ctx=vm.createContext({console:{warn(){}},setTimeout});
  const {Emitter,Handler,PromiseHandler}=vm.runInContext(`(${EmitterInitFunc.toString()})()`,ctx);
  const e=new Emitter();let got;e.on('x',v=>{got=v;});e.emit('x',42);
  assert.equal(got,42);assert.equal(typeof Handler,'function');assert.equal(typeof PromiseHandler,'function');
  assert.doesNotMatch(EmitterInitFunc.toString(),/\bimport\b|\brequire\(/);
});
