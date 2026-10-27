// Task789: parity of message/gate and message/messageUtil moved to TypeScript (legacy
// fixture vs generated runtime, identical fakes; results and side effects compared).
// messageUtil runs on the real Emitter/PromiseHandler.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,legacySection,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return [read(s.fixture),read(s.runtime)];};
const emitterSection=legacySection(read('packages/lib/src/Emitter.js'));
const withEmitter=code=>'//===BEGIN===\n'+emitterSection+'\n'+legacySection(code)+'\n//===END===';
const flush=async(n=20)=>{for(let i=0;i<n;i++)await Promise.resolve();};
const PRODUCT='ZenzaWatch';

async function compare(name,symbol,makeWorld,run,label,wrap=c=>c){
  const out=[];
  for(const code of pair(name)){
    const w=makeWorld();
    const subject=loadLegacy(wrap(code),symbol,w.globals);
    const r=await settle(()=>run(subject,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log)});
  }
  assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' side effects');
}
function timersFor(log){
  let tid=0;const timers=new Map();
  return {timers,
    setTimeout:(f,ms)=>{const i=++tid;timers.set(i,{f,ms});log.push(['setTimeout',ms]);return i;},
    clearTimeout:i=>{log.push(['clearTimeout',i===undefined?'u':typeof i]);timers.delete(i);},
    run(pick=()=>true){const list=[...timers.entries()].filter(([,t])=>pick(t.ms));for(const [i,t] of list){timers.delete(i);t.f();}}};
}

// ---- gate (loader iframe side) ----
function gateWorld({name='nicovideoApiLoader#https://www.nicovideo.jp',referrer='https://www.nicovideo.jp/watch/sm9',white=''}={}){
  const log=[];const t=timersFor(log);
  const portListeners=new Map();
  class MessageChannel{constructor(){
    this.port1={start:()=>log.push(['port.start']),postMessage:m=>log.push(['port.post',snapshot(m)]),
      addEventListener:(type,f)=>{portListeners.set(type,f);log.push(['port.add',type]);}};
    this.port2={name:'port2'};}}
  const responses=[];
  const fetch=(url,options)=>{log.push(['fetch',url,Object.keys(options).sort(),options.signal?options.signal.aborted:'none']);
    const next=responses.shift();return next?next(options):new Promise(()=>{});};
  const globals={PRODUCT,workerUtil:{env:p=>log.push(['env',p])},name,
    window:{name,history:{replaceState:(...a)=>log.push(['replaceState',...a])}},
    document:{referrer,createElement:()=>{const a={};Object.defineProperty(a,'href',{set(v){const u=new URL(v);a.hostname=u.hostname;a.protocol=u.protocol;}});return a;}},
    location:{href:'https://nicovideo.cdn.nimg.jp/loader.html#tok',host:'nicovideo.cdn.nimg.jp',hash:'#tok',pathname:'/loader.html'},
    parent:{postMessage:(m,origin,transfer)=>log.push(['parent.post',snapshot(m),origin,transfer.length])},
    MessageChannel,localStorage:white?{ZenzaWatch_whiteHost:white}:{},fetch,AbortController,
    Date:{now:()=>0xabc},setTimeout:t.setTimeout,clearTimeout:t.clearTimeout,isNaN,Map,Object,Promise,Error,JSON,RegExp,
    console:{log:(...a)=>log.push(['console.log',...a.slice(2)]),error:(...a)=>log.push(['console.error',a[0]])}};
  return {log,globals,t,responses,portListeners};
}
const fakeResponse=(body='abc')=>({type:'basic',url:'https://www.nicovideo.jp/api',redirected:false,status:200,ok:true,statusText:'OK',
  headers:{entries:()=>[['content-type','text/plain']][Symbol.iterator]()},arrayBuffer:async()=>body});

test('gate: host allowlists',{timeout:20000},async()=>{
  await compare('gate','gate',()=>gateWorld({white:'example.org,intra.local'}),g=>{
    const {isWhiteHost,isNicoServiceHost,parseUrl}=g();
    const urls=['https://www.nicovideo.jp/','https://account.nicovideo.jp/','https://point.nicovideo.jp/x','http://sp.nicovideo.jp/',
      'https://live.nico/','http://localhost:3000/','http://127.0.0.1/','https://example.org/','http://intra.local/',
      'http://www.google.com/','https://www.google.com/','https://x.slack.com/','https://evil.com/','https://nicovideo.jp.evil.com/',
      'https://friends.nico/','',null,undefined];
    return [urls.map(u=>[isWhiteHost(u),isNicoServiceHost(u)]),parseUrl('').hostname];
  },'hosts');
});

test('gate: post opens the channel once, then uses the port',{timeout:20000},async()=>{
  await compare('gate','gate',gateWorld,g=>{
    const {post}=g();
    const p1=post({command:'a'},{type:'nicovideoApi',token:'T',origin:'https://www.nicovideo.jp',sessionId:'s1'});
    const p2=post({command:'b'});
    const p3=post({command:'c'},{sessionId:'s3',type:'other'});
    return [p1===p2,p2===p3];
  },'post');
});

test('gate: init validates name and origin, wires cancelFetch',{timeout:20000},async()=>{
  for(const opt of [{name:'other'},{name:'nicovideoApiLoader',referrer:'https://evil.com/'},{name:'nicovideoApiLoader#https://www.nicovideo.jp',referrer:''}]){
    await compare('gate','gate',()=>gateWorld(opt),g=>{
      let r;try{r=g().init({prefix:'nicovideoApi',type:'nicovideoApi'});}catch(e){return ['threw',e.message];}
      return {TOKEN:r.TOKEN,origin:r.origin,type:r.type,PID:r.PID};
    },'init '+JSON.stringify(opt));
  }
  await compare('gate','gate',gateWorld,async(g,w)=>{
    const api=g();
    const r=api.init({prefix:'nicovideoApi'});
    const x=api.xFetch({url:'https://www.nicovideo.jp/api'},'sid-1');
    const onMsg=w.portListeners.get('message');
    let stopped=0;const ev=data=>({data,stopImmediatePropagation:()=>stopped++});
    onMsg(ev('{bad json'));
    onMsg(ev({token:'nope',body:{command:'cancelFetch',params:{sessionId:'sid-1'}}}));
    onMsg(ev({token:'tok',body:{command:'other'}}));
    onMsg(ev(JSON.stringify({token:'tok',body:{command:'cancelFetch',params:{sessionId:'unknown'}}})));
    onMsg(ev({token:'tok',body:{command:'cancelFetch',params:{sessionId:'sid-1'}}}));
    await x;
    return [r.type,stopped];
  },'cancelFetch');
});

test('gate: uFetch / xFetch results, rejections, timeout and abort',{timeout:20000},async()=>{
  await compare('gate','gate',gateWorld,async(g,w)=>{
    const {uFetch,xFetch}=g();
    const r=[];
    r.push(await uFetch({url:'https://evil.com/'}).then(()=>'ok',e=>e));
    r.push(await uFetch({url:'https://localhost/'}).then(()=>'ok',e=>e));
    w.responses.push(async()=>fakeResponse());
    r.push(await uFetch({url:'https://www.nicovideo.jp/a',options:{method:'POST',timeout:5}},resp=>resp.status));
    w.responses.push(async()=>{throw new TypeError('net');});
    r.push(await uFetch({url:'https://www.nicovideo.jp/b',timeout:0}).then(()=>'ok',e=>e));
    const slow=uFetch({url:'https://www.nicovideo.jp/c',timeout:7});
    w.t.run();
    r.push(await slow.then(()=>'ok',e=>e));
    const ac=new AbortController();
    const aborted=uFetch({url:'https://www.nicovideo.jp/d',options:{signal:ac.signal}});
    ac.abort(new Error('mine'));
    r.push(await aborted.then(()=>'ok',e=>e));
    r.push(await uFetch({url:'https://www.nicovideo.jp/e',options:{signal:ac.signal}}).then(()=>'ok',e=>e));
    g().post({},{origin:'https://www.nicovideo.jp'});
    w.responses.push(async()=>fakeResponse('xyz'));
    r.push(await xFetch({url:'https://www.nicovideo.jp/f',options:{credentials:'include'}},'s9'));
    r.push(await xFetch({url:'https://evil.com/'},'s10'));
    return r;
  },'fetch');
});

// ---- messageUtil (window / broadcast messaging, on the real Emitter) ----
function msgWorld({host='www.nicovideo.jp',bc=true,singleton=false}={}){
  const log=[];const t=timersFor(log);const winListeners=new Map();const bcListeners=new Map();
  class BroadcastChannel{constructor(n){log.push(['bc.new',n]);}postMessage(m){log.push(['bc.post',snapshot(m)]);}
    addEventListener(type,f){bcListeners.set(type,f);log.push(['bc.add',type]);}}
  let rnd=0;
  const globals={PRODUCT,
    global:{config:{props:{enableSingleton:singleton}},debug:{},
      external:{sendOrExecCommand:(...a)=>log.push(['sendOrExec',...a]),execCommand:(...a)=>log.push(['exec',...a])}},
    Config:{setValue:(k,v)=>log.push(['Config.setValue',k,snapshot(v)])},
    NicoVideoApi:{sendMessage:(...a)=>{log.push(['api.sendMessage',snapshot(a)]);return Promise.resolve({answer:42});}},
    window:{addEventListener:(type,f)=>{winListeners.set(type,f);log.push(['win.add',type]);},
      setTimeout:(f,ms)=>t.setTimeout(f,ms),console:{time:()=>log.push(['time']),timeEnd:()=>log.push(['timeEnd']),
        info:(...a)=>log.push(['info',...a]),error:(...a)=>log.push(['error',...a])}},
    self:bc?{BroadcastChannel}:{},location:{host,href:'https://'+host+'/watch/sm9'},document:{title:'T'},
    Math:Object.assign(Object.create(Math),{random:()=>++rnd/1000}),Date:{now:()=>1000},
    setTimeout:t.setTimeout,clearTimeout:t.clearTimeout,Object,Promise,Error,JSON,Map,Set,Array,Symbol,WeakMap,
    console:{log:()=>{},warn:(...a)=>log.push(['warn',a[0]]),error:(...a)=>log.push(['console.error',a[0]]),trace:()=>{}}};
  return {log,globals,t,winListeners,bcListeners};
}
const res=p=>p.then(v=>['ok',v],e=>['ng',e]);
const listen=(emitter,log,tag)=>emitter.on('message',(...a)=>log.push([tag,snapshot(a)]));

test('messageUtil: WindowMessageEmitter filters sources and handles blog parts',{timeout:20000},async()=>{
  for(const singleton of [false,true]){
    await compare('messageUtil','messageUtil',()=>msgWorld({singleton}),async(m,w)=>{
      const em=m.WindowMessageEmitter;
      listen(em,w.log,'win');
      const on=w.winListeners.get('message');
      const known={};em.addKnownSource(known);
      const send=(source,origin,data)=>on({source,origin,data});
      send({},'https://evil.com',{id:PRODUCT,type:'x',body:{command:'message',params:{command:'a'}}});
      send(known,'https://evil.com',{id:'Other',body:{command:'message',params:{command:'a'}}});
      send(known,'https://evil.com',JSON.stringify({id:PRODUCT,type:'x',sessionId:'s',body:{command:'message',params:{command:'ok1'}}}));
      send({},'https://ext.nicovideo.jp',{id:PRODUCT,type:'x',body:{command:'message',params:{command:'ok2'}}});
      send({},'http://ext.nicovideo.jp',{id:PRODUCT,type:'x',body:{command:'other',params:{command:'z'}}});
      send({},'http://ext.nicovideo.jp',{id:PRODUCT,type:'x',body:{command:'message',params:{}}});
      for(const command of ['send','open'])
        send({},'https://ext.nicovideo.jp',{id:PRODUCT,type:'blogParts',body:{params:{command,params:{watchId:'sm'+command}}}});
      send(known,'x','{broken');
      send(known,'x',{id:PRODUCT,type:'x'});
      return em===m.WindowMessageEmitter;
    },'window singleton='+singleton,withEmitter);
  }
});

test('messageUtil: BroadcastChannel path (send, receive, promise timeout)',{timeout:20000},async()=>{
  await compare('messageUtil','messageUtil',msgWorld,async(m,w)=>{
    const b=m.BroadcastEmitter;
    listen(b,w.log,'bcast');
    const r=[b.windowId];
    r.push(b.sendMessage({command:'x'}),b.sendMessage({command:'y'},'sid'));
    b.sendOpen('sm1',{from:'t'});b.notifyClose();b.notifyOpen('p1');b.pong({playerId:'p'});
    const on=w.bcListeners.get('message');
    on({data:{body:{command:'message',params:{command:'hi'}},sessionId:'z'}});
    on({data:JSON.stringify({body:{command:'message',params:{command:'json'}}})});
    on({data:{body:{command:'nope',params:{}}}});
    w.t.run();
    const pending=b.sendExecCommand({command:'play'});
    w.t.run();
    r.push(await res(pending));
    const hello=b.hello();w.t.run();r.push(await res(hello));
    const ping=b.ping({timeout:5});w.t.run(ms=>ms===5);
    r.push(await ping.then(v=>['ok',v],e=>['ng',e]));
    const dbg=m.BroadcastEmitter&&w.globals.global.debug;
    const dp=dbg.ping();w.t.run(ms=>ms===500);r.push(await dp);
    return r;
  },'broadcast channel',withEmitter);
});

test('messageUtil: storage fallback and gate path',{timeout:20000},async()=>{
  await compare('messageUtil','messageUtil',()=>msgWorld({bc:false}),async(m,w)=>{
    const b=m.BroadcastEmitter;
    listen(b,w.log,'bcast');
    b.sendMessage({command:'s'},'sid');
    const on=w.winListeners.get('storage');
    const ev=(key,newValue,oldValue=null,type='storage')=>on({type,key,newValue,oldValue});
    ev('ZenzaWatch_message',JSON.stringify({body:{command:'go'}}));
    ev('ZenzaWatch_message',JSON.stringify({body:{command:'same'}}),JSON.stringify({body:{command:'same'}}));
    ev('ZenzaWatch_message',null);ev('ZenzaWatch_message','{bad');ev('ZenzaWatch_message','[1]');
    ev('ZenzaWatch_message',JSON.stringify({body:[]}));ev('ZenzaWatch_message',JSON.stringify({body:{command:''}}));
    ev('ZenzaWatch_message',JSON.stringify({body:{command:5}}));
    ev('Other_message',JSON.stringify({body:{command:'x'}}));ev(null,'1');ev('ZenzaWatch_volume','1');
    ev('ZenzaWatch_message',JSON.stringify({body:{command:'t'}}),null,'other');
    w.t.run();
    return [...w.winListeners.keys()];
  },'storage',withEmitter);
  await compare('messageUtil','messageUtil',()=>msgWorld({host:'ext.nicovideo.jp'}),async(m,w)=>{
    const b=m.BroadcastEmitter;
    const r=[await b.sendMessage({command:'g'},'sid'),b.sendMessage({command:'h'})];
    const p=b.sendMessagePromise({command:'k'},50);
    r.push(await res(p));
    return [r,[...w.bcListeners.keys()],[...w.winListeners.keys()]];
  },'gate path',withEmitter);
});
