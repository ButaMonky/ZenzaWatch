'use strict';
const assert=require('assert');
const {beginSection,read,createContext,run}=require('../helpers/extractSource');
const FORK_LABEL={0:'main',1:'owner',2:'easy',3:'ai'};
const commentSchemaError=reason=>({kind:'schema',errorCode:'RESPONSE_SCHEMA',reason});
function before(){
  return run(read('test/fixtures/Task498CommentReadAdapter.before.js')+
    ';CommentReadAdapter;',createContext({FORK_LABEL,commentSchemaError}));
}
function after(){
  return run(beginSection('packages/lib/src/nico/CommentReadAdapter.js')+
    ';CommentReadAdapter;',createContext({}));
}
function call(api,method,...args){
  try{return {ok:true,value:api[method](...args)};}
  catch(e){return {ok:false,error:JSON.stringify(e)};}
}
function verify(method,data,msgInfo) {
  const old=before(),next=after();
  const args=method==='threads'?[data,msgInfo]:[data];
  const a=call(old,method,...args),b=call(next,method,...args);
  assert.strictEqual(b.ok,a.ok,method+' success parity');
  if(a.ok){
    assert.strictEqual(a.value,data,'old preserves input identity');
    assert.strictEqual(b.value,data,'new preserves input identity');
  }else{
    assert.strictEqual(b.error,a.error,method+' error parity');
  }
}
describe('Task498 CommentReadAdapter legacy/TS behavior parity',()=>{
  it('requires a nonblank threadKey without normalizing it',()=>{
    for(const data of [null,undefined,false,'abc',[],{}, {threadKey:42},
      {threadKey:''},{threadKey:' \t'},
      {threadKey:' token ',trace:{foo:'bar'}}]){
      verify('threadKey',data);
    }
  });
  it('accepts valid target threads including numeric forks',()=>{
    for(const fork of [0,'main',1,'owner',2,'easy',3,'ai']){
      const actual=typeof fork==='number'?FORK_LABEL[fork]:fork;
      const data={globalComments:[{count:1}],threads:[
        {id:10,fork:actual,commentCount:1,comments:[{body:'fixture'}]}
      ]};
      verify('threads',data,{threads:[{id:10,fork}]});
    }
  });
  it('rejects malformed envelopes and counts consistently',()=>{
    const good={globalComments:[{count:1}],threads:[
      {id:10,fork:'main',commentCount:1,comments:[{}]}]};
    const msg={threads:[{id:10,fork:0}]};
    for(const data of [null,0,{},[],{globalComments:[],threads:[]},
      {...good,globalComments:[{count:-1}]},
      {...good,globalComments:[{count:1.25}]},
      {...good,globalComments:[{}]},
      {...good,threads:[{id:10,fork:'main',commentCount:-1,comments:[]}]},
      {...good,threads:[{id:11,fork:'main',commentCount:1,comments:[{}]}]},
      {...good,threads:[{id:'bad',fork:'main',commentCount:1,comments:[]}]},
      {...good,threads:[...good.threads,...good.threads]},
      {...good,threads:[{id:10,fork:'main',commentCount:1,comments:[null]}]}
    ])verify('threads',data,msg);
  });
  it('requires msgInfo threads and known forks without leaking payload',()=>{
    const data={globalComments:[],threads:[]};
    for(const msg of [null,undefined,{},[],{threads:null},{threads:'bad'},
      {threads:[]},{threads:[{id:1,fork:99}]}]){
      verify('threads',data,msg);
    }
  });
});
