'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
async function flush(){for(let i=0;i<18;i++)await Promise.resolve();}
function fixture(file,queue){
  let calls=0;
  const util={fetch:async()=>{calls++;const next=queue.shift();if(next instanceof Error)throw next;
    if(next?.pending)return await next.pending;
    return {ok:next?.ok??true,status:next?.status??200,
      json:async()=>next?.json};
  }};
  const ctx=createContext({util,VideoSession:class{}});
  const C=loadClass(file,'DmcSession',ctx);
  const d=Object.create(C.prototype),fails=[];
  d.info={heartBeatUrl:'https://example.invalid/heartbeat',sessionId:'session-1'};
  d._lastResponse={session:{id:'session-1',initial:true}};
  d._lastUpdate=123;d._isClosed=false;d._isDeleted=false;
  d._onHeartBeatSuccess=d._onHeartBeatSuccess.bind(d);
  d._onHeartBeatFail=()=>fails.push('failed');
  return {d,fails,calls:()=>calls};
}
describe('Issue #256: DMC heartbeat result validation and owner isolation',()=>{
  for(const file of ['packages/lib/src/nico/VideoSessionWorker.js','dist/ZenzaWatch-dev.user.js']){
    it(file+' rejects HTTP and API failures without overwriting a valid session',async()=>{
      for(const entry of [
        {status:403,json:{meta:{status:200},data:{session:{id:'session-1'}}}},
        {json:{meta:{status:403}}},
        {json:{meta:{status:200},data:null}},
        {json:{meta:{status:200},data:{session:[]}}}
      ]){
        const h=fixture(file,[entry]),before=h.d._lastResponse;
        h.d._heartBeat();await flush();
        assert.strictEqual(h.d._lastResponse,before);
        assert.strictEqual(h.d._lastUpdate,123);
        assert.deepStrictEqual(h.fails,['failed']);
      }
    });
    it(file+' accepts valid session heartbeat',async()=>{
      const valid={meta:{status:200},data:{session:{id:'session-1',heartbeat:1}}};
      const h=fixture(file,[{json:valid}]);h.d._heartBeat();await flush();
      assert.strictEqual(h.d._lastResponse,valid.data);
      assert.equal(h.fails.length,0);
      assert(h.d._lastUpdate>123);
    });
    it(file+' ignores delayed completion after close',async()=>{
      let release;
      const wait=new Promise(resolve=>{release=resolve;});
      const h=fixture(file,[{pending:wait}]),before=h.d._lastResponse;
      h.d._heartBeat();h.d._isClosed=true;
      release({ok:true,status:200,json:async()=>({meta:{status:200},data:{session:{id:'session-1'}}})});
      await flush();
      assert.strictEqual(h.d._lastResponse,before);
      assert.equal(h.fails.length,0);
    });
    it(file+' ignores older heartbeat completion after a newer success',async()=>{
      let release;const old=new Promise(resolve=>{release=resolve;});
      const good={meta:{status:200},data:{session:{id:'session-1',fresh:true}}};
      const h=fixture(file,[{pending:old},{json:good}]);
      h.d._heartBeat();h.d._heartBeat();await flush();
      const last=h.d._lastResponse;
      assert.strictEqual(last,good.data);
      release({ok:true,status:200,json:async()=>({meta:{status:200},data:{session:{id:'session-1',old:true}}})});
      await flush();
      assert.strictEqual(h.d._lastResponse,last);
    });
  }
});
