// Task640: netUtil parity — abortable fetch, host delegation, ajax and JSONP.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.netUtil;
const before=read(spec.fixture),after=read(spec.runtime);
const tick=(ms=5)=>new Promise(r=>setTimeout(r,ms));

function world(opt={}){
  const log=[];const L=(...a)=>log.push(snapshot(a));
  const timers=[];
  const fakeSetTimeout=(fn,ms)=>{L('setTimeout',ms);const id=setTimeout(fn,opt.fireTimers?1:100000);timers.push(id);return id;};
  const fakeClearTimeout=id=>{L('clearTimeout');clearTimeout(id);};
  const fetch=(url,options)=>{
    const {signal,...rest}=options||{};
    L('fetch',url,rest,signal?{aborted:signal.aborted}:null);
    if(opt.fetchFails)return Promise.reject(Object.assign(Error('offline'),{tag:'net'}));
    if(opt.hang){
      return new Promise((resolve,reject)=>{
        signal&&signal.addEventListener('abort',()=>{L('fetch-saw-abort',snapshot(signal.reason));});
      });
    }
    return Promise.resolve({status:200,tag:'response'});
  };
  const NicoVideoApi={ajax:p=>{L('gate.ajax',p);return 'gate-ajax';},fetch:(u,p)=>{L('gate.fetch',u,p);return Promise.resolve({tag:'gate'});}};
  const $={ajax:p=>{L('$.ajax',p);return 'jq-ajax';}};
  // JSONP fakes: an iframe whose window records the callback and can be invoked by the test.
  const frameWin={
    document:{createElement:t=>({tag:t,remove(){L('script.remove');},set src(v){L('script.src',v);}}),head:{append:s=>L('head.append',s.tag)}},
    setTimeout:fakeSetTimeout,clearTimeout:fakeClearTimeout
  };
  const document={
    createElement:t=>{
      const el={tag:t,style:{},set srcdoc(v){L('srcdoc',v);},set sandbox(v){L('sandbox',v);}};
      return el;
    },
    body:{append:el=>{L('body.append',el.tag,el.style);el.contentWindow=frameWin;queueMicrotask(()=>el.onload());}},
    documentElement:null
  };
  const globals={fetch,NicoVideoApi,$,document,
    location:{host:opt.host||'www.nicovideo.jp'},
    AbortController:opt.noAbortController?undefined:AbortController,
    setTimeout:fakeSetTimeout,clearTimeout:fakeClearTimeout,
    Promise,Object,Error,isNaN};
  return {globals,log,frameWin,timers};
}
async function compare(label,run,opt={}){
  const a=world(opt),b=world(opt);
  const A=loadLegacy(before,'netUtil',a.globals),B=loadLegacy(after,'netUtil',b.globals);
  const ra=await settle(()=>run(A,a)),rb=await settle(()=>run(B,b));
  await tick();
  assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
  assert.deepEqual(b.log,a.log,label+' side effects');
  for(const id of [...a.timers,...b.timers])clearTimeout(id);
}

test('abortableFetch: success, failure, timeout and caller abort',async()=>{
  await compare('success default timeout',u=>u.abortableFetch('https://a/x',{credentials:'include',headers:{'X-Frontend-Id':6}}));
  await compare('null params',u=>u.abortableFetch('https://a/x',null));
  await compare('no params',u=>u.abortableFetch('https://a/x'));
  await compare('fetch rejects',u=>u.abortableFetch('https://a/x',{timeout:500}),{fetchFails:true});
  await compare('timeout fires',u=>u.abortableFetch('https://a/x',{timeout:50}),{hang:true,fireTimers:true});
  await compare('timeout 0 disables timer',u=>u.abortableFetch('https://a/x',{timeout:0}));
  await compare('NaN timeout falls back to 30s',u=>u.abortableFetch('https://a/x',{timeout:NaN}));
  await compare('already aborted with reason',u=>{const c=new AbortController();c.abort(Object.assign(Error('closed'),{name:'Closed'}));return u.abortableFetch('https://a/x',{signal:c.signal});});
  await compare('already aborted without reason',u=>{const c=new AbortController();c.abort();return u.abortableFetch('https://a/x',{signal:c.signal});});
  await compare('abort while in flight',u=>{const c=new AbortController();const p=u.abortableFetch('https://a/x',{signal:c.signal});setTimeout(()=>c.abort('user'),1);return p;},{hang:true});
  await compare('caller signal, success removes listener',u=>{const c=new AbortController();return u.abortableFetch('https://a/x',{signal:c.signal}).then(r=>{c.abort('late');return r;});});
  await compare('no AbortController available',u=>u.abortableFetch('https://a/x',{timeout:10}),{noAbortController:true,hang:true,fireTimers:true});
});

test('fetch: www uses local transport, other hosts use the gate',async()=>{
  await compare('fetch on www',u=>u.fetch('https://www.nicovideo.jp/api',{credentials:'include'}));
  await compare('fetch on live host',u=>u.fetch('https://www.nicovideo.jp/api',{credentials:'include'}),{host:'live.nicovideo.jp'});
  await compare('fetch on live host without params',u=>u.fetch('https://www.nicovideo.jp/api'),{host:'live.nicovideo.jp'});
});

test('Task641: unused ajax removed (NETUTIL-AJAX-001), other members unchanged',()=>{
  const a=world(),b=world();
  const A=loadLegacy(before,'netUtil',a.globals),B=loadLegacy(after,'netUtil',b.globals);
  assert.equal(typeof A.ajax,'function','legacy had ajax');
  assert.equal('ajax' in B,false);
  assert.deepEqual(Object.keys(B),Object.keys(A).filter(k=>k!=='ajax'));
  assert.doesNotMatch(after,/\$\.ajax|NicoVideoApi\.ajax|jQuery/);
});

test('jsonp: callback naming, URL suffix, success and timeout',async()=>{
  await compare('success with generated names, frame reused',async(u,w)=>{
    const p1=u.jsonp('https://ext/api?x=1');
    await tick();
    w.frameWin.JsonpCallback0({ok:1});
    const r1=await p1;
    const p2=u.jsonp('https://ext/api2','myCb');
    await tick();
    w.frameWin.myCb('two');
    return [r1,await p2,typeof w.frameWin.JsonpCallback0,typeof w.frameWin.myCb];
  });
  await compare('timeout rejects and removes callback',async(u,w)=>{
    const r=await settle(()=>u.jsonp('https://ext/slow'));
    return [r,typeof w.frameWin.JsonpCallback0];
  },{fireTimers:true});
});

test('Task647 NETUTIL-POCKET-002: without a NicoVideoApi gate (MylistPocket) off-www fetch goes direct',async()=>{
  const run=async code=>{
    const w=world({host:'ch.nicovideo.jp'});
    delete w.globals.NicoVideoApi;
    const u=loadLegacy(code,'netUtil',w.globals);
    const r=await settle(()=>u.fetch('https://nvapi.nicovideo.jp/v1/x',{credentials:'include',timeout:0}));
    for(const id of w.timers)clearTimeout(id);
    return {r:snapshot(r),log:w.log};
  };
  const legacy=await run(before),fixed=await run(after);
  assert.equal(legacy.r.ok,false);
  assert.equal(legacy.r.error.$error,'ReferenceError');
  assert.deepEqual(fixed.r,{ok:true,value:{status:200,tag:'response'}});
  assert.equal(fixed.log.filter(e=>e[0]==='fetch').length,1);
  // With the gate present (ZenzaWatch), off-www still goes through it (unchanged).
  const w=world({host:'ch.nicovideo.jp'});const u=loadLegacy(after,'netUtil',w.globals);
  assert.deepEqual(snapshot(await u.fetch('https://x/',{a:1})),{tag:'gate'});
});
