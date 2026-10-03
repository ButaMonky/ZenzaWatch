import assert from 'power-assert';
const {createContext, loadClass} = require('../helpers/extractSource');
const flush = async () => { for(let i=0;i<8;i++) await Promise.resolve(); };
function subject() {
  const requests=[], timers=[];
  const worker={post({params}) { return new Promise((resolve,reject)=>requests.push({params,resolve,reject})); }};
  const VM={prepareCommentArt(){},SPEED_RATE:1,emitter:{on(){}},create(chat) {
    return {id:chat.id,type:'naka',vpos:chat.vpos||0,y:0,beginLeftTiming:0,endRightTiming:4,
      get bulkLayoutData(){return {id:this.id,type:this.type,ypos:this.y,isOverflow:false};},
      set bulkLayoutData(data){this.y=data.ypos;},
      checkCollision(){return false;},reset(){},resetLayoutForSpeedChange(){this.y=0;},
      recalcBeginEndTiming(rate){this.endRightTiming=4/rate;}};
  }};
  const quiet={log(){},warn(){},time(){},timeEnd(){}};
  const c=createContext({console:quiet,Date:{now:()=>123},setTimeout:f=>timers.push(f),
    NicoChatViewModel:VM,NicoChat:{SORT_FUNCTION:(a,b)=>a.vpos-b.vpos},
    CommentLayoutWorker:{getInstance:()=>worker}});
  const Group=loadClass('packages/zenza/src/commentLayer/NicoChatGroupViewModel.js','NicoChatGroupViewModel',c);
  const make=()=>{const g=new Group({members:[],on(){},currentTime:0,type:'naka'},{});
    const exec=g._execCommentLayoutWorker.bind(g);
    g._execCommentLayoutWorker=()=>{const p=exec();p.catch(()=>{});return p;};return g;};
  const g=make();
  const finish=async (i,y)=>{const q=requests[i];q.resolve({lastUpdate:q.params.lastUpdate,
    members:q.params.members.map(m=>({...m,ypos:y}))});await flush();};
  return {g,make,requests,timers,finish,VM};
}
const chats=(prefix,n)=>Array.from({length:n},(_,i)=>({id:prefix+i,vpos:i*100}));
describe('非同期コメント配置の世代（H-01 / Task109）',function(){
  it('同じミリ秒に追加しても遅れて届く古い結果を採用しない',async function(){
    const h=subject();h.g.addChat({id:'a'});h.g.addChat({id:'b'});
    await h.finish(1,20);await h.finish(0,90);
    assert.deepEqual(h.g.members.map(m=>m.y),[20,20]);
  });
  it('速度を変えた後に古い配置が戻っても新しい配置を守る',async function(){
    const h=subject();h.g.addChat({id:'a'});h.g.changeSpeed(2);
    await h.finish(1,20);await h.finish(0,90);
    assert.equal(h.g.members[0].y,20);assert.equal(h.g.members[0].endRightTiming,2);
  });
  it('reset直後の別コメントへreset前のWorker結果を適用しない',async function(){
    const h=subject();h.g.addChat({id:'old'});h.g.reset();h.g.addChat({id:'new'});
    await h.finish(1,20);await h.finish(0,90);
    assert.equal(h.g.members[0].id,'new');assert.equal(h.g.members[0].y,20);
  });
  it('100件ごとの中断中にresetしたら残りの古い追加を取り消す',async function(){
    const h=subject();const adding=h.g.addChatArray(chats('old',101));
    h.g.reset();h.g.addChat({id:'new'});h.timers.shift()();await adding;
    assert.deepEqual(h.g.members.map(m=>m.id),['new']);assert.equal(h.requests.length,1);
  });
  it('分割追加の完了前でも既存Worker結果を無効にする',async function(){
    const h=subject();h.g.addChat({id:'seed'});const seed=h.g.members[0];
    const adding=h.g.addChatArray(chats('next',101));await h.finish(0,90);
    assert.equal(seed.y,0);h.timers.shift()();await adding;await h.finish(1,20);
    assert.equal(h.g.members.length,102);assert.ok(h.g.members.every(m=>m.y===20));
  });
  it('同じ世代で重なった追加は双方を残し、最新配置を適用する',async function(){
    const h=subject();const a=h.g.addChatArray(chats('a',101));const b=h.g.addChatArray(chats('b',101));
    h.timers.shift()();await a;h.timers.shift()();await b;
    await h.finish(1,20);await h.finish(0,90);
    assert.equal(h.g.members.length,202);assert.ok(h.g.members.every(m=>m.y===20));
  });
  it('Worker失敗を処理し、後続の配置で復帰できる',async function(){
    const h=subject();h.g.addChat({id:'a'});const result=h.g._execCommentLayoutWorker();
    h.requests[1].reject(new Error('worker failed'));await result;
    h.g.changeSpeed(2);await h.finish(2,20);assert.equal(h.g.members[0].y,20);
  });
  it('別グループの要求は互いの新旧判定に干渉しない',async function(){
    const h=subject(), other=h.make();h.g.addChat({id:'a'});other.addChat({id:'b'});
    await h.finish(1,20);await h.finish(0,10);
    assert.equal(h.g.members[0].y,10);assert.equal(other.members[0].y,20);
  });
});
