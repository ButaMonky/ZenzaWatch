'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {REPO_ROOT} = require('../helpers/buildSandbox');
const {beginSection,createContext,run,loadClass} = require('../helpers/extractSource');
const SOURCE = 'packages/zenza/src/commentLayer/SlotLayoutWorker.js';
function factory(code=beginSection(SOURCE)) {
  const context = createContext({
    workerUtil: {isAvailable:false},
    console: {time(){},timeEnd(){}}
  });
  run(code + '\nglobalThis.slotFactory = SlotLayoutWorker._func;',context);
  const self = {};
  context.slotFactory(self);
  return params => self.onmessage({command:'layout',params});
}
const copy = x => JSON.parse(JSON.stringify(x));
const row = (no,begin=0,end=10,fork=0,extra={}) =>
  ({no,begin,end,fork,invisible:false,...extra});
const payload = (top=[],naka=[],bottom=[],lastUpdate=123) =>
  ({top,naka,bottom,lastUpdate});

describe('Task628 SlotLayoutWorker allocation and RPC contract',()=>{
  it('returns the caller-required grouped object even when all groups are empty',()=>{
    const result=copy(factory()(payload()));
    assert.deepStrictEqual(result,payload());
  });
  it('allocates unique slots for overlapping comments in one fork',()=>{
    const result=factory()(payload([row(1),row(2),row(3)]));
    assert.deepStrictEqual(Array.from(result.top,x=>x.slot),[0,1,2]);
    assert.strictEqual(result.lastUpdate,123);
  });
  it('keeps independent slot queues per fork while retaining input groups',()=>{
    const result=factory()(payload(
      [row(1,6,10,0),row(2,0,10,1)],
      [row(3,1,9,0),row(4,4,10,2)],
      [row(5,3,10,1),row(6,2,10,2)],99));
    assert.deepStrictEqual(Array.from(result.top,x=>x.slot),[1,0]);
    assert.deepStrictEqual(Array.from(result.naka,x=>x.slot),[0,1]);
    assert.deepStrictEqual(Array.from(result.bottom,x=>x.slot),[1,0]);
    assert.strictEqual(result.lastUpdate,99);
  });
  it('recycles only when time is beyond the previous end boundary',()=>{
    const result=factory()(payload([row(1,0,10),row(2,10,20),row(3,10.01,18)]));
    assert.deepStrictEqual(Array.from(result.top,x=>x.slot),[0,1,0]);
  });
  it('evicts oldest slot at capacity without creating slot 40',()=>{
    const result=factory()(payload(Array.from({length:42},(_,i)=>row(i,0,10))));
    assert.deepStrictEqual(Array.from(result.top,x=>x.slot),
      [...Array.from({length:40},(_,i)=>i),0,1]);
  });
  it('does not give invisible comments a new slot or consume capacity',()=>{
    const result=factory()(payload([row(1,0,10,0,{invisible:true}),row(2),row(3)]));
    assert.deepStrictEqual(Array.from(result.top,x=>x.slot),[undefined,0,1]);
  });
  it('keeps per-request state separate and original group ordering intact',()=>{
    const invoke=factory();
    const first=invoke(payload([row(9,10,20),row(8,0,10)]));
    assert.deepStrictEqual(Array.from(first.top,x=>x.no),[9,8]);
    assert.deepStrictEqual(Array.from(first.top,x=>x.slot),[1,0]);
    const second=invoke(payload([row(1,0,10)]));
    assert.deepStrictEqual(Array.from(second.top,x=>x.slot),[0]);
  });
});
describe('Task628 live source contract with NicoCommentViewModel',()=>{
  it('feeds the real bulkSlotData setter without lost groups',async()=>{
    const NicoChat={SORT_FUNCTION:(a,b)=>a.vpos-b.vpos,TYPE:{TOP:'ue',NAKA:'naka',BOTTOM:'shita'}};
    const ctx=createContext({
      Emitter:class {},NicoChat,
      NicoChatViewModel:class {},
      CommentLayoutWorker:{getInstance:()=>null},
      SlotLayoutWorker:{},Config:{},NicoComment:{},
      console:{time(){},timeEnd(){},warn(){}},
      window:{console:{time(){},timeEnd(){},warn(){}}}
    });
    const Group=loadClass('packages/zenza/src/commentLayer/NicoChatGroupViewModel.js',
      'NicoChatGroupViewModel',ctx);
    const View=loadClass('packages/zenza/src/commentLayer/NicoCommentViewModel.js',
      'NicoCommentViewModel',ctx);
    const group = (...items)=>{
      const instance=Object.create(Group.prototype);
      instance._members=items.map(o=>({
        id:o.no,no:o.no,fork:o.fork,vpos:o.begin*100,
        inviewTiming:o.begin,beginLeftTiming:o.begin,endRightTiming:o.end,
        isInvisible:false,slot:undefined
      }));
      return instance;
    };
    const view=Object.create(View.prototype);
    view._topGroup=group(row(1,0,10),row(2,0,10));
    view._nakaGroup=group(row(3,0,10,1));
    view._bottomGroup=group(row(4,0,10,2));
    view._lastUpdate=123;
    const worker=factory();
    view._slotLayoutWorker={post:async ({params})=>worker(params)};
    await view._updateSlotLayout();
    assert.deepStrictEqual(view._topGroup._members.map(x=>x.slot),[0,1]);
    assert.deepStrictEqual(view._nakaGroup._members.map(x=>x.slot),[0]);
    assert.deepStrictEqual(view._bottomGroup._members.map(x=>x.slot),[0]);
  });
});

describe('Task628 generated development userscript parity',()=>{
  it('bundles the same grouped response and slot reuse behavior',()=>{
    const bundle=fs.readFileSync(path.join(REPO_ROOT,'dist/ZenzaWatch-dev.user.js'),'utf8');
    const begin=bundle.indexOf('const SlotLayoutWorker = (() => {');
    assert(begin>=0,'missing worker in dev bundle');
    const end=bundle.indexOf('})();',begin);
    assert(end>begin,'missing worker closure');
    const invoke=factory(bundle.slice(begin,end+5));
    const result=invoke(payload([row(1),row(2),row(3)]));
    assert.deepStrictEqual(Array.from(result.top,x=>x.slot),[0,1,2]);
    assert.strictEqual(result.lastUpdate,123);
    assert.deepStrictEqual(Array.from(result.naka,x=>x.slot),[]);
    assert.deepStrictEqual(Array.from(result.bottom,x=>x.slot),[]);
  });
});
