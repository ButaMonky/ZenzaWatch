// Task 088（監査v2 ZW-085）: 「コメントの保存」（saveMymemory）で作る HTML に、動画のタイトル等が
// HTML として解釈されずに文字のまま入ることの回帰テスト。
// 修正前はタイトルを <h2> と <title> へそのまま差し込んでいた（「titleはエスケープされてる」というコメントに反して、
// 今の VideoInfo.title は元の文字列を返す）。監査の再現ケース BROWSER-EXPORT-TITLE-HTML。
// jsdom の DOMParser での確認で、実際のブラウザで保存したファイルを開いた確認ではない。
import assert from 'power-assert';
import {JSDOM} from 'jsdom';

const {beginSection, createContext, run} = require('../helpers/extractSource');

function save(title, {watchId = 'sm123', mymemory, userAgent = 'TestAgent/1.0'} = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', {url: 'https://www.nicovideo.jp/watch/sm9'});
  const w = dom.window;
  let blob = null;
  let anchor = null;
  w.URL.createObjectURL = b => { blob = b; return 'blob:test'; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function() { anchor = this; };
  const c = createContext({
    window: w, document: w.document, navigator: {userAgent}, Blob: w.Blob, URL: w.URL,
    ZenzaWatch: {version: 'test', env: 'test'}, setTimeout: () => 0
  });
  run(`${beginSection('packages/zenza/src/parts/saveMymemory.js')}; globalThis.saveMymemory = saveMymemory;`, c);
  const player = {
    currentTime: 12.5,
    getMymemory: () => mymemory || '<html><head><title>original</title></head><body class="x"><p>comments</p></body></html>'
  };
  c.saveMymemory(player, {watchId, title});
  return blob.text().then(text => {
    const doc = new w.DOMParser().parseFromString(text, 'text/html');
    return {text, doc, anchor, close: () => w.close()};
  });
}

const TITLES = [
  '<span data-audit-marker="title">literal title</span>',
  'A & B "quoted" \'single\' <b>bold</b>',
  'dollar $& $1 $` $\' $$ end',
  '改行\nの\tタイトル',
  '</title><script>window.__x=1</script>',
  '</h2><img src=x onerror=alert(1)>'
];

describe('コメントの保存で、タイトルを HTML として解釈しない（ZW-085）', function() {
  this.timeout(20000);

  for (const title of TITLES) {
    it(`タイトル ${JSON.stringify(title)} は文字のまま・要素も属性も作らない`, async function() {
      const r = await save(title);
      const h2 = r.doc.querySelector('h2');
      assert.equal(h2.children.length, 0, h2.innerHTML);
      assert.equal(h2.textContent, title);
      assert.equal(r.doc.title, `sm123 - ${title}`.replace(/\s+/g, ' ').trim());
      assert.equal(r.doc.querySelector('[data-audit-marker]'), null);
      assert.equal(r.doc.querySelector('script'), null);
      assert.equal(r.doc.querySelector('img'), null);
      // 元のコメント部分は残る
      assert.equal(r.doc.querySelector('body p').textContent, 'comments');
      assert.equal(r.doc.body.className, 'x');
      r.close();
    });
  }

  it('保存するファイル名に、パスの区切り・使えない文字が入らない', async function() {
    const r = await save('a/b\\c:d*e?f"g<h>i|j');
    assert.ok(!/[\\/:*?"<>|]/.test(r.anchor.download), r.anchor.download);
    assert.ok(r.anchor.download.endsWith('.html'));
    assert.ok(r.anchor.download.startsWith('sm123 - '));
    r.close();
  });

  it('作成環境（userAgent）・動画ID も文字のまま入る', async function() {
    const r = await save('t', {userAgent: 'UA<b id="ua">x</b>', watchId: 'sm1"><i>'});
    assert.equal(r.doc.querySelector('#ua'), null);
    assert.equal(r.doc.querySelector('i'), null);
    const link = r.doc.querySelector('div a');
    assert.ok(link.getAttribute('href').startsWith('//www.nicovideo.jp/watch/sm1%22'), link.getAttribute('href'));
    r.close();
  });

  it('正常: 元の動画へのリンク（再生位置つき）とデバッグの切り替えボタンが入る', async function() {
    const r = await save('普通のタイトル');
    const link = r.doc.querySelector('div a');
    assert.equal(link.getAttribute('href'), '//www.nicovideo.jp/watch/sm123?from=12');
    assert.equal(link.textContent, '元動画');
    assert.ok(r.doc.querySelector('button'));
    r.close();
  });
});
