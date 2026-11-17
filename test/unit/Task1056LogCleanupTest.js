'use strict';
// Task1056: 実機ログで見つかった問題の修正を確かめる。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const TS = 'tools/typescript-stage1/';

describe('Task1056 実機ログの指摘の修正', function() {
  it('サムネ情報のゲートは、キャッシュDBを開く前に受信を登録する（最初の要求が捨てられない）', () => {
    for (const rel of [TS + 'nico-src/GateAPI.ts', 'packages/lib/src/nico/GateAPI.js']) {
      const src = read(rel);
      const start = src.indexOf('const thumbInfo = async');
      const body = src.slice(start, src.indexOf('const nicovideo = ', start));
      const listen = body.indexOf("port.addEventListener('message'");
      assert(listen > 0, rel);
      assert(!/await ThumbInfoCacheDb\.open\(\)/.test(body.slice(0, listen)), rel + ': 受信登録の前に DB を待たない');
      assert(/const db = await dbReady;/.test(body), rel + ': 要求の中で DB を待つ');
    }
  });

  it('裏の動画要素を空にするとき src="" を使わない（error イベントを出さない）', () => {
    for (const rel of [TS + 'hls-src/HlsVideoElement.ts', 'packages/zenza/src/hls/HlsVideoElement.js']) {
      const src = read(rel);
      assert(!/this\._video\.src = '';/.test(src), rel);
      assert(/this\._video\.removeAttribute\('src'\);/.test(src), rel);
    }
  });

  it('FrameLayer は意味のない sandbox を付けない', () => {
    for (const rel of [TS + 'nico-src/FrameLayer.ts', 'packages/zenza/src/parts/FrameLayer.js']) {
      assert(!/sandbox: 'allow-same-origin allow-scripts'/.test(read(rel)), rel);
    }
  });

  it('切り替え中の先読み停止は switching として記録する', () => {
    // Task1060: 先読みの判断は NicoVideoPlayerDialogPrefetch へ分割した。
    for (const rel of [TS + 'nico-src/NicoVideoPlayerDialogPrefetch.ts', 'src/NicoVideoPlayerDialogPrefetch.js']) {
      const src = read(rel);
      assert(src.indexOf("? 'switching' :") > 0 && src.indexOf("? 'switching' :") < src.indexOf("? 'not-hls' :"), rel);
    }
  });

  it('開発用の細かいログは debug 設定で止められる console を使う', () => {
    const files = ['NicoChatGroupViewModel', 'NicoChatFilter', 'NicoComment', 'NicoCommentCss3PlayerView', 'OffscreenLayer']
      .flatMap(n => [TS + 'comment-src/' + n + '.ts', 'packages/zenza/src/commentLayer/' + n + '.js'])
      .concat(['CommentPanel', 'VideoInfoPanel', 'initializer'].map(n => 'src/' + n + '.js'));
    for (const rel of files) {
      const src = read(rel).split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
      assert(!/\b(?:window|self)\.console\.(?:time|timeEnd|timeLog|log|info)\(/.test(src), rel);
    }
    assert(/\['debug','開発用の細かいログ/.test(read(TS + 'advanced-src/ModernAdvancedSettingsModel.ts')));
  });

  it('先読みの通知履歴は画面の通知と同じ文面にする（履歴で二重にならない）', () => {
    const src = read(TS + 'nico-src/PrefetchReporter.ts');
    assert(!src.includes("message: `${text}（${videoId}）`"));
  });
});

describe('Task1056 診断ログの見立て', function() {
  const RUNTIME = path.join(ROOT, 'packages/zenza/src/diagnostics/DiagnosticConsole.js');
  let dom;
  afterEach(() => { dom && dom.window.close(); dom = null; });
  const setup = () => {
    dom = new JSDOM('<!DOCTYPE html><body><div class="zenzaVideoPlayerDialog"><img class="zenzaThumb"></div><img class="pageAd"></body>',
      {url: 'https://www.nicovideo.jp/watch/sm9', pretendToBeVisual: true});
    const w = dom.window;
    const out = [];
    const record = level => (...args) => out.push({level, text: String(args[0]), data: args[2]});
    w.console = {info: record('info'), warn: record('warn'), error: record('error'), debug: record('debug'), log: record('log'), table() {}};
    const src = fs.readFileSync(RUNTIME, 'utf8');
    const body = src.slice(src.indexOf('//===BEGIN===') + 13, src.indexOf('//===END==='));
    const names = ['window', 'document', 'Node', 'Element', 'HTMLMediaElement', 'HTMLVideoElement', 'HTMLImageElement', 'ErrorEvent', 'URL'];
    // eslint-disable-next-line no-new-func
    const DiagnosticConsole = new Function(...names, body + '\nreturn DiagnosticConsole;')(
      w, w.document, w.Node, w.Element, w.HTMLMediaElement, w.HTMLVideoElement, w.HTMLImageElement, w.ErrorEvent, w.URL);
    const values = {'diagnostics.console.enabled': true, 'diagnostics.console.errors': true};
    DiagnosticConsole.install({window: w, config: {getValue: k => values[k], on() {}, off() {}}, version: 't', debugRoot: {}});
    return {w, out};
  };

  it('ページ側の要素の読み込み失敗は警告にせず、ZenzaWatch の要素は警告にする', () => {
    const {w, out} = setup();
    w.document.querySelector('.pageAd').dispatchEvent(new w.Event('error'));
    w.document.querySelector('.zenzaThumb').dispatchEvent(new w.Event('error'));
    const page = out.find(o => /（ページ側）読み込みに失敗した要素/.test(o.text));
    const own = out.find(o => /^[^（]*読み込みに失敗した要素/.test(o.text.replace(/^%c\[[^\]]*\][^読（]*/, '')));
    assert(page && page.level === 'info', JSON.stringify(out.map(o => [o.level, o.text])));
    assert(own && own.level === 'warn', JSON.stringify(out.map(o => [o.level, o.text])));
  });
});
