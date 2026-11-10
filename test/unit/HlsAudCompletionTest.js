'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {stripTypeScriptTypes} = require('node:module');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const {createContext, run} = require('../helpers/extractSource');
// Index each canonical owner separately; only the storage lifecycle fixture
// slices its owner to inject a deterministic worker transport.
const sources = ['HlsConfig','HlsStorage','HlsVideoElement'].map(name =>
  stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,
    '../../tools/typescript-stage1/hls-src/'+name+'.ts'), 'utf8'),
    {mode:'strip',disableExperimentalWarning:true}));
const source = sources[1];
const nodes = {};
for (const owner of sources) {
  traverse(parser.parse(owner, {sourceType:'module'}), {noScope: true,
    ClassDeclaration(p) { nodes[p.node.id.name] = owner.slice(p.node.start,p.node.end); },
    VariableDeclarator(p) { if (p.node.id.name && p.node.init) {
      nodes[p.node.id.name] = owner.slice(p.node.init.start,p.node.init.end);
    }}
  });
}
const quiet = {log() {}, info() {}, warn() {}, error() {}, time() {}, timeEnd() {}};
const tick = async () => { for (let i=0;i<10;i++) { await Promise.resolve(); } };
const fragment = () => ({url:'https://media.invalid/nicovideo-sm9_a/0/ts/1.ts', level:0,sn:1});
function loader(extra={}) {
  const calls={network:0,save:0,touch:0,success:0};
  class Base {load(ctx,cfg,cb) {calls.network++; cb.onSuccess({url:ctx.url,data:new ArrayBuffer(8)}, {},ctx);}
    abort() {} destroy() {}}
  const c=createContext({console:quiet, Hls:{DefaultConfig:{loader:Base}},
    Config:{get:()=>true}, XMLHttpRequest:class {}, performance:{now:()=>10000},
    Storage:{gc(){},load:async()=>[null,null],save:async()=>{calls.save++;return 'hash';},
      touch:async()=>{calls.touch++;return true;},hasData:async()=>false},
    AbortController,Request,fetch:async()=>({ok:true,status:200,arrayBuffer:async()=>new ArrayBuffer(8)}),
    debounce:()=>Object.assign(()=>{}, {cancel(){}}),...extra});
  run('let FragmentLoaderClass;globalThis.Loader=('+nodes.createFragmentLoader+')(Hls)',c);
  return {c,calls,instance:new c.Loader({fragLoadingMaxRetry:3}),
    callbacks:{onSuccess(){calls.success++;},onError(){}}};
}
function player() {
  const c=createContext({console:quiet,HTMLElement:EventTarget,Event,Hls:{isSupported:()=>true},
    overrideTarget:e=>e});
  run('const PLAYER_MODE='+nodes.PLAYER_MODE+';'+nodes.ZenzaVideoElement+';globalThis.Subject=ZenzaVideoElement;',c);
  // Native EventTarget internal slots are required by the inherited methods.
  const p=Reflect.construct(EventTarget,[],c.Subject);
  Object.assign(p,{_video:new EventTarget(),_eventWrapperMap:new Map(),_videoCount:0,_hlsConfig:{},
    _throttledCurrentTime:Object.assign(()=>{}, {cancel(){}}),_resetPlayingStatus(){},
    _destroyHLSJS(){this._hls=null;},isInBuffer:()=>true});
  Object.defineProperty(p,'playerMode',{value:'HLS-JS',writable:true});
  return p;
}
describe('HLS AUD completion contracts',()=>{
  it('#171 timeout diagnostics never expose request objects or URL',()=>{
    const logs=[];const c=createContext({HLS_JS_VERSION:'fixture',console:{log:(...a)=>logs.push(a)}});
    const config=run('('+nodes.DEFAULT_CONFIG+')',c);
    const xhr={fixtureValue:'PRIVATE_MARKER'};config.xhrSetup(xhr,'https://media.invalid/PRIVATE_MARKER');
    xhr.ontimeout(); assert.strictEqual(xhr.withCredentials,true);
    assert(!JSON.stringify(logs).includes('PRIVATE_MARKER'));
  });
  it('#173 clear acknowledges transaction commit only',async()=>{
    const c=createContext({console:quiet});run(nodes.IndexDBStorage+';globalThis.S=IndexDBStorage;',c);
    const request={}, transaction={};const s=new c.S();
    s.getStore=async()=>({transaction,store:{clear:()=>request}});
    let settled=false;const result=s.clear().then(()=>{settled=true;});
    await tick();if(request.onsuccess)request.onsuccess({});await tick();
    assert.strictEqual(settled,false);
    transaction.oncomplete();await result;assert.strictEqual(settled,true);
  });
  it('#174 alternate segment names delegate without cache parsing failure',async()=>{
    const f=loader();const frag={url:'https://media.invalid/segment/1.ts',sn:1};
    await f.instance.load({url:frag.url,frag},{},f.callbacks);
    assert.strictEqual(f.calls.network,1);assert.strictEqual(f.calls.success,1);
  });
  it('#175 preload failures exhaust a cumulative budget and release timer',async()=>{
    let fetches=0,cancelled=0;
    const f=loader({fetch:async()=>{fetches++;return {ok:false,status:500};},
      setTimeout:fn=>{fn();return 1;},
      debounce:()=>Object.assign(()=>{}, {cancel(){cancelled++;}})});
    const frag=fragment();await f.c.Loader.preloadFragment(frag,frag.url);
    await f.c.Loader.preloadFragment(frag,frag.url);
    assert.strictEqual(fetches,3);assert.strictEqual(cancelled,1);
  });
  it('#176 unsuccessful saves never mark a network fragment cached',async()=>{
    const f=loader();f.c.Storage.save=async()=>false;const frag=fragment();
    await f.instance.load({url:frag.url,frag},{},f.callbacks);await tick();
    assert.notStrictEqual(frag.hasCache,true);assert.strictEqual(f.calls.success,1);
  });
  it('#177 cache hits touch expiry without resaving bytes',async()=>{
    const f=loader();f.c.Storage.load=async()=>[{url:'cached',stats:{}},new ArrayBuffer(8)];
    const frag=fragment();await f.instance.load({url:frag.url,frag},{},f.callbacks);
    assert.strictEqual(f.calls.save,0);assert.strictEqual(f.calls.touch,1);
    assert.strictEqual(f.calls.success,1);assert.strictEqual(f.calls.network,0);
  });
  it('#179 disconnect cancels trailing seek and clears seeking state',()=>{
    const p=player();let cancelled=0;p._throttledCurrentTime.cancel=()=>cancelled++;
    p._isSeeking=true;p.disconnectedCallback();
    assert.strictEqual(cancelled,1);assert.strictEqual(p._isSeeking,false);
  });
  it('#180 capture and bubble identities are independently removed',()=>{
    const p=player();let count=0;const cb=()=>count++;
    p.addEventListener('probe',cb,true);p.addEventListener('probe',cb,false);
    p.removeEventListener('probe',cb,true);p._video.dispatchEvent(new Event('probe'));
    assert.strictEqual(count,1);p.disconnectedCallback();
    p._video.dispatchEvent(new Event('probe'));assert.strictEqual(count,1);
  });
  it('#181 detached capture seek does not dereference destroyed engine',()=>{
    const p=player();p._hlsConfig.autoStartLoad=false;p._hls=null;
    assert.doesNotThrow(()=>{p.currentTime=20;});
  });
  it('#182 direct ordinary source replacement destroys old engine',()=>{
    const p=player();let destroyed=0;p._destroyHLSJS=()=>destroyed++;
    p.src='https://media.invalid/video.mp4';assert.strictEqual(destroyed,1);
  });
});
function storageRuntime(holdReplacementConfig=false) {
  const workers=[],timers=new Map(),listeners={};let sequence=0;
  const config={cache_expire_time:6000};
  const c=createContext({console:quiet,StorageWorker(){},Config:{get:k=>config[k],on:(k,fn)=>listeners[k]=fn},
    debounce:fn=>fn,setTimeout:fn=>{timers.set(++sequence,fn);return sequence;},
    clearTimeout:id=>timers.delete(id),performance:{now:()=>++sequence},
    createWebWorker:()=>{const handlers={};const worker={handlers,sent:[],terminated:false,
      addEventListener:(type,fn)=>handlers[type]=fn,terminate(){this.terminated=true;},
      postMessage(message){this.sent.push(message);if(message.command==='config' && !(holdReplacementConfig && workers.length>1)){
        queueMicrotask(()=>handlers.message({data:{id:message.id,result:'ok'}}));}}
    };workers.push(worker);return worker;}});
  const start=source.indexOf('const Storage = {',source.indexOf('const createWebWorker'));
  const end=source.indexOf('return Storage;',start);
  run(source.slice(start,end)+';globalThis.subject=Storage;',c);
  return {c,workers,timers,listeners,config};
}
describe('HLS worker lifecycle and config',()=>{
  it('#172 new requests recover once without replaying failed mutations',async()=>{
    const f=storageRuntime();await tick();const old=f.workers[0];
    const pending=f.c.subject.save({hash:'x',videoId:'v',meta:{}},new ArrayBuffer(4));
    const rejected=assert.rejects(pending);old.handlers.error();await rejected;
    const next=f.c.subject.load({hash:'x'});await tick();
    assert.strictEqual(f.workers.length,2);
    const current=f.workers[1];assert.deepStrictEqual(current.sent.map(x=>x.command),['config','load']);
    old.handlers.error();const req=current.sent[1];
    current.handlers.message({data:{id:req.id,result:null}});await next;
    assert.strictEqual(old.terminated,true);
  });
  it('shares one recovery handshake between simultaneous requests',async()=>{
    const f=storageRuntime(true);await tick();f.workers[0].handlers.error();
    const a=f.c.subject.load({hash:'a'}),b=f.c.subject.hasData({hash:'b'});await tick();
    assert.strictEqual(f.workers.length,2);
    const current=f.workers[1];assert.deepStrictEqual(current.sent.map(x=>x.command),['config']);
    current.handlers.message({data:{id:current.sent[0].id,result:'ok'}});await tick();
    assert.strictEqual(current.sent[0].command,'config');
    assert.deepStrictEqual(current.sent.slice(1).map(x=>x.command).sort(),['hasData','load']);
    for(const request of current.sent.slice(1))current.handlers.message({data:{id:request.id,result:null}});
    await Promise.all([a,b]);assert.strictEqual(f.timers.size,0);
  });
  it('#178 runtime TTL changes reach worker before subsequent saves',async()=>{
    const f=storageRuntime();await tick();
    assert.strictEqual(typeof f.listeners['update-cache_expire_time'],'function');
    f.config.cache_expire_time=1500;f.listeners['update-cache_expire_time'](1500);await tick();
    assert.strictEqual(f.workers[0].sent.at(-1).data.cache_expire_time,1500);
  });
});

describe('HLS AUD failure boundaries',()=>{
  it('clear rejects transaction abort after successful request',async()=>{
    const c=createContext({console:quiet});run(nodes.IndexDBStorage+';globalThis.S=IndexDBStorage;',c);
    const request={},transaction={};const s=new c.S();
    s.getStore=async()=>({transaction,store:{clear:()=>request}});
    const result=s.clear();const rejection=assert.rejects(result,/aborted/);await tick();
    if(request.onsuccess)request.onsuccess({});transaction.onabort();await rejection;
  });
  it('touch preserves payload and refreshes sliding TTL only after commit',async()=>{
    const c=createContext({console:quiet,Config:{cache_expire_time:1500},Date:{now:()=>1000}});
    // Date is also used for human-readable metadata.
    c.Date=class extends Date {static now(){return 1000;}};
    run(nodes.IndexDBStorage+';globalThis.S=IndexDBStorage;',c);
    const buffer=new ArrayBuffer(8),record={buffer,meta:{url:'cached'},expiresAt:1100};
    const request={},transaction={};let updated,settled=false;
    const s=new c.S();s.getStore=async()=>({transaction,store:{openCursor:()=>request}});
    const result=s.touch({hash:'x'}).then(value=>{settled=true;return value;});await tick();
    request.result={value:record,update:value=>updated=value};request.onsuccess();await tick();
    assert.strictEqual(settled,false);assert.strictEqual(updated.buffer,buffer);
    assert.strictEqual(updated.expiresAt,2500);transaction.oncomplete();
    assert.strictEqual(await result,true);
  });
  it('partial preload responses never become cached',async()=>{
    const f=loader({fetch:async()=>({ok:true,status:206}),setTimeout:fn=>{fn();return 1;}});
    const frag=fragment();assert.strictEqual(await f.c.Loader.preloadFragment(frag,frag.url),false);
    assert.strictEqual(f.calls.save,0);assert.strictEqual(frag.hasCache,false);
  });
  it('preload save false reports failure and retries persistence on next call',async()=>{
    const f=loader();let saves=0;f.c.Storage.save=async()=>{saves++;return false;};
    const frag=fragment();assert.strictEqual(await f.c.Loader.preloadFragment(frag,frag.url),false);
    assert.strictEqual(await f.c.Loader.preloadFragment(frag,frag.url),false);
    assert.strictEqual(saves,2);
  });
  it('once listeners can be registered again and signal cancellation cleans both targets',()=>{
    const p=player();let calls=0;const cb=()=>calls++;
    p.addEventListener('probe',cb,{once:true});p._video.dispatchEvent(new Event('probe'));
    p.dispatchEvent(new Event('probe'));assert.strictEqual(calls,1);
    const controller=new AbortController();
    p.addEventListener('probe',cb,{capture:true,signal:controller.signal});controller.abort();
    p._video.dispatchEvent(new Event('probe'));assert.strictEqual(calls,1);
    p.addEventListener('probe',cb);p._video.dispatchEvent(new Event('probe'));assert.strictEqual(calls,2);
  });
  it('worker restart budget cannot become an unbounded crash loop',async()=>{
    const f=storageRuntime();await tick();
    for(let i=0;i<3;i++){
      f.workers.at(-1).handlers.error();
      const request=f.c.subject.load({hash:'x'});const rejection=assert.rejects(request);
      await tick();
      if(i<2){f.workers.at(-1).handlers.error();}
      await rejection;
    }
    assert.strictEqual(f.workers.length,3);
    assert.strictEqual(Object.keys(f.c.subject.request).length,0);
    assert.strictEqual(f.timers.size,0);
  });
  it('invalid TTL updates do not overwrite worker configuration',async()=>{
    const f=storageRuntime();await tick();const count=f.workers[0].sent.length;
    for(const value of [-1,NaN,Infinity,'1500'])f.listeners['update-cache_expire_time'](value);
    await tick();assert.strictEqual(f.workers[0].sent.length,count);
  });
});
