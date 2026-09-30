// Task 092: MylistPocket の説明文リンク（util.httpLink）と、動画リンクの解析・解決の回帰テスト。
// 修正前は、sm/nm/so/ss の置換・/shorts/ss の置換・既存 <a> の退避の順だったため、
// フルURL・/shorts/・既にリンクになっている文字列を混ぜると、二重のリンク化や href の中の置換が起きていた。
// 動画の参照の「解析」（util.parseNicoVideoReference）と「リンク化」（util.httpLink）を分け、
// Google 等のリンク（リダイレクト用の /url?…&url=… を含む）からの解決（util.resolveNicoVideoLink）も同じ解析を使う。
// jsdom での確認で、実際のブラウザ・実際のニコニコの説明文・Google 検索での確認ではない。
import assert from 'power-assert';

const {pocketUtil, toDom} = require('../helpers/pocketHarness');

describe('MylistPocket: 動画の参照の解析（Task 092）', function() {
  this.timeout(20000);
  let s;
  before(() => { s = pocketUtil(); });
  after(() => s.close());
  const parse = v => s.util.parseNicoVideoReference(v);

  const ok = [
    ['sm123', 'sm123', 'https://www.nicovideo.jp/watch/sm123'],
    ['nm123', 'nm123', 'https://www.nicovideo.jp/watch/nm123'],
    ['so123', 'so123', 'https://www.nicovideo.jp/watch/so123'],
    ['ss123', 'ss123', 'https://www.nicovideo.jp/shorts/ss123'],
    ['/watch/sm123', 'sm123', 'https://www.nicovideo.jp/watch/sm123'],
    ['/shorts/ss123', 'ss123', 'https://www.nicovideo.jp/shorts/ss123'],
    ['https://www.nicovideo.jp/watch/sm123', 'sm123', 'https://www.nicovideo.jp/watch/sm123'],
    ['https://www.nicovideo.jp/watch/so123', 'so123', 'https://www.nicovideo.jp/watch/so123'],
    ['https://www.nicovideo.jp/shorts/ss123', 'ss123', 'https://www.nicovideo.jp/shorts/ss123'],
    ['http://www.nicovideo.jp/watch/sm123', 'sm123', 'https://www.nicovideo.jp/watch/sm123'],
    ['https://sp.nicovideo.jp/watch/sm123', 'sm123', 'https://www.nicovideo.jp/watch/sm123'],
    ['https://nico.ms/sm123', 'sm123', 'https://www.nicovideo.jp/watch/sm123'],
    ['https://nico.ms/ss123', 'ss123', 'https://www.nicovideo.jp/shorts/ss123'],
    ['https://www.nicovideo.jp/watch/sm9?ref=search#top', 'sm9', 'https://www.nicovideo.jp/watch/sm9'],
    ['https://www.nicovideo.jp/watch/ss123', 'ss123', 'https://www.nicovideo.jp/shorts/ss123'],
    ['https://www.nicovideo.jp/watch/1340979099', '1340979099', 'https://www.nicovideo.jp/watch/1340979099']
  ];
  for (const [input, watchId, canonicalUrl] of ok) {
    it(`${input} → ${watchId}`, function() {
      const r = parse(input);
      assert.ok(r, `${input} を解析できない`);
      assert.equal(r.watchId, watchId);
      assert.equal(r.canonicalUrl, canonicalUrl);
      assert.equal(r.type, watchId.startsWith('ss') ? 'shorts' : 'watch');
    });
  }

  const ng = [
    '', null, undefined, 'sm', 'lv123', 'sm123abc', 'xsm123', 'mylist/123',
    'https://www.nicovideo.jp/mylist/123', 'https://www.nicovideo.jp/user/1',
    'https://example.com/watch/sm9', 'https://www.nicovideo.jp.example.com/watch/sm9',
    'https://example.com/?u=https://www.nicovideo.jp/watch/sm9',
    'javascript:alert(1)//watch/sm9', 'https://www.nicovideo.jp/shorts/sm9',
    '//evil.example/watch/sm9', 'watch/sm9', 'https://live.nicovideo.jp/watch/lv123'
  ];
  for (const input of ng) {
    it(`${JSON.stringify(input)} は動画ではない`, function() {
      assert.equal(parse(input), null);
    });
  }
});

describe('MylistPocket: リンクから動画を解決する（Google のリダイレクト用リンクを含む、Task 092）', function() {
  this.timeout(20000);
  const anchor = (s, href, attrs = {}) => {
    const a = s.doc.createElement('a');
    a.setAttribute('href', href);
    for (const [k, v] of Object.entries(attrs)) { a.setAttribute(k, v); }
    s.doc.body.append(a);
    return a;
  };

  it('nicovideo の直接のリンク・sp・nico.ms・/shorts/', function() {
    const s = pocketUtil({url: 'https://www.google.com/search?q=sm9'});
    assert.equal(s.util.resolveNicoVideoLink(anchor(s, 'https://www.nicovideo.jp/watch/sm9')).watchId, 'sm9');
    assert.equal(s.util.resolveNicoVideoLink(anchor(s, 'https://sp.nicovideo.jp/watch/so1')).watchId, 'so1');
    assert.equal(s.util.resolveNicoVideoLink(anchor(s, 'https://nico.ms/ss5')).canonicalUrl, 'https://www.nicovideo.jp/shorts/ss5');
    assert.equal(s.util.resolveNicoVideoLink(anchor(s, 'https://www.nicovideo.jp/shorts/ss46448095')).watchId, 'ss46448095');
    s.close();
  });

  it('Google の /url?…&url=… と /url?q=… は、中の nicovideo の URL へ解決する（相対の /url? も）', function() {
    const s = pocketUtil({url: 'https://www.google.com/search?q=sm9'});
    const enc = encodeURIComponent('https://www.nicovideo.jp/watch/sm9');
    assert.equal(s.util.resolveNicoVideoLink(anchor(s, `https://www.google.com/url?sa=t&source=web&url=${enc}`)).watchId, 'sm9');
    assert.equal(s.util.resolveNicoVideoLink(anchor(s, `/url?sa=t&url=${enc}&ved=x`)).watchId, 'sm9');
    assert.equal(s.util.resolveNicoVideoLink(anchor(s, `https://www.google.co.jp/url?q=${encodeURIComponent('https://nico.ms/ss7')}&sa=U`)).watchId, 'ss7');
    s.close();
  });

  it('data-href があれば、そちらを先に見る', function() {
    const s = pocketUtil({url: 'https://www.google.com/search?q=sm9'});
    const a = anchor(s, 'https://www.google.com/search?q=x', {'data-href': 'https://www.nicovideo.jp/watch/sm10'});
    assert.equal(s.util.resolveNicoVideoLink(a).watchId, 'sm10');
    s.close();
  });

  it('任意のサイトへのリダイレクト・Google 以外の /url・Google の検索リンクは対象にしない', function() {
    const s = pocketUtil({url: 'https://www.google.com/search?q=sm9'});
    const r = href => s.util.resolveNicoVideoLink(anchor(s, href));
    assert.equal(r(`https://www.google.com/url?url=${encodeURIComponent('https://evil.example/watch/sm9')}`), null);
    assert.equal(r(`https://evil.example/url?url=${encodeURIComponent('https://www.nicovideo.jp/watch/sm9')}`), null);
    assert.equal(r('https://www.google.com/search?q=sm9'), null);
    assert.equal(r('https://www.google.com/search?q=https%3A%2F%2Fwww.nicovideo.jp%2Fwatch%2Fsm9'), null);
    assert.equal(r(`https://www.google.com/url?q=sm9`), null);
    // 二重のリダイレクトは解かない（1段だけ）
    const inner = `https://www.google.com/url?url=${encodeURIComponent('https://www.nicovideo.jp/watch/sm9')}`;
    assert.equal(r(`https://www.google.com/url?url=${encodeURIComponent(inner)}`), null);
    assert.equal(s.util.resolveNicoVideoLink(null), null);
    s.close();
  });

  it('HoverMenu は Google のリダイレクト用リンクでも対象の要素として扱い、無関係のリンクは扱わない', function() {
    const s = pocketUtil({url: 'https://www.google.com/search?q=sm9'});
    const {createContext, run, extract} = require('../helpers/extractSource');
    const c = createContext({util: s.util, Emitter: class {}, bounce: {time: f => f}, document: s.doc, window: s.w, location: s.w.location});
    run(`${extract('src/_pocket.js', 'HoverMenu', 'class')}; globalThis.HoverMenu = HoverMenu;`, c);
    const isTarget = a => c.HoverMenu.prototype._isTargetElement.call({}, {target: a});
    const enc = encodeURIComponent('https://www.nicovideo.jp/watch/sm9');
    const wrapped = anchor(s, `/url?sa=t&url=${enc}`);
    const span = s.doc.createElement('span');
    wrapped.append(span);
    assert.equal(isTarget(span), wrapped);
    assert.equal(isTarget(anchor(s, 'https://www.nicovideo.jp/watch/sm9')).getAttribute('href'), 'https://www.nicovideo.jp/watch/sm9');
    assert.equal(isTarget(anchor(s, 'https://www.google.com/search?q=watch/sm9')), false);
    assert.equal(isTarget(anchor(s, 'https://example.com/watch/sm9')), false);
    s.close();
  });
});

describe('MylistPocket: 説明文のリンク化 util.httpLink（Task 092）', function() {
  this.timeout(20000);
  let s;
  before(() => { s = pocketUtil(); });
  after(() => s.close());
  const link = html => toDom(s.w, s.util.httpLink(html));
  const anchors = root => [...root.querySelectorAll('a')];
  const noNested = root => assert.equal(root.querySelectorAll('a a').length, 0, '<a> の中に <a> がある');

  for (const [text, href] of [
    ['sm123', 'https://www.nicovideo.jp/watch/sm123'],
    ['nm123', 'https://www.nicovideo.jp/watch/nm123'],
    ['so123', 'https://www.nicovideo.jp/watch/so123'],
    ['ss123', 'https://www.nicovideo.jp/shorts/ss123'],
    ['https://www.nicovideo.jp/watch/sm123', 'https://www.nicovideo.jp/watch/sm123'],
    ['https://www.nicovideo.jp/watch/so123', 'https://www.nicovideo.jp/watch/so123'],
    ['https://www.nicovideo.jp/shorts/ss123', 'https://www.nicovideo.jp/shorts/ss123'],
    ['https://nico.ms/sm123', 'https://www.nicovideo.jp/watch/sm123'],
    ['https://nico.ms/ss123', 'https://www.nicovideo.jp/shorts/ss123']
  ]) {
    it(`「${text}」は1つのリンクになり、href は ${href}`, function() {
      const root = link(`前 ${text} 後`);
      const as = anchors(root);
      noNested(root);
      assert.equal(as.length, 1, root.innerHTML);
      assert.equal(as[0].getAttribute('href'), href);
      assert.equal(as[0].textContent, text);
      assert.ok(as[0].classList.contains('videoLink'));
      assert.equal(root.textContent, `前 ${text} 後`);
    });
  }

  it('既にリンクになっている URL は、そのまま（href を変えない・中にリンクを作らない）', function() {
    const html = '<a href="https://www.nicovideo.jp/watch/sm123">https://www.nicovideo.jp/watch/sm123 と sm456</a> の後 sm789';
    const root = link(html);
    noNested(root);
    const as = anchors(root);
    assert.equal(as.length, 2, root.innerHTML);
    assert.equal(as[0].getAttribute('href'), 'https://www.nicovideo.jp/watch/sm123');
    assert.equal(as[0].textContent, 'https://www.nicovideo.jp/watch/sm123 と sm456');
    assert.equal(as[1].getAttribute('href'), 'https://www.nicovideo.jp/watch/sm789');
  });

  it('既存のリンクの href が別サイトでも壊れない', function() {
    const root = link('<a href="https://example.com/sm9?x=https://www.nicovideo.jp/shorts/ss1">example</a>');
    const as = anchors(root);
    assert.equal(as.length, 1);
    assert.equal(as[0].getAttribute('href'), 'https://example.com/sm9?x=https://www.nicovideo.jp/shorts/ss1');
    assert.equal(as[0].textContent, 'example');
  });

  it('1つの説明文に複数の ID・URL', function() {
    const root = link('sm1 と nm2、so3 / ss4 https://www.nicovideo.jp/watch/sm5 https://nico.ms/ss6 https://www.nicovideo.jp/shorts/ss7');
    noNested(root);
    assert.deepEqual(anchors(root).map(a => a.getAttribute('href')), [
      'https://www.nicovideo.jp/watch/sm1',
      'https://www.nicovideo.jp/watch/nm2',
      'https://www.nicovideo.jp/watch/so3',
      'https://www.nicovideo.jp/shorts/ss4',
      'https://www.nicovideo.jp/watch/sm5',
      'https://www.nicovideo.jp/shorts/ss6',
      'https://www.nicovideo.jp/shorts/ss7'
    ]);
  });

  it('URL の直後の句読点・括弧はリンクに含めない', function() {
    const root = link('(https://nico.ms/sm9) 見て。https://www.nicovideo.jp/watch/sm10。次は https://www.nicovideo.jp/watch/sm11, その次 https://www.nicovideo.jp/shorts/ss12.');
    noNested(root);
    const as = anchors(root);
    assert.deepEqual(as.map(a => a.getAttribute('href')), [
      'https://www.nicovideo.jp/watch/sm9',
      'https://www.nicovideo.jp/watch/sm10',
      'https://www.nicovideo.jp/watch/sm11',
      'https://www.nicovideo.jp/shorts/ss12'
    ]);
    assert.deepEqual(as.map(a => a.textContent), [
      'https://nico.ms/sm9', 'https://www.nicovideo.jp/watch/sm10',
      'https://www.nicovideo.jp/watch/sm11', 'https://www.nicovideo.jp/shorts/ss12'
    ]);
    assert.equal(root.textContent, '(https://nico.ms/sm9) 見て。https://www.nicovideo.jp/watch/sm10。次は https://www.nicovideo.jp/watch/sm11, その次 https://www.nicovideo.jp/shorts/ss12.');
  });

  it('関係の無い URL は、そのままのリンク（中の sm〜 をリンクにしない）', function() {
    const root = link('https://example.com/?v=sm9&q=ss1 と https://x.com/foo');
    noNested(root);
    const as = anchors(root);
    assert.equal(as.length, 2, root.innerHTML);
    assert.equal(as[0].getAttribute('href'), 'https://example.com/?v=sm9&q=ss1');
    assert.ok(as[0].classList.contains('otherSite'));
    assert.equal(as[0].getAttribute('target'), '_blank');
    assert.equal(as[1].getAttribute('href'), 'https://x.com/foo');
  });

  it('続けて書かれた URL（…sm1https://…）は分ける', function() {
    const root = link('https://www.nicovideo.jp/watch/sm1https://www.nicovideo.jp/watch/sm2');
    assert.deepEqual(anchors(root).map(a => a.getAttribute('href')), [
      'https://www.nicovideo.jp/watch/sm1', 'https://www.nicovideo.jp/watch/sm2'
    ]);
  });

  it('同じ文字列を2回処理しても、リンクが増えたり入れ子にならない', function() {
    const src = 'sm1 https://www.nicovideo.jp/shorts/ss2 https://nico.ms/sm3 @nico im4 co5 mylist/6 https://example.com/';
    const once = s.util.httpLink(src);
    const twice = s.util.httpLink(once);
    assert.equal(twice, once);
    const root = toDom(s.w, twice);
    noNested(root);
    assert.equal(anchors(root).length, 8);
  });

  it('これまでのリンク化（@ID・im〜・co〜・mylist/〜・watch/数字）も残る', function() {
    const root = link('@nicovideo im123 co456 mylist/789 series/10 user/11 watch/1340979099 https://seiga.nicovideo.jp/seiga/im5 https://www.nicovideo.jp/mylist/12');
    noNested(root);
    const as = anchors(root);
    const byText = t => as.find(a => a.textContent === t);
    assert.equal(byText('@nicovideo').getAttribute('href'), 'https://twitter.com/nicovideo');
    assert.ok(byText('@nicovideo').classList.contains('twitterLink'));
    assert.equal(byText('im123').getAttribute('href'), 'https://seiga.nicovideo.jp/seiga/im123');
    assert.ok(byText('im123').classList.contains('seigaLink'));
    assert.equal(byText('co456').getAttribute('href'), 'https://com.nicovideo.jp/community/co456');
    assert.equal(byText('mylist/789').getAttribute('href'), 'https://www.nicovideo.jp/mylist/789');
    assert.equal(byText('series/10').getAttribute('href'), 'https://www.nicovideo.jp/series/10');
    assert.equal(byText('user/11').getAttribute('href'), 'https://www.nicovideo.jp/user/11');
    assert.equal(byText('watch/1340979099').getAttribute('href'), 'https://www.nicovideo.jp/watch/1340979099');
    assert.equal(byText('https://seiga.nicovideo.jp/seiga/im5').getAttribute('href'), 'https://seiga.nicovideo.jp/seiga/im5');
    assert.equal(byText('https://www.nicovideo.jp/mylist/12').getAttribute('href'), 'https://www.nicovideo.jp/mylist/12');
    assert.ok(byText('mylist/789').classList.contains('videoLink'));
  });

  it('メールアドレスの @ はリンクにしない・単語の途中の sm〜 もリンクにしない', function() {
    const root = link('mail: someone@example.com / cosm12 / asm9 / sm9x');
    assert.equal(anchors(root).length, 0, root.innerHTML);
  });

  it('改行（<br />）を残す', function() {
    const root = link('sm1<br />sm2<br>https://nico.ms/sm3');
    assert.equal(root.querySelectorAll('br').length, 2);
    assert.equal(anchors(root).length, 3);
  });

  it('スクリプトとして動き得るもの（script 等・on〜 属性・javascript: の URL）を残さない（Task 088 と同じ方針）', function() {
    const root = link('<img src="x" onerror="window.__x=1">sm1<script>window.__y=1</script><a href="javascript:alert(1)" onclick="x()">ng</a><iframe src="https://example.com/"></iframe><a href=" data:text/html,xx">d</a>');
    assert.equal(root.querySelectorAll('script,iframe').length, 0);
    for (const e of root.querySelectorAll('*')) {
      for (const a of e.attributes) {
        assert.ok(!/^on/i.test(a.name), `${e.tagName} に ${a.name}`);
        if (a.name === 'href') { assert.ok(!/^\s*(javascript|data|vbscript):/i.test(a.value), a.value); }
      }
    }
    assert.equal(anchors(root).find(a => a.textContent === 'sm1').getAttribute('href'), 'https://www.nicovideo.jp/watch/sm1');
  });

  it('文字の中の < > & は、文字のまま（要素にならない）', function() {
    const root = link('a &lt;b&gt; &amp; sm1');
    assert.equal(root.querySelectorAll('b').length, 0);
    assert.equal(root.textContent, 'a <b> & sm1');
  });
});
