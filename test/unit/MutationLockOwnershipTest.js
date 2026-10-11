'use strict';
const assert = require('assert');
const {createContext,loadClass} = require('../helpers/extractSource');

function fakeTimers() {
  let now=0,seq=0;
  const scheduled=new Map();
  return {
    setTimeout(fn,ms){const id=++seq;scheduled.set(id,{fn,at:now+ms});return id;},
    clearTimeout(id){scheduled.delete(id);},
    advance(ms){
      const end=now+ms;
      for(;;) {
        const next=[...scheduled.entries()].filter(([,t])=>t.at<=end)
          .sort((a,b)=>a[1].at-b[1].at)[0];
        if(!next) break;
        scheduled.delete(next[0]);now=next[1].at;next[1].fn();
      }
      now=end;
    }
  };
}
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function harness(file) {
  const timers=fakeTimers(),requests=[],notifications=[];
  const apis=['addMylistItem','removeMylistItem','addDeflistItem','removeDeflistItem'];
  const api={};
  for(const name of apis)api[name]=(...args)=>{
    let resolve,reject;
    const promise=new Promise((ok,fail)=>{resolve=ok;reject=fail;});
    requests.push({name,args,resolve,reject});
    return promise;
  };
  const c=createContext({
    Emitter:class {},util:{isLogin:()=>true},console:{log(){},warn(){},error(){}},
    MylistApiLoader:api,ThumbInfoLoader:{load:async()=>({owner:{name:'owner',linkId:'1'}})},
    setTimeout:timers.setTimeout,clearTimeout:timers.clearTimeout
  });
  const Dialog=loadClass(file,'NicoVideoPlayerDialog',c);
  const dialog=Object.create(Dialog.prototype);
  dialog._state={isUpdatingMylist:false,isUpdatingDeflist:false};
  dialog._watchId='smA';
  dialog._videoInfo={watchId:'smA',owner:{name:'owner',linkId:'1'},originalVideoId:null};
  dialog._playerConfig={props:{enableAutoMylistComment:false},getValue:()=>false};
  dialog._mylistApiLoader=api;
  dialog.execCommand=(...args)=>notifications.push(args);
  return {dialog,requests,notifications,advance:timers.advance,flush};
}
const actions={
  mylistAdd:d=>d._onMylistAdd('group','Saved'),
  mylistRemove:d=>d._onMylistRemove('group','Saved'),
  deflistAdd:d=>d._onDeflistAdd('smA'),
  deflistRemove:d=>d._onDeflistRemove('smA')
};
const busyFlag=kind=>kind.startsWith('mylist')?'isUpdatingMylist':'isUpdatingDeflist';

describe('Task324 AUD-44 mutation lock generation ownership',()=>{
  for(const file of ['src/NicoVideoPlayerDialog.js','dist/ZenzaWatch-dev.user.js']){
    for(const [first,second] of [
      ['mylistAdd','mylistRemove'],['mylistRemove','mylistAdd'],
      ['deflistAdd','deflistRemove'],['deflistRemove','deflistAdd']
    ]) {
      it(file+' protects '+second+' from late '+first+' cleanup',async()=>{
        const h=harness(file), flag=busyFlag(first);
        actions[first](h.dialog);await flush();
        assert.strictEqual(h.requests.length,1);
        assert.strictEqual(h.dialog._state[flag],true);
        h.advance(10000);
        assert.strictEqual(h.dialog._state[flag],false,'original ten-second fallback');
        actions[second](h.dialog);await flush();
        assert.strictEqual(h.requests.length,2);
        assert.strictEqual(h.dialog._state[flag],true);
        h.requests[0].resolve({message:'A finished'});await flush();
        h.advance(2000);
        assert.strictEqual(h.dialog._state[flag],true,'A stale timer must not unlock B');
        actions[first](h.dialog);await flush();
        assert.strictEqual(h.requests.length,2,'a third operation must be blocked');
        h.requests[1].resolve({message:'B finished'});await flush();
        h.advance(2000);
        assert.strictEqual(h.dialog._state[flag],false,'B can unlock its own operation');
        actions[first](h.dialog);await flush();
        assert.strictEqual(h.requests.length,3,'a new operation can start after B');
      });
    }
    for(const kind of Object.keys(actions)) {
      it(file+' preserves normal delayed unlock for '+kind,async()=>{
        const h=harness(file),flag=busyFlag(kind);
        actions[kind](h.dialog);await flush();
        assert.strictEqual(h.requests.length,1);
        h.requests[0].resolve({message:'done'});await flush();
        assert.strictEqual(h.dialog._state[flag],true);
        h.advance(1999);assert.strictEqual(h.dialog._state[flag],true);
        h.advance(1);assert.strictEqual(h.dialog._state[flag],false);
      });
    }
    for(const kind of ['mylistAdd','deflistRemove']) {
      it(file+' retains ten-second failsafe for '+kind,async()=>{
        const h=harness(file),flag=busyFlag(kind);
        actions[kind](h.dialog);await flush();
        h.advance(9999);assert.strictEqual(h.dialog._state[flag],true);
        h.advance(1);assert.strictEqual(h.dialog._state[flag],false);
      });
    }
  }
});
