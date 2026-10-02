const assert=require('assert');
const {beginSection,createContext,run,loadClass}=require('../helpers/extractSource');
const {createDialogHarness,flush}=require('../helpers/dialogHarness');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const ok=()=>({meta:{status:200},data:{threads:[],globalComments:[]}});
function subject() {
 const requests=[],timers=new Map(),waits=[],alerts=[];let id=0;
 const c=createContext({AbortController,console:{log(){},warn(){},error(){},time(){},timeEnd(){}},debug:{},logSafe:{redact:x=>x},
  PopupMessage:{alert:x=>alerts.push(x)},sleep:ms=>new Promise(resolve=>{waits.push(ms);timers.set(++id,{resolve,ms});}),
  setTimeout:(resolve,ms)=>{waits.push(ms);timers.set(++id,{resolve,ms});return id;},clearTimeout:n=>timers.delete(n),
  netUtil:{fetch:(url,options)=>{const q=defer();requests.push({url:String(url),options,...q});return q.promise;}}});
 run(beginSection('packages/lib/src/nico/ThreadLoader.js')+';globalThis.loader=ThreadLoader;',c);
 const msg={videoId:'sm9',userId:'u',threadId:'t',threads:[],defaultThread:{is184Forced:false},language:'en-us',nvComment:{server:'https://example.invalid',threadKey:'key',params:{language:'ja-jp'}}};
 const reply=async(i,body=ok(),header)=>{await flush();requests[i].resolve({status:body.meta.status,headers:{get:()=>header||null},json:async()=>body});await flush();};
 return {loader:c.loader,msg,requests,timers,waits,alerts,reply};
}
const observe=p=>p.then(value=>({value}),error=>({error}));
describe('Task159 コメント取得の中断と再試行',()=>{
 it('中断済みなら通信を開始しない',async()=>{
  const h=subject(),ac=new AbortController();ac.abort();const p=observe(h.loader.load(h.msg,{signal:ac.signal}));await flush();
  assert.equal(h.requests.length,0);assert.equal((await p).error.name,'AbortError');
 });
 it('signalを本文取得へ渡し、通信待機中の中断で即座に終了する',async()=>{
  const h=subject(),ac=new AbortController();let done=false;
  const p=observe(h.loader.load(h.msg,{signal:ac.signal})).then(x=>(done=true,x));await flush();
  assert.strictEqual(h.requests[0].options.signal,ac.signal);ac.abort();await flush();assert.equal(done,true);
  assert.equal((await p).error.name,'AbortError');assert.equal(h.alerts.length,0);
 });
 it('本文解析中の中断後は言語とthreadInfoを変更しない',async()=>{
  const h=subject(),ac=new AbortController(),body=defer();const p=observe(h.loader.load(h.msg,{signal:ac.signal}));await flush();
  h.requests[0].resolve({status:200,headers:{get:()=>null},json:()=>body.promise});await flush();ac.abort();
  body.resolve(ok());await flush();assert.ok((await p).error);assert.equal(h.msg.threadInfo,undefined);assert.equal(h.alerts.length,0);
 });
 it('再試行待機中の中断でタイマーを解放し、再送しない',async()=>{
  const h=subject(),ac=new AbortController();let done=false;const p=observe(h.loader.load(h.msg,{signal:ac.signal})).then(x=>(done=true,x));
  await h.reply(0,{meta:{status:503}});assert.equal(h.timers.size,1);ac.abort();await flush();
  assert.equal(done,true);assert.equal(h.timers.size,0);assert.equal(h.requests.length,1);assert.equal((await p).error.name,'AbortError');
 });
 it('キー再取得にもsignalを渡し、遅れたキーを保存しない',async()=>{
  const h=subject(),ac=new AbortController();const p=observe(h.loader.load(h.msg,{signal:ac.signal}));await h.reply(0,{meta:{status:503}});
  const [id,t]=[...h.timers][0];h.timers.delete(id);t.resolve();await flush();assert.equal(h.requests.length,2);
  assert.strictEqual(h.requests[1].options.signal,ac.signal);ac.abort();
  await h.reply(1,{meta:{status:200},data:{threadKey:'late'}});assert.equal((await p).error.name,'AbortError');
  assert.equal(h.loader._threadKeys.sm9,undefined);assert.equal(h.requests.length,2);
 });
 for(const [header,expected] of [['12',12000],['0',3000],['garbage',3000],['-1',3000]])it('Retry-After '+header+' の待機',async()=>{
  const h=subject(),ac=new AbortController();const p=observe(h.loader.load(h.msg,{signal:ac.signal}));
  await h.reply(0,{meta:{status:429}},header);assert.equal(h.waits[0],expected);ac.abort();await p;
 });
 it('Retry-AfterのHTTP日時を受信時刻との差として扱う',async()=>{
  const h=subject(),ac=new AbortController();const p=observe(h.loader.load(h.msg,{signal:ac.signal}));
  await h.reply(0,{meta:{status:503}},new Date(Date.now()+15000).toUTCString());assert.ok(h.waits[0]>13000&&h.waits[0]<=15000);ac.abort();await p;
 });
 it('極端に長いRetry-Afterは短縮再送せず失敗として終了する',async()=>{
  const h=subject();let done=false;const p=observe(h.loader.load(h.msg)).then(x=>(done=true,x));await h.reply(0,{meta:{status:429}},'999999999999');
  assert.equal(done,true);assert.ok((await p).error);assert.equal(h.waits.length,0);assert.equal(h.requests.length,1);
 });
 it('HTTP失敗の本文がJSONでなくてもstatusとRetry-Afterを使う',async()=>{
  const h=subject(),ac=new AbortController();const p=observe(h.loader.load(h.msg,{signal:ac.signal}));
  await flush();h.requests[0].resolve({status:503,headers:{get:()=> '9'},json:async()=>{throw SyntaxError('html');}});await flush();
  assert.equal(h.waits[0],9000);ac.abort();await p;
 });
 it('正常完了なら中断リスナーを残さない',async()=>{
  const h=subject(),ac=new AbortController();let adds=0,removes=0;
  const add=ac.signal.addEventListener.bind(ac.signal),remove=ac.signal.removeEventListener.bind(ac.signal);
  ac.signal.addEventListener=(...a)=>{adds++;add(...a);};ac.signal.removeEventListener=(...a)=>{removes++;remove(...a);};
  const p=h.loader.load(h.msg,{signal:ac.signal});await h.reply(0);assert.equal((await p).format,'threads');assert.equal(adds,removes);assert.equal(h.timers.size,0);
 });
});
function dialog(){
 const h=createDialogHarness();h.context.AbortController=AbortController;
 h.dialog.loadComment=h.Dialog.prototype.loadComment;
 const requests=[],success=[],fail=[];
 h.dialog.threadLoader={load:(msg,options)=>{const d=defer();requests.push({msg,options,...d});return d.promise;}};
 h.dialog._onCommentLoadSuccess=(id,r)=>success.push(r);h.dialog._onCommentLoadFail=(id,e)=>fail.push(e);
 h.dialog._requestId='A';return {...h,requests,success,fail};
}
describe('Task159 ダイアログがコメント取得を所有する',()=>{
 it('同じ動画の再読込でも古い成功・失敗を採用しない',async()=>{
  const h=dialog();h.dialog.loadComment({});h.dialog.loadComment({});
  h.requests[1].resolve('new');h.requests[0].resolve('old');await flush();assert.deepEqual(h.success,['new']);
  h.dialog.loadComment({});h.dialog.loadComment({});h.requests[2].reject(Error('old'));h.requests[3].resolve('new2');await flush();assert.equal(h.fail.length,0);
 });
 it('再読込、動画切替、閉じるで前のsignalを中断する',async()=>{
  const h=dialog();h.dialog.loadComment({});h.dialog.loadComment({});assert.equal(h.requests[0].options.signal.aborted,true);
  h.dialog.open('smB');await flush();assert.equal(h.requests[1].options.signal.aborted,true);
  h.dialog.loadComment({});h.dialog.close();assert.equal(h.requests[2].options.signal.aborted,true);
 });
 it('現在の読み込み失敗は通知し、所有者を解放する',async()=>{
  const h=dialog();h.dialog.loadComment({});const e=Error('current');h.requests[0].reject(e);await flush();
  assert.deepEqual(h.fail,[e]);assert.equal(h.dialog._commentLoadController,null);
 });
});
