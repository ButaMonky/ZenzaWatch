'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(file,liked=false) {
  const requests=[],alerts=[],notices=[];
  let failSynchronously=false;
  function send(action,id) {
    if(failSynchronously)throw new Error('synchronous fixture failure');
    let resolve,reject;
    const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
    requests.push({action,id,resolve,reject});
    return promise;
  }
  const c=createContext({Emitter:class{},util:{isLogin:()=>true},
    console:{warn(){}},LikeApi:{like:id=>send('like',id),unlike:id=>send('unlike',id)}});
  const Dialog=loadClass(file,'NicoVideoPlayerDialog',c);
  const a={videoId:'smA',isLiked:liked},b={videoId:'smB',isLiked:false};
  const dialog=Object.assign(Object.create(Dialog.prototype),{_videoInfo:a,
    _state:{isLiked:liked},_view:{emit(){}},execCommand(type,value){
      (type==='alert'?alerts:notices).push(value);
    }});
  return {dialog,a,b,requests,alerts,notices,
    setFailure(value){failSynchronously=value;},
    select(model){dialog._videoInfo=model;dialog._state.isLiked=!!model?.isLiked;}};
}
for(const file of ['src/NicoVideoPlayerDialog.js','dist/ZenzaWatch-dev.user.js']) {
  describe('Task360 completion: like reentry and failure recovery ('+file+')',()=>{
    it('retains A ownership when returning from a pending B request',async()=>{
      const h=harness(file);
      h.dialog._onToggleLike(); h.select(h.b); h.dialog._onToggleLike();
      h.select(h.a); h.dialog._onToggleLike();
      assert.deepStrictEqual(h.requests.map(r=>r.id),['smA','smB']);
      h.requests[0].resolve({data:{}}); await tick();
      assert.strictEqual(h.a.isLiked,true);
      h.select(h.b); h.dialog._onToggleLike();
      assert.strictEqual(h.requests.length,2,'settling A must not unlock pending B');
      h.requests[1].resolve({data:{}}); await tick();
      assert.strictEqual(h.b.isLiked,true);
    });
    it('allows retrying A after its failure without releasing pending B',async()=>{
      const h=harness(file);
      h.dialog._onToggleLike(); h.select(h.b); h.dialog._onToggleLike();
      h.select(h.a); h.requests[0].reject(new Error('A failed')); await tick();
      assert.deepStrictEqual(h.alerts,['A failed']);
      h.dialog._onToggleLike();
      assert.deepStrictEqual(h.requests.map(r=>r.id),['smA','smB','smA']);
      h.select(h.b); h.dialog._onToggleLike();
      assert.strictEqual(h.requests.length,3);
      h.requests[2].resolve({data:{}}); h.requests[1].resolve({data:{}}); await tick();
      assert.strictEqual(h.b.isLiked,true);
    });
    it('coalesces repeated unlike input until the server result settles',async()=>{
      const h=harness(file,true);
      h.dialog._onToggleLike(); h.dialog._onToggleLike();
      assert.strictEqual(h.requests.length,1);
      assert.strictEqual(h.requests[0].action,'unlike');
      assert.strictEqual(h.a.isLiked,true);
      h.requests[0].resolve({data:{}}); await tick();
      assert.strictEqual(h.a.isLiked,false);
      h.dialog._onToggleLike();
      assert.strictEqual(h.requests[1].action,'like');
      h.requests[1].resolve({data:{}}); await tick();
    });
    it('ignores logged-in input when no video model is active',()=>{
      const h=harness(file); h.select(null);
      assert.doesNotThrow(()=>h.dialog._onToggleLike());
      assert.strictEqual(h.requests.length,0);
      assert.deepStrictEqual(h.alerts,[]);
    });
    it('releases ownership and reports a synchronous API exception once',async()=>{
      const h=harness(file); h.setFailure(true);
      assert.doesNotThrow(()=>h.dialog._onToggleLike());
      await tick();
      assert.strictEqual(h.a.isLiked,false);
      assert.deepStrictEqual(h.alerts,['synchronous fixture failure']);
      h.setFailure(false); h.dialog._onToggleLike();
      assert.strictEqual(h.requests.length,1,'sync failure must not strand the guard');
      h.requests[0].resolve({data:{}}); await tick();
      assert.strictEqual(h.a.isLiked,true);
    });
    it('does not display an obsolete rejection after the active model clears',async()=>{
      const h=harness(file); h.dialog._onToggleLike(); h.select(null);
      h.requests[0].reject(new Error('closed model')); await tick();
      assert.deepStrictEqual(h.alerts,[]);
      h.select(h.a); h.dialog._onToggleLike();
      assert.strictEqual(h.requests.length,2);
      h.requests[1].resolve({data:{}}); await tick();
      assert.strictEqual(h.a.isLiked,true);
    });
    it('keeps a reopened same-ID model independent of its old request',async()=>{
      const h=harness(file),fresh={videoId:'smA',isLiked:false};
      h.dialog._onToggleLike(); h.select(fresh); h.dialog._onToggleLike();
      h.requests[0].reject(new Error('old same-ID failure')); await tick();
      h.dialog._onToggleLike();
      assert.strictEqual(h.requests.length,2);
      assert.deepStrictEqual(h.alerts,[]);
      h.requests[1].resolve({data:{}}); await tick();
      assert.strictEqual(fresh.isLiked,true);
      assert.strictEqual(h.a.isLiked,false);
    });
  });
}
