'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');

const variants=[
  ['source','src/NicoVideoPlayerDialog.js','src/CommentPanel.js'],
  ['dev dist','dist/ZenzaWatch-dev.user.js','dist/ZenzaWatch-dev.user.js']
];
const settle=async()=>{for(let n=0;n<8;n++)await Promise.resolve();await new Promise(r=>setImmediate(r));};
function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function harness([,dialogPath,panelPath]){
  const requests=[],commands=[],removedFromPlayer=[],removedFromList=[];
  let loggedIn=true;
  class FakeCommentPanel{
    constructor(){this.handlers={};}
    on(name,handler){this.handlers[name]=handler;}
  }
  const c=createContext({
    Emitter:class{},_:{debounce:f=>f},
    util:{isLogin:()=>loggedIn},CommentPanel:FakeCommentPanel,
    window:{console:{time(){},timeEnd(){},log(){}}}
  });
  const Dialog=loadClass(dialogPath,'NicoVideoPlayerDialog',c);
  // Keep the real Panel prototype isolated from the Dialog's stub constructor.
  const panelContext=createContext({Emitter:class{}});
  const Panel=loadClass(panelPath,'CommentPanel',panelContext);
  const dialog=Object.create(Dialog.prototype);
  const player={removeChat:chat=>removedFromPlayer.push(chat)};
  dialog._nicoVideoPlayer=player;
  dialog._state={isCommentReady:true};
  dialog._videoInfo={msgInfo:{owner:'A'}};
  dialog._view={appendTab:()=>({})};
  dialog._playerConfig={props:{
    enableCommentPanelAutoScroll:false,commentLanguage:'ja',enableCommentPanel:true
  }};
  dialog._onCommand=()=>{};
  dialog._onCommentPanelStatusUpdate=()=>{};
  dialog._applyCommentPanelVisibility=()=>{};
  dialog.emitResolve=()=>{};
  dialog.execCommand=(...args)=>commands.push(args);
  dialog.threadLoader={deleteChat:(info,chat)=>{
    const task=deferred();task.info=info;task.chat=chat;
    requests.push(task);
    return task.promise;
  }};
  dialog._initializeCommentPanel();
  const row={itemId:1,nicoChat:{no:1,threadId:'threadA'},text:'test'};
  let currentRows=[row];
  const panel=Object.create(Panel.prototype);
  panel._model={
    findByItemId:id=>currentRows.find(x=>x.itemId===Number(id)),
    removeItem(item){removedFromList.push(item);
      currentRows=currentRows.filter(x=>x!==item);}
  };
  panel.emit=(event,...args)=>{
    if(event!=='deleteChat')throw Error('unexpected event '+event);
    return dialog._commentPanel.handlers[event](...args);
  };
  return {dialog,panel,row,player,requests,commands,removedFromPlayer,
    removedFromList,rows:()=>currentRows,
    setLoggedIn:value=>{loggedIn=value;},
    setRows:rows=>{currentRows=rows;}
  };
}

describe('Task357 AUD-46: failed comment deletions never delete a local row',()=>{
  for(const v of variants){
    const name=v[0];
    it(name+' propagates original network failure from removeChat',async()=>{
      const h=harness(v),error=new Error('delete rejected');
      const request=h.dialog.removeChat(h.row.nicoChat);
      assert.strictEqual(h.requests.length,1);
      h.requests[0].reject(error);
      await assert.rejects(request,e=>e===error);
      assert.deepStrictEqual(h.commands,[['alert',error.message]]);
      assert.strictEqual(h.removedFromPlayer.length,0);
    });
    it(name+' retains comment row after failed deletion (all three layers)',async()=>{
      const h=harness(v);
      h.panel._onCommand('removeComment',null,h.row.itemId);
      assert.strictEqual(h.requests.length,1);
      h.requests[0].reject(new Error('HTTP 500'));
      await settle();
      assert.deepStrictEqual(h.removedFromList,[]);
      assert.deepStrictEqual(h.rows(),[h.row]);
      assert.deepStrictEqual(h.removedFromPlayer,[]);
      assert.deepStrictEqual(h.commands,[['alert','HTTP 500']]);
    });
    it(name+' removes both player and row only on confirmed success',async()=>{
      const h=harness(v);
      h.panel._onCommand('removeComment',null,h.row.itemId);
      assert.deepStrictEqual(h.removedFromList,[]);
      assert.deepStrictEqual(h.removedFromPlayer,[]);
      h.requests[0].resolve({status:'ok'});
      await settle();
      assert.deepStrictEqual(h.removedFromPlayer,[h.row.nicoChat]);
      assert.deepStrictEqual(h.removedFromList,[h.row]);
      assert.deepStrictEqual(h.rows(),[]);
      assert.deepStrictEqual(h.commands,[['notify','コメント削除成功']]);
    });
    it(name+' retries after failure instead of losing the selected row',async()=>{
      const h=harness(v);
      h.panel._onCommand('removeComment',null,h.row.itemId);
      h.requests[0].reject({message:'temporary failure'});
      await settle();
      assert.deepStrictEqual(h.rows(),[h.row]);
      h.panel._onCommand('removeComment',null,h.row.itemId);
      assert.strictEqual(h.requests.length,2);
      h.requests[1].resolve({status:'ok'});
      await settle();
      assert.deepStrictEqual(h.rows(),[]);
      assert.deepStrictEqual(h.removedFromList,[h.row]);
    });
    it(name+' returns a rejected promise for missing readiness or login',async()=>{
      const h=harness(v);
      h.dialog._state.isCommentReady=false;
      await assert.rejects(h.dialog.removeChat(h.row.nicoChat));
      h.dialog._state.isCommentReady=true;
      h.setLoggedIn(false);
      await assert.rejects(h.dialog.removeChat(h.row.nicoChat));
      assert.strictEqual(h.requests.length,0);
      assert.deepStrictEqual(h.removedFromPlayer,[]);
    });
    it(name+' does not remove a newer video chat after old success',async()=>{
      const h=harness(v);
      const pending=h.dialog.removeChat(h.row.nicoChat);
      const newPlayer={removeChat:chat=>h.removedFromPlayer.push(chat)};
      h.dialog._nicoVideoPlayer=newPlayer;
      h.dialog._videoInfo={msgInfo:{owner:'B'}};
      h.requests[0].resolve({status:'ok'});
      await pending;
      assert.deepStrictEqual(h.removedFromPlayer,[]);
      assert.deepStrictEqual(h.commands,[]);
    });
    it(name+' ignores obsolete row identity after list replacement',async()=>{
      const h=harness(v);
      h.panel._onCommand('removeComment',null,h.row.itemId);
      const other={itemId:1,nicoChat:{no:2}};
      h.setRows([other]);
      h.requests[0].resolve({status:'ok'});
      await settle();
      assert.deepStrictEqual(h.rows(),[other]);
      assert.ok(!h.removedFromList.includes(other));
    });
  }
});
