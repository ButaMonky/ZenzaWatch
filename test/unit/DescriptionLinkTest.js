// Task 088（監査v2 ZW-052）: 動画の説明文のリンク装飾（mylist/…・series/… のリンクに ▶ を付ける）で、
// リンクの文字列が HTML の属性・要素として解釈し直されないことの回帰テスト。
// 修正前は link.textContent から取った ID を、そのまま HTML の文字列へ埋め込んでいた
// （監査の再現ケース HTML-01: 引用符を含むリンク文字列から data-audit-marker 属性が作られた）。
// 説明文の本文そのもの（ニコニコが返す HTML）について、スクリプト・イベント属性・javascript: 等の URL を残さないことも確かめる。
// jsdom での確認で、実際のブラウザ・実際のニコニコの説明文での確認ではない。
import assert from 'power-assert';
import {JSDOM} from 'jsdom';

const {beginSection, createContext, run, loadClass} = require('../helpers/extractSource');

function subject() {
  const dom = new JSDOM('<!doctype html><body><div id="description"></div>', {url: 'https://www.nicovideo.jp/watch/sm9'});
  const w = dom.window;
  // jsdom の DOM のクラス（HTMLCollection・Element 等）をそのまま使えるようにする
  const domClasses = Object.fromEntries(Object.getOwnPropertyNames(w).filter(n => /^[A-Z]/.test(n) && typeof w[n] === 'function').map(n => [n, w[n]]));
  const c = createContext({
    ...domClasses,
    window: w, document: w.document, CSS: w.CSS, customElements: w.customElements,
    sleep: {promise: () => Promise.resolve()},
    nicoUtil: {getThumbnailUrlByVideoId: () => null},
    requestAnimationFrame: f => setTimeout(f, 0), cancelAnimationFrame: id => clearTimeout(id)
  });
  run(beginSection('packages/lib/src/Emitter.js'), c);
  run(beginSection('packages/lib/src/infra/bounce.js'), c);
  run(`${beginSection('packages/lib/src/text/textUtil.js')}; globalThis.textUtil = textUtil;`, c);
  run(`${beginSection('packages/lib/src/uQuery.js')}; globalThis.uq = uq;`, c);
  const VideoInfoPanel = loadClass('src/VideoInfoPanel.js', 'VideoInfoPanel', c);
  const panel = {_description: w.document.getElementById('description')};
  const update = (html, series) => VideoInfoPanel.prototype._updateVideoDescription.call(panel, html, series);
  return {w, doc: w.document, panel, update, close: () => w.close()};
}

const allAttributes = root => [...root.querySelectorAll('*')].flatMap(e => [...e.attributes].map(a => a.name));

describe('説明文のリンク装飾が文字列を HTML にしない（ZW-052）', function() {
  this.timeout(20000);

  it('正常: mylist/123 のリンクは、href の ID で ▶（プレイリストで開く）が付く', async function() {
    const s = subject();
    await s.update('<a href="https://www.nicovideo.jp/mylist/123">mylist/123</a>');
    const wrap = s.doc.querySelector('zenza-mylist-link');
    assert.ok(wrap);
    assert.equal(wrap.dataset.mylistId, '123');
    const a = wrap.querySelector('a');
    assert.equal(a.getAttribute('href'), 'https://www.nicovideo.jp/mylist/123');
    assert.equal(a.textContent, 'mylist/123');
    const btn = wrap.querySelector('zenza-playlist-append');
    assert.equal(btn.dataset.command, 'playlistSetMylist');
    assert.equal(btn.dataset.param, '123');
    s.close();
  });

  it('正常: series/456 のリンクも同じ（ユーザーのページの /user/…/series/… の形も）', async function() {
    const s = subject();
    await s.update('<a href="https://www.nicovideo.jp/user/1/series/456">series/456</a>');
    const wrap = s.doc.querySelector('zenza-series-link');
    assert.ok(wrap);
    assert.equal(wrap.dataset.seriesId, '456');
    assert.equal(wrap.querySelector('zenza-playlist-append').dataset.param, '456');
    s.close();
  });

  it('HTML-01: 引用符を含むリンク文字列から新しい属性が作られない', async function() {
    const s = subject();
    await s.update('<a href="https://www.nicovideo.jp/mylist/123">mylist/123&quot; data-audit-marker=&quot;injected</a>');
    assert.equal(s.doc.querySelector('[data-audit-marker]'), null);
    const wrap = s.doc.querySelector('zenza-mylist-link');
    assert.ok(wrap, 'href の ID で装飾される');
    assert.equal(wrap.dataset.mylistId, '123');
    assert.equal(wrap.querySelector('a').textContent, 'mylist/123" data-audit-marker="injected', 'リンクの文字はそのまま');
    s.close();
  });

  it('イベント属性に相当する文字列・角括弧を含むリンク文字列から、属性・要素が作られない', async function() {
    const s = subject();
    await s.update([
      '<a href="https://www.nicovideo.jp/mylist/1">mylist/1&quot; onmouseover=&quot;alert(1)</a>',
      '<a href="https://www.nicovideo.jp/series/2">series/2&lt;img src=x onerror=alert(1)&gt;</a>',
      '<a href="https://example.com/">mylist/3&quot;&gt;&lt;b id=&quot;x&quot;&gt;</a>'
    ].join('<br>'));
    const root = s.panel._description;
    assert.ok(!allAttributes(root).some(n => /^on/i.test(n)), allAttributes(root).join(','));
    assert.equal(root.querySelector('img'), null);
    assert.equal(root.querySelector('b#x'), null);
    // href から ID が取れないリンク（example.com で文字列も数字だけではない）は装飾しない
    assert.equal(root.querySelectorAll('zenza-mylist-link').length, 1);
    s.close();
  });

  it('ID が数字だけでない時は、文字列から取っても装飾しない（形式の検証）', async function() {
    const s = subject();
    await s.update('<a href="https://example.com/x">mylist/12a</a>');
    assert.equal(s.doc.querySelector('zenza-mylist-link'), null);
    assert.equal(s.panel._description.querySelector('a').textContent, 'mylist/12a');
    s.close();
  });

  it('説明文の本文: script 要素・on〜属性・javascript: 等の URL を残さない（普通のリンクと装飾は残す）', async function() {
    const s = subject();
    await s.update([
      '<span style="color: #ff0000;">赤い文字</span>',
      '<script>window.__x = 1</script>',
      '<b onclick="alert(1)">太字</b>',
      '<a href="javascript:alert(1)">危ないリンク</a>',
      '<a href=" JaVaScRiPt:alert(1)">危ないリンク2</a>',
      '<a href="data:text/html,<b>x</b>">データURL</a>',
      '<a href="https://www.nicovideo.jp/watch/sm9">sm9</a>',
      '<a href="/tag/test">相対リンク</a>'
    ].join('<br>'));
    const root = s.panel._description;
    assert.equal(root.querySelector('script'), null);
    assert.ok(!allAttributes(root).some(n => /^on/i.test(n)));
    const hrefs = [...root.querySelectorAll('a')].map(a => a.getAttribute('href'));
    assert.ok(!hrefs.some(h => h && /^\s*(javascript|data|vbscript):/i.test(h)), hrefs.join(' | '));
    assert.ok(hrefs.includes('https://www.nicovideo.jp/watch/sm9'));
    assert.ok(hrefs.includes('/tag/test'));
    assert.equal(root.querySelector('b').textContent, '太字');
    assert.ok(root.textContent.includes('赤い文字'));
    s.close();
  });

  it('シリーズの前後の動画の ID・シリーズ名も、文字のまま入る', async function() {
    const s = subject();
    await s.update('説明', {title: '<i>名前</i>', video: {prev: {id: 'sm1"><img src=x onerror=alert(1)>'}, next: {id: 'sm3'}}});
    const root = s.panel._description;
    assert.equal(root.querySelector('img'), null);
    assert.equal(root.querySelector('i'), null);
    assert.ok(root.textContent.includes('「<i>名前</i>」'));
    assert.ok(!allAttributes(root).some(n => /^on/i.test(n)));
    s.close();
  });
});
