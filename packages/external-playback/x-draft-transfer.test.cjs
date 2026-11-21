'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomBytes,randomUUID} = require('node:crypto');
const vm = require('node:vm');
const {createXDraftTransfer} = require('./x-draft-transfer.cjs');

function setup() {
  class FileReader {
    async readAsDataURL(blob) {
      this.result = 'data:;base64,' + Buffer.from(await blob.arrayBuffer()).toString('base64');
      this.onload();
    }
  }
  const create = vm.runInNewContext('(' + createXDraftTransfer + ')',{
    FileReader,URL,File,Blob,crypto:{randomUUID},setTimeout,clearTimeout,atob,Uint8Array
  });
  const values = new Map(), records = {}, listeners = new Map(), writes = [], chunks = [];
  let openUrl, opened = {};
  const gm = {
    get:key => values.get(key),remove:key => values.delete(key),
    set(key,msg) {
      writes.push(msg);
      values.set(key,msg);
      for (const [fn,id] of listeners) if (id === key) queueMicrotask(() => fn(key,null,msg));
    },
    listen(key,fn) { listeners.set(fn,key); return fn; },
    unlisten:fn => listeners.delete(fn),
    tab:async () => structuredClone(records.source || {}),
    async save(value) {
      if (value.zenzaXDraftChunk) chunks.push(value.zenzaXDraftChunk.data.length);
      records.source = structuredClone(value);
    },
    tabs:async () => structuredClone(records),
    open(url) { openUrl = new URL(url); return opened; }
  };
  return {source:create(gm),x:create(gm),gm,values,records,listeners,writes,chunks,opened,
    url:() => openUrl, id:() => openUrl.hash.split('=')[1]};
}
test('two anonymous tabs transfer the exact MP4 in bounded tab-only chunks and acknowledge attachment',async () => {
  const env = setup(), bytes = randomBytes(2 * 1024 ** 2 + 7);
  const file = new File([bytes],'試験.mp4',{type:'video/mp4'});
  const progress = [];
  const sender = env.source.send(file,'最初の動画',new AbortController().signal,stage => progress.push(stage));
  const id = env.id(), draft = env.url();
  assert.equal(draft.origin,'https://x.com');
  assert.equal(draft.pathname,'/intent/tweet');
  assert.equal(draft.searchParams.get('text'),'最初の動画');
  let received;
  await Promise.all([sender,env.x.receive(id,value => { received = value; },new AbortController().signal)]);
  assert.equal(received.name,file.name);
  assert.equal(received.type,'video/mp4');
  assert.deepEqual(Buffer.from(await received.arrayBuffer()),bytes);
  assert.deepEqual(env.chunks,[1048576,1048576,699060]);
  assert.deepEqual(progress,['draft-receive',...env.chunks.map(() => 'draft-attach')]);
  assert.equal(env.values.size,0);
  assert.equal(env.listeners.size,0);
  assert.equal(env.opened.onclose,null);
  assert.deepEqual(env.records.source,{});
  assert(env.writes.every(msg => !['data','size','name','text'].some(key => Object.hasOwn(msg,key))));
});
test('an unmarked X tab or expired link cannot fetch media or write a mailbox',async () => {
  const env = setup(), id = randomUUID(), signal = new AbortController().signal;
  await assert.rejects(env.x.receive(id,assert.fail,signal),/完成画面/);
  assert.equal(env.writes.length,0);
  env.gm.set('zenza-x-draft:'+id,{type:'ready',expires:Date.now()-1});
  await assert.rejects(env.x.receive(id,assert.fail,signal),/完成画面/);
  assert.equal(env.writes.length,1);
});
test('close, cancellation, and X rejecting its occupied input preserve a manual fallback',async () => {
  const file = new File(['MP4'],'test.mp4',{type:'video/mp4'});
  for (const action of ['close','cancel','reject']) {
    const env = setup(), controller = new AbortController();
    const sent = env.source.send(file,'',controller.signal);
    const failure = assert.rejects(sent,/完成画面/);
    if (action === 'cancel') controller.abort();
    if (action === 'close') env.opened.onclose();
    if (action === 'reject') {
      await assert.rejects(env.x.receive(env.id(),() => { throw Error('選択中'); },new AbortController().signal),/選択中/);
    }
    await failure;
    assert.equal(env.listeners.size,0);
    assert.equal(env.opened.onclose,null);
    assert.equal(env.values.size,0);
    assert.equal(env.records.source?.zenzaXDraftChunk,undefined);
  }
});
test('records the failing tab-open step and cleans the pending notification without a receiver',async()=>{
  const env=setup();
  env.gm.open=()=>{throw Error('private manager details');};
  const file=new File(['movie'],'private.mp4',{type:'video/mp4'});
  await assert.rejects(env.source.send(file,'private',new AbortController().signal),error =>
    error.reason === 'draft-open-failed' && !error.message.includes('private'));
  assert.equal(env.values.size,0);
  assert.equal(env.listeners.size,0);
});
test('oversized clips open a text draft without disclosing bytes', async () => {
  const env = setup();
  await assert.rejects(env.source.send({type:'video/mp4',size:256 * 1024 ** 2 + 1},'本文',new AbortController().signal),error => error.reason === 'draft-size' && /256 MiB/.test(error.message));
  assert.equal(env.url().hash,'');
  assert.equal(env.url().searchParams.get('text'),'本文');
  assert.equal(env.writes.length,0);
});
test('a manager with only tab opening still opens a text draft at completion and explains manual attachment', async () => {
  const env = setup();
  env.gm.tabs = null;
  const signal = new AbortController().signal;
  const file = new File(['MP4'],'test.mp4',{type:'video/mp4'});
  await assert.rejects(env.source.send(file,'本文',signal),error => error.reason === 'draft-manager' && /下書きを開きました.*クリップボードから読み込む/.test(error.message));
  assert.equal(env.url().hash,'');
  assert.equal(env.url().searchParams.get('text'),'本文');
  assert.equal(env.writes.length,0);
});

test('the X clipboard confirmation releases its pending file after five minutes without changing the composer',async () => {
  const {JSDOM} = require('jsdom');
  const mount = require('./x-clip-attachment.cjs');
  const w = new JSDOM('<input type="file" accept="video/mp4">',{url:'https://x.com/compose/post',runScripts:'outside-only'}).window;
  let now = 0, shadow, click, reads = 0;
  const attachShadow = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function(options) { shadow = attachShadow.call(this,options); return shadow; };
  const listen = w.HTMLButtonElement.prototype.addEventListener;
  w.HTMLButtonElement.prototype.addEventListener = function(type,handler,...rest) {
    if (type === 'click') click = handler;
    return listen.call(this,type,handler,...rest);
  };
  w.Date.now = () => now;
  try {
    w.eval('('+mount+')')({supported:()=>true,read:async () => {
      reads++;
      return new w.File(['video'],'clip.mp4',{type:'video/mp4'});
    }});
    await click({isTrusted:true});
    assert.match(shadow.querySelector('[role=status]').textContent,/clip.mp4/);
    now += 5*60000;
    w.document.dispatchEvent(new w.Event('visibilitychange'));
    assert.match(shadow.querySelector('[role=status]').textContent,/解放/);
    assert.equal(w.document.querySelector('input').files.length,0);
    await click({isTrusted:true});
    assert.equal(reads,2,'expired file must be read again before attachment');
    w.dispatchEvent(new w.Event('pagehide'));
    assert.equal(shadow.querySelector('[role=status]').textContent,'');
  } finally { w.close(); }
});
