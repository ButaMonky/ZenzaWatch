import assert from 'power-assert';
const {JSDOM}=require('jsdom');
const lodash=require('lodash');
const {beginSection,createContext,run,loadClass}=require('../helpers/extractSource');
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
async function subject(queuedRaf=false){
  let now=0,seq=0;const timers=new Map();
  const set=(f,ms=0)=>{const id=++seq;timers.set(id,{f,at:now+ms});return id;};
  const clear=id=>timers.delete(id);
  class ClockDate extends Date {static now(){return now;}}
  const _=lodash.runInContext({Date:ClockDate,setTimeout:set,clearTimeout:clear});
  const tick=async ms=>{await flush();const end=now+ms;for(;;){
    const q=[...timers].filter(([,t])=>t.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
    if(!q)break;timers.delete(q[0]);now=q[1].at;q[1].f();await flush();
  }now=end;await flush();};
  const dom=new JSDOM('<body><div id="listContainer"><div id="listContainerInner"></div></div><div class="listMenu"></div><div class="itemDetailContainer"></div></body>');
  const w=dom.window,doc=w.document;w.setTimeout=set;w.clearTimeout=clear;
  Object.defineProperty(w,'innerHeight',{value:40});
  w.console={time(){},timeEnd(){},log(){},warn(){}};
  function uq(node){const nodes=node?[node]:[];const q={0:node,
    find:sel=>uq(node&&node.querySelector(sel)),on:()=>q,
    toggleClass:(name,v)=>{nodes.forEach(n=>n.classList.toggle(name,!!v));return q;},
    removeClass:name=>{nodes.forEach(n=>n.classList.remove(name));return q;}};return q;}
  class FrameLayer {constructor(){this.isVisible=true;this.frame=doc.createElement('iframe');doc.body.append(this.frame);}async wait(){return w;}}
  class ItemView {constructor({item,index,height}){this.top=index*height;this.viewElement=doc.createElement('div');this.viewElement.dataset.itemId=item.itemId;this.viewElement.textContent=item.text;}}
  ItemView.CSS='';
  const pending=[];let hold=false;
  const cssUtil={setProps(...tasks){for(const [e,k,v]of tasks)e.style.setProperty(k,v);return hold?new Promise(resolve=>pending.push(resolve)):Promise.resolve();}};
  const c=createContext({window:w,document:doc,_:_,FrameLayer,CommentListItemView:ItemView,uq,
    ClassList:e=>e.classList,cssUtil,throttle:{raf:f=>{if(!queuedRaf)return f;let id,args;return(...a)=>{args=a;if(id)return;id=set(()=>{id=null;f(...args);},16);};}},setTimeout:set,clearTimeout:clear,
    nicoUtil:{isLogin:()=>true,isPremium:()=>false},env:{isFirefox:()=>false},
    global:{debug:{},emitter:{emit(){},emitAsync(){}}},textUtil:{escapeHtml:String,dateToString:String,secToTime:String}});
  run(beginSection('packages/lib/src/Emitter.js'),c);
  c.CommentListItem=loadClass('src/CommentPanel.js','CommentListItem',c);c.CommentListItem._itemId=0;
  const Model=loadClass('src/CommentPanel.js','CommentListModel',c);
  const View=loadClass('src/CommentPanel.js','CommentListView',c);View.__tpl__='%CSS%';View.ITEM_HEIGHT=40;
  const model=new Model({});const view=new View({model,container:doc.body});await flush();view.isAutoScroll=true;
  model.on('currentTimeUpdate',(sec,idx)=>view.setCurrentPoint(sec,idx,view.isAutoScroll));
  model.setChatList({top:[],bottom:[],naka:[0,10,20,30,40].map((sec,i)=>({vpos:sec*100,text:'row'+i,date:i}))});
  model.currentTime=30;await tick(600);view.setCurrentPoint(30,model.getInViewIndex(30),true);if(queuedRaf)await tick(16);
  const visible=v=>{view.frameLayer.isVisible=v;view.frameLayer.frame.dispatchEvent(new w.CustomEvent('visibilitychange',{detail:{isVisible:v}}));};
  return {model,view,doc,tick,pending,hold:()=>{hold=true;},visible,close:()=>dom.window.close()};
}
describe('コメント一覧の描画と時刻の同期（H-03 / Task110）',function(){
  let h;afterEach(()=>h&&h.close());
  it('一時停止中に過去の行を消しても再描画後の現在行へ追従する',async function(){
    h=await subject();assert.equal(h.view._container.scrollTop,120);
    h.model.removeItemByIndex(0);await h.tick(600);
    assert.equal(h.view._container.scrollTop,80);assert.equal(h.doc.querySelectorAll('#listContainerInner>div').length,4);
  });
  it('描画待ち中の時刻通知で古い行へスクロールしない',async function(){
    h=await subject();h.model.removeItemByIndex(0);h.model.removeItemByIndex(0);h.model.currentTime=40;
    assert.equal(h.view._container.scrollTop,120);await h.tick(600);
    assert.equal(h.view.timeScrollTop,80);assert.equal(h.view._itemViews.length,3);
  });
  it('隠している間に時刻が進んでも再表示時に現在行へ追従する',async function(){
    h=await subject();h.visible(false);h.model.currentTime=40;
    assert.equal(h.view._container.scrollTop,120);h.visible(true);
    assert.equal(h.view._container.scrollTop,160);
  });
  it('降順表示でも再生時刻に対応する行を指す',async function(){
    h=await subject();h.model.sortBy('vpos',true);await h.tick(600);h.model.currentTime=10;
    const idx=h.model.getInViewIndex(10);assert.equal(h.model.getItemByIndex(idx).vpos,1000);
    assert.equal(h.view._container.scrollTop,120);
  });
  it('非表示から戻っても手動操作中の位置を奪わない',async function(){
    h=await subject();h.view.isActive=true;h.view._container.scrollTop=35;h.visible(false);h.model.currentTime=40;h.visible(true);
    assert.equal(h.view._container.scrollTop,35);
  });
  it('手動操作中に一覧が更新されても位置を奪わない',async function(){
    h=await subject();h.view.isActive=true;h.view._container.scrollTop=35;
    h.model.removeItemByIndex(0);await h.tick(600);
    assert.equal(h.view.isActive,true);assert.equal(h.view._container.scrollTop,35);
  });
  it('予約済みの次フレームのスクロールも描画待ち中は実行しない',async function(){
    h=await subject(true);h.model.currentTime=40;h.model.removeItemByIndex(0);await h.tick(16);
    assert.equal(h.view._container.scrollTop,120);await h.tick(600);assert.equal(h.view._container.scrollTop,120);
    h.model.currentTime=10;h.view.isActive=true;await h.tick(16);assert.equal(h.view._container.scrollTop,120);
  });
  it('既に予約された旧描画の完了通知も次の更新後は発火しない',async function(){
    h=await subject();let updates=0;h.view.on('update',()=>updates++);
    h.model.removeItemByIndex(0);await h.tick(500);h.model.removeItemByIndex(0);await h.tick(100);
    assert.equal(updates,0);await h.tick(500);assert.equal(updates,1);
  });
  it('自動スクロールOFFと時刻以外の並び替えでは位置を動かさない',async function(){
    h=await subject();h.view.isAutoScroll=false;h.model.removeItemByIndex(0);await h.tick(600);
    assert.equal(h.view._container.scrollTop,120);
    h.view.isAutoScroll=true;h.model.sortBy('date',true);await h.tick(600);h.model.currentTime=5;h.visible(false);h.visible(true);
    assert.equal(h.view._container.scrollTop,120);
  });
  it('古い描画のawait完了・遅延通知は新しい一覧へ干渉しない',async function(){
    h=await subject();let updates=0;h.view.on('update',()=>updates++);h.hold();
    h.model.removeItemByIndex(0);await h.tick(500);
    h.model.removeItemByIndex(0);await h.tick(500);
    assert.equal(h.pending.length,2);h.pending[0]();await flush();await h.tick(100);
    assert.equal(updates,0);h.pending[1]();await flush();await h.tick(100);
    assert.equal(updates,1);assert.equal(h.view._itemViews.length,3);assert.equal(h.view._container.scrollTop,40);
  });
});
