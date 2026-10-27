// Task463: TagSuggestLoader / PlaylistApiLoader parity (stateful sequences).
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const pair=name=>[read(NICO_API_BY_NAME[name].fixture),read(NICO_API_BY_NAME[name].runtime)];

/** Run the same call sequence on fresh old/new instances; compare every step and side effect. */
async function compareSequences(name,makeGlobals,cases){
  const [before,after]=pair(name);
  for(const [label,steps,scenario] of cases){
    const a=makeGlobals(scenario),b=makeGlobals(scenario);
    const sa=loadLegacy(before,name,a.globals),sb=loadLegacy(after,name,b.globals);
    for(const [i,step] of steps.entries()){
      const ra=await settle(()=>step(sa)),rb=await settle(()=>step(sb));
      assert.deepEqual(snapshot(rb),snapshot(ra),`${label} step ${i}`);
    }
    assert.deepEqual(snapshot(b.log),snapshot(a.log),label+' side effects');
  }
  return cases.length;
}

// ---------- TagSuggestLoader ----------
function suggestGlobals(scenario){
  const log=[];
  const respond=(url,opts)=>{
    log.push(['fetch',url,opts]);
    if(scenario.fail)return Promise.reject(Error('offline'));
    return Promise.resolve({json:async()=>{
      if(scenario.jsonFails)throw SyntaxError('bad');
      return typeof scenario.body==='function'?scenario.body(url):scenario.body;
    }});
  };
  const globals={encodeURIComponent,Map,Array,Promise};
  if(scenario.noNetUtil)globals.fetch=respond;else globals.netUtil={fetch:respond};
  return {globals,log};
}
test('TagSuggestLoader: trimming, cache, validation, eviction and fallback fetch',async()=>{
  const body={candidates:['東方神起',1,null,'東方MMD']};
  const word=s=>a=>a.load(s);
  const many=Array.from({length:302},(_,i)=>word('w'+i));
  const n=await compareSequences('TagSuggestLoader',suggestGlobals,[
    ['trim + cache hit',[word('  東方 '),word('東方'),word('東方 ')],{body}],
    ['empty/null/undefined skip network',[word(''),word('   '),word(null),word(undefined)],{body}],
    ['non-object body',[word('a')],{body:'x'}],
    ['candidates not array',[word('a')],{body:{candidates:'x'}}],
    ['null body',[word('a')],{body:null}],
    ['fetch fails (not cached)',[word('a'),word('a')],{fail:true}],
    ['json fails',[word('a')],{jsonFails:true}],
    ['eviction after 300 entries',[...many,word('w0'),word('w301')],{body:u=>({candidates:[u.slice(-4)]})}],
    ['fallback to global fetch',[word('b'),word('b')],{body,noNetUtil:true}]
  ]);
  assert.equal(n,9);
});

// ---------- PlaylistApiLoader ----------
function playlistGlobals(scenario){
  const log=[];
  const store=new Map(Object.entries(scenario.cached||{}));
  class CacheStorage{
    constructor(storage){log.push(['cache:new',storage&&storage.kind]);}
    getItem(key){log.push(['cache:get',key]);return store.get(key);}
    setItem(key,value,expire){log.push(['cache:set',key,value,expire]);store.set(key,value);}
  }
  const netUtil={fetch:(url,opts)=>{
    log.push(['fetch',url,opts]);
    if(scenario.fail)return Promise.reject(Object.assign(Error('offline'),{code:1}));
    return Promise.resolve({json:async()=>{
      if(scenario.jsonFails)throw SyntaxError('bad');
      return scenario.body;
    }});
  }};
  return {globals:{CacheStorage,netUtil,sessionStorage:{kind:'session'},URLSearchParams,Object,Error,Promise},log};
}
const items=[{watchId:'sm9'}];
const ok={body:{meta:{status:200},data:{items}}};
// Task972: legacy parity is for the retained single-page API; full collections
// are exercised by Task972PlaylistPaginationTest against real generated runtime.
const load=(req,fe)=>a=>a.load({...req,all:false},fe);
test('PlaylistApiLoader: URLs per type, cache keys, headers and failure codes (1/2/3)',async()=>{
  const n=await compareSequences('PlaylistApiLoader',playlistGlobals,[
    ['series + cache reuse',[load({type:'series',id:'123'}),load({type:'series',id:'123'})],ok],
    ['user-uploaded with numeric options',[load({type:'user-uploaded',id:1,options:{page:2,pageSize:100}})],ok],
    ['mylist sort override',[load({type:'mylist',id:'77',options:{sortOrder:'desc'}})],ok],
    ['watchlater default',[load({type:'watchlater'})],ok],
    ['search keyword',[load({type:'search',options:{keyword:'東方 MMD'}})],ok],
    ['custom frontend headers',[load({type:'series',id:1},{frontendId:70,frontendVersion:2})],ok],
    ['unknown type -> (3)',[load({type:'nope'})],ok],
    ['preloaded cache skips fetch',[load({type:'series',id:'5'})],
      {...ok,cached:{'playlist; https://nvapi.nicovideo.jp/v1/playlist/series/5':['cached']}}],
    ['meta 404 -> (1)',[load({type:'series',id:1})],{body:{meta:{status:404},data:{items}}}],
    ['items null -> (1)',[load({type:'series',id:1})],{body:{meta:{status:200},data:{items:null}}}],
    ['empty items array is success',[load({type:'series',id:1})],{body:{meta:{status:200},data:{items:[]}}}],
    ['error body cause is forwarded',[load({type:'series',id:1})],{body:{meta:{status:500},data:{},cause:'srv'}}],
    ['data missing -> TypeError',[load({type:'series',id:1})],{body:{meta:{status:200}}}],
    ['json fails -> (2)',[load({type:'series',id:1})],{jsonFails:true}],
    ['fetch fails -> (2)',[load({type:'series',id:1})],{fail:true}]
  ]);
  assert.equal(n,15);
});
