'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const {randomUUID} = require('node:crypto');
const mount = require('./x-clip-attachment.cjs');
const flush = () => new Promise(resolve => setImmediate(resolve));

function composer(beforeAttach) {
  const w = new JSDOM('<div role="dialog"><input type="file" accept="video/mp4"><button data-testid="tweetButton">Post</button><div data-testid="attachments"></div></div>',
    {url:'https://x.com/compose/post#zenza-clip='+randomUUID(),runScripts:'outside-only',pretendToBeVisual:true}).window;
  const dialog = w.document.querySelector('[role=dialog]'), media = dialog.lastElementChild;
  const input = dialog.querySelector('input'), post = dialog.querySelector('button'), stages = [], percentages = [];
  let outcome, now = 1, changes = 0, clicks = 0, inspect;
  w.Date.now = () => now;
  w.Element.prototype.getClientRects = function() { return this.closest('[hidden]') ? [] : [{}]; };
  w.setInterval = fn => { inspect = fn; return 1; };
  w.DataTransfer = class { files = []; items = {add:value => this.files.push(value)}; };
  Object.defineProperty(input,'files',{value:[],writable:true});
  input.onchange = () => { changes++; };
  post.onclick = () => { clicks++; };
  beforeAttach?.(media,dialog);
  w.eval('('+mount+')')({supported:() => false},() => ({
    async receive(id,attach,signal) {
      try {
        await attach(new w.File(['film'],'film.mp4',{type:'video/mp4'}),signal,(phase,percent) => {
          stages.push(phase);
          if (percent !== undefined) percentages.push(percent);
        });
        outcome = 'ready';
      } catch (error) { outcome = error.reason || error.message; }
    }
  }));
  return {w,dialog,media,post,stages,percentages,outcome:() => outcome,counts:() => [changes,clicks],
    close() { w.dispatchEvent(new w.Event('pagehide')); w.close(); },
    async advance(ms) { now += ms; inspect?.(); await flush(); }};
}
test('waits for the same X composer to show stable actionable media, even if it was initially actionable for text',async () => {
  const c = composer();
  try {
    await c.advance(3000);
    assert.equal(c.outcome(),undefined);
    assert.deepEqual(c.stages,['draft-received']);
    Object.defineProperty(c.w.document,'hidden',{value:true});
    c.media.innerHTML = '<button data-testid="removeMedia"></button><div role="progressbar"></div>';
    c.post.disabled = true;
    await c.advance(1000);
    assert.deepEqual(c.stages,['draft-received','draft-prepare']);
    await c.advance(110000); // Background tab timers can be heavily throttled.
    assert.equal(c.outcome(),undefined);
    c.post.disabled = false;
    await c.advance(2000);
    assert.equal(c.outcome(),undefined,'enabled while the attachment still shows progress');
    c.media.lastElementChild.remove();
    await c.advance(1);
    assert.equal(c.outcome(),undefined,'require a stable state after a transient render');
    await c.advance(2000);
    assert.equal(c.outcome(),'ready');
    assert.deepEqual(c.counts(),[1,0]);
  } finally { c.close(); }
});
test('recognizes native preparing and upload progress in Japanese and English without using the toolbar character counter',async () => {
  for (const japanese of [true,false]) {
    const c = composer();
    try {
      c.post.disabled = true;
      c.dialog.insertAdjacentHTML('beforeend','<div role="toolbar"><div role="progressbar" aria-label="29"></div></div>');
      const spinner = c.w.document.createElement('div');
      spinner.setAttribute('role','progressbar');
      spinner.setAttribute('aria-label',japanese ? 'メディアを準備中...' : 'Preparing media…');
      c.dialog.append(spinner);
      await c.advance(1);
      assert.equal(c.stages.at(-1),'draft-prepare');
      await c.advance(98000);
      assert.equal(c.outcome(),undefined);
      spinner.remove();
      c.media.innerHTML = '<video><source src="blob:https://x.com/selected"></video><div role="button" aria-label="'+(japanese ? 'メディアを削除' : 'Remove media')+'"></div><span></span>';
      const label = c.media.querySelector('span');
      const progress = value => { label.textContent = japanese ? 'アップロード中（'+value+'%）' : 'Uploading ('+value+'%)'; };
      c.post.disabled = false;
      progress(26); await c.advance(1000);
      assert.deepEqual(c.percentages,[26]);
      progress(28); await c.advance(10);
      progress(29); await c.advance(10);
      progress(27); await c.advance(1100);
      assert.deepEqual(c.percentages,[26,29]);
      progress(84); await c.advance(235000);
      assert.equal(c.outcome(),undefined,'observed progress extends the initial preparation window');
      label.remove();
      c.media.querySelector('[role=button]').remove();
      await c.advance(1);
      await c.advance(2000);
      assert.equal(c.outcome(),'ready','nested source is a native video even when the character counter persists');
      assert.deepEqual(c.counts(),[1,0]);
    } finally { c.close(); }
  }
});
test('rejects an already occupied native composer and ignores unrelated English or Japanese indicators',async () => {
  for (const html of ['<div role="button" aria-label="メディアを削除"></div>','<video><source src="blob:stale"></video>']) {
    const c = composer(media => { media.innerHTML = html; });
    try {
      await c.advance(1);
      assert.match(c.outcome(),/選択中/);
      assert.deepEqual(c.counts(),[0,0]);
    } finally { c.close(); }
  }
  const c = composer();
  try {
    c.media.innerHTML = '<div data-testid="card.wrapper"><div role="progressbar" aria-label="Preparing media"></div><span>Uploading (78%)</span><video><source src="blob:card"></video></div>';
    c.dialog.insertAdjacentHTML('beforeend','<div role="toolbar"><span>アップロード中（26%）</span><div role="progressbar" aria-label="29"></div></div>');
    await c.advance(1);
    assert.deepEqual(c.stages,['draft-received']);
    await c.advance(91000);
    assert.equal(c.outcome(),'draft-media-unknown');
  } finally { c.close(); }
});
test('a repeated percentage cannot prolong a stalled upload, and even an advancing upload has an absolute limit',async () => {
  for (const advancing of [false,true]) {
    const c = composer();
    try {
      c.media.innerHTML = '<span>Uploading (10%)</span>';
      const label = c.media.firstElementChild;
      await c.advance(1);
      for (let i = 1; i <= 6; i++) {
        label.textContent = 'Uploading ('+(advancing ? i*10+10 : 10)+'%)';
        await c.advance(200000);
      }
      assert.equal(c.outcome(),advancing ? 'draft-media-limit' : 'draft-media-timeout');
      assert.deepEqual(c.counts(),[1,0]);
    } finally { c.close(); }
  }
});
test('ignores link cards, hidden controls and other dialogs and bounds an unrecognized or stuck upload',async () => {
  for (const mode of ['card','hidden','other','busy','rejected']) {
    const c = composer();
    try {
      const native = '<button data-testid="removeMedia"></button><video></video>';
      if (mode === 'card') c.media.innerHTML = '<div data-testid="card.wrapper">' + native + '<div role="progressbar"></div></div>';
      if (mode === 'hidden') c.media.innerHTML = '<div hidden>'+native+'</div>';
      if (mode === 'other') c.dialog.insertAdjacentHTML('afterend','<div role="dialog">' + native + '<button data-testid="tweetButton"></button></div>');
      if (mode === 'busy') c.media.innerHTML = native+'<div role="progressbar"></div>';
      if (mode === 'rejected') c.media.innerHTML = '<div role="alert">動画のアップロードに失敗しました</div>';
      await c.advance(1);
      await c.advance(310000);
      assert.equal(c.outcome(),mode === 'busy' ? 'draft-media-timeout' : mode === 'rejected' ? 'draft-media-rejected' : 'draft-media-unknown',mode);
      assert.deepEqual(c.counts(),[1,0]);
    } finally { c.close(); }
  }
});
test('identifies hidden preparation at timeout only before any measured native upload percent',async () => {
  for (const percent of [undefined,0]) {
    const c = composer();
    try {
      Object.defineProperty(c.w.document,'hidden',{value:true});
      c.media.innerHTML = '<div role="progressbar"></div>' +
        (percent === undefined ? '' : '<span>Uploading media (0%)</span>');
      await c.advance(1);
      await c.advance(300001);
      assert.equal(c.outcome(),percent === undefined ? 'draft-media-hidden' : 'draft-media-timeout');
      assert.deepEqual(c.counts(),[1,0]);
    } finally { c.close(); }
  }
});
test('auto handoff waits for the intent editor instead of using the home timeline file picker',async () => {
  const w = new JSDOM('<main><form><input type="file" accept="video/mp4"><button data-testid="tweetButtonInline">Post</button></form></main>',
    {url:'https://x.com/intent/tweet#zenza-clip='+randomUUID(),runScripts:'outside-only',pretendToBeVisual:true}).window;
  const doc = w.document;
  w.Element.prototype.getClientRects = function() { return this.closest('[hidden]') ? [] : [{}]; };
  let receivers = 0;
  try {
    w.eval('('+mount+')')({supported:()=>false},()=>({receive:async () => { receivers++; }}));
    await flush();
    assert.equal(receivers,0,'home picker was already present before X rendered the intent');
    doc.body.insertAdjacentHTML('beforeend','<div role="dialog"><form><input type="file" accept="video/mp4"></form></div>');
    await flush();
    assert.equal(receivers,0,'attachment input alone does not identify a ready composer');
    doc.querySelector('[role=dialog]').insertAdjacentHTML('beforeend','<button data-testid="tweetButton" disabled>Post</button>');
    await flush();
    assert.equal(receivers,1);
  } finally { w.dispatchEvent(new w.Event('pagehide')); w.close(); }
});
