const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
function setup(handler, brokenStorage=false) {
 const calls=[], cache=new Map();
 const fetch=async(url,options)=>{calls.push({url,options});return handler(new URL(url),options);};
 class Cache {getItem(k){if(brokenStorage)throw Error('storage');return cache.get(k);}setItem(k,v){if(brokenStorage)throw Error('storage');cache.set(k,v);}}
 class Gate {fetch(url,options){return fetch(url,options);}}
 const c=createContext({fetch,URL,URLSearchParams,AbortController,sessionStorage:{},CacheStorage:Cache,CrossDomainGate:Gate,console:{warn(){}}});
 run('globalThis.subject='+extract('packages/lib/src/nico/NicodicArticleLoader.js','NicodicArticleLoader','var')+';',c);
 return {s:c.subject,calls,cache};
}
const article=n=>({request_title:n,title:n.toLowerCase(),summary:'summary '+n});
const ok=a=>({ok:true,status:200,json:async()=>a});
describe('Task157 encyclopedia batch lookup',()=>{
 it('fetches ten tags in one GET and maps normalized titles to original tags',async()=>{
  const names=['VOCALOID','音楽','C++','A/B','a&b','東方','ゲーム','初音ミク','陰陽師','none'];
  const p=setup(()=>ok(names.slice(0,-1).map(article)));const out=[];
  await p.s.checkAll(names,(n,v,a)=>out.push([n,v,a]));
  assert.equal(p.calls.length,1);const u=new URL(p.calls[0].url);
  assert.equal(u.pathname,'/v1/articles/article');assert.deepEqual(u.searchParams.getAll('titles[]'),names);
  assert.equal(p.calls[0].options.credentials,'omit');assert.equal(out.length,10);
  assert.equal(out.find(x=>x[0]==='VOCALOID')[2].summary,'summary VOCALOID');assert.equal(out.find(x=>x[0]==='none')[1],false);
 });
 it('shares overlapping concurrent calls and caches both present and absent',async()=>{
  const p=setup(u=>ok(u.searchParams.getAll('titles[]').filter(n=>n!=='none').map(article)));
  const a=p.s.exists('音楽');const b=p.s.checkAll(['音楽','none','音楽'],()=>{});await Promise.all([a,b]);
  assert.equal(p.calls.length,1);assert.equal(await p.s.exists('none'),false);assert.equal(await p.s.exists('音楽'),true);assert.equal(p.calls.length,1);
 });
 it('splits more than ten distinct tags into bounded requests',async()=>{const p=setup(u=>ok(u.searchParams.getAll('titles[]').map(article)));await p.s.checkAll(Array.from({length:21},(_,i)=>'tag'+i),()=>{});assert.equal(p.calls.length,3);assert(p.calls.every(x=>new URL(x.url).searchParams.getAll('titles[]').length<=10));});
 it('does not cache HTTP failures as absent and allows retry',async()=>{let fail=true;const p=setup(()=>fail?{ok:false,status:429}:ok([article('音楽')]));assert.equal(await p.s.exists('音楽'),null);assert.equal(p.cache.size,0);fail=false;assert.equal(await p.s.exists('音楽'),true);});
 it('does not cache malformed JSON shapes or malformed entries',async()=>{for(const body of [{error:'fail'},[{}],[{request_title:'音楽'}]]){const p=setup(()=>ok(body));assert.equal(await p.s.exists('音楽'),null);assert.equal(p.cache.size,0);}});
 it('returns unknown after a network failure without per-tag fallback',async()=>{const p=setup(()=>{throw Error('offline');});assert.equal(await p.s.exists('音楽'),null);assert.equal(p.calls.length,1);});
 it('ignores invalid names and handles empty input without requests',async()=>{const p=setup(()=>ok([]));await p.s.checkAll(['',null,42],()=>{});assert.equal(p.calls.length,0);assert.equal(await p.s.exists(null),null);});
 it('still resolves results when storage is unavailable',async()=>{const p=setup(()=>ok([article('音楽')]),true);assert.equal(await p.s.exists('音楽'),true);});
});
