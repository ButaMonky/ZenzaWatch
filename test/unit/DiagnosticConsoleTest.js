'use strict';
// Task1052: 上級者設定「診断（上級者向け）」の詳細ログ（DiagnosticConsole）。
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');

const ROOT = path.resolve(__dirname, '../..');
const RUNTIME = path.join(ROOT, 'packages/zenza/src/diagnostics/DiagnosticConsole.js');

const load = () => {
  const dom = new JSDOM('<!DOCTYPE html><body><div class="zenzaVideoPlayerDialog"><video></video></div></body>',
    {url: 'https://www.nicovideo.jp/watch/sm9?ref=secret', pretendToBeVisual: true});
  const w = dom.window;
  const out = [];
  const record = level => (...args) => out.push({level, text: String(args[0]), data: args[2]});
  w.console = {info: record('info'), warn: record('warn'), error: record('error'), debug: record('debug'),
    table() {}, log: record('log')};
  const src = fs.readFileSync(RUNTIME, 'utf8');
  const body = src.slice(src.indexOf('//===BEGIN===') + 13, src.indexOf('//===END==='));
  const names = ['window', 'document', 'Node', 'Element', 'HTMLMediaElement', 'HTMLVideoElement',
    'HTMLImageElement', 'ErrorEvent', 'URL'];
  // eslint-disable-next-line no-new-func
  const DiagnosticConsole = new Function(...names, body + '\nreturn DiagnosticConsole;')(
    w, w.document, w.Node, w.Element, w.HTMLMediaElement, w.HTMLVideoElement, w.HTMLImageElement, w.ErrorEvent, w.URL);
  const values = {};
  const listeners = [];
  const config = {
    getValue: k => values[k],
    on: (name, fn) => { if (name === 'update') listeners.push(fn); },
    off: (name, fn) => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); },
    set(k, v) { values[k] = v; for (const fn of listeners.slice()) fn(k, v); }
  };
  const defaults = {
    'diagnostics.console.enabled': false, 'diagnostics.console.errors': true, 'diagnostics.console.startup': true,
    'diagnostics.console.player': true, 'diagnostics.console.network': true, 'diagnostics.console.notifications': true,
    'diagnostics.console.settings': true, 'diagnostics.console.events': false, 'diagnostics.console.performance': true,
    'diagnostics.console.intervalSec': 0
  };
  Object.assign(values, defaults);
  const emitted = [];
  const emitter = {emit(name, ...args) { emitted.push([name, ...args]); return 'original'; }};
  const debugRoot = {};
  return {w, out, config, DiagnosticConsole, emitter, emitted, debugRoot, dom, listenerCount: () => listeners.length};
};

describe('Task1052 DiagnosticConsole（診断ログ）', function() {
  let env;
  afterEach(() => { env && env.config.set('diagnostics.console.enabled', false); env && env.dom.window.close(); env = null; });

  const install = () => {
    env = load();
    env.DiagnosticConsole.install({window: env.w, config: env.config, version: '9.9.9-test', build: 'b1',
      emitter: env.emitter, debugRoot: env.debugRoot});
    return env;
  };

  it('初期状態（OFF）では何も出さず、何も記録しない', () => {
    const {w, out, debugRoot} = install();
    w.dispatchEvent(new w.ErrorEvent('error', {message: 'boom', filename: 'x.js', lineno: 1, colno: 2}));
    w.document.querySelector('video').dispatchEvent(new w.Event('waiting'));
    assert.deepStrictEqual(out, []);
    assert.strictEqual(debugRoot.diagnostics.status().enabled, false);
    assert.deepStrictEqual(debugRoot.diagnostics.status().running, []);
    assert.strictEqual(debugRoot.diagnostics.entries().length, 0);
  });

  it('ONにすると起動・環境の情報を出し、URLのクエリは消す', () => {
    const {out, config} = install();
    config.set('diagnostics.console.enabled', true);
    const start = out.find(o => /診断ログを開始しました/.test(o.text));
    assert(start, 'startup log');
    assert.strictEqual(start.data['版'], '9.9.9-test');
    assert.strictEqual(start.data['ページ'], 'www.nicovideo.jp/watch/sm9?(クエリ省略)');
    assert(!JSON.stringify(out).includes('secret'));
  });

  it('エラー・Promiseの拒否・動画要素のイベントを出す', () => {
    const {w, out, config} = install();
    config.set('diagnostics.console.enabled', true);
    w.dispatchEvent(new w.ErrorEvent('error', {message: 'boom', filename: 'userscript.html', lineno: 3, colno: 4,
      error: new Error('boom')}));
    const err = out.find(o => /捕捉されなかったエラー: boom/.test(o.text));
    assert(err && err.level === 'error');
    assert.match(err.data['zenzaらしさ'], /ZenzaWatch/);
    const rejection = new w.Event('unhandledrejection');
    rejection.reason = new Error('nope');
    w.dispatchEvent(rejection);
    assert(out.some(o => /Promise の拒否: nope/.test(o.text)));
    w.document.querySelector('video').dispatchEvent(new w.Event('waiting'));
    const media = out.find(o => /動画要素のイベント: waiting/.test(o.text));
    assert(media && media.level === 'info');
    assert.strictEqual(media.data['要素'], '#1 video');
    assert('readyState' in media.data && 'buffered' in media.data);
  });

  it('Task1054: Shadow DOM の中の動画要素のイベントも出し、enabled() で種類ごとの状態を返す', () => {
    const {w, out, config, DiagnosticConsole} = install();
    const host = w.document.createElement('div');
    w.document.body.append(host);
    const root = host.attachShadow({mode: 'open'});
    const video = w.document.createElement('video');
    root.append(video);
    assert.strictEqual(DiagnosticConsole.enabled('player'), false);
    config.set('diagnostics.console.enabled', true);
    assert.strictEqual(DiagnosticConsole.enabled('player'), true);
    assert.strictEqual(DiagnosticConsole.enabled('events'), false);
    video.dispatchEvent(new w.Event('stalled'));
    const ev = out.find(o => /動画要素のイベント: stalled/.test(o.text));
    assert(ev, out.map(o => o.text).join('\n'));
    assert.strictEqual(ev.level, 'info', '再生の警告は console.warn ではなく info で出す（呼び出し元の一覧を付けない）');
    assert.match(ev.text, /^%c\[Zenza診断:再生\] \+\d+\.\ds /, '経過時間はマイナスにならない');
  });

  it('Task1054: Config の update には 1 つだけ登録する', () => {
    const {config} = install();
    config.set('diagnostics.console.enabled', true);
    config.set('diagnostics.console.events', true);
    assert.strictEqual(env.listenerCount(), 1);
  });

  it('Task1055: 同じイベントが続けて 2 回来たら 1 回にまとめる', () => {
    const {w, out, config} = install();
    config.set('diagnostics.console.enabled', true);
    const video = w.document.querySelector('video');
    video.dispatchEvent(new w.Event('waiting'));
    video.dispatchEvent(new w.Event('waiting'));
    assert.strictEqual(out.filter(o => /動画要素のイベント: waiting/.test(o.text)).length, 1);
  });

  it('秘密のキーと本文は伏せ字にする', () => {
    const {out, config, debugRoot} = install();
    config.set('diagnostics.console.enabled', true);
    debugRoot.diagnostics.mark('test', {csrfToken: 'abc', comment: '本文', nested: {userId: 1, ok: 2},
      url: 'https://nvapi.nicovideo.jp/v1/x?actionTrackId=zzz'});
    const mark = out.find(o => /目印: test/.test(o.text));
    assert.strictEqual(mark.data.csrfToken, '[伏せ字]');
    assert.strictEqual(mark.data.comment, '[伏せ字]');
    assert.strictEqual(mark.data.nested.userId, '[伏せ字]');
    assert.strictEqual(mark.data.nested.ok, 2);
    assert.strictEqual(mark.data.url, 'nvapi.nicovideo.jp/v1/x?(クエリ省略)');
  });

  it('種類ごとにON/OFFでき、設定の変更・内部イベントも出せる', () => {
    const {w, out, config, emitter, emitted, debugRoot} = install();
    config.set('diagnostics.console.enabled', true);
    out.length = 0;
    config.set('diagnostics.console.player', false);
    w.document.querySelector('video').dispatchEvent(new w.Event('waiting'));
    assert(!out.some(o => /動画要素のイベント/.test(o.text)), 'player off');
    assert(out.some(o => /設定が変わりました: diagnostics.console.player/.test(o.text)), 'settings log');
    config.set('wordFilter', 'NGワード');
    const filter = out.find(o => /設定が変わりました: wordFilter/.test(o.text));
    assert.strictEqual(filter.data['値'], '[伏せ字]');
    config.set('diagnostics.console.events', true);
    assert.strictEqual(emitter.emit('fooEvent', 1), 'original');
    assert.deepStrictEqual(emitted.at(-1), ['fooEvent', 1]);
    assert(out.some(o => /内部イベント: fooEvent/.test(o.text)));
    assert(debugRoot.diagnostics.status().running.includes('events'));
  });

  it('OFFに戻すと監視を止め、本来の emit を元に戻す', () => {
    const {w, out, config, emitter} = install();
    const original = emitter.emit;
    config.set('diagnostics.console.enabled', true);
    config.set('diagnostics.console.events', true);
    assert.notStrictEqual(emitter.emit, original);
    config.set('diagnostics.console.enabled', false);
    assert.strictEqual(emitter.emit, original);
    assert(out.some(o => /診断ログを停止しました/.test(o.text)));
    out.length = 0;
    w.dispatchEvent(new w.ErrorEvent('error', {message: 'later'}));
    assert.deepStrictEqual(out, []);
  });

  it('配布物に組み込まれ、TS の正本から生成された JS が最新である', () => {
    require(path.join(ROOT, 'tools/generate-watch-click-navigation.cjs')).generate(true);
    const dist = fs.readFileSync(path.join(ROOT, 'dist/ZenzaWatch-dev.user.js'), 'utf8');
    assert(dist.includes('const DiagnosticConsole = (() => {'));
    assert(dist.includes('DiagnosticConsole.install({'));
  });
});
