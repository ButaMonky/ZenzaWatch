// Task 090（監査v2 R04 ZW-053）: 動画の説明文を続けて更新した時に、前後2つの動画の説明文が混ざらないことの回帰テスト。
// 修正前は、呼ばれた直後に表示を空にし、await の後で世代を確かめずに append していたため、
// A・B を続けて呼ぶと両方が残った（監査の HTML-02）。clear() の後に古い更新が説明文を戻すこともあった。
// jsdom での確認で、実際のブラウザ・実際のニコニコの説明文での確認ではない。
import assert from 'power-assert';
import {JSDOM} from 'jsdom';

const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');

// sleep.promise() の完了を、テストから好きな順で起こせるようにする
function controlledSleep() {
  const waiting = [];
  return {
    sleep: {promise: () => new Promise(r => waiting.push(r))},
    wake: i => waiting[i](),
    count: () => waiting.length
  };
}

function subject() {
  const dom = new JSDOM('<!doctype html><body><div id="description"></div>', {url: 'https://www.nicovideo.jp/watch/sm9'});
  const w = dom.window;
  const domClasses = Object.fromEntries(Object.getOwnPropertyNames(w).filter(n => /^[A-Z]/.test(n) && typeof w[n] === 'function').map(n => [n, w[n]]));
  const ctl = controlledSleep();
  const c = createContext({
    ...domClasses,
    window: w, document: w.document, CSS: w.CSS, customElements: w.customElements,
    sleep: ctl.sleep,
    nicoUtil: {getThumbnailUrlByVideoId: () => null},
    requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: id => clearTimeout(id)
  });
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(beginSection('packages/lib/src/infra/bounce.js'), c);
  run(`${beginSection('packages/lib/src/text/textUtil.js')}; globalThis.textUtil = textUtil;`, c);
  run(`${beginSection('packages/lib/src/uQuery.js')}; globalThis.uq = uq;`, c);
  const VideoInfoPanel = loadClass('src/VideoInfoPanel.js', 'VideoInfoPanel', c);
  const panel = {
    _description: w.document.getElementById('description'),
    _videoHeaderPanel: {clear() {}},
    classList: {add() {}},
    _$ownerIcon: {raf: {addClass() {}}}
  };
  const update = html => VideoInfoPanel.prototype._updateVideoDescription.call(panel, html);
  const clear = () => VideoInfoPanel.prototype.clear.call(panel);
  const flush = () => new Promise(r => setTimeout(r, 0));
  return {w, panel, update, clear, ctl, flush, text: () => panel._description.textContent, close: () => w.close()};
}

describe('説明文の非同期の更新で、前後の動画の説明文が混ざらない（ZW-053）', function() {
  this.timeout(20000);

  it('HTML-02: A・B を続けて更新すると、B だけが表示される（A が先に終わる場合）', async function() {
    const s = subject();
    const a = s.update('description A');
    const b = s.update('description B');
    s.ctl.wake(0);
    s.ctl.wake(1);
    await Promise.all([a, b]);
    assert.equal(s.text(), 'description B');
    s.close();
  });

  it('完了の順を逆にしても（B が先に終わっても）B だけで、後から終わった A は捨てる', async function() {
    const s = subject();
    const a = s.update('description A');
    const b = s.update('description B');
    s.ctl.wake(1);
    await b;
    assert.equal(s.text(), 'description B');
    s.ctl.wake(0);
    await a;
    assert.equal(s.text(), 'description B');
    assert.equal(s.panel._description.children.length, 1, '説明文の要素は1つだけ');
    s.close();
  });

  it('clear()（動画を閉じた・切り替えの初期化）の後に、前の更新が説明文を戻さない', async function() {
    const s = subject();
    const a = s.update('description A');
    s.clear();
    s.ctl.wake(0);
    await a;
    assert.equal(s.text(), '');
    s.close();
  });

  it('正常: 1回だけの更新は今までどおり表示される（同じ動画を2回更新しても1つだけ）', async function() {
    const s = subject();
    const a = s.update('description A');
    s.ctl.wake(0);
    await a;
    assert.equal(s.text(), 'description A');
    const a2 = s.update('description A');
    s.ctl.wake(1);
    await a2;
    assert.equal(s.text(), 'description A');
    assert.equal(s.panel._description.children.length, 1);
    s.close();
  });
});
