// Task466: NicodicArticleLoader old/new offline behavior parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.NicodicArticleLoader;
const before=read(spec.fixture),after=read(spec.runtime);

function globalsFor(scenario={}){
  const log=[],cache=new Map(Object.entries(scenario.seed||{}));
  let requestCount=0,timerCount=0;
  const fetch=async (url,opts)=>{
    log.push(['fetch',url,opts]);
    requestCount++;
    if(scenario.fetchReject)throw Error('offline');
    const names=new URL(url).searchParams.getAll('titles[]');
    return {
      ok:!scenario.status,
      status:scenario.status||200,
      json:async()=>{
        if(scenario.jsonReject)throw SyntaxError('bad JSON');
        return scenario.body?scenario.body(names,requestCount):
          names.filter(n=>n!=='missing').map(n=>({request_title:n,title:'ARTICLE '+n,summary:'summary'}));
      }
    };
  };
  class CacheStorage{
    constructor(storage){log.push(['cache:new',storage.kind]);}
    getItem(key){
      log.push(['cache:get',key]);
      if(scenario.cacheThrows)throw Error('cache fail');
      return cache.get(key);
    }
    setItem(key,val,ttl){
      log.push(['cache:set',key,val,ttl]);
      if(scenario.cacheThrows)throw Error('cache fail');
      cache.set(key,val);
    }
  }
  class AbortController{
    constructor(){this.signal={aborted:false};}
    abort(){this.signal.aborted=true;}
  }
  const setTimeout=(fn,ms)=>{log.push(['timeout',ms]);return ++timerCount;};
  const clearTimeout=id=>{log.push(['clearTimeout',id]);};
  const globals={
    fetch,CacheStorage,AbortController,setTimeout,clearTimeout,
    sessionStorage:{kind:'session'},window:{console:{warn:(...args)=>log.push(['warn',...args])}},
    URLSearchParams,Promise,Map,Set,Array,Object,Error
  };
  return {globals,log,cache};
}

async function parity(label,scenario,steps){
  const l=globalsFor(scenario),r=globalsFor(scenario);
  const old=loadLegacy(before,'NicodicArticleLoader',l.globals);
  const now=loadLegacy(after,'NicodicArticleLoader',r.globals);
  for(const [i,step] of steps.entries()){
    const expected=await settle(()=>step(old,l));
    const actual=await settle(()=>step(now,r));
    assert.deepEqual(snapshot(actual),snapshot(expected),label+' step '+i);
  }
  assert.deepEqual(snapshot(r.log),snapshot(l.log),label+' side effects');
  return l.log.filter(row=>row[0]==='fetch').length;
}
const exists=name=>(api)=>api.exists(name);
const report=names=>(api,state)=>api.checkAll(names,
  (name,value,article)=>state.log.push(['onResult',name,value,article]));

test('NicodicArticleLoader: cache, in-flight coalescing, missing titles, and batch boundaries',async()=>{
  assert.equal(await parity('known/unknown/cache',{ },[
    report(['VOCALOID','missing','C++']),exists('VOCALOID'),exists('missing'),
    report(['VOCALOID','missing']),exists(null),exists('')
  ]),1);
  assert.equal(await parity('22 requested, serial batches',{ },[
    report(Array.from({length:22},(_,i)=>'key'+i))
  ]),3);
  assert.equal(await parity('invalid and duplicate names',{ },[
    report(['A','A',null,undefined,0,'','B',false]),exists('A'),exists('B')
  ]),1);
  assert.equal(await parity('same name in-flight',{ },[
    api=>Promise.all([api.exists('A'),api.exists('A'),api.exists('A')])
  ]),1);
});

test('NicodicArticleLoader: cache resilience and error paths match pre-migration runtime',async()=>{
  assert.equal(await parity('cached state is authoritative',{
    seed:{'nicodicBatch: A':{exists:true,article:{request_title:'A',title:'cached'}}}
  },[exists('A'),report(['A'])]),0);
  assert.equal(await parity('cache unavailable',{cacheThrows:true},[exists('A'),exists('A')]),2);
  assert.equal(await parity('HTTP error',{status:503},[exists('A'),exists('A')]),2);
  assert.equal(await parity('network reject',{fetchReject:true},[report(['A']),exists('A')]),2);
  assert.equal(await parity('JSON reject',{jsonReject:true},[exists('A')]),1);
  assert.equal(await parity('not an array',{body:()=>({error:1})},[exists('A')]),1);
  assert.equal(await parity('missing title',{body:()=>[{request_title:'A'}]},[exists('A')]),1);
  assert.equal(await parity('missing request title',{body:()=>[{title:'A'}]},[exists('A')]),1);
  assert.equal(await parity('empty batch result',{body:()=>[]},[report(['A','B'])]),1);
});
