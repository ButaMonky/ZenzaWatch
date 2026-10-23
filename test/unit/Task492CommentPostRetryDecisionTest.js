'use strict';
const assert=require('assert');
const {beginSection, createContext, run}=require('../helpers/extractSource');
function wire() {
  return run(beginSection('packages/lib/src/nico/CommentPostWire.js')+
    ';CommentPostWire;',createContext({netUtil:{fetch:()=>{throw Error('offline');}}}));
}
describe('Task492 typed comment-post retry decision',()=>{
  it('refreshes post credentials only once for the two recognized token errors',()=>{
    const api=wire();
    for(const code of ['INVALID_TOKEN','EXPIRED_TOKEN']){
      const error={result:{status:403,errorCode:code}};
      const first=api.classifyPostFailure(error,false);
      const second=api.classifyPostFailure(error,true);
      assert.strictEqual(first.action,'retry-token');
      assert.strictEqual(second.action,'rejected');
      assert.strictEqual(first.statusCode,403);
      assert.strictEqual(first.errorCode,code);
    }
  });
  it('never retries invalid challenge or other HTTP400 parameter errors',()=>{
    const api=wire();
    for(const code of ['INVALID_CHALLENGE_TOKEN','INVALID_PARAMETER','FORBIDDEN']){
      const decision=api.classifyPostFailure({result:{status:400,errorCode:code}},false);
      assert.strictEqual(decision.action,'rejected');
      assert.strictEqual(decision.statusCode,400);
      assert.strictEqual(decision.errorCode,code);
    }
  });
  it('preserves unknown outcomes for network and timed-out responses',()=>{
    const api=wire();
    for(const error of [null,undefined,{result:{}},
      {kind:'network',result:{}},
      {result:{httpStatus:502,errorCode:'INVALID_TOKEN'}},
      {result:{status:null,errorCode:'INVALID_TOKEN'}}]){
      assert.strictEqual(api.classifyPostFailure(error,false).action,'unknown');
    }
  });
  it('does not normalize an existing non-null status code',()=>{
    const api=wire();
    const decision=api.classifyPostFailure({result:{status:'400',errorCode:'INVALID_CHALLENGE_TOKEN'}},false);
    assert.strictEqual(decision.action,'rejected');
    assert.strictEqual(decision.statusCode,'400');
  });
});
