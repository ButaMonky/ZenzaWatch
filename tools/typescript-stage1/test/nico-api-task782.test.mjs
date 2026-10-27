// Task782: parity of logSafe, objUtil and Observable moved to TypeScript.
// Legacy fixture vs generated runtime, identical fakes; Observable runs on the real
// Handler/PromiseHandler from packages/lib/src/Emitter.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,legacySection,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return [read(s.fixture),read(s.runtime)];};
const flush=async(n=8)=>{for(let i=0;i<n;i++)await Promise.resolve();};

async function compare(name,symbol,makeWorld,run,label,wrap=code=>code){
  const out=[];
  for(const code of pair(name)){
    const w=makeWorld();
    const subject=loadLegacy(wrap(code),symbol,w.globals);
    const r=await settle(()=>run(subject,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log)});
  }
  // Both sides must actually run: an identical crash would otherwise compare equal.
  assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' side effects');
}

test('logSafe: secrets, personal keys, JSON strings, depth, cycles, URL, Error', async()=>{
  await compare('logSafe','logSafe',()=>({log:[],globals:{JSON,Object,Array,String,WeakSet,URL,Error}}),l=>{
    const cyc={a:1};cyc.self=cyc;
    let deep={v:0};for(let i=0;i<12;i++)deep={child:deep};
    return [
      l.redact({token:'t',apiKey:'k',keys:[1],Cookie:'c',body:'b',userId:9,ok:'fine',nested:{password:'p',n:1}}),
      l.redact('{"csrfToken":"x","threadId":"1"}'),l.redact('[{"mail":"m"},2]'),l.redact('{broken'),
      l.redact(null),l.redact(undefined),l.redact(3),l.redact(cyc),l.redact(deep),
      l.redact(new URL('https://example.invalid/a?b=1')),l.redact(new Error('boom')),
      l.redact([{session:'s'},{x:1}]),
      ['signature','user_name','text','videoId','threadKey','KEYS'].map(l.isSecretKey),l.MASK
    ];
  },'redact');
});

test('objUtil: bridge, isObject, toMap, mapToObj', async()=>{
  await compare('objUtil','objUtil',()=>({log:[],globals:{Object,Map,Symbol}}),u=>{
    class Target{constructor(){this.n=2;}twice(){return this.n*2;}name(){return 'T';}}
    const t=new Target();const self={};u.bridge(self,t);
    const only={};u.bridge(only,t,['name']);
    const m=new Map([['a',1]]);
    return [Object.keys(self).sort(),self.twice(),Object.keys(only),only.name(),
      [u.isObject(null),u.isObject({}),u.isObject(1),u.isObject([])],
      u.toMap(m)===m,Array.from(u.toMap({x:1,y:2})),u.mapToObj(new Map([['k','v']])),u.mapToObj('plain')];
  },'helpers');
});

// Observable needs Handler / PromiseHandler: evaluate Emitter.js's section first.
const emitterSection=legacySection(read('packages/lib/src/Emitter.js'));
const withEmitter=code=>'//===BEGIN===\n'+emitterSection+'\n'+legacySection(code)+'\n//===END===';
const obsWorld=()=>{
  const log=[];const listeners=new Map();
  const win={innerWidth:800,innerHeight:600,
    addEventListener:(n,f,o)=>{log.push(['add',n,o]);listeners.set(n,f);},
    removeEventListener:(n)=>{log.push(['remove',n]);listeners.delete(n);}};
  let tid=0;const timers=new Map();
  return {log,win,listeners,timers,globals:{window:win,Symbol,WeakMap,Map,Set,Promise,Object,Array,TypeError,Error,
    setInterval:(f,ms)=>{const i=++tid;timers.set(i,f);log.push(['setInterval',ms]);return i;},
    clearInterval:i=>{log.push(['clearInterval',i]);timers.delete(i);},
    console:{warn:(...a)=>log.push(['warn',String(a[0])]),log(){},error(){}}}};
};
const O='({Observable, WindowResizeObserver})';

test('Observable: of/from/concat/subscribe/filter/map/unsubscribe', async()=>{
  await compare('Observable',O,obsWorld,({Observable})=>{
    const out=[];
    const s1=Observable.of(1,2,3).subscribe(v=>out.push(['a',v]),e=>out.push(['err',e]),c=>out.push(['done',c]));
    const s2=Observable.of(4,5).filter(v=>v>4);
    const s3=Observable.of(6,7).map(v=>v*10);
    const chained=Observable.of('x').concat(Observable.of('y')).concat(['z']);
    chained.subscribe({next:v=>out.push(['c',v]),complete:()=>out.push(['c-done'])});
    let err=null;try{chained.concat(chained);}catch(e){err=e.message;}
    const fromIter=Observable.from(new Set([8,9]));fromIter.subscribe(v=>out.push(['set',v]));
    const viaSym=Observable.from({[Observable.observavle]:()=>Observable.of('sym')});viaSym.subscribe(v=>out.push(['sym',v]));
    return [out,s1.closed,typeof s2.subscribe,typeof s3.unsubscribe,err,s1.unsubscribe()===s1,s1.dispose()===s1];
  },'basics',withEmitter);
});

test('Observable: hot sharing, filter/map on subscriptions, errors, cleanup, disconnect', async()=>{
  await compare('Observable',O,obsWorld,({Observable})=>{
    const out=[];let emit;let cleanups=0;
    const hot=new Observable(o=>{emit=o;return ()=>{cleanups++;};});
    const a=hot.subscribe(v=>out.push(['a',v]));
    const b=hot.subscribe(v=>out.push(['b',v])).filter(v=>v%2===0).map(v=>v+100);
    emit.next(1);emit.next(2);
    a.unsubscribe();emit.next(4);
    b.unsubscribe();
    const r1=[hot.closed,cleanups];
    const failing=new Observable(o=>{o.error('bad');});
    failing.subscribe(null,e=>out.push(['err',e]));
    const thrower=new Observable(()=>{throw Error('producer');});
    thrower.subscribe(null,e=>out.push(['thrown',e.message]));
    const sync=new Observable(o=>{o.complete('now');return {unsubscribe:()=>out.push(['unsub-cleanup'])};});
    sync.subscribe({complete:v=>out.push(['sync-done',v])});
    const later=new Observable(o=>{o.next('first');return ()=>{throw Error('cleanup fails');};});
    later.subscribe(v=>out.push(['later',v]));later.disconnect();
    const nop=Observable.of(1).subscribe();
    return [out,r1,nop.closed,later.closed];
  },'hot',withEmitter);
});

test('Observable: fromEvent caching, interval, forEach, WindowResizeObserver', async()=>{
  await compare('Observable',O,obsWorld,async({Observable,WindowResizeObserver},w)=>{
    const out=[];
    const target={l:new Map(),addEventListener(n,f,o){w.log.push(['t.add',n,o]);this.l.set(n,f);},
      removeEventListener(n){w.log.push(['t.remove',n]);this.l.delete(n);}};
    const e1=Observable.fromEvent(target,'click'),e2=Observable.fromEvent(target,'click');
    const sub=e1.subscribe(ev=>out.push(['click',ev.x]));
    target.l.get('click')({x:3});sub.unsubscribe();
    const iv=Observable.interval(50);const isub=iv.subscribe(v=>out.push(['tick',v]));
    for(const f of w.timers.values()){f();f();}
    isub.unsubscribe();
    const promises=[];const src=new Observable(o=>{src.o=o;});
    src.forEach(p=>promises.push(p));
    src.o.next('n1');src.o.error('e1');
    const settled=await Promise.all(promises.slice(0,2).map(p=>p.then(v=>['ok',v],e=>['ng',e])));
    WindowResizeObserver.subscribe(v=>out.push(['resize',v]));
    w.listeners.get('resize')({});
    return [out,e1===e2,settled,typeof WindowResizeObserver.unsubscribe];
  },'events',withEmitter);
});
