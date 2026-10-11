'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
function harness(file) {
  const c = createContext({Emitter: class {}, global:{emitter:{emitAsync(){}}}});
  const Model = loadClass(file, 'CommentListModel', c);
  const Panel = loadClass(file, 'CommentPanel', c);
  const PanelView = loadClass(file, 'CommentPanelView', c);
  const List = loadClass(file, 'CommentListView', c);
  const dialogPath = file === 'src/CommentPanel.js' ?
    'src/NicoVideoPlayerDialog.js' : file;
  const Dialog = loadClass(dialogPath, 'NicoVideoPlayerDialog', c);
  const model = new Model({});
  model.emit = () => {};
  const chat = {no:42, text:'fixture', nicoru: 0, nicotta:false};
  const item = {itemId: 0, nicoChat:chat, nicoru:0, nicotta:false};
  model.setItem([item]);
  const classes = new Set();
  const row = {dataset:{itemId:'0'}, isConnected:true,
    classList:{add:v=>classes.add(v), remove:v=>classes.delete(v),
      contains:v=>classes.has(v)}};
  const panel = Object.create(Panel.prototype);
  panel._model = model;
  const view = Object.create(PanelView.prototype);
  const list = Object.create(List.prototype);
  list.emit = (...args) => view._onCommand(...args.slice(1));
  view.emit = (...args) => panel._onCommand(...args.slice(1));
  const dialog = Object.create(Dialog.prototype);
  const requests = [], notifications=[];
  dialog._videoInfo = {msgInfo:{videoId:'sm9'}};
  dialog.threadLoader = {nicoru(info, sentChat) {
    const d = deferred();
    requests.push({info,sentChat,d});
    return d.promise;
  }};
  dialog.execCommand = (...args) => notifications.push(args);
  panel.emit = (...args) => dialog._onCommand(...args.slice(1));
  const click = () => list._onItemClick({
    target:{closest:selector=>selector === '.nicoru-icon' ? {} : null}
  }, row);
  const settle = async () => {
    await new Promise(resolve=>setImmediate(resolve));
    await new Promise(resolve=>setImmediate(resolve));
  };
  return {model,item,chat,panel,row,classes,requests,notifications,click,settle};
}
for (const file of ['src/CommentPanel.js','dist/ZenzaWatch-dev.user.js']) {
  describe('AUD-43 Nicoru server-confirmed state ('+file+')', () => {
    it('does not mark a row before successful API completion',async()=>{
      const h=harness(file);
      h.click(); h.click();
      await h.settle();
      assert.strictEqual(h.requests.length,1,'only one in-flight nicoru per row');
      assert.strictEqual(h.item.nicoru,0);
      assert.strictEqual(h.item.nicotta,false);
      assert.strictEqual(h.chat.nicoru,0);
      assert.strictEqual(h.classes.has('nicotta'),false);
      h.requests[0].d.resolve({status:'ok',count:13});
      await h.settle();
      assert.strictEqual(h.item.nicoru,13);
      assert.strictEqual(h.item.nicotta,true);
      assert.strictEqual(h.chat.nicoru,13);
      assert.strictEqual(h.classes.has('nicotta'),true);
      assert.strictEqual(h.row.dataset.nicoru,13);
    });
    it('keeps the row retryable after a rejected request',async()=>{
      const h=harness(file);
      h.click();
      await h.settle();
      h.requests[0].d.reject(new Error('network'));
      await h.settle();
      assert.strictEqual(h.chat.nicoru,0);
      assert.strictEqual(h.chat.nicotta,false);
      assert.strictEqual(h.classes.has('nicotta'),false);
      assert.strictEqual(h.row.dataset.nicoru,undefined);
      assert.strictEqual(h.classes.has('is-nicoruPending'),false);
      assert.strictEqual(h.notifications.length,1);
      h.click();
      await h.settle();
      assert.strictEqual(h.requests.length,2,'retry must be permitted');
      h.requests[1].d.resolve({count:1});
      await h.settle();
      assert.strictEqual(h.chat.nicoru,1);
      assert.strictEqual(h.chat.nicotta,true);
    });
    it('does not apply a late success to a cleared or replaced list',async()=>{
      const h=harness(file);
      h.click();
      await h.settle();
      h.model.clear();
      h.row.isConnected=false;
      h.requests[0].d.resolve({count:99});
      await h.settle();
      assert.strictEqual(h.chat.nicoru,0);
      assert.strictEqual(h.classes.has('nicotta'),false);
    });
    it('uses existing count+1 if the server omits count',async()=>{
      const h=harness(file);
      h.chat.nicoru=3; h.item.nicoru=3;
      h.click();
      await h.settle();
      h.requests[0].d.resolve({status:'ok'});
      await h.settle();
      assert.strictEqual(h.chat.nicoru,4);
      assert.strictEqual(h.row.dataset.nicoru,4);
    });
    it('does not overwrite a new row mounted at the same item ID',async()=>{
      const h=harness(file);
      h.click();
      await h.settle();
      h.model.clear();
      h.model.setItem([{itemId:0,nicoChat:{no:100},nicoru:7}]);
      h.requests[0].d.resolve({count:15});
      await h.settle();
      assert.strictEqual(h.chat.nicoru,0);
      assert.strictEqual(h.classes.has('nicotta'),false);
    });
  });
}
