// Task471: MylistApiLoader parity — read, write, 409 reorder, CSRF token, events.
// Pre-migration fixture vs generated runtime on identical scripted fakes (no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.MylistApiLoader;
const before=read(spec.fixture),after=read(spec.runtime);
const tick=()=>new Promise(r=>setTimeout(r,15));

function globalsFor(scenario){
  const log=[];
  // Clone per run: the loader merges pages into the first response object in place,
  // so sharing bodies between old/new runs would leak mutations across them.
  const queue=structuredClone(scenario.responses||[]);
  const store=new Map(Object.entries(structuredClone(scenario.cached||{})));
  class CacheStorage{
    constructor(s){log.push(['cache:new',s&&s.kind]);}
    getItem(k){log.push(['cache:get',k]);return store.get(k);}
    setItem(k,v,e){log.push(['cache:set',k,v,e]);store.set(k,v);}
    removeItem(k){log.push(['cache:remove',k]);store.delete(k);}
  }
  const listeners={};
  const emitter={
    on(name,cb){log.push(['on',name]);listeners[name]=cb;},
    emitAsync(...args){log.push(['emit',...args]);}
  };
  const netUtil={fetch:(url,opts)=>{
    log.push(['fetch',url,opts]);
    const next=queue.length?queue.shift():{fail:'exhausted'};
    if(next.fail)return Promise.reject(Object.assign(Error(next.fail),{tag:next.fail}));
    return Promise.resolve({
      json:async()=>{if(next.jsonFail)throw SyntaxError('bad json');return next.body;},
      text:async()=>next.text
    });
  }};
  class DOMParser{
    parseFromString(html,type){
      log.push(['parse',html,type]);
      return {querySelector:sel=>{log.push(['query',sel]);
        return scenario.noTokenElement?null:{getAttribute:n=>{log.push(['attr',n]);return scenario.env;}};}};
    }
  }
  const globals={
    netUtil,CacheStorage,emitter,DOMParser,
    sessionStorage:{kind:'session'},
    window:{ZenzaWatch:scenario.zenza?{}:null},
    console:{log:(...a)=>{log.push(['log',...a]);}},
    URLSearchParams,Error,JSON,encodeURIComponent,String,parseInt,Promise,Object
  };
  return {globals,log,listeners};
}

async function compare(label,steps,scenario={}){
  const a=globalsFor(scenario),b=globalsFor(scenario);
  const sa=loadLegacy(before,'MylistApiLoader',a.globals);
  const sb=loadLegacy(after,'MylistApiLoader',b.globals);
  for(const [i,step] of steps.entries()){
    const ra=await settle(()=>step(sa,a)),rb=await settle(()=>step(sb,b));
    assert.deepEqual(snapshot(rb),snapshot(ra),`${label} step ${i}`);
  }
  await tick(); // fire-and-forget removals (addMylistItem) settle before comparing effects
  assert.deepEqual(snapshot(b.log),snapshot(a.log),label+' side effects');
}

const ok=(extra={})=>({body:{meta:{status:200},...extra}});
const page=(key,items,hasNext,hidden=false)=>({body:{meta:{status:200},data:{[key]:{items,hasNext,hasInvisibleItems:hidden}}}});
const item=(watchId,itemId)=>({watchId,itemId});

test('reads: list cache, pagination, not-found and failure metadata',async()=>{
  await compare('mylist list + cache',[l=>l.getMylistList(),l=>l.getMylistList()],
    {responses:[ok({data:{mylists:[{id:1}]}})]});
  await compare('mylist list meta 500',[l=>l.getMylistList({frontendId:7})],
    {responses:[{body:{meta:{status:500},data:{},error:{code:'E'},status:'x',message:'m'}}]});
  await compare('mylist list fetch fails',[l=>l.getMylistList()],{responses:[{fail:'offline'}]});
  await compare('watch-later pagination',[l=>l._getDeflistItems()],
    {responses:[page('watchLater',[item('sm1',1)],true),page('watchLater',[item('sm2',2)],false,true)]});
  await compare('mylist items 404',[l=>l._getMylistItems(7)],
    {responses:[{body:{meta:{status:404},data:{},error:{code:'NOT_FOUND'}}}]});
  await compare('mylist items json fails',[l=>l._getMylistItems(7,9,1)],{responses:[{jsonFail:true}]});
  await compare('find watch-later hit/miss',[l=>l.findDeflistItemByWatchId('sm2'),l=>l.findDeflistItemByWatchId('sm9')],
    {responses:[page('watchLater',[item('sm1',1),item('sm2',2)],false),page('watchLater',[],false)]});
  await compare('find mylist miss',[l=>l.findMylistItemByWatchId('sm9',3)],
    {responses:[page('mylist',[item('sm1',1)],false)]});
});

test('writes: remove/add for watch-later and mylist, including failures',async()=>{
  const wl=page('watchLater',[item('sm1',11)],false);
  await compare('remove watch-later ok',[l=>l.removeDeflistItem('sm1')],{responses:[wl,ok()]});
  await compare('remove watch-later 400',[l=>l.removeDeflistItem('sm1',{frontendId:1})],
    {responses:[wl,{body:{meta:{status:400},error:{description:'denied',code:'D'}}}]});
  await compare('remove watch-later fetch fails',[l=>l.removeDeflistItem('sm1')],{responses:[wl,{fail:'net'}]});
  await compare('remove mylist ok',[l=>l.removeMylistItem('sm1',5)],
    {responses:[page('mylist',[item('sm1',21)],false),ok()]});
  await compare('add watch-later 201 with memo',[l=>l.addDeflistItem('sm3','メモ & ok')],
    {responses:[{body:{meta:{status:201},data:{}}}]});
  await compare('add watch-later 409 -> move to top',[l=>l.addDeflistItem('sm1','')],
    {responses:[{body:{meta:{status:409},error:{code:'C'}}},wl,ok(),{body:{meta:{status:201}}}]});
  await compare('add watch-later 409 and removal fails (101)',[l=>l.addDeflistItem('sm9',null)],
    {responses:[{body:{meta:{status:409},error:{code:'C'}}},page('watchLater',[],false)]});
  await compare('add watch-later 409 on retry is an error',[l=>l.addDeflistItem('sm1','x',true)],
    {responses:[{body:{meta:{status:409},error:{description:'dup',code:'C'}}}]});
  await compare('add watch-later no status (100)',[l=>l.addDeflistItem('sm1')],{responses:[{body:{meta:{}}}]});
  await compare('add watch-later fetch fails (200)',[l=>l.addDeflistItem('sm1')],{responses:[{fail:'net'}]});
  await compare('add mylist ok + background watch-later removal',[l=>l.addMylistItem('sm1',5,'d')],
    {responses:[ok(),wl,ok()]});
  await compare('add mylist ok, background removal fails silently',[l=>l.addMylistItem('sm1',5)],
    {responses:[{body:{meta:{status:201}}},{fail:'net'}]});
  await compare('add mylist duplicate emits then throws',[l=>l.addMylistItem('sm1',5,'d')],
    {responses:[{body:{meta:{status:409},error:{description:'exists',code:'DUP'}}}]});
  await compare('add mylist no status (100)',[l=>l.addMylistItem('sm1',5)],{responses:[{body:{meta:{status:0}}}]});
});

test('CSRF token: cache, page scrape, failure and event wiring',async()=>{
  await compare('constructor reads cached token',[l=>l._getCsrfToken()],{cached:{csrfToken:'secret-not-logged'}});
  await compare('scrape token from mylist page',[l=>l._getCsrfToken()],
    {responses:[{text:'<html>'}],env:'{"csrfToken":"t1"}'});
  await compare('scrape fails',[l=>l._getCsrfToken()],{responses:[{fail:'net'}]});
  await compare('scrape page without element (TypeError)',[l=>l._getCsrfToken()],
    {responses:[{text:'<p>'}],noTokenElement:true});
  await compare('event + setCsrfToken',[(l,g)=>g.listeners.csrfTokenUpdate('t2'),l=>l.setCsrfToken('t3'),l=>l._getCsrfToken()],
    {zenza:true});
});
