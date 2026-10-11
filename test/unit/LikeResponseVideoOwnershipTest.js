'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function harness(file, liked=false, loggedIn=true) {
  const calls=[], notifications=[], viewEvents=[], warnings=[];
  let resolve, reject;
  const pending=new Promise((good,bad)=>{resolve=good;reject=bad;});
  const c=createContext({
    Emitter:class {},
    util:{isLogin:()=>loggedIn},
    LikeApi:{
      like:id=>{calls.push(['like',id]);return pending;},
      unlike:id=>{calls.push(['unlike',id]);return pending;}
    },
    console:{warn:e=>warnings.push(e)}
  });
  const Class=loadClass(file,'NicoVideoPlayerDialog',c);
  const dialog=Object.create(Class.prototype);
  const original={videoId:'smA',isLiked:liked};
  dialog._videoInfo=original;
  dialog._state={isLiked:liked};
  dialog._view={emit:(...parts)=>viewEvents.push(parts)};
  dialog.execCommand=(...parts)=>notifications.push(parts);
  return {dialog,original,calls,notifications,viewEvents,warnings,resolve,reject};
}
const flush=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};

describe('Task321 AUD-42 Like result video ownership',()=>{
  for(const file of ['src/NicoVideoPlayerDialog.js','dist/ZenzaWatch-dev.user.js']){
    it(file+' preserves the current B video when A finishes late',async()=>{
      const h=harness(file),b={videoId:'smB',isLiked:false};
      h.dialog._onToggleLike();
      h.dialog._videoInfo=b;
      h.dialog._state.isLiked=false;
      h.resolve({data:{thanksMessage:'thank you A'}});
      await flush();
      assert.deepStrictEqual(h.calls,[['like','smA']]);
      assert.strictEqual(h.original.isLiked,false);
      assert.strictEqual(b.isLiked,false);
      assert.strictEqual(h.dialog._state.isLiked,false);
      assert.deepStrictEqual(h.viewEvents,[]);
      assert.deepStrictEqual(h.notifications,[]);
    });

    it(file+' ignores a completed earlier request even if the same ID is reopened',async()=>{
      const h=harness(file),reopened={videoId:'smA',isLiked:false};
      h.dialog._onToggleLike();
      h.dialog._videoInfo=reopened;
      h.resolve({data:{thanksMessage:'previous view'}});
      await flush();
      assert.strictEqual(reopened.isLiked,false);
      assert.strictEqual(h.dialog._state.isLiked,false);
      assert.deepStrictEqual(h.viewEvents,[]);
    });
    it(file+' still updates and notifies for the original active model',async()=>{
      const h=harness(file);
      h.dialog._onToggleLike();
      h.resolve({data:{thanksMessage:'thanks'}});
      await flush();
      assert.strictEqual(h.original.isLiked,true);
      assert.strictEqual(h.dialog._state.isLiked,true);
      assert.deepStrictEqual(h.calls,[['like','smA']]);
      assert.deepStrictEqual(h.notifications,[['notify','thanks']]);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(h.viewEvents)),[['likeThanksMessage',{message:'thanks',videoId:'smA'}]]);
    });

    it(file+' keeps unlike success on the active model',async()=>{
      const h=harness(file,true);
      h.dialog._onToggleLike();
      h.resolve({data:{}});
      await flush();
      assert.deepStrictEqual(h.calls,[['unlike','smA']]);
      assert.strictEqual(h.original.isLiked,false);
      assert.strictEqual(h.dialog._state.isLiked,false);
      assert.deepStrictEqual(h.notifications,[['notify','(･A･)ﾉｼ']]);
    });
    it(file+' preserves failure alerts and never changes model state on rejection',async()=>{
      const h=harness(file),failure=new Error('request failed');
      h.dialog._onToggleLike();
      h.reject(failure);
      await flush();
      assert.strictEqual(h.original.isLiked,false);
      assert.strictEqual(h.dialog._state.isLiked,false);
      assert.deepStrictEqual(h.notifications,[['alert','request failed']]);
      assert.strictEqual(h.warnings[0],failure);
    });
    it(file+' never attempts a write when logged out',async()=>{
      const h=harness(file,false,false);
      h.dialog._onToggleLike();
      await flush();
      assert.deepStrictEqual(h.calls,[]);
      assert.strictEqual(h.original.isLiked,false);
    });
  }
});
