'use strict';
const assert = require('node:assert/strict');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function setup() {
  const entries = [], timers = new Map(), document = new EventTarget();
  let now = 1000, timerId = 0;
  document.hidden = false;
  const video = Object.assign(new EventTarget(), {
    currentTime:0, paused:false, ended:false, seeking:false, readyState:2, playbackRate:1,
    buffered:{length:0}, src:'https://private.invalid/signed'
  });
  const context = createContext({document, Date:{now:()=>now},
    setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},
    NotificationJournal:{recordDiagnostic(key,entry){entries.push({key,...entry});}}});
  run(beginSection('src/PlaybackInterruptionTrace.js')+'\nglobalThis.api=PlaybackInterruptionTrace;',context);
  const wrapper = Object.assign(new EventTarget(),{drawableElement:video,playerMode:'HLS-JS'});
  const stop = context.api.observe(wrapper);
  const emit = type => video.dispatchEvent(new Event(type));
  const advance = () => { video.currentTime++;emit('timeupdate'); };
  const play = () => { emit('playing');advance(); };
  const tick = () => { now+=15000; const due=[...timers.values()];timers.clear();for(const fn of due) fn(); };
  return {entries,video,wrapper,document,stop,emit,advance,play,tick};
}

describe('再生途中の修復レポート',()=>{
  it('同じ待機を一度だけ記録し、再生時刻の前進で同じ行を復旧済みにする',()=>{
    const h=setup();h.play();h.emit('waiting');h.emit('stalled');h.tick();h.emit('waiting');h.tick();
    assert.equal(h.entries.length,1);
    const first=h.entries[0];assert.equal(first.details.nextStage,'hls-buffer');
    assert.equal(first.details.elapsedMs,15000);
    h.emit('playing');h.emit('timeupdate');assert.equal(h.entries.length,1);
    h.advance();
    assert.equal(h.entries[1].key,first.key);assert.equal(h.entries[1].details.outcome,'recovered');
    assert(!JSON.stringify(h.entries).includes('private.invalid'));
  });
  it('開始前、短い待ち、シーク、一時停止、動画切替を警告にしない',()=>{
    for(const interrupt of ['seeking','pause','ended','emptied','dispose','progress']){
      const h=setup();h.emit('waiting');h.tick();h.play();h.emit('waiting');
      if(interrupt==='dispose')h.stop();else if(interrupt==='progress')h.advance();else h.emit(interrupt);
      h.tick();assert.equal(h.entries.length,0,interrupt);
    }
  });
  it('シークで移動した時間を復旧と数えず、着地後の再生を監視する',()=>{
    const h=setup();h.play();h.emit('waiting');h.tick();
    h.emit('seeking');h.video.currentTime=50;h.emit('seeked');h.advance();
    h.emit('waiting');h.tick();
    assert.equal(h.entries.length,2);
    assert.equal(h.entries[1].details.outcome,'failed');
    assert.notEqual(h.entries[1].key,h.entries[0].key);
  });
  it('画面が非表示の間は警告せず、戻っても待つ場合だけ記録する',()=>{
    const h=setup();h.play();h.emit('waiting');h.document.hidden=true;
    h.document.dispatchEvent(new Event('visibilitychange'));h.tick();
    assert.equal(h.entries.length,0);h.document.hidden=false;
    h.document.dispatchEvent(new Event('visibilitychange'));h.tick();
    assert.equal(h.entries.length,1);
  });
  it('HLSラッパーだけが返す失敗を分類し、重複イベントと生のメッセージを除く',()=>{
    for(const [code,message,reason] of [[1002,'fragLoadError','hls-fragment'],[1003,'private-string','hls-decode'],
      [1004,'private-string','hls-error']]){
      const h=setup();h.play();h.wrapper.error={code,message};
      h.wrapper.dispatchEvent(new Event('error'));h.wrapper.dispatchEvent(new Event('error'));
      assert.equal(h.entries.length,1);
      assert.equal(h.entries[0].details.reason,reason);assert(!JSON.stringify(h.entries).includes('private-string'));
    }
  });
  it('先のデータがある停止と、動画要素が返したデコードエラーを区別する',()=>{
    const h=setup();h.video.buffered={length:1,start:()=>0,end:()=>10};
    h.play();h.emit('waiting');h.tick();assert.equal(h.entries[0].details.nextStage,'advance');
    h.video.error={code:3,message:'sensitive'};h.emit('error');
    assert.equal(h.entries[1].key,h.entries[0].key);
    assert.equal(h.entries[1].details.reason,'media-decode');
    assert(!JSON.stringify(h.entries).includes('sensitive'));
  });
});
