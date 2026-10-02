'use strict';
const assert = require('assert');
const {read, extract, createContext, run, loadClass} = require('../helpers/extractSource');
function playerClass(extra = {}) {
  const c = createContext({Emitter: class {}, ...extra});
  return loadClass('src/CommentPlayer.js', 'NicoCommentPlayer', c);
}
describe('Task200 comment history integration', function() {
  it('lazily uses one renderer and forwards display requests', async function() {
    const calls = []; let count = 0;
    class Renderer { constructor(o) { count++; this.player = o.player; } apply(d,c) { calls.push([d,c]); return Promise.resolve('applied'); } }
    const P = playerClass({ZenzaCommentHistoryCore:{CommentHistoryRenderer:Renderer},NicoChat:{},NicoChatViewModel:{}});
    const p = Object.create(P.prototype), data = {threads:[]}, control = {};
    assert.strictEqual(typeof p.applyHistoryThreads, 'function');
    assert.strictEqual(await p.applyHistoryThreads(data,control),'applied');
    await p.applyHistoryThreads(data,control);
    assert.strictEqual(count,1); assert.strictEqual(calls[0][0],data); assert.strictEqual(calls[0][1],control);
  });
  it('invalidates history on normal replacement and close, and records deletions', function() {
    const calls=[], P=playerClass(), p=Object.create(P.prototype);
    p._commentHistoryRenderer={reset(){calls.push('reset');},removed(){calls.push('removed');},clear(){calls.push('clear-history');}};
    p._model={setThreads(){calls.push('normal');},removeChat(){calls.push('delete');},clear(){calls.push('clear-model');}};
    p._view={clear(){calls.push('clear-view');}};
    p.setComment({threads:[]},{format:'threads'});p.removeChat({});p.clearCommentHistory();p.close();
    assert.deepStrictEqual(calls,['reset','normal','removed','delete','clear-history','reset','clear-model','clear-view']);
  });
  it('propagates display and release calls through the video player', async function() {
    const V=loadClass('src/NicoVideoPlayer.js','NicoVideoPlayer',createContext({Emitter:class {}}));
    const v=Object.create(V.prototype), data={}, control={};let cleared=0;
    v._commentPlayer={applyHistoryThreads(d,c){assert.strictEqual(d,data);assert.strictEqual(c,control);return Promise.resolve(7);},clearCommentHistory(){cleared++;}};
    assert.strictEqual(typeof v.applyHistoryThreads,'function');assert.strictEqual(await v.applyHistoryThreads(data,control),7);
    v.clearCommentHistory();assert.strictEqual(cleared,1);
  });
  it('cancels the old history generation when normal comments are reloaded', function() {
    const D=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',createContext({Emitter:class {}}));
    const d=Object.create(D.prototype);let n=0,aborts=0;
    d._commentHistory={controller:{invalidate(){n++;}}};d._commentLoadController={abort(){aborts++;}};
    d._cancelCommentLoad();assert.strictEqual(n,1);assert.strictEqual(aborts,1);
  });
  it('wires normal success to the validated history seed without changing official counts', function() {
    const text=read('src/NicoVideoPlayerDialog.js');
    assert(text.includes('history.controller.normalReady({videoInfo: this._videoInfo, result, generation: requestId})'));
    assert(text.includes('this._state.isWaybackMode = result.threadInfo.isWaybackMode'));
    assert(text.includes('comment: result.threadInfo.totalResCount'));
  });
  it('adds the chosen icon before the screen filter and a separate advanced-settings mount', function() {
    const bar=read('src/VideoControlBar.js'), settings=read('src/_setting.js');
    assert(bar.indexOf('class="commentHistorySwitch controlButton"')>=0);
    assert(bar.indexOf('class="commentHistorySwitch controlButton"')<bar.indexOf('class="screenFilterSwitch controlButton"'));
    assert(settings.includes('mountHistorySettings('));assert(settings.includes('commentHistorySettingsContainer'));
  });
});

describe('Task200 toolbar before lazy history-panel initialization',function(){
 it('sizes the icon in the toolbar stylesheet rather than waiting for the panel',function(){
  const bar=read('src/VideoControlBar.js');
  assert(/\.commentHistorySwitch \.controlButtonInner\s*\{[^}]*width:\s*26px;[^}]*height:\s*26px;/.test(bar));
  assert(/\.commentHistorySwitch svg\s*\{[^}]*width:\s*100%;[^}]*fill:\s*currentColor;/.test(bar));
 });
 it('does not override the existing hover background with an inline transparent style',function(){
  const bar=read('src/VideoControlBar.js');
  const tag=bar.slice(bar.indexOf('class="commentHistorySwitch controlButton"')).split('>')[0];
  assert(!tag.includes('background:transparent'));assert(bar.includes('.commentHistorySwitch:focus-visible'));
 });
});

describe('Task200 history icon keyboard activation',function(){
 it('isolates Enter/Space from player shortcuts without suppressing native button activation',function(){
  const c=createContext();run('globalThis.guard='+extract('src/VideoControlBar.js','historyTriggerKeyGuard','var')+';',c);
  for(const key of ['Enter',' ','Spacebar']){let stopped=0,prevented=0;c.guard({key,stopPropagation(){stopped++;},preventDefault(){prevented++;}});assert.strictEqual(stopped,1);assert.strictEqual(prevented,0);}
  let stopped=0;c.guard({key:'Escape',stopPropagation(){stopped++;}});assert.strictEqual(stopped,0);
 });
});
