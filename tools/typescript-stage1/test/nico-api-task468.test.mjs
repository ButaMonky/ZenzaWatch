// Task468: AdDecorationLoader old/new parity with offline bulk-ad responses.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico, read, loadLegacy, snapshot, settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.AdDecorationLoader;
const before=read(spec.fixture), after=read(spec.runtime);

function makeGlobals(scenario={}) {
  const log=[];
  let calls=0,active=0,maxActive=0;
  const netUtil={fetch:async (url, opts)=>{
    const seq=++calls;
    log.push(['fetch',url,opts]);
    active++;
    maxActive=Math.max(maxActive,active);
    await Promise.resolve();
    active--;
    if(scenario.failAt===seq)throw Error('offline');
    const status=scenario.status??200;
    return {
      ok:status===200,status,
      json:async()=>{
        if(scenario.jsonFails)throw SyntaxError('malformed');
        const ids=url.split('?ids=')[1].split(',');
        return scenario.body??{meta:{status:200},data:{contents:ids
          .filter((_,i)=>i%2===0).map(id=>({id,decoration:'gold'}))}};
      }
    };
  }};
  const window={console:{warn:(...args)=>log.push(['warn',...args])}};
  return {globals:{netUtil,window,Map,Set,String,Array,Promise},log,stats:()=>({calls,maxActive})};
}
function normalized(settled){
  if(!settled.ok)return snapshot(settled);
  if(settled.value instanceof Map ||
     (settled.value&&typeof settled.value.entries==='function'&&typeof settled.value.get==='function')){
    return {ok:true,entries:snapshot(Array.from(settled.value.entries()))};
  }
  return snapshot(settled);
}
async function parity(label,scenario,run) {
  const a=makeGlobals(scenario),b=makeGlobals(scenario);
  const old=loadLegacy(before,'AdDecorationLoader',a.globals);
  const migrated=loadLegacy(after,'AdDecorationLoader',b.globals);
  const oa=await settle(()=>run(old,a.log)),ob=await settle(()=>run(migrated,b.log));
  assert.deepEqual(normalized(ob),normalized(oa),label+' return');
  assert.deepEqual(snapshot(b.log),snapshot(a.log),label+' effects');
  assert.deepEqual(b.stats(),a.stats(),label+' concurrency');
  return {old:oa,stats:a.stats(),logs:a.log};
}
test('AdDecorationLoader: request options, dedup, blank input, missing ids and uncached loads',async()=>{
  const r=await parity('dedup',{},a=>a.load(['sm1','sm1','', 'sm2']));
  assert.equal(r.stats.calls,1);
  assert.deepEqual(Array.from(r.old.value.entries()),[['sm1','gold'],['sm2','normal']]);
  await parity('empty',{},a=>a.load([]));
  await parity('null',{},a=>a.load(null));
  await parity('no response contents',{body:{data:{}}},a=>a.load(['sm1']));
  await parity('fresh progress',{},(a,log)=>a.loadFresh(['sm1','sm2'],p=>log.push(['progress',p])));
  const repeated=await parity('two calls',{},async a=>{
    const first=await a.load(['sm1']);
    const second=await a.load(['sm1']);
    return [Array.from(first),Array.from(second)];
  });
  assert.equal(repeated.stats.calls,2);
});
test('AdDecorationLoader: failed chunks are omitted, warnings & callback errors match',async()=>{
  await parity('HTTP 500',{status:500},(a,log)=>a.loadFresh(['sm1'],p=>log.push(['progress',p])));
  await parity('network',{failAt:1},a=>a.load(['sm1']));
  await parity('bad JSON',{jsonFails:true},a=>a.load(['sm1']));
  await parity('contents is not an array',{body:{data:{contents:'bad'}}},a=>a.load(['sm1']));
  await parity('callback throws',{},a=>a.loadFresh(['sm1'],()=>{throw Error('progress');}));
});
test('AdDecorationLoader: 100-ID chunks, 2000-char URL and max three concurrent calls',async()=>{
  const ids=Array.from({length:251},(_,i)=>'sm'+(1000+i));
  const r=await parity('251',{},(a,log)=>a.loadFresh(ids,p=>log.push(['progress',p])));
  assert.equal(r.stats.calls,3);
  assert.equal(r.stats.maxActive,3);
  const urls=r.logs.filter(x=>x[0]==='fetch').map(x=>x[1]);
  assert.equal(urls.every(url=>url.length<=2000),true);
  assert.equal(urls.every(url=>url.split('?ids=')[1].split(',').length<=100),true);
  const long=Array.from({length:50},(_,i)=>'sm'+String(i).padStart(80,'0'));
  const split=await parity('long IDs',{},a=>a.load(long));
  assert.equal(split.stats.calls>1,true);
});
test('AdDecorationLoader: a failed middle chunk stays absent and can be retried',async()=>{
  const ids=Array.from({length:205},(_,i)=>'sm'+i);
  const r=await parity('middle failure',{failAt:2},a=>a.load(ids));
  assert.equal(r.stats.calls,3);
  assert.equal(r.old.value.has('sm100'),false);
  assert.equal(r.old.value.has('sm200'),true);
});
