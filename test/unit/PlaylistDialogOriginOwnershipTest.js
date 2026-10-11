'use strict';
const assert = require('assert');
const {loadClass, createContext} = require('../helpers/extractSource');

const flush = async () => {
  await new Promise(resolve => setImmediate(resolve));
  await new Promise(resolve => setImmediate(resolve));
};
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
const modes = [
  ['mylist', dialog => dialog._onPlaylistSetMylist('9')],
  ['uploaded', dialog => dialog._onPlaylistSetUploadedVideo('9')],
  ['search', dialog => dialog._onPlaylistSetSearchVideo({word:'test', option:{}})],
  ['series', dialog => dialog._onPlaylistSetSeriesVideo('9')]
];
function fixture(path, {enabled = false} = {}) {
  const commands=[], inserts=[], searches=[], timers=[], scrolls=[], requests=[];
  const context=createContext({
    Emitter:class {},
    window:{setTimeout:fn=>timers.push(fn),console:{warn(){}}},
    global:{emitter:{emitAsync:(...args)=>searches.push(args)}}
  });
  const Dialog=loadClass(path,'NicoVideoPlayerDialog',context);
  const dialog=Object.create(Dialog.prototype);
  const A={videoId:'smA',watchId:'smA',msgInfo:{thread:'A'},
    owner:{id:'7',type:'user'},isChannel:false};
  const B={videoId:'smB',watchId:'smB',msgInfo:{thread:'B'},
    owner:{id:'8',type:'user'},isChannel:false};
  const A2={...A,msgInfo:{thread:'A2'}};
  const playlist={isEnable:enabled,load:(playlistInfo,options,info,isCurrent)=>{
      const request=deferred();
      requests.push({kind:'load',playlistInfo,options,info,isCurrent,...request});
      return request.promise;
    },loadSearchVideo:(word,options,limit,isCurrent)=>{
      const request=deferred();
      requests.push({kind:'search',word,options,limit,isCurrent,...request});
      return request.promise;
    },insertCurrentVideo:videoInfo=>inserts.push(videoInfo),
    scrollToActiveItem:()=>scrolls.push('scroll')};
  dialog._playlist=playlist;
  dialog._watchId='smA';
  dialog._requestId='load-A';
  dialog._videoInfo=A;
  dialog._state={currentTab:'videoInfoTab'};
  dialog._playerConfig={props:{'search.limit':100}};
  dialog._videoWatchOptions={query:{}};
  dialog.execCommand=(...args)=>commands.push(args);
  const switchToB=()=>{
    dialog._watchId='smB';
    dialog._requestId='load-B';
    dialog._videoInfo=B;
  };
  const result=async(index=0,payload={status:'ok',message:'loaded'})=>{
    requests[index].resolve(payload);await flush();
  };
  const messages=()=>commands.filter(c=>c[0]==='notify'||c[0]==='alert');
  return {dialog,A,B,A2,playlist,requests,commands,inserts,searches,timers,
    scrolls,switchToB,result,messages};
}
for(const path of ['src/NicoVideoPlayerDialog.js','dist/ZenzaWatch-dev.user.js']) {
  describe('Task385 AUD-41 originating-video dialog load ownership '+path,()=>{
    for(const [name,start] of modes){
      it('does not attach video B to A playlist after A->B: '+name,async()=>{
        const f=fixture(path);start(f.dialog);
        assert.strictEqual(f.requests.length,1);
        if(name!=='search'){assert.strictEqual(f.requests[0].info,f.A.msgInfo);}
        assert.strictEqual(typeof f.requests[0].isCurrent,'function');
        assert.strictEqual(f.requests[0].isCurrent(),true);
        f.switchToB();
        assert.strictEqual(f.requests[0].isCurrent(),false);
        await f.result();
        assert.deepStrictEqual(f.inserts,[]);
        assert.deepStrictEqual(f.messages(),[]);
        assert.deepStrictEqual(f.searches,[]);
        assert.deepStrictEqual(f.timers,[]);
      });
      it('preserves same-video success, notification and insertion: '+name,async()=>{
        const f=fixture(path);start(f.dialog);
        await f.result();
        assert.strictEqual(f.inserts.length,1);
        assert.strictEqual(f.inserts[0],f.A);
        assert.deepStrictEqual(f.messages(),[['notify','loaded']]);
        assert.strictEqual(f.searches.length,name==='search'?1:0);
        assert.strictEqual(f.timers.length, ['search','series'].includes(name)?1:0);
        if(['mylist','uploaded','series'].includes(name)){
          assert.strictEqual(f.dialog._state.currentTab,'playlist');
        }
      });
      it('ignores A completion when A watchId is reused with new model: '+name,
        async()=>{
          const f=fixture(path);start(f.dialog);
          f.dialog._videoInfo=f.A2;
          await f.result();
          assert.deepStrictEqual(f.inserts,[]);
          assert.deepStrictEqual(f.messages(),[]);
        });
      it('does not apply A results after request generation changes: '+name,
        async()=>{
          const f=fixture(path);start(f.dialog);
          f.dialog._requestId='reload-A';
          await f.result();
          assert.deepStrictEqual(f.inserts,[]);
          assert.deepStrictEqual(f.messages(),[]);
        });
      it('does not insert into replacement playlist object: '+name,async()=>{
        const f=fixture(path);start(f.dialog);
        f.dialog._playlist={...f.playlist,insertCurrentVideo:()=>{throw Error('wrong playlist');}};
        await f.result();
        assert.deepStrictEqual(f.inserts,[]);
        assert.deepStrictEqual(f.messages(),[]);
      });
      it('preserves Task384 superseded-result suppression: '+name,async()=>{
        const f=fixture(path);start(f.dialog);
        await f.result(0,{status:'superseded',message:''});
        assert.deepStrictEqual(f.inserts,[]);
        assert.deepStrictEqual(f.messages(),[]);
      });
      it('preserves existing additive playlist success behavior: '+name,async()=>{
        const f=fixture(path,{enabled:true});start(f.dialog);
        assert.strictEqual(f.requests[0].options.insert,true);
        await f.result();
        assert.strictEqual(f.inserts[0],f.A);
        assert.deepStrictEqual(f.messages(),[['notify','loaded']]);
      });
    }
    for(const [name,start] of modes.filter(([name])=>['search','series'].includes(name))){
      it('does not scroll A playlist after navigating to B during delayed scroll: '+name,
        async()=>{
          const f=fixture(path);start(f.dialog);
          await f.result();
          assert.strictEqual(f.timers.length,1);
          f.switchToB();
          f.timers[0]();
          assert.deepStrictEqual(f.scrolls,[]);
        });
      it('preserves ordinary delayed scroll on same video: '+name,async()=>{
        const f=fixture(path);start(f.dialog);
        await f.result();
        f.timers[0]();
        assert.deepStrictEqual(f.scrolls,['scroll']);
      });
    }
  });
}
