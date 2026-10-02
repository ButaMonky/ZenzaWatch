const assert=require('assert');
const {beginSection,createContext,run}=require('../helpers/extractSource');
const flush=async()=>{for(let i=0;i<14;i++)await Promise.resolve();};
const observe=p=>p.then(value=>({value}),error=>({error}));
function subject(){
 const listeners=new Map(),timers=new Map(),frames=[],observers=[];let seq=0;
 const c=createContext({AbortController,PRODUCT:'ZenzaWatch',TOKEN:'token',location:{href:'https://www.nicovideo.jp',host:'www.nicovideo.jp'},
  console:{log(){},warn(){},time(){},timeEnd(){}},BroadcastEmitter:{emitAsync(){}},
  setTimeout:(fn,ms)=>{timers.set(++seq,{fn,ms});return seq;},clearTimeout:id=>timers.delete(id),
  addEventListener:(n,f)=>{if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},removeEventListener:(n,f)=>listeners.get(n)?.delete(f),
  MutationObserver:class{constructor(f){this.f=f;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}
 });
 c.document={body:{append:f=>f.parentNode=c.document.body},createElement:()=>{
  const frame={style:{},contentWindow:{location:{replace(){}}},remove(){this.parentNode=null;}};frames.push(frame);return frame;
 }};
 run(beginSection('packages/lib/src/Emitter.js'),c);
 const Gate=run(beginSection('packages/lib/src/infra/CrossDomainGate.js')+';CrossDomainGate;',c);
 const gate=new Gate({baseUrl:'https://www.nicovideo.jp/robots.txt',type:'test'});
 const port=()=>{const handlers=new Map(),sent=[];return {handlers,sent,closed:false,start(){},close(){this.closed=true;},
  postMessage:p=>sent.push(p),addEventListener:(n,f)=>handlers.set(n,f),removeEventListener:(n,f)=>{if(handlers.get(n)===f)handlers.delete(n);}};};
 const hello=(p=port(),frame=frames[frames.length-1])=>{
  const e={source:frame.contentWindow,ports:[p],data:{id:'ZenzaWatch',type:'test',token:'token',body:{command:'initialized',params:{command:'ready',status:'ok'}}}};
  for(const f of [...listeners.get('message')||[]])f(e);return p;
 };
 const request=()=>observe(gate._postMessage({command:'fetch',params:{url:'https://www.nicovideo.jp/api'}}));
 const respond=(p,value)=>{const packet=p.sent.find(x=>x.sessionId);p.handlers.get('message')({data:{id:'ZenzaWatch',type:'test',token:'token',sessionId:packet.sessionId,body:{command:'fetch',status:'ok',params:value}}});};
 const fire=ms=>{const found=[...timers].find(([,t])=>t.ms===ms);assert.ok(found,'timer '+ms);timers.delete(found[0]);found[1].fn();};
 return {c,gate,listeners,timers,frames,observers,hello,port,request,respond,fire};
}
describe('Task160 gate connection lifetime',()=>{
 it('初期化期限後は待機を解放し、次要求で接続できる',async()=>{
  const h=subject(),a=h.request();h.fire(60000);await flush();assert.ok((await a).error);
  assert.equal(h.timers.size,0);assert.equal(h.listeners.get('message').size,0);
  const b=h.request();assert.equal(h.frames.length,2);const p=h.hello();await flush();h.respond(p,42);assert.equal((await b).value,42);assert.equal(h.timers.size,0);
 });
 it('正常な初期化時に期限タイマーを解除する',async()=>{
  const h=subject();const ready=h.gate._initializeFrame();h.hello();await ready;assert.equal(h.timers.size,0);
 });
 it('個別要求の期限で登録を消し、同じ接続の後続要求は成功する',async()=>{
  const h=subject(),a=h.request(),p=h.hello();await flush();h.fire(60000);assert.ok((await a).error);assert.equal(Object.keys(h.gate._sessions).length,0);
  p.sent.length=0;const b=h.request();await flush();h.respond(p,8);assert.equal((await b).value,8);assert.equal(h.timers.size,0);
 });
 it('初期化途中のdisposeを複数回呼んでも残留しない',async()=>{
  const h=subject(),a=h.request();h.gate.dispose();h.gate.dispose();assert.ok((await a).error);
  assert.equal(h.timers.size,0);assert.equal(h.listeners.get('message').size,0);assert.equal(h.frames[0].parentNode,null);
  assert.ok((await h.request()).error);assert.equal(h.frames.length,1);
 });
 it('確立後のdisposeは全要求を失敗にしport・監視を解放する',async()=>{
  const h=subject(),a=h.request(),p=h.hello();await flush();const b=h.request();await flush();h.gate.dispose();
  assert.ok((await a).error);assert.ok((await b).error);assert.equal(p.closed,true);assert.equal(p.handlers.size,0);assert.equal(h.timers.size,0);assert.ok(h.observers.every(o=>!o.active));
 });
 it('フレーム削除で待機を解放し、次要求を新しい接続へ送る',async()=>{
  const h=subject(),a=h.request(),p=h.hello();await flush();h.frames[0].parentNode=null;
  for(const o of h.observers)if(o.active)o.f();await flush();assert.equal(p.closed,true);assert.ok((await a).error);
  const b=h.request(),next=h.hello();await flush();h.respond(next,7);assert.equal((await b).value,7);
 });
 it('reconnect後に旧port応答を受信しても新要求を決着しない',async()=>{
  const h=subject(),a=h.request(),old=h.hello();await flush();const stale=old.handlers.get('message');
  const ready=h.gate.reconnect();assert.ok((await a).error);const p=h.hello();await ready;
  let done=false;const b=h.request().then(x=>(done=true,x));await flush();const id=p.sent.find(x=>x.sessionId).sessionId;
  stale({data:{id:'ZenzaWatch',type:'test',token:'token',sessionId:id,body:{command:'fetch',status:'ok',params:'old'}}});await flush();assert.equal(done,false);
  h.respond(p,'new');assert.equal((await b).value,'new');
 });
 it('messageerrorとpagehideで接続を解放し、再送はしない',async()=>{
  for(const event of ['messageerror','pagehide']){
   const h=subject(),a=h.request(),p=h.hello();await flush();
   if(event==='messageerror')p.handlers.get(event)({});else for(const f of h.listeners.get(event))f({persisted:true});
   assert.ok((await a).error);assert.equal(p.closed,true);assert.equal(h.frames.length,1);assert.equal(h.timers.size,0);
  }
 });
 it('不正JSONや欠けた初期化通知で例外・誤初期化しない',async()=>{
  const h=subject();const ready=observe(h.gate._initializeFrame());const f=[...h.listeners.get('message')][0];
  for(const data of ['{',null,{}, {id:'ZenzaWatch',type:'test',token:'token',body:{command:'initialized'}}])assert.doesNotThrow(()=>f({source:h.frames[0].contentWindow,data,ports:[]}));
  assert.equal(h.gate._initializeStatus,'initializing');h.hello();assert.ok((await ready).value);
 });
 it('初期化直後のdisposeと送信再開が競合しても送信しない',async()=>{
  const h=subject(),a=h.request(),p=h.hello();h.gate.dispose();assert.ok((await a).error);assert.equal(p.sent.filter(x=>x.sessionId).length,0);
 });
 it('fetchのsignalを転送せず、abort時は相手へ中断を通知する',async()=>{
  const h=subject(),ac=new AbortController();const options=Object.freeze({signal:ac.signal});
  const a=observe(h.gate._fetch('https://www.nicovideo.jp/api',options)),p=h.hello();await flush();
  const packet=p.sent.find(x=>x.sessionId);assert.equal('signal' in packet.body.params.options,false);ac.abort();
  assert.equal((await a).error.name,'AbortError');assert.equal(h.timers.size,0);assert.equal(Object.keys(h.gate._sessions).length,0);
  assert.ok(p.sent.some(x=>x.body.command==='cancelFetch'&&x.body.params.sessionId===packet.sessionId));
 });
 it('一方の初期化待ちをabortしても別の要求は継続する',async()=>{
  const h=subject(),ac=new AbortController();let done=false;const a=observe(h.gate._fetch('https://www.nicovideo.jp/api',{signal:ac.signal})).then(x=>(done=true,x));
  const b=h.request();ac.abort();await flush();assert.equal(done,true);assert.equal((await a).error.name,'AbortError');
  const p=h.hello();await flush();h.respond(p,9);assert.equal((await b).value,9);
 });
 it('値が0の中断理由も成功に変えず初期化中・送信後とも伝える',async()=>{
  for(const initialized of [false,true]){
   const h=subject(),ac=new AbortController();const a=observe(h.gate._fetch('https://www.nicovideo.jp/api',{signal:ac.signal}));
   if(initialized){h.hello();await flush();}
   ac.abort(0);await flush();const result=await a;assert.ok(Object.prototype.hasOwnProperty.call(result,'error'));assert.strictEqual(result.error,0);
   h.gate.dispose();
  }
 });
 it('再接続後は既存DBハンドルを開き直し、保存操作を重複再送しない',async()=>{
  const h=subject();const opening=h.gate.bridgeDb({name:'cache',ver:1,stores:[{name:'items'}]});const p=h.hello();await flush();
  h.respond(p,{name:'cache',ver:1});const db=await opening;p.sent.length=0;
  const old=observe(db.items.put({id:'old'}));await flush();assert.equal(p.sent[0].body.params.command,'put');
  const ready=h.gate.reconnect();assert.ok((await old).error);const next=h.hello();await ready;
  const a=db.items.get({key:'one'});const b=db.items.get({key:'two'});await flush();
  const requests=next.sent.filter(x=>x.sessionId);assert.equal(requests.length,1);assert.equal(requests[0].body.params.command,'open');
  h.respond(next,{name:'cache',ver:1});next.sent.length=0;await flush();
  assert.equal(next.sent.length,2);assert.ok(next.sent.every(x=>x.body.params.command==='get'));
  for(const packet of [...next.sent])h.gate._onCommand({command:'bridge-db-result',status:'ok',params:packet.body.params.params.data.key},packet.sessionId);
  assert.deepEqual(await Promise.all([a,b]),['one','two']);assert.equal(h.timers.size,0);
 });
 it('応答受信からPromise完了までに破棄された結果も採用しない',async()=>{
  const h=subject(),a=h.request(),p=h.hello();await flush();h.respond(p,'obsolete');h.gate.dispose();assert.ok((await a).error);
 });
 it('disposeでconfig購読を解除する',async()=>{
  const h=subject();let callback,removed=0;
  const config={props:{},getKeys:()=>[],on:(name,f)=>callback=f,off:(name,f)=>{assert.strictEqual(f,callback);removed++;}};
  h.gate._postMessage=async()=>({});await h.gate.configBridge(config);h.gate.dispose();assert.equal(removed,1);
 });
});
function receiver(){
 const timers=new Map(),sent=[],handlers=[],calls=[];let seq=0,resolveFetch,resolveBody;
 const port={start(){},postMessage:p=>sent.push(p),addEventListener:(n,f)=>handlers.push(f)};
 const c=createContext({AbortController,PRODUCT:'ZenzaWatch',workerUtil:{env(){}},name:'testZenzaWatchLoader',localStorage:{},
  location:{href:'https://www.nicovideo.jp/robots.txt',host:'www.nicovideo.jp',pathname:'/robots.txt',hash:'#token'},
  history:{replaceState(){}},console:{log(){},error(){},warn(){}},parent:{postMessage(){}},
  MessageChannel:class{constructor(){this.port1=port;this.port2={};}},
  document:{referrer:'https://www.nicovideo.jp/watch/sm9',createElement:()=>{let u;return {set href(v){u=new URL(v);},get hostname(){return u.hostname;},get protocol(){return u.protocol;}};}},
  setTimeout:(f,ms)=>{timers.set(++seq,{f,ms});return seq;},clearTimeout:id=>timers.delete(id),
  fetch:(url,options)=>{calls.push({url,options});return new Promise(r=>resolveFetch=r);}
 });
 const g=run(beginSection('packages/lib/src/message/gate.js')+';gate();',c);g.init({prefix:'test',type:'test'});
 const headers=()=>resolveFetch({status:200,headers:{entries:()=>[]},arrayBuffer:()=>new Promise(r=>resolveBody=r)});
 const cancel=(token='token')=>{for(const f of handlers)f({data:{token,body:{command:'cancelFetch',params:{sessionId:'one'}}},stopImmediatePropagation(){}});};
 return {g,timers,sent,calls,headers,cancel,body:b=>resolveBody(b),call:()=>g.xFetch({url:'https://www.nicovideo.jp/api',options:{timeout:20}},'one')};
}
describe('Task160 gate receiver fetch lifetime',()=>{
 it('本文を読み終わるまで期限と中断伝播を維持する',async()=>{
  const h=receiver(),p=h.call();h.headers();await flush();assert.equal(h.timers.size,1);
  const [id,t]=[...h.timers][0];h.timers.delete(id);t.f();await p;
  assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.timers.size,0);assert.equal(h.sent[0].body.message,'timeout');
  h.body(new ArrayBuffer(2));await flush();assert.equal(h.sent.length,1);
 });
 it('正しい接続tokenの中断だけを受け入れる',async()=>{
  const h=receiver(),p=h.call();h.headers();await flush();h.cancel('wrong');await flush();assert.equal(h.calls[0].options.signal.aborted,false);
  h.cancel();await p;assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.timers.size,0);assert.equal(h.sent[0].body.status,'fail');
 });
 it('正常に本文を受信した後は期限と中断対象を残さない',async()=>{
  const h=receiver(),p=h.call();h.headers();await flush();const body=new ArrayBuffer(3);h.body(body);await p;
  assert.strictEqual(h.sent[0].body.params.buffer,body);assert.equal(h.timers.size,0);h.cancel();assert.equal(h.calls[0].options.signal.aborted,false);
 });
});
