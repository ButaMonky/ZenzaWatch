'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');
const targets=[
  ['source','packages/zenza/src/commentLayer/NicoCommentViewModel.js'],
  ['generated Dev','dist/ZenzaWatch-dev.user.js']
];
function makeHarness(file){
  const warnings=[];
  const logger={time(){},timeEnd(){},warn:message=>warnings.push(message)};
  const context=createContext({
    Emitter:class{},NicoChat:{TYPE:{TOP:'ue',NAKA:'naka',BOTTOM:'shita'}},
    SlotLayoutWorker:{},NicoChatGroupViewModel:class{},
    Config:{},NicoComment:{},console:logger,window:{console:logger}
  });
  const View=loadClass(file,'NicoCommentViewModel',context);
  const group=(id, fork)=>{
    const rows=[{id,no:1,fork,slot:-1,begin:0,end:4,invisible:false}];
    return {rows,get bulkSlotData(){return rows.map(x=>({...x}));},
      set bulkSlotData(result){rows[0].slot=result[0].slot;}};
  };
  const view=Object.create(View.prototype);
  view._topGroup=group('top',0);
  view._nakaGroup=group('naka',1);
  view._bottomGroup=group('bottom',2);
  view._lastUpdate=33;
  const slots=()=>[view._topGroup.rows[0].slot,view._nakaGroup.rows[0].slot,
    view._bottomGroup.rows[0].slot];
  return {view,slots,warnings,async run(reply){
    view._slotLayoutWorker={post:async({params})=>reply(params)};
    await view._updateSlotLayout();
  }};
}
for(const [name,file] of targets){
  describe('Task708 generated slot response parity: '+name,function(){
    this.timeout(15000);
    const valid=params=>({
      lastUpdate:params.lastUpdate,
      top:params.top.map(x=>({...x,slot:0})),
      naka:params.naka.map(x=>({...x,slot:0})),
      bottom:params.bottom.map(x=>({...x,slot:0}))
    });
    it('accepts the complete validated grouped reply',async()=>{
      const h=makeHarness(file);
      await h.run(params=>valid(params));
      assert.deepStrictEqual(h.slots(),[0,0,0]);
    });
    it('rejects a malformed middle group before updating top',async()=>{
      const h=makeHarness(file);
      await h.run(params=>({...valid(params),naka:undefined}));
      assert.deepStrictEqual(h.slots(),[-1,-1,-1]);
    });
    it('rejects a sparse middle group before updating top',async()=>{
      const h=makeHarness(file);
      await h.run(params=>({...valid(params),naka:new Array(params.naka.length)}));
      assert.deepStrictEqual(h.slots(),[-1,-1,-1]);
    });
    it('recovers from an RPC error without partially updating',async()=>{
      const h=makeHarness(file);
      await h.run(()=>Promise.reject(new Error('internal secret')));
      assert.deepStrictEqual(h.slots(),[-1,-1,-1]);
      assert(h.warnings.includes('slotLayoutWorker request failed'));
      assert(!h.warnings.join(' ').includes('internal secret'));
    });
  });
}
