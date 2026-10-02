import assert from 'power-assert';
const {createContext, loadClass}=require('../helpers/extractSource');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function raf(callback,skip=0) {
 const frames=new Map();let id=0;
 const c=createContext({sleep:{resolve:Promise.resolve()},requestAnimationFrame:f=>{const n=id++;frames.set(n,f);return n;},cancelAnimationFrame:n=>frames.delete(n)});
 const Frame=loadClass('packages/lib/src/infra/RequestAnimationFrame.js','RequestAnimationFrame',c);
 const r=new Frame(callback,skip);
 const fire=()=>{const [n,f]=frames.entries().next().value;frames.delete(n);f();};
 return {r,frames,fire};
}
describe('Task158 描画の寿命',function(){
 it('callback例外後も次フレームで復帰する',async()=>{
  let calls=0;const h=raf(()=>{if(++calls===1)throw Error('drawing failed');});h.r.enable();
  assert.throws(h.fire,/drawing failed/);await flush();assert.equal(h.frames.size,1);
  h.fire();await flush();assert.equal(calls,2);h.r.disable();assert.equal(h.frames.size,0);
 });
 it('最初の予約IDが0でもdisableで取り消す',()=>{const h=raf(()=>{});h.r.enable();h.r.disable();assert.equal(h.frames.size,0);});
 it('microtask待機中のdisable後に新しい予約を作らない',async()=>{
  const h=raf(()=>{});h.r.enable();h.fire();h.r.disable();await flush();assert.equal(h.frames.size,0);
 });
 it('待機中のdisable→enableで予約が二重にならない',async()=>{
  let calls=0;const h=raf(()=>calls++);h.r.enable();h.fire();h.r.disable();h.r.enable();await flush();
  assert.equal(h.frames.size,1);h.fire();await flush();assert.equal(calls,2);assert.equal(h.frames.size,1);h.r.disable();
 });
 it('callback内で再開した世代に古い予約を重ねない',async()=>{
  const h=raf(()=>{h.r.disable();h.r.enable();});h.r.enable();h.fire();await flush();assert.equal(h.frames.size,1);h.r.disable();
 });
 it('execOnce例外でも停止し、次回execOnceを実行できる',async()=>{
  let calls=0;const h=raf(()=>{calls++;throw Error('once');});h.r.execOnce();assert.throws(h.fire,/once/);await flush();
  assert.equal(h.frames.size,0);h.r.execOnce();assert.throws(h.fire,/once/);assert.equal(calls,2);
 });
 it('フレームスキップとenableの冪等性を維持する',async()=>{
  let calls=0;const h=raf(()=>calls++,1);h.r.enable();h.r.enable();assert.equal(h.frames.size,1);
  h.fire();await flush();assert.equal(calls,0);h.fire();await flush();assert.equal(calls,1);h.r.disable();
 });
 it('古い世代のcallbackが遅れて届いても現世代を進めない',async()=>{
  let calls=0;const h=raf(()=>calls++);h.r.enable();const old=[...h.frames.values()][0];h.r.disable();h.r.enable();
  old();await flush();assert.equal(calls,0);assert.equal(h.frames.size,1);h.r.disable();
 });
});
function view() {
 const handlers={};const document={visibilityState:'visible',addEventListener:(type,f)=>handlers[type]=f};
 const c=createContext({document,Emitter:class{},Config:{namespace:()=>({})},throttle:{raf:f=>f},global:{debug:{}},console:{log(){}}});
 const View=loadClass('packages/zenza/src/commentLayer/NicoCommentCss3PlayerView.js','NicoCommentCss3PlayerView',c);
 View.prototype._initializeView=function(){};View.prototype.refresh=function(){this.refreshCount=(this.refreshCount||0)+1;};
 const v=new View({viewModel:{on(){}}});return {v,document,show:handlers.visibilitychange};
}
describe('Task158 タブ復帰',()=>{
 it('iframe初期化前の復帰で例外を出さない',()=>{const h=view();h.show();assert.equal(h.v.refreshCount,1);});
 it('準備後はresizeし、非表示への変更では処理しない',()=>{
  const h=view();let count=0;h.v._view={};h.v.onResize=()=>count++;h.show();assert.equal(count,1);
  h.document.visibilityState='hidden';h.show();assert.equal(count,1);assert.equal(h.v.refreshCount,1);
 });
});
function group() {
 const c=createContext({console:{warn(){}}});
 const G=loadClass('packages/zenza/src/commentLayer/NicoChatGroupViewModel.js','NicoChatGroupViewModel',c);
 const g=Object.create(G.prototype);g._lastUpdate=0;
 const members=['a','b'].map(id=>({id,type:'naka',y:5,set bulkLayoutData(v){this.y=v.ypos;this.overflow=v.isOverflow;}}));
 g._members=members;g._vSortedMembers=members;
 Object.defineProperty(g,'bulkLayoutData',{get:()=>members.map(m=>({id:m.id,ypos:5,isOverflow:false}))});
 return {g,members,async reply(change){g._layoutWorker={post:async({params})=>change({lastUpdate:params.lastUpdate,members:params.members.map(m=>({...m,ypos:25}))})};await g._execCommentLayoutWorker();}};
}
describe('Task158 Worker配置の一括検証',()=>{
 const changes={sparse:r=>(delete r.members[1],r),short:r=>({...r,members:r.members.slice(0,1)}),long:r=>({...r,members:[...r.members,r.members[0]]}),missing:r=>({...r,members:null}),wrongID:r=>(r.members[1].id='other',r),notFinite:r=>(r.members[1].ypos=NaN,r),infinity:r=>(r.members[1].ypos=Infinity,r),stringY:r=>(r.members[1].ypos='25',r),invalidOverflow:r=>(r.members[1].isOverflow='false',r)};
 for(const [name,change] of Object.entries(changes))it(name+'で一部のコメントも上書きしない',async()=>{
  const h=group();await h.reply(change);assert.deepEqual(h.members.map(m=>m.y),[5,5]);
 });
 it('妥当な全件の結果は反映できる',async()=>{const h=group();await h.reply(r=>r);assert.deepEqual(h.members.map(m=>m.y),[25,25]);});
});
