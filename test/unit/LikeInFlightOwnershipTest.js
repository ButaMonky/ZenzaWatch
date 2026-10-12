'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
const deferred=()=>{
  let resolve,reject;
  const promise=new Promise((good,bad)=>{resolve=good;reject=bad;});
  return {resolve,reject,promise};
};
const flush=async()=>{for(let i=0;i<9;i++)await Promise.resolve();await new Promise(r=>setImmediate(r));};
function setup(file,liked=false,login=true){
  const requests=[],notifications=[],viewEvents=[],warnings=[];
  const c=createContext({
    Emitter:class{},util:{isLogin:()=>login},
    LikeApi:{
      like:id=>{const d=deferred();requests.push({action:'like',id,...d});return d.promise;},
      unlike:id=>{const d=deferred();requests.push({action:'unlike',id,...d});return d.promise;}
    },
    console:{warn:e=>warnings.push(e)}
  });
  const Dialog=loadClass(file,'NicoVideoPlayerDialog',c);
  const dialog=Object.create(Dialog.prototype);
  const a={videoId:'smA',isLiked:liked};
  dialog._videoInfo=a;dialog._state={isLiked:liked};
  dialog._view={emit:(...x)=>viewEvents.push(x)};
  dialog.execCommand=(...x)=>notifications.push(x);
  return {dialog,a,requests,notifications,viewEvents,warnings};
}
describe('Task360 AUD-42 Like in-flight request ownership',()=>{
  for(const [label,file] of [
    ['source','src/NicoVideoPlayerDialog.js'],
    ['generated dist','dist/ZenzaWatch-dev.user.js']
  ]) {
    it(label+' sends at most one request while the same video is pending',async()=>{
      const h=setup(file);
      h.dialog._onToggleLike();
      h.dialog._onToggleLike();
      h.dialog._onToggleLike();
      assert.strictEqual(h.requests.length,1);
      assert.strictEqual(h.requests[0].action,'like');
      assert.strictEqual(h.a.isLiked,false);
      h.requests[0].resolve({data:{}});
      await flush();
      assert.strictEqual(h.a.isLiked,true);
      assert.strictEqual(h.notifications.length,1);
    });
    it(label+' allows opposite toggle only after prior request completed',async()=>{
      const h=setup(file);
      h.dialog._onToggleLike();
      h.requests[0].resolve({data:{}});
      await flush();
      h.dialog._onToggleLike();
      assert.deepStrictEqual(h.requests.map(x=>x.action),['like','unlike']);
      h.requests[1].resolve({data:{}});
      await flush();
      assert.strictEqual(h.a.isLiked,false);
      assert.strictEqual(h.notifications.length,2);
    });
    it(label+' re-enables same-video retry after a rejection',async()=>{
      const h=setup(file),failure=new Error('temporarily unavailable');
      h.dialog._onToggleLike();
      h.requests[0].reject(failure);
      await flush();
      assert.deepStrictEqual(h.notifications,[['alert',failure.message]]);
      assert.strictEqual(h.a.isLiked,false);
      h.dialog._onToggleLike();
      assert.strictEqual(h.requests.length,2);
      h.requests[1].resolve({data:{}});
      await flush();
      assert.strictEqual(h.a.isLiked,true);
    });
    it(label+' ignores A failure alert after B becomes active',async()=>{
      const h=setup(file),b={videoId:'smB',isLiked:false};
      h.dialog._onToggleLike();
      h.dialog._videoInfo=b;
      h.dialog._state.isLiked=false;
      h.requests[0].reject(new Error('obsolete A request'));
      await flush();
      assert.deepStrictEqual(h.notifications,[]);
      assert.strictEqual(b.isLiked,false);
      assert.strictEqual(h.warnings.length,1);
    });
    it(label+' keeps B request lock when A resolves later',async()=>{
      const h=setup(file),b={videoId:'smB',isLiked:false};
      h.dialog._onToggleLike();
      h.dialog._videoInfo=b;
      h.dialog._onToggleLike();
      assert.deepStrictEqual(h.requests.map(x=>x.id),['smA','smB']);
      h.requests[0].resolve({data:{thanksMessage:'A old'}});
      await flush();
      h.dialog._onToggleLike();
      assert.strictEqual(h.requests.length,2,'A completion must not unlock B');
      h.requests[1].resolve({data:{thanksMessage:'B new'}});
      await flush();
      assert.strictEqual(b.isLiked,true);
      assert.deepStrictEqual(h.notifications,[['notify','B new']]);
    });
    it(label+' ignores A rejection after B has already finished',async()=>{
      const h=setup(file),b={videoId:'smB',isLiked:false};
      h.dialog._onToggleLike();
      h.dialog._videoInfo=b;
      h.dialog._onToggleLike();
      h.requests[1].resolve({data:{}});
      await flush();
      h.requests[0].reject(new Error('A expired'));
      await flush();
      assert.strictEqual(b.isLiked,true);
      assert.strictEqual(h.notifications.length,1);
    });
    it(label+' treats reopened same video ID as a new model owner',async()=>{
      const h=setup(file),newA={videoId:'smA',isLiked:false};
      h.dialog._onToggleLike();
      h.dialog._videoInfo=newA;
      h.dialog._onToggleLike();
      assert.strictEqual(h.requests.length,2,'model identity, not string ID, owns each request');
      h.requests[0].reject(new Error('old instance'));
      await flush();
      assert.deepStrictEqual(h.notifications,[]);
      h.requests[1].resolve({data:{}});
      await flush();
      assert.strictEqual(newA.isLiked,true);
      assert.strictEqual(h.a.isLiked,false);
    });
    it(label+' makes no requests while logged out or no model is active',async()=>{
      const h=setup(file,false,false);
      h.dialog._onToggleLike();
      h.dialog._videoInfo=null;
      h.dialog._onToggleLike();
      assert.deepStrictEqual(h.requests,[]);
    });
  }
});
