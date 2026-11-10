// Task642: StoryboardCacheDb parity — open sharing/retry, www vs bridge, payload guard, GC.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.StoryboardCacheDb;
const before=read(spec.fixture),after=read(spec.runtime);
const tick=(ms=5)=>new Promise(r=>setTimeout(r,ms));

function world(opt={}){
  const log=[];const L=(...a)=>log.push(snapshot(a));
  const rows=new Map(Object.entries(opt.rows||{}));
  let opens=0;
  const store={
    storyboardCache:async data=>{
      if(data.op==='stats')return store.gc(7*24*60*60*1000);
      if(data.op==='get')return store.updateTime({key:data.key});
      if(data.op==='put'){await store.put(data.record);return data.record;}
      throw Error('unexpected storyboard operation');
    },
    put:async r=>{L('put',r);if(opt.putFails)throw Error('quota');rows.set(r.watchId,r);return 'k';},
    updateTime:async q=>{L('updateTime',q);return rows.has(q.key)?rows.get(q.key):opt.missValue;},
    delete:async q=>{L('delete',q);rows.delete(q.key);return 'deleted';},
    close:async()=>{L('close');return 'closed';},
    gc:async e=>{L('gc',e);if(opt.gcFails)throw Error('gc');return 'gc-ok';}
  };
  const connect=async(kind,def)=>{
    L(kind,def);opens++;
    await new Promise(r=>setTimeout(r,2));
    if(opt.openFailsTimes&&opens<=opt.openFailsTimes)throw Object.assign(Error('blocked'),{tag:opens});
    return opt.noCacheStore?{}:{cache:store};
  };
  const IndexedDbStorage={open:def=>connect('idb.open',def)};
  const bridge={bridgeDb:def=>connect('bridgeDb',def)};
  const globals={IndexedDbStorage,location:{host:opt.host||'www.nicovideo.jp'},
    console:{warn:(...a)=>{L('warn',...a);}},Date:{now:()=>5000},Promise,Object,Error};
  return {globals,log,bridge};
}
async function compare(label,run,opt={}){
  const a=world(opt),b=world(opt);
  const A=loadLegacy(before,'StoryboardCacheDb',a.globals),B=loadLegacy(after,'StoryboardCacheDb',b.globals);
  const ra=await settle(()=>run(A,a)),rb=await settle(()=>run(B,b));
  await tick();
  assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
  assert.deepEqual(b.log,a.log,label+' side effects');
}
const all=ps=>Promise.all(ps.map(p=>p.then(v=>({ok:v}),e=>({err:e}))));

test('www: open once, initial 7-day GC, put/get/delete/close/gc',async()=>{
  await compare('round trip',async d=>[
    await d.put('sm9',{status:'ok',storyboards:[1]}),
    await d.get('sm9'),
    await d.get('sm1'),
    await d.delete('sm9'),
    await d.get('sm9'),
    await d.gc(),
    await d.gc(60000),
    await d.close()
  ]);
  await compare('facade identity and db snapshot',async d=>{
    const f1=await d.open(),f2=await d.open();
    return [f1===f2,d.db,typeof d.initWorker,(await d.initWorker())===(await d.initWorker())];
  });
  await compare('falsy and shapeless records',async d=>[await d.get('zero'),await d.get('nosb'),await d.get('missing')],
    {rows:{zero:0,nosb:{watchId:'nosb'}},missValue:''});
});

test('payload guard: only status ok objects are stored',async()=>{
  await compare('rejected payloads',async d=>[
    await d.put('a'),await d.put('b',null),await d.put('c','ok'),await d.put('d',{status:'fail'}),
    await d.put('e',{status:'OK'}),await d.put('f',[]),await d.put('g',{status:'ok'})
  ]);
  // Task996: image persistence is best-effort; the attempted transaction still runs.
  const w=world({putFails:true}),d=loadLegacy(after,'StoryboardCacheDb',w.globals);
  assert.equal(await d.put('sm9',{status:'ok'}),undefined);
  assert.equal(w.log.filter(row=>row[0]==='put').length,1);
});

test('concurrent opens share one connection; failures can be retried',async()=>{
  // Facades/connections hold functions (not comparable across realms): compare their keys.
  await compare('concurrent',d=>all([d.get('x'),d.put('y',{status:'ok'}),d.open().then(f=>Object.keys(f)),
    d.initWorker().then(c=>Object.keys(c))]));
  const w=world({openFailsTimes:1,rows:{x:{sbInfo:{status:'ok'}}}}),d=loadLegacy(after,'StoryboardCacheDb',w.globals);
  assert.deepEqual(await Promise.all([d.get('x'),d.get('y')]),[null,null]);
  assert.equal((await d.get('x')).status,'ok');
  assert.equal(w.log.filter(row=>row[0]==='idb.open').length,2,'failed single-flight must be released');
  const missing=world({noCacheStore:true});
  assert.equal(await loadLegacy(after,'StoryboardCacheDb',missing.globals).put('sm9',{status:'ok'}),undefined);
  await compare('initial GC failure only warns',async d=>{await d.open();await tick();return d.get('a');},{gcFails:true});
});

test('other hosts use the injected bridge',async()=>{
  await compare('bridge',async(d,w)=>{
    const r=d.api(w.bridge);
    return [r===w.bridge,await d.put('sm9',{status:'ok'}),await d.get('sm9')];
  },{host:'live.nicovideo.jp'});
  const unavailable=world({host:'live.nicovideo.jp'});
  assert.equal(await loadLegacy(after,'StoryboardCacheDb',unavailable.globals).get('sm9'),null);
});
