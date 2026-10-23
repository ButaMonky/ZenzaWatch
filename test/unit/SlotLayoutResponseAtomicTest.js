'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
const NicoChat={
  SORT_FUNCTION:(a,b)=>a.vpos-b.vpos,
  TYPE:{TOP:'ue',NAKA:'naka',BOTTOM:'shita'}
};
function subject(){
  const warnings=[];
  const logger={time(){},timeEnd(){},warn(...args){warnings.push(args)}};
  const ctx=createContext({
    Emitter:class {},NicoChat,NicoChatViewModel:class {},
    CommentLayoutWorker:{getInstance:()=>null},SlotLayoutWorker:{},
    Config:{},NicoComment:{},console:logger,window:{console:logger}
  });
  const Group=loadClass(
    'packages/zenza/src/commentLayer/NicoChatGroupViewModel.js',
    'NicoChatGroupViewModel',ctx);
  const View=loadClass('packages/zenza/src/commentLayer/NicoCommentViewModel.js',
    'NicoCommentViewModel',ctx);
  const group=(numbers,fork)=>{
    const out=Object.create(Group.prototype);
    out._members=numbers.map(no=>({
      id:String(no),no,fork,vpos:no*100,inviewTiming:no,
      beginLeftTiming:no,endRightTiming:no+4,isInvisible:false,slot:-1
    }));
    return out;
  };
  const view=Object.create(View.prototype);
  view._topGroup=group([1,2],0);
  view._nakaGroup=group([3],1);
  view._bottomGroup=group([4],2);
  view._lastUpdate=12;
  const valid=params=>({
    lastUpdate:params.lastUpdate,
    top:params.top.map((x,i)=>({...x,slot:i})),
    naka:params.naka.map((x,i)=>({...x,slot:i})),
    bottom:params.bottom.map((x,i)=>({...x,slot:i}))
  });
  const slotState=()=>[
    view._topGroup._members.map(x=>x.slot),
    view._nakaGroup._members.map(x=>x.slot),
    view._bottomGroup._members.map(x=>x.slot)
  ];
  const run=async responder=>{
    view._slotLayoutWorker={post:async({params})=>responder(params,valid(params))};
    return view._updateSlotLayout();
  };
  return {view,warnings,slotState,run};
}
describe('Task707 atomic SlotLayoutWorker response application',function(){
  it('applies a valid complete reply to all groups',async()=>{
    const h=subject();
    await h.run((_params,valid)=>valid);
    assert.deepStrictEqual(h.slotState(),[[0,1],[0],[0]]);
  });
  const badReplies={
    'missing group':valid=>({...valid,naka:undefined}),
    'sparse middle group':valid=>({...valid,naka:new Array(valid.naka.length)}),
    'truncated group':valid=>({...valid,top:valid.top.slice(0,1)}),
    'identity mismatch':valid=>({...valid,top:[
      {...valid.top[0],id:'unrelated'},valid.top[1]
    ]}),
    'nonfinite slot':valid=>({...valid,top:[
      {...valid.top[0],slot:NaN},valid.top[1]
    ]}),
    'invalid top payload':valid=>({...valid,top:null})
  };
  for(const [name,modify] of Object.entries(badReplies)){
    it(name+' does not partially mutate comment groups',async()=>{
      const h=subject();
      await assert.doesNotReject(()=>h.run((_params,valid)=>modify(valid)));
      assert.deepStrictEqual(h.slotState(),[[-1,-1],[-1],[-1]]);
    });
  }
  it('handles an RPC rejection without unhandled layout failure',async()=>{
    const h=subject();
    await assert.doesNotReject(()=>h.run(()=>Promise.reject(new Error('offline'))));
    assert.deepStrictEqual(h.slotState(),[[-1,-1],[-1],[-1]]);
  });
  it('continues ignoring stale generation replies',async()=>{
    const h=subject();
    await h.run((_params,valid)=>({...valid,lastUpdate:11}));
    assert.deepStrictEqual(h.slotState(),[[-1,-1],[-1],[-1]]);
  });
});
