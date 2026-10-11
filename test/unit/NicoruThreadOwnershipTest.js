'use strict';
const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

function fixture(path) {
  const ctx = createContext({Emitter:class {}});
  const Dialog = loadClass(path, 'NicoVideoPlayerDialog', ctx);
  const dialog = Object.create(Dialog.prototype);
  const calls=[], alerts=[], fulfilled=[], rejected=[];
  const loaders = [];
  const makeLoader = name => {
    const loader = {name,nicoru:(info,chat)=>{
      calls.push({loader,info,chat});
      return Promise.resolve({status:'ok',count:4});
    }};
    loaders.push(loader);return loader;
  };
  const a={threadInfo:{threadId:100,videoId:'smA'}};
  const b={threadInfo:{threadId:200,videoId:'smB'}};
  dialog._videoInfo={msgInfo:a};
  dialog.threadLoader=makeLoader('A');
  dialog.execCommand=(...args)=>alerts.push(args);
  const send=chat=>{
    const request={
      resolve:r=>fulfilled.push({chat,result:r}),
      reject:e=>rejected.push({chat,error:e})
    };
    dialog._onCommand('nicoru',chat,request);
  };
  const switchToB=()=>{
    dialog._videoInfo={msgInfo:b};
    dialog.threadLoader=makeLoader('B');
  };
  const settle=async()=>{
    await new Promise(resolve=>setImmediate(resolve));
    await new Promise(resolve=>setImmediate(resolve));
  };
  return {dialog,calls,alerts,fulfilled,rejected,loaders,a,b,
    makeLoader,send,switchToB,settle};
}
for(const path of ['src/NicoVideoPlayerDialog.js','dist/ZenzaWatch-dev.user.js']) {
  describe('Task379 Nicoru originating-thread ownership '+path,()=>{
    it('uses A thread for A comment even if B becomes active synchronously',async()=>{
      const h=fixture(path),chat={no:1,text:'A'};
      const loader=h.dialog.threadLoader;
      h.send(chat);h.switchToB();
      await h.settle();
      assert.strictEqual(h.calls.length,1);
      assert.strictEqual(h.calls[0].info,h.a);
      assert.strictEqual(h.calls[0].chat,chat);
      assert.strictEqual(h.calls[0].loader,loader);
      assert.strictEqual(h.fulfilled.length,1);
    });
    it('keeps A and B request thread identities separate in the same turn',async()=>{
      const h=fixture(path),aChat={no:1},bChat={no:2};
      h.send(aChat);h.switchToB();h.send(bChat);
      await h.settle();
      assert.strictEqual(h.calls.length,2);
      assert.deepStrictEqual(h.calls.map(x=>x.info.threadInfo.videoId),
        ['smA','smB']);
      assert.deepStrictEqual(h.calls.map(x=>x.chat),[aChat,bChat]);
      assert.strictEqual(h.fulfilled.length,2);
    });
    it('keeps stable original msgInfo even if the active object is replaced',async()=>{
      const h=fixture(path),chat={no:1};
      const original=h.a;
      h.send(chat);
      h.dialog._videoInfo=null;
      await h.settle();
      assert.strictEqual(h.calls[0].info,original);
      assert.strictEqual(h.rejected.length,0);
    });
    it('preserves the existing rejection callback and error notification',async()=>{
      const h=fixture(path),chat={no:1};
      h.dialog.threadLoader.nicoru=async()=>{throw new Error('failure');};
      h.send(chat);h.switchToB();
      await h.settle();
      assert.strictEqual(h.rejected.length,1);
      assert.strictEqual(h.fulfilled.length,0);
      assert.deepStrictEqual(h.alerts[0],['alert','failure']);
    });
    it('does not depend on later mutation of the dialog threadLoader',async()=>{
      const h=fixture(path),chat={no:1};
      const loader=h.dialog.threadLoader;
      h.send(chat);
      h.dialog.threadLoader=null;
      await h.settle();
      assert.strictEqual(h.calls.length,1);
      assert.strictEqual(h.calls[0].loader,loader);
    });
  });
}
