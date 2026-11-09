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
    if(label.startsWith('add watch-later 409 ')&&!label.includes('on retry')){
      assert.equal(rb.ok,true,label+' safe duplicate');
      assert.match(rb.value.message,/登録済み/);
    }else if(label==='mylist items 404'||label==='mylist items json fails'){
      // #241 keeps failure/cause but drops private response bodies.
      const expected=snapshot(ra);
      delete expected.error.result;
      expected.error.$message=expected.error.$message.replace('\u53d6\u5f97','\u306e\u53d6\u5f97');
      assert.equal(rb.ok,false);assert.equal(rb.error.status,'fail');
      assert.equal(Object.hasOwn(rb.error,'result'),false);
      if(label==='mylist items 404')assert.equal(rb.error.code,'NOT_FOUND');
      else assert.equal(rb.error.cause.name,'SyntaxError');
      assert.deepEqual(snapshot(rb),expected,`${label} bounded-reader contract`);
    }else assert.deepEqual(snapshot(rb),snapshot(ra),`${label} step ${i}`);
  }
  await tick(); // fire-and-forget removals (addMylistItem) settle before comparing effects
  // #261: auth token / private list caching is intentionally removed. Compare
  // retained network and event contracts, not unsafe legacy storage accesses.
  const withoutPrivateStorage = log=>snapshot(log).filter(row=>
    !(row[0]?.startsWith('cache:') && ['csrfToken','mylistList'].includes(row[1])));
  const oldLog = withoutPrivateStorage(a.log), newLog = withoutPrivateStorage(b.log);
  if(label==='remove watch-later 400'){
    // #241 lookup and DELETE use the caller's same frontend identity.
    const fetches=newLog.filter(row=>row[0]==='fetch');assert.equal(fetches.length,2);
    for(const row of fetches){assert.equal(row[2].headers['X-Frontend-Id'],1);assert.equal(row[2].headers['X-Frontend-Version'],0);}
    oldLog.find(row=>row[0]==='fetch')[2].headers['X-Frontend-Id']=1;
  }

  const event = row => Array.isArray(row) && row[0] === 'emit' && row[1] === 'mylistAdd';
  const isSuccess = label.startsWith('add mylist ok');
  const isRejected = label === 'add mylist duplicate emits then throws';
  if (isSuccess || isRejected) {
    // AUD #251 intentionally reverses the old incorrect notification behavior:
    // 201 success emits exactly once; 409 rejection emits nothing.
    assert.equal(oldLog.filter(event).length, isRejected ? 1 : 0, label+' legacy baseline');
    assert.equal(newLog.filter(event).length, isSuccess ? 1 : 0, label+' corrected notification');
    if (isSuccess) {
      assert.equal(newLog.filter(event)[0][2], 'sm1');
      assert.equal(newLog.filter(event)[0][3], 5);
    }
    assert.deepEqual(newLog.filter(row => !event(row)), oldLog.filter(row => !event(row)),
      label+' other side effects unchanged');
  }else if(label.startsWith('add watch-later 409 ')&&!label.includes('on retry')){
    const fetches=newLog.filter(row=>row[0]==='fetch');
    assert.equal(fetches.length,1,label+' avoids remove+reinsert');
    assert.equal(fetches[0][2].method,'POST');
    assert.equal(newLog.filter(row=>row[0]==='emit'&&row[1]==='deflistRemove').length,0);
  }else{
    assert.deepEqual(newLog,oldLog,label+' side effects');
  }
}

const ok=(extra={})=>({body:{meta:{status:200},...extra}});
const page=(key,items,hasNext,hidden=false)=>({body:{meta:{status:200},data:{[key]:{items,hasNext,hasInvisibleItems:hidden}}}});
const item=(watchId,itemId)=>({watchId,itemId});

test('reads: list cache, pagination, not-found and failure metadata',async()=>{
  // #261 private list cache behavior is verified separately below.
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

test('#261: cached CSRF token from account A is not used after switching to B',async()=>{
  const w=globalsFor({
    cached:{csrfToken:'TEST_A',mylistList:[{id:'from-A'}]},
    responses:[{text:'<html>login B</html>'},{text:'<html>login B</html>'}],
    env:'{"csrfToken":"TEST_B"}',zenza:true
  });
  const loader=loadLegacy(after,'MylistApiLoader',w.globals);
  assert.equal(await loader._getCsrfToken(),'TEST_B');
  w.listeners.csrfTokenUpdate('TEST_A');
  loader.setCsrfToken('TEST_A');
  assert.equal(await loader._getCsrfToken(),'TEST_B','even a stale event cannot override current page auth');
  assert.equal(w.log.filter(row=>row[0]==='fetch').length,2);
  assert.equal(w.log.filter(row=>row[0]==='cache:set' && row[1]==='csrfToken').length,0);
  assert.equal(w.log.filter(row=>row[0]==='cache:get' && row[1]==='csrfToken').length,0);
});
test('#261: malformed/unavailable CSRF source fails closed',async()=>{
  const missing=globalsFor({responses:[{text:'<p>'}],noTokenElement:true,cached:{csrfToken:'TEST_A'}});
  const fail=loadLegacy(after,'MylistApiLoader',missing.globals);
  const result=await settle(()=>fail._getCsrfToken());
  assert.equal(result.ok,false);
  assert.match(String(result.error?.message),/トークン取得失敗/);
  const offline=globalsFor({responses:[{fail:'offline'}]});
  const result2=await settle(()=>loadLegacy(after,'MylistApiLoader',offline.globals)._getCsrfToken());
  assert.equal(result2.ok,false);
});
test('#261: /users/me/mylists never reads previous owner private cache',async()=>{
  const w=globalsFor({
    cached:{mylistList:[{id:'account-A'}]},
    responses:[ok({data:{mylists:[{id:'account-B'}]}}),ok({data:{mylists:[{id:'account-B-new'}]}})]
  });
  const loader=loadLegacy(after,'MylistApiLoader',w.globals);
  assert.deepEqual(snapshot(await loader.getMylistList()),[{id:'account-B'}]);
  assert.deepEqual(snapshot(await loader.getMylistList()),[{id:'account-B-new'}]);
  assert.equal(w.log.filter(row=>row[0]==='fetch').length,2);
  assert.equal(w.log.filter(row=>row[0]==='cache:get' && row[1]==='mylistList').length,0);
});
