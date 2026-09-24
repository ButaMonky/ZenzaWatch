// Task 085（監査v2 ZW-008）: 実際に配布する10個の dist/*.user.js についての検査。
//  1. 静的検査: どこにも定義されていない識別子（no-undef 相当）を、ビルド後の配布物に対して調べる。
//     連結ビルド（BEGIN/END・@require）で import が隠れるため、ソースではなく配布物で見る。
//  2. 起動スモーク: jsdom 上で配布物を読み込み、読み込み直後（0.5秒）に例外が出ないかを調べる。
// 期待する正常動作（監査の acceptance）:
//   CapTube の初期化不良（未定義 throttle、ZW-051）と不正な参照を検出でき、既知の例外だけが残る。
// 既知の問題（KNOWN_*）は別の指摘・未修正のものとして明記して固定している。直したら一覧から外すこと
// （一覧と実際が食い違うとテストが失敗する＝新しい問題も、直ったのに一覧に残っているのも分かる）。
// 注意: これはブラウザでの起動確認ではない。jsdom に無い API（IntersectionObserver 等）は空の代用品を置く。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const {REPO_ROOT} = require('../helpers/buildSandbox');

const DISTS = {
  'ZenzaWatch-dev.user.js': 'https://www.nicovideo.jp/watch/sm9',
  'uQuery.user.js': 'https://www.nicovideo.jp/',
  'MylistPocket.user.js': 'https://www.nicovideo.jp/ranking',
  'MaskedWatch.user.js': 'https://www.nicovideo.jp/watch/sm9',
  'ZenzaAdvancedSettings.user.js': 'https://www.nicovideo.jp/',
  'ZenzaHLS.user.js': 'https://www.nicovideo.jp/watch/sm9',
  'ZenzaGamePad.user.js': 'https://www.nicovideo.jp/',
  'ZenzaBlogPartsButton.user.js': 'https://example.com/',
  'CapTube.user.js': 'https://www.youtube.com/watch?v=test',
  'HeatSync.user.js': 'https://www.nicovideo.jp/watch/sm9'
};

// 古い globals パッケージの一覧に無い、現在のブラウザの組み込み
const MODERN_BROWSER_GLOBALS = [
  'globalThis', 'AbortController', 'Atomics', 'OffscreenCanvas', 'CSSStyleValue', 'CSSKeywordValue', 'arguments'
];
// Worker に文字列として渡すコードへ workerUtil が差し込む名前（Worker 側では定義される）
const WORKER_INJECTED = ['PID', 'bcast', 'portMap', 'EmitterInitFunc'];

// 既知の「定義されていない参照」（Task 085 時点。コード確認のみ・実行経路での再現は未確認のものを含む）
const KNOWN_UNDEFINED = {
  'CapTube.user.js': ['throttle', 'global'], // throttle: 監査 ZW-051（起動直後に停止）。global: 要調査
  'MaskedWatch.user.js': ['PromiseHandler', 'global'], // 要調査（Task 085 で新たに検出）
  'HeatSync.user.js': ['_'], // lodash の @require が無い。要調査（Task 085 で新たに検出）
  'MylistPocket.user.js': ['$', 'NicoVideoApi', 'BroadcastEmitter'], // 要調査（Task 085 で新たに検出）
  'ZenzaAdvancedSettings.user.js': ['workerUtil'], // 要調査（Task 085 で新たに検出）
  'ZenzaHLS.user.js': ['ZenzaWatch', 'context', 'stats'] // ZenzaWatch は本体が作る window.ZenzaWatch の可能性。要調査
};
// 既知の起動直後の例外
const KNOWN_STARTUP_ERRORS = {
  'CapTube.user.js': [/ReferenceError: throttle is not defined/] // 監査 ZW-051
};

function freeIdentifiers(src, {hasLodash}) {
  const parser = require('@babel/parser');
  const traverse = require('@babel/traverse').default;
  const G = require('globals');
  const known = new Set([
    ...Object.keys(G.builtin), ...Object.keys(G.browser), ...Object.keys(G.worker),
    ...Object.keys(G.serviceworker), ...Object.keys(G.greasemonkey),
    ...MODERN_BROWSER_GLOBALS, ...WORKER_INJECTED, ...(hasLodash ? ['_'] : [])
  ]);
  const found = new Set();
  traverse(parser.parse(src, {sourceType: 'script'}), {
    ReferencedIdentifier(p) {
      const n = p.node.name;
      if (known.has(n) || p.scope.hasBinding(n, true)) { return; }
      if (p.parentPath.isMemberExpression({property: p.node}) && !p.parent.computed) { return; }
      found.add(n);
    }
  });
  return Array.from(found).sort();
}

async function startupErrors(src, url, {hasLodash}) {
  const {JSDOM, VirtualConsole} = require('jsdom');
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(`jsdomError: ${(e.detail && e.detail.message) || e.message}`));
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>',
    {url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc});
  const w = dom.window;
  // ネットワークには出さない
  w.fetch = () => new Promise(() => {});
  w.XMLHttpRequest = function() {
    return {open() {}, send() {}, setRequestHeader() {}, addEventListener() {}, abort() {}};
  };
  // jsdom に無いブラウザ API の空の代用品
  const Noop = function() { return {observe() {}, unobserve() {}, disconnect() {}, postMessage() {}, addEventListener() {}, removeEventListener() {}, terminate() {}, close() {}}; };
  for (const name of ['Worker', 'IntersectionObserver', 'ResizeObserver', 'BroadcastChannel']) {
    if (typeof w[name] !== 'function') { w[name] = Noop; }
  }
  w.URL.createObjectURL = () => 'blob:stub';
  w.URL.revokeObjectURL = () => {};
  w.unsafeWindow = w;
  w.GM_info = {script: {version: '0'}};
  for (const g of ['GM_getValue', 'GM_setValue', 'GM_xmlhttpRequest', 'GM_addStyle']) { w[g] = () => undefined; }
  if (hasLodash) {
    // 配布物は CDN の lodash を @require で読む。ここでは npm の lodash で代用する（版の違いは監査 ZW-010）
    w.eval(fs.readFileSync(require.resolve('lodash/lodash.min.js'), 'utf-8'));
  }
  w.addEventListener('error', e => errors.push(`error: ${(e.error && e.error.constructor.name) || ''}: ${(e.error && e.error.message) || e.message}`));
  w.addEventListener('unhandledrejection', e => errors.push(`unhandledrejection: ${(e.reason && e.reason.message) || e.reason}`));
  const saved = process.listeners('uncaughtException');
  process.removeAllListeners('uncaughtException');
  const onUncaught = e => errors.push(`uncaught: ${e.constructor.name}: ${e.message}`);
  process.on('uncaughtException', onUncaught);
  try {
    try {
      w.eval(src);
    } catch (e) {
      errors.push(`sync: ${e.constructor.name}: ${e.message}`);
    }
    await new Promise(res => setTimeout(res, 500));
  } finally {
    process.removeListener('uncaughtException', onUncaught);
    saved.forEach(l => process.on('uncaughtException', l));
    w.close();
  }
  return errors;
}

describe('配布物の検査（ZW-008）', function() {
  this.timeout(120000);

  for (const [name, url] of Object.entries(DISTS)) {
    describe(name, function() {
      let src;
      let hasLodash;
      before(function() {
        src = fs.readFileSync(path.join(REPO_ROOT, 'dist', name), 'utf-8');
        hasLodash = /^\/\/\s*@require\s+\S*lodash/m.test(src);
      });

      it('どこにも定義されていない識別子は、既知のものだけ', function() {
        assert.deepEqual(freeIdentifiers(src, {hasLodash}), (KNOWN_UNDEFINED[name] || []).slice().sort());
      });

      it('jsdom で読み込んだ直後の例外は、既知のものだけ', async function() {
        const errors = await startupErrors(src, url, {hasLodash});
        const expected = KNOWN_STARTUP_ERRORS[name] || [];
        const unexpected = errors.filter(e => !expected.some(rx => rx.test(e)));
        assert.deepEqual(unexpected, []);
        for (const rx of expected) {
          assert.ok(errors.some(e => rx.test(e)), `既知の例外 ${rx} が出なくなった（直ったなら KNOWN_STARTUP_ERRORS から外す）`);
        }
      });
    });
  }
});

// 既存の ESLint 4 系は optional chaining 等の現在の構文を解析できない（監査 ZW-008 の lint.log）。
// ESLint の更新は依存の大きな変更になるため Task 085 では行わず、
// まず全ソースが現在の構文として解析できることを @babel/parser（ビルド・テストで使っているもの）で確かめる。
describe('ソースの構文（ZW-008）', function() {
  it('src と packages/*/src の全 .js が構文エラー無く解析できる', function() {
    const parser = require('@babel/parser');
    const walk = d => fs.readdirSync(d, {withFileTypes: true}).flatMap(e =>
      e.isDirectory() ? walk(path.join(d, e.name)) : (e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
    const roots = [path.join(REPO_ROOT, 'src'),
      ...fs.readdirSync(path.join(REPO_ROOT, 'packages')).map(p => path.join(REPO_ROOT, 'packages', p, 'src'))
        .filter(p => fs.existsSync(p))];
    const files = roots.flatMap(walk);
    assert.ok(files.length > 100, `ソースが少なすぎる（${files.length}）`);
    const bad = [];
    for (const f of files) {
      try {
        parser.parse(fs.readFileSync(f, 'utf-8'), {sourceType: 'unambiguous', allowReturnOutsideFunction: true});
      } catch (e) {
        bad.push(`${path.relative(REPO_ROOT, f)}: ${e.message}`);
      }
    }
    assert.deepEqual(bad, []);
  });
});
