'use strict';
const assert=require('assert');
const {beginSection,createContext,run}=require('../helpers/extractSource');

function environment(code) {
  const diagnostics=[];
  const context=createContext({
    console:{log() {},warn() {},error() {}},
    logSafe:{redact:value=>value},
    sleep:async()=>{},
    netUtil:{fetch:()=>{throw Error('unexpected network')}}
  });
  const loader=run(beginSection('packages/lib/src/nico/ThreadLoader.js')+';ThreadLoader;',context);
  const wire=run('CommentPostWire',context);
  const calls=[];
  const original=wire.classifyPostFailure;
  wire.classifyPostFailure=(error,retrying)=>{
    const decision=original(error,retrying);
    calls.push({retrying,action:decision.action});
    return decision;
  };
  loader.getPostKey=async()=>({postKey:'fixture-key'});
  loader.load=async()=>{diagnostics.push('refresh');};
  loader._post=async()=>{throw {result:{status:400,errorCode:code}};};
  const msgInfo={threadInfo:{videoId:'sm9',threadId:12,language:'ja-jp'},
    nvComment:{server:'https://comments.invalid'}};
  return {loader,calls,diagnostics,msgInfo};
}
describe('Task492 ThreadLoader uses typed retry classification',()=>{
  it('keeps invalid challenge token as terminal rejected response',async()=>{
    const p=environment('INVALID_CHALLENGE_TOKEN');
    const error=await p.loader.postChat(p.msgInfo,'fixture','',0).then(()=>null,e=>e);
    assert(error && error.statusCode===400);
    assert.deepStrictEqual(p.calls,[{retrying:false,action:'rejected'}]);
    assert.deepStrictEqual(p.diagnostics,[]);
  });
  it('refreshes only for expired token and stops on second response',async()=>{
    const p=environment('EXPIRED_TOKEN');
    const error=await p.loader.postChat(p.msgInfo,'fixture','',0).then(()=>null,e=>e);
    assert(error && error.statusCode===400);
    assert.deepStrictEqual(p.calls,[
      {retrying:false,action:'retry-token'},
      {retrying:true,action:'rejected'}
    ]);
    assert.deepStrictEqual(p.diagnostics,['refresh']);
  });
});
