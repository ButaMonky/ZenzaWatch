'use strict';
const assert = require('node:assert/strict');
const {beginSection, createContext, run} = require('../helpers/extractSource');
function harness() {
  const entries = [], timers = new Map();
  let sequence = 0, now = 1000;
  const document = new EventTarget();
  document.hidden = false;
  const c = createContext({document, Date:{now:()=>now},
    setTimeout(fn){timers.set(++sequence,fn);return sequence;}, clearTimeout(id){timers.delete(id);},
    NotificationJournal:{recordDiagnostic(key,entry){entries.push({key,...entry});}}});
  run(beginSection('src/PlaybackStartupTrace.js')+'\nglobalThis.trace=PlaybackStartupTrace;',c);
  return {api:c.trace,entries,document,tick(){now+=15000;const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());}};
}
describe('再生開始の修復レポート',()=>{
  it('区間を待ち続けた記録と、同じ試行の最初の映像での復旧を結び付ける',()=>{
    const h=harness(), t=h.api.adopt({});
    for (const stage of ['dialog','watch','info','session','delivery']) t.mark(stage);
    const wrapper = new EventTarget(), video = new EventTarget();
    wrapper.playerMode = 'HLS-JS';
    wrapper.drawableElement = video;
    let showFrame;
    video.requestVideoFrameCallback = callback => { showFrame = callback; return 1; };
    t.observeMedia(wrapper);
    const manifest = new Event('zenza-readiness');
    manifest.detail = {stage:'manifestReady'};
    wrapper.dispatchEvent(manifest);
    h.tick();
    assert.equal(h.entries[0].details.lastStage,'manifest');
    assert.equal(h.entries[0].details.nextStage,'metadata');
    assert.equal(h.entries[0].details.reason,'startup-wait');
    video.readyState = 1;
    video.dispatchEvent(new Event('loadedmetadata'));
    showFrame();h.tick();
    assert.equal(h.entries.length,2);assert.equal(h.entries[1].details.outcome,'recovered');
    assert.equal(h.entries[1].key,h.entries[0].key);
  });
  it('準備前のクリックを引き継ぎ、取得済みの視聴ページを再度待機中と表示しない',()=>{
    const h=harness(), intent={},t=h.api.reserve(intent);
    t.mark('watch');h.tick();
    assert.equal(h.entries[0].details.nextStage,'player');
    assert.equal(h.api.adopt(intent),t);
    t.mark('dialog');t.fail();assert.equal(h.entries[1].details.nextStage,'info');
  });
  it('中止、非表示、正常な再生では新しい故障を記録しない',()=>{
    const h=harness();const old=h.api.reserve({});
    old.cancel();old.fail();h.tick();
    const current=h.api.adopt({});h.document.hidden=true;h.tick();
    current.mark('frame');h.document.hidden=false;h.document.dispatchEvent(new Event('visibilitychange'));h.tick();
    assert.equal(h.entries.length,0);
  });
  it('HLSリストの応答前、ネイティブ再生のメタデータ前、手動開始待ちを区別する',()=>{
    for (const mode of ['HLS-JS','native']) {
      const h = harness(), t = h.api.adopt({}), video = new EventTarget();
      video.playerMode = mode;
      t.observeMedia(video, false);
      h.tick();
      assert.equal(h.entries[0].details.nextStage,mode === 'HLS-JS' ? 'manifest' : 'metadata');
      video.readyState = 1; video.paused = true;
      video.dispatchEvent(new Event('loadedmetadata'));
      h.tick();
      assert.equal(h.entries.length,2);
      assert.equal(h.entries[1].details.outcome,'recovered');
      assert.match(h.entries[1].message,/手動再生待ち/);
    }
  });
  it('保存値をソースパスとして解釈しない',()=>{
    const h=harness();assert.equal(h.api.describe('https://example.invalid/secret'),undefined);
    assert.equal(h.api.describe('__proto__'),undefined);
    assert.match(h.api.describe('delivery').file,/VideoSessionWorker\.ts$/);
  });
});
