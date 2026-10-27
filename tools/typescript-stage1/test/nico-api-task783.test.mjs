// Task783: parity of workerUtil and IndexedDbStorage moved to TypeScript.
// Main-thread RPC runs against a fake Worker; the generated Worker source itself is
// executed in a fake worker realm; the IndexedDB controller runs on a fake indexedDB.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return [read(s.fixture),read(s.runtime)];};
const flush=async(n=12)=>{for(let i=0;i<n;i++)await Promise.resolve();};

async function compare(name,symbol,makeWorld,run,label){
  const out=[];
  for(const code of pair(name)){
    const w=makeWorld();
    const subject=loadLegacy(code,symbol,w.globals);
    const r=await settle(()=>run(subject,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log)});
  }
  assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' side effects');
}

/** Main-thread world: Worker/Blob/URL/MessageChannel fakes that record traffic. */
function mainWorld(opt={}){
  const log=[];const blobs=[];const workers=[];let timerId=0;const timers=new Map();
  class Target{constructor(){this.l={};}addEventListener(t,f){(this.l[t]=this.l[t]||[]).push(f);}
    fire(t,e){(this.l[t]||[]).forEach(f=>f(e));}}
  class Worker extends Target{constructor(url,options){super();this.url=url;this.options=options;workers.push(this);
      log.push(['new Worker',url,options&&options.name]);}
    postMessage(m,transfer){log.push(['w.post',JSON.parse(JSON.stringify(m,(k,v)=>v&&v.isPort?'[port]':v)),
      Array.isArray(transfer)?transfer.length:transfer===undefined?'u':transfer===null?'n':typeof transfer]);}
    terminate(){log.push(['terminate']);}}
  class Port extends Target{constructor(id){super();this.id=id;this.isPort=true;}postMessage(m){log.push(['port.post',this.id,m.body&&m.body.command]);}
    start(){log.push(['port.start',this.id]);}close(){log.push(['port.close',this.id]);}}
  let portSeq=0;
  class MessageChannel{constructor(){this.port1=new Port(++portSeq);this.port2=new Port(++portSeq);}}
  class BroadcastChannel extends Target{constructor(n){super();this.n=n;log.push(['bc',n]);}postMessage(m){log.push(['bc.post',m.body&&m.body.command]);}
    close(){log.push(['bc.close']);}}
  const win={name:'win',Blob:true,Worker,URL:true,console:{log(){},time(){},timeEnd(){},timeLog(){}},fetch:async()=>({buffer:'B'})};
  return {log,blobs,workers,timers,globals:{window:win,location:{href:'https://www.nicovideo.jp/watch/sm1',host:'www.nicovideo.jp',origin:'https://www.nicovideo.jp'},
    Blob:class{constructor(parts){blobs.push(parts.join(''));}},
    URL:{createObjectURL:()=>'blob:'+blobs.length},Worker,MessageChannel,BroadcastChannel,
    SharedWorker:class extends Worker{constructor(u){super(u,{name:'shared'});this.port=new Port('S');}},
    EmitterInitFunc:function(){return {Handler:1,PromiseHandler:2,Emitter:3};},
    Date:{now:()=>0x1234},JSON,Object,Promise,Error,Map,String,Array,Infinity,
    setTimeout:(f,ms)=>{const i=++timerId;timers.set(i,f);log.push(['setTimeout',ms]);return i;},
    clearTimeout:i=>{timers.delete(i);},
    console:{log(){},warn:(...a)=>log.push(['warn',String(a[0])]),error:(...a)=>log.push(['error',String(a[0])]),
      time(){},timeEnd(){},timeLog(){}}}};
}
const reply=(w,sessionId,result,status='ok')=>w.workers.at(-1).fire('message',{data:{body:{command:'commandResult',params:{result}},sessionId,status}});
const lastSession=w=>{const posts=w.log.filter(x=>x[0]==='w.post');return posts.at(-1)[1].sessionId;};

test('workerUtil main thread: env, create cache, RPC post/send/ping, timeout, errors, terminate', async()=>{
  await compare('workerUtil','workerUtil',mainWorld,async(u,w)=>{
    const r=[u.isAvailable];
    u.env({TOKEN:'tok',PRODUCT:'ZW',config:{export:()=>({c:1})},CONSTANT:{k:1}});
    const f=function(self){self.x=1;};
    const plain1=u.create(f,{name:'Plain'}),plain2=u.create(f,{name:'Plain'});
    r.push(plain1.url===plain2.url,w.blobs.length,w.blobs[0].includes(f.toString()),w.blobs[0].includes('"ZW"'));
    const rpc=u.createCrossMessageWorker(f,{name:'Rpc',requestTimeout:500});
    r.push(w.blobs[1].includes('NAME = "Rpc"'),w.blobs[1].includes(f.toString()));
    // ping sent at start; answer it
    reply(w,lastSession(w),{pong:1});
    const p=rpc.post({command:'hello',params:{a:1}});
    reply(w,lastSession(w),'world');
    r.push(await p);
    const bad=rpc.post({command:'x'});reply(w,lastSession(w),'oops','fail');
    r.push(await bad.then(()=>'ok',e=>[e.message]));
    const slow=rpc.post({command:'slow'},{timeout:50});
    [...w.timers.values()].at(-1)();
    r.push(await slow.then(()=>'ok',e=>[e.name,e.reason,e.workerName]));
    rpc.send({command:'note'});
    r.push(rpc.getRpcState());
    // worker -> main commands
    rpc.oncommand=async({command,params})=>({echo:command,params});
    w.workers.at(-1).fire('message',{data:{body:{command:'custom',params:{v:2}},sessionId:'s1'}});
    w.workers.at(-1).fire('message',{data:{body:{command:'ping',params:{NAME:'Rpc'}},sessionId:'s2'}});
    w.workers.at(-1).fire('message',{data:{body:{command:'notify',params:{}}}});
    await flush();
    const pending=rpc.post({command:'wait'});
    w.workers.at(-1).fire('messageerror',{});
    r.push(await pending.then(()=>'ok',e=>e.reason));
    const pending2=rpc.post({command:'wait2'});
    rpc.terminate();rpc.terminate();
    r.push(await pending2.then(()=>'ok',e=>e.reason));
    r.push(await rpc.post({command:'after'}).then(()=>'ok',e=>e.reason));
    r.push(rpc.BroadcastChannel.length);
    return r;
  },'rpc');
  await compare('workerUtil','workerUtil',mainWorld,async(u,w)=>{
    const rpc=u.createCrossMessageWorker(function(self){},{name:'Boot'});
    const p=rpc.post({command:'first'});
    w.workers.at(-1).fire('error',{message:'syntax'});
    const r=[await p.then(()=>'ok',e=>[e.reason,e.message]),await rpc.post({command:'x'}).then(()=>'ok',e=>e.reason)];
    w.workers.at(-1).fire('message',{data:{body:{command:'ping',params:{}},sessionId:'z'}});
    r.push(rpc.getRpcState().state);
    const name=rpc.BroadcastChannel('Base');
    r.push(name);
    const other={name:'Other',addPort:async(port,o)=>{w.log.push(['other.addPort',o.name]);}};
    const br=rpc.bridge(other);reply(w,lastSession(w),{name:'x'});await br;
    return r;
  },'boot failure, broadcast, bridge');
});

/** Worker realm: run the generated Worker source (create()'s Blob) with a fake `self`. */
async function workerSide(code){
  const w=mainWorld();
  const u=loadLegacy(code,'workerUtil',w.globals);
  u.env({TOKEN:'tok',PRODUCT:'ZW'});
  u.createCrossMessageWorker(function(self){self.onmessage=async({command,params})=>({got:command,params});},{name:'Inner'});
  const src=w.blobs.at(-1);
  const log=[];
  class P{constructor(id){this.id=id;this.l={};}addEventListener(t,f){(this.l[t]=this.l[t]||[]).push(f);}
    postMessage(m){log.push(['port.post',this.id,m.body.command,m.status]);}start(){log.push(['port.start',this.id]);}}
  const self={name:'Inner',postMessage:(m,t)=>log.push(['self.post',m.body.command,m.sessionId,m.status,snapshot(m.body.params.result)])};
  const ctx=createContext({self,console:{log(){},warn:(...a)=>log.push(['warn',String(a[0])]),error:(...a)=>log.push(['error',String(a[0])]),time(){},timeEnd(){}},
    location:{href:'https://x.invalid/',origin:'https://x.invalid'},Date:{now:()=>1},JSON,Object,Promise,Error,
    setTimeout,BroadcastChannel:undefined});
  runInContext(src,ctx,{timeout:1000});
  const send=data=>self.onmessage({data});
  await send({body:{command:'ping',params:{}},sessionId:'p1'});
  await send({body:{command:'env',params:{config:{a:1},TOKEN:'t2',PRODUCT:'P2',CONSTANT:{}}},sessionId:'e1'});
  await send({body:{command:'custom',params:{v:1}},sessionId:'c1'});
  await send({body:{command:'custom',params:{v:2}}});
  const port=new P(7);
  await send({body:{command:'port',params:{name:'Chan'}},sessionId:'po1',ports:[port]});
  const out=self.post({command:'up',params:{}});
  const sid=log.filter(x=>x[0]==='self.post').at(-1)[2];
  await send({body:{command:'commandResult',params:{result:'R'}},sessionId:sid,status:'ok'});
  const r=[await out,typeof self.xFetch,typeof self.ping,typeof port.post];
  await flush();
  return {r:snapshot(r),log:snapshot(log)};
}

test('workerUtil worker side: generated source answers ping/env/custom/port and resolves its own requests', async()=>{
  const [before,after]=pair('workerUtil');
  const a=await workerSide(before),b=await workerSide(after);
  assert.ok(a.log.length>3,'legacy worker ran');
  assert.deepEqual(b.r,a.r);
  assert.deepEqual(b.log,a.log);
});

/** Fake indexedDB enough for open/upgrade/transactions/cursors (single store, synchronous-ish events). */
function fakeIdb(log){
  const dbs=new Map();
  const later=f=>Promise.resolve().then(f);
  function makeDb(name,version){
    const stores=new Map();
    const db={name,version,objectStoreNames:{contains:n=>stores.has(n)},close(){log.push(['db.close',name]);},
      createObjectStore(n,def){const s={name:n,keyPath:def.keyPath??null,autoIncrement:!!def.autoIncrement,rows:new Map(),idx:new Map(),
        indexNames:{contains:i=>s.idx.has(i)},createIndex(i,kp,params){s.idx.set(i,{keyPath:kp,unique:!!(params&&params.unique),multiEntry:!!(params&&params.multiEntry)});},
        index(i){return {keyPath:s.idx.get(i).keyPath,unique:s.idx.get(i).unique,multiEntry:s.idx.get(i).multiEntry,
          get:k=>req(()=>[...s.rows.values()].find(r=>r[s.idx.get(i).keyPath]===k)),
          openCursor:range=>cursorReq(s,r=>range.upper!==undefined?r[s.idx.get(i).keyPath]<=range.upper:r[s.idx.get(i).keyPath]===range.only)};}};
        stores.set(n,s);log.push(['createStore',n]);return s;},
      transaction(n,mode){const s=stores.get(n);
        // Like IndexedDB: complete only after every request of the transaction settled
        // (requests issued from success callbacks keep it alive).
        const t={mode,pending:0,done:false,objectStore:()=>api(s,t),abort(){t.done=true;log.push(['abort']);t.onabort&&t.onabort({target:{error:'aborted'}});}};
        t.track=fn=>{t.pending++;return (...a)=>{try{fn(...a);}finally{t.pending--;settle(t);}};};
        later(()=>settle(t));return t;}};
    const settle=t=>later(()=>later(()=>{if(!t.done&&t.pending===0){t.done=true;t.oncomplete&&t.oncomplete();}}));
    const api=(s,t)=>({get:k=>req(()=>s.rows.get(k),t),put:r=>req(()=>{s.rows.set(r[s.keyPath],r);log.push(['put',r[s.keyPath]]);return r[s.keyPath];},t),
      clear:()=>req(()=>{s.rows.clear();},t),index:i=>{const x=s.index(i);return {...x,get:k=>req(()=>[...s.rows.values()].find(r=>r[x.keyPath]===k),t),
        openCursor:range=>cursorReq(s,r=>range.upper!==undefined?r[x.keyPath]<=range.upper:r[x.keyPath]===range.only,t)};},
      openCursor:range=>cursorReq(s,r=>r[s.keyPath]===range.only,t)});
    db._stores=stores;
    stores.forEach(s=>{s.index=s.index;});
    return db;
  }
  const req=(fn,t)=>{const r={};const run=()=>{try{r.result=fn();r.onsuccess&&r.onsuccess({target:r});}catch(e){r.error=e;r.onerror&&r.onerror({target:r});}};
    later(t?t.track(run):run);return r;};
  const cursorReq=(s,match,t)=>{const r={};const rows=[...s.rows.values()].filter(match);let i=0;
    const step=()=>{const run=()=>{const row=rows[i];r.result=row?{value:row,delete(){s.rows.delete(row[s.keyPath]);log.push(['cursor.delete',row[s.keyPath]]);},continue(){i++;step();}}:null;
      r.onsuccess&&r.onsuccess({target:r});};later(t?t.track(run):run);};step();return r;};
  return {indexedDB:{open(name,ver){log.push(['open',name,ver]);const r={};later(()=>{
      let db=dbs.get(name);const upgrade=!db||(ver!==undefined&&ver>db.version);
      if(!db){db=makeDb(name,ver||1);dbs.set(name,db);}else if(upgrade){db.version=ver;}
      if(upgrade){r.transaction={objectStore:n=>db._stores.get(n),abort(){}};r.onupgradeneeded&&r.onupgradeneeded({target:{result:db}});}
      r.result=db;r.onsuccess&&r.onsuccess({target:{result:db}});});return r;}},
    IDBKeyRange:{only:v=>({only:v}),upperBound:v=>({upper:v})}};
}

test('IndexedDbStorage controller: open/upgrade, put/get/update/updateTime/delete/gc/clear', async()=>{
  await compare('IndexedDbStorage','IndexedDbStorage',()=>{
    const log=[];const captured={};
    const workerUtil={createCrossMessageWorker:(func,opt)=>{captured.func=func;log.push(['createWorker',opt.name]);
      return {post:async(m)=>{log.push(['post',m.command,m.params.storeName||null]);return 'ok';}};}};
    const idb=fakeIdb(log);
    return {log,captured,idb,globals:{workerUtil,Promise,Object,Map,JSON,Number,Array,TypeError,Error,Date:{now:()=>100000},
      performance:{now:()=>1},setTimeout,clearTimeout,console:{warn:(...a)=>log.push(['warn',String(a[0])])},...idb}};
  },async(S,w)=>{
    const def={name:'cache',ver:1,stores:[{name:'items',indexes:[{name:'updatedAt',keyPath:'updatedAt',params:{unique:false}}],
      definition:{keyPath:'id',autoIncrement:false}}]};
    const handle=await S.open(def);
    const r=[Object.keys(handle).sort(),typeof w.captured.func];
    await handle.items.put({id:'a'});await handle.items.get({key:'a'});await handle.items.gc();
    // Run the stringified worker controller directly with the same fakes.
    const self={};
    const controller=w.captured.func(self);
    r.push(await self.onmessage({command:'init',params:def}));
    r.push(await controller.put({name:'cache',storeName:'items',data:{id:'a',updatedAt:10,v:1}}));
    r.push(await controller.put({name:'cache',storeName:'items',data:{id:'b',updatedAt:99990,v:2}}));
    r.push(await controller.get({name:'cache',storeName:'items',data:{key:'a'}}));
    r.push(await controller.update({name:'cache',storeName:'items',data:{key:'a',patch:{v:5},increment:{n:2},append:{tags:['x']},limits:{tags:1},defaults:{d:1}}}));
    r.push(await controller.update({name:'cache',storeName:'items',data:{key:'zz',onlyExisting:true}}));
    r.push(await controller.update({name:'cache',storeName:'items',data:{key:'a',increment:{n:'bad'}}}).then(()=>'ok',e=>e.message));
    r.push(await controller.delete({name:'cache',storeName:'items',data:{key:'b'}}));
    r.push(await controller.gc({name:'cache',storeName:'items',data:{expireTime:1000}}));
    r.push(await controller.clear({name:'cache',storeName:'items'}));
    r.push(await controller.get({name:'cache',storeName:'items',data:{key:'a'}}));
    controller.close({name:'cache'});
    return r;
  },'controller');
});
