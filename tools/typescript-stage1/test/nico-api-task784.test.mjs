// Task784: parity of CrossDomainGate moved to TypeScript (legacy fixture vs generated
// runtime). Runs on the real Emitter/PromiseHandler with a fake iframe, window and
// MessagePort; the loader side is simulated by the test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,legacySection,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const [before,after]=(s=>[read(s.fixture),read(s.runtime)])(NICO_API_BY_NAME.CrossDomainGate);
const emitterSection=legacySection(read('packages/lib/src/Emitter.js'));
const withEmitter=code=>'//===BEGIN===\n'+emitterSection+'\n'+legacySection(code)+'\n//===END===';
const flush=async(n=20)=>{for(let i=0;i<n;i++)await Promise.resolve();};
const TOKEN='ranbu',PRODUCT='ZenzaWatch';

function world(){
  const log=[];const winListeners=new Map();let tid=0;const timers=new Map();
  const loaderWindow={location:{replace:u=>log.push(['loader.replace',u])}};
  const parent={children:[],append(el){this.children.push(el);el.parentNode=this;log.push(['append',el.name,el.className,el.sandbox,el.referrerPolicy,el.loading]);}};
  const document={body:parent,documentElement:parent,createElement:tag=>({tag,style:{},parentNode:null,contentWindow:loaderWindow,
    remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(c=>c!==this);}this.parentNode=null;log.push(['frame.remove']);}})};
  const window={console:{time(){},timeEnd(){}},addEventListener:(t,f,o)=>{log.push(['win.add',t,o&&o.capture]);winListeners.set(t,f);},
    removeEventListener:(t,f,o)=>{log.push(['win.remove',t,o&&o.capture]);winListeners.delete(t);}};
  const port={l:new Map(),sent:[],addEventListener(t,f){this.l.set(t,f);log.push(['port.add',t]);},
    removeEventListener(t){this.l.delete(t);log.push(['port.remove',t]);},start(){log.push(['port.start']);},close(){log.push(['port.close']);},
    postMessage(m,transfer){this.sent.push(m);log.push(['port.post',m.body.command,m.sessionId?'sid':'-',m.token===TOKEN,transfer===undefined?'u':'t']);}};
  class Headers{constructor(){this.list=[];}append(k,v){this.list.push([k,v]);}}
  class Response{constructor(body,init){this.body=body;this.status=init.status;this.statusText=init.statusText;this.headers=init.headers.list;}}
  const BroadcastEmitter={emitAsync:(...a)=>log.push(['broadcast',...a])};
  let rnd=0;
  const globals={window,document,location:{href:'https://www.nicovideo.jp/watch/sm9',host:'www.nicovideo.jp'},
    PRODUCT,TOKEN,BroadcastEmitter,Headers,Response,URL,Request:class{},MutationObserver:undefined,
    Math:Object.assign(Object.create(Math),{random:()=>++rnd/1000}),
    setTimeout:(f,ms)=>{const i=++tid;timers.set(i,f);log.push(['setTimeout',ms]);return i;},
    clearTimeout:i=>{timers.delete(i);},Object,Promise,Error,JSON,Map,Number,Array,Symbol,
    console:{warn:(...a)=>log.push(['warn',a[0],snapshot(a[1])]),log(){},error(){}}};
  // Loader side: answer `initialized` through the window, then replies via the port.
  const hello=(extra={})=>winListeners.get('message')({source:loaderWindow,ports:[port],
    data:{id:PRODUCT,type:'nicovideo',token:TOKEN,body:{command:'initialized'},...extra}});
  const replyLast=(status,params)=>{const m=port.sent.at(-1);
    port.l.get('message')({data:{id:PRODUCT,type:'nicovideo',token:TOKEN,sessionId:m.sessionId,body:{command:m.body.command,status,params}}});};
  return {log,globals,port,hello,replyLast,timers,winListeners,loaderWindow};
}

async function compare(label,run){
  const out=[];
  for(const code of [before,after]){
    const w=world();
    const Gate=loadLegacy(withEmitter(code),'CrossDomainGate',w.globals);
    const r=await settle(()=>run(Gate,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log)});
  }
  assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' side effects');
}
const make=Gate=>new Gate({baseUrl:'https://www.nicovideo.jp/loader',type:'nicovideo',suffix:'a'});

test('handshake, token checks, fetch reply to Response/arraybuffer, failure status', async()=>{
  await compare('handshake+fetch',async(Gate,w)=>{
    const g=make(Gate);
    const r=[Gate.hostReg.test('www.nicovideo.jp'),Gate.hostReg.test('evil.example')];
    const p=g.fetch('https://www.nicovideo.jp/api',{method:'GET'});
    await flush();
    // a foreign window and a bad token are ignored
    w.winListeners.get('message')({source:{},data:{id:PRODUCT,type:'nicovideo',token:TOKEN,body:{command:'initialized'}}});
    w.winListeners.get('message')({source:w.loaderWindow,ports:[w.port],data:{id:PRODUCT,type:'nicovideo',token:'bad',body:{command:'initialized'}}});
    w.hello();
    await flush();
    w.replyLast('ok',{buffer:'BUF',init:{status:200},headers:[['a','1']]});
    const res=await p;
    r.push([res.status,res.statusText,res.headers,res.body]);
    const p2=g.fetch(new URL('https://www.nicovideo.jp/x'),{_format:'arraybuffer'});await flush();
    w.replyLast('ok',{buffer:'B2',init:{status:204,statusText:'No'},headers:[]});
    r.push(await p2);
    const p3=g.fetch('https://www.nicovideo.jp/y');await flush();
    w.replyLast('fail',null);
    r.push(await p3.then(()=>'ok',e=>e));
    const p4=g.videoCapture('src',3);await flush();w.replyLast('ok',{dataUrl:'data:x'});
    r.push(await p4);
    return r;
  });
});

test('timeout, abort, notify-only messages, broadcast, dispose and reconnect', async()=>{
  await compare('lifecycle',async(Gate,w)=>{
    const g=make(Gate);const r=[];
    const p=g.postMessage({command:'loadUrl',params:{url:'u'}});await flush();w.hello();await flush();
    [...w.timers.values()].at(-1)();
    r.push(await p.then(()=>'ok',e=>[e.message,e.status]));
    const ac=new AbortController();
    const p2=g._fetch('https://www.nicovideo.jp/z',{signal:ac.signal,timeout:5});await flush();
    ac.abort();
    r.push(await p2.then(()=>'ok',e=>e.name));
    await g.sendMessage({hello:1});await g.pushHistory('/p','t');
    w.port.l.get('message')({data:{id:PRODUCT,type:'nicovideo',token:TOKEN,sessionId:'s',body:{command:'message',params:{x:1}}}});
    w.port.l.get('message')({data:'{broken'});
    const pending=g.postMessage({command:'slow'});await flush();
    g.dispose();
    r.push(await pending.then(()=>'ok',e=>e.message));
    r.push(await g.postMessage({command:'after'}).then(()=>'ok',e=>e.message));
    const again=g.reconnect();w.hello();await flush();
    r.push(await again);
    return r;
  });
});

test('configBridge and bridgeDb', async()=>{
  await compare('config+db',async(Gate,w)=>{
    const g=make(Gate);const r=[];
    const listeners=[];
    const config={getKeys:()=>['a','b'],props:{},on:(n,f)=>{listeners.push(f);w.log.push(['config.on',n]);},off:(n)=>w.log.push(['config.off',n])};
    const cb=g.configBridge(config);await flush();w.hello();await flush();
    w.replyLast('ok',{a:1,b:'x'});await cb;
    r.push(config.props);
    listeners[0]('autoCloseFullScreen',true);listeners[0]('volume',0.5);
    await flush();
    const dbp=g.bridgeDb({name:'cache',ver:1,stores:[{name:'items'}]});await flush();
    w.replyLast('ok','worker-ref');
    const db=await dbp;
    r.push(Object.keys(db).sort(),db.worker);
    const got=db.items.get({key:'k'});await flush();w.replyLast('ok',{id:'k'});
    r.push(await got);
    return r;
  });
});
