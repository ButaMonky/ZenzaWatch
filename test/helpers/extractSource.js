// Task 088: 連結ビルド前提のソースから、クラス・変数・//===BEGIN===〜//===END=== の部分だけを取り出して、
// 用意した環境（vm のコンテキスト）で実行するための小さな道具。
// モジュールを丸ごと import すると依存が芋づる式に必要になるファイル（VideoInfoPanel.js 等）を、
// 監査v2 のプローブ（checks/reproduce.cjs）と同じ方法で、確かめたい部分だけ動かす。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const {REPO_ROOT} = require('./buildSandbox');
const {sceneSearchOwnershipPrelude} = require('./sceneSearchOwnershipDependencies');

const read = rel => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8').replace(/\r\n/g,'\n');

function beginSection(rel) {
  const text = read(rel);
  const parts = text.split('//===BEGIN===');
  if (parts.length < 2) { throw new Error(`${rel} に //===BEGIN=== が無い`); }
  const body = parts[1].split('//===END===')[0];
  // Task478: ThreadLoader's isolated VM tests must execute the same production
  // posting transport code that the userscript imports (no test-only mock).
  if (rel === 'packages/zenza/src/menu/HoverMenu.js') {
    return beginSection('packages/zenza/src/menu/WatchClickNavigation.js') + '\n' + body;
  }
  if (rel === 'packages/lib/src/nico/ThreadLoader.js') {
    return beginSection('packages/lib/src/nico/CommentPostWire.js') + '\n' +
      beginSection('packages/lib/src/nico/CommentReadAdapter.js') + '\n' +
      beginSection('packages/comment-history/src/generated/ZenzaCommentHistoryCore.generated.js') + '\n' + body;
  }
  if (rel === 'packages/lib/src/nico/VideoInfoLoader.js') {
    return beginSection('packages/lib/src/nico/CommentPostTarget.js') + '\n' + body;
  }
  // Task1060: 分割した部品は、本来 //@require で先に読み込まれる。
  if (SPLIT_FAMILIES[rel]) {
    return SPLIT_FAMILIES[rel].map(beginSection).join('\n') + '\n' + sceneSearchOwnershipPrelude(rel, read) + body;
  }
  return sceneSearchOwnershipPrelude(rel, read) + body;
}

// Index source offsets once per file content. Do not retain Babel nodes or scopes.
function indexSource(text) {
  const ranges = new Map();
  const remember = (kind, name, node) => {
    const key = `${kind}:${name}`;
    if (!ranges.has(key)) {
      ranges.set(key, node ? [node.start, node.end] : null);
    }
  };
  traverse(parser.parse(text, {sourceType: 'unambiguous', allowUndeclaredExports: true, plugins: ['classProperties']}), {
    noScope: true,
    ClassDeclaration(p) {
      if (p.node.id) { remember('class', p.node.id.name, p.node); }
    },
    VariableDeclarator(p) {
      if (p.node.id.type === 'Identifier') { remember('var', p.node.id.name, p.node.init); }
    }
  });
  return ranges;
}

// Task1060: NicoVideoPlayerDialog から分割した部品。元のファイルに無い宣言は、分割先から探す。
// 役割ごとのメソッド（NicoVideoPlayerDialog.prototype へ取り付ける）。本体の for 文と同じ順番。
const DIALOG_ROLES = ['NicoVideoPlayerDialogPrefetch', 'NicoVideoPlayerDialogPlaylistSources', 'NicoVideoPlayerDialogComments',
  'NicoVideoPlayerDialogResume', 'NicoVideoPlayerDialogUserActions', 'NicoVideoPlayerDialogNotifications',
  'NicoVideoPlayerDialogNicoadEnd', 'NicoVideoPlayerDialogCommands'];
// 分割した大きなモジュール（元の名前 → 分割先の名前）。元のファイルで見つからない宣言は分割先から探す。
// Task1060: NicoVideoPlayerDialog / Task1063: VideoInfoPanel・VideoControlBar・NicoVideoPlayerDialogView
// Task1063: NicoVideoPlayerDialogView も役割ごとに分けた（同じ取り付け方）。
const VIEW_ROLES = ['NicoVideoPlayerDialogViewSmallMode', 'NicoVideoPlayerDialogViewBookmarks', 'NicoVideoPlayerDialogViewFeedback'];
// クラス名 → そのクラスへ取り付ける役割（本体の for 文と同じ順番）
const CLASS_ROLES = {NicoVideoPlayerDialog: DIALOG_ROLES, NicoVideoPlayerDialogView: VIEW_ROLES};
const SPLIT_MODULES = {
  NicoVideoPlayerDialog: ['NicoVideoPlayerDialogView', 'VideoHoverMenu', ...DIALOG_ROLES],
  NicoVideoPlayerDialogView: ['VariablesMapper', ...VIEW_ROLES],
  VideoInfoPanel: ['VideoHeaderPanel', 'VideoSearchForm', 'UaaView', 'RelatedInfoMenu', 'VideoMetaInfo'],
  VideoControlBar: ['CommentPreview', 'SeekBarToolTip', 'SmoothSeekBarPointer'],
};
const SPLIT_ROOTS = [['src/', '.js'], ['tools/typescript-stage1/nico-src/', '.ts'], ['tools/typescript-stage1/.generated/nico/', '.js']];
const SPLIT_FAMILIES = {};
for (const [orig, parts] of Object.entries(SPLIT_MODULES)) {
  // 分割先がさらに分割されている時（NicoVideoPlayerDialogView など）は、その分割先も含める
  const expand = names => names.flatMap(n => [n, ...expand(SPLIT_MODULES[n] || [])]);
  for (const [dir, ext] of SPLIT_ROOTS) {
    SPLIT_FAMILIES[dir + orig + ext] = expand(parts).map(n => dir + n + ext);
  }
}
/** 取り出したクラス（NicoVideoPlayerDialog / NicoVideoPlayerDialogView）へ、分割したメソッドを本番と同じ形で取り付ける。 */
function installDialogRoles(rel, Klass, context, className = 'NicoVideoPlayerDialog') {
  if (rel.endsWith('.ts')) { return Klass; }
  const dir = rel.slice(0, rel.lastIndexOf('/') + 1);
  const own = indexed(rel).ranges;
  for (const role of CLASS_ROLES[className] || []) {
    // 配布物（dist）は役割のオブジェクトも同じファイルにある。src などは分割先のファイルから読む。
    const file = own.has(`var:${role}`) ? rel : dir + role + '.js';
    if (!fs.existsSync(path.join(REPO_ROOT, file))) { continue; }
    const code = extractOne(file, role, 'var');
    context.__dialogRole = run('(' + code + ')', context);
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(context.__dialogRole))) {
      Object.defineProperty(Klass.prototype, key, {...descriptor, enumerable: false});
    }
  }
  return Klass;
}
/** Task1063: クラスの定義に、分割した役割のメソッドの定義と取り付けを足した JS（ブラウザへそのまま入れるテスト用）。 */
function classWithRolesSource(rel, name) {
  const code = extract(rel, name, 'class');
  const roles = CLASS_ROLES[name] || [];
  if (!roles.length) { return code; }
  const dir = rel.slice(0, rel.lastIndexOf('/') + 1);
  const own = indexed(rel).ranges;
  const defs = roles.map(role => {
    const file = own.has(`var:${role}`) ? rel : dir + role + '.js';
    return `const ${role} = ${extractOne(file, role, 'var')};`;
  }).join('\n');
  return `${code}\n${defs}\nfor (const role of [${roles.join(', ')}]) {\n` +
    `  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(role))) {\n` +
    `    Object.defineProperty(${name}.prototype, key, {...descriptor, enumerable: false});\n  }\n}\n`;
}
/** 分割された部品も含めた、元のファイルの全文（文字列で検査するテスト用）。 */
function readFamily(rel) {
  return [rel, ...(SPLIT_FAMILIES[rel] || [])].map(read).join('\n');
}

// Keep only source offsets/text, never ASTs, classes or live VM state.
const extractionCache = new Map();
function extract(rel, name, kind = 'class') {
  const family = SPLIT_FAMILIES[rel];
  if (family) {
    for (const candidate of [rel, ...family]) {
      if (indexed(candidate).ranges.has(`${kind}:${name}`)) { return extractOne(candidate, name, kind); }
    }
  }
  return extractOne(rel, name, kind);
}
function indexed(rel) {
  const text = read(rel);
  let cached = extractionCache.get(rel);
  if (!cached || cached.text !== text) {
    cached = {text, ranges: indexSource(text), results: new Map()};
    extractionCache.set(rel, cached);
  }
  return cached;
}
function extractOne(rel, name, kind = 'class') {
  const text = read(rel);
  let cached = extractionCache.get(rel);
  if (!cached || cached.text !== text) {
    cached = {text, ranges: indexSource(text), results: new Map()};
    extractionCache.set(rel, cached);
  }
  const key = `${kind}:${name}`;
  if (cached.results.has(key)) { return cached.results.get(key); }
  const range = cached.ranges.get(key);
  if (range === undefined) { throw new Error(`${rel} に ${name} が見つからない`); }
  if (range === null) { throw new TypeError(`${rel}: ${name} has no initializer`); }
  const out = text.slice(range[0], range[1]);
  cached.results.set(key, out);
  return out;
}

function createContext(extra = {}) {
  const c = Object.assign({
    console, URL, URLSearchParams, setTimeout, clearTimeout, Promise, JSON, Math, Date, RegExp, Error
  }, extra);
  c.window = c.window || c;
  c.self = c.self || c;
  const context = vm.createContext(c);
  // Config extraction omits its userscript dependency directives.
  if ((extra.DataStorage || extra.buildDefaultKeyConfig) && !extra.ShareClipPreferences) {
    context.ShareClipPreferences = loadClass('src/ShareClipPreferences.js', 'ShareClipPreferences', context);
  }
  return context;
}

// UI fixture boot creates many isolated VM contexts from identical source.
// Compile immutable scripts once (bounded LRU), NEVER cache their contexts,
// exports, live DOM or any result of running the script. Parsing repeated
// classes under a 2000ms Mocha deadline caused intermittent setup stalls.
const scriptCache = new Map();
const SCRIPT_CACHE_LIMIT = 64;
function run(code, context) {
  if (typeof code !== 'string') {
    return new vm.Script(code).runInContext(context, {timeout: 5000});
  }
  let script = scriptCache.get(code);
  if (script) {
    scriptCache.delete(code);
  } else {
    script = new vm.Script(code);
  }
  scriptCache.set(code, script);
  if (scriptCache.size > SCRIPT_CACHE_LIMIT) {
    scriptCache.delete(scriptCache.keys().next().value);
  }
  return script.runInContext(context, {timeout: 5000});
}

// Isolated search probes need the real module-level cancellation closure.
function loadSearchDependencies(rel, context) {
  const text = read(rel);
  const start = text.indexOf('const SEARCH_SUPERSEDED =');
  const end = text.indexOf('class NicoSearchApiV2Loader', start);
  if (start < 0 || end <= start) {
    throw new Error(`${rel}: search cancellation prelude missing`);
  }
  run(text.slice(start, end), context);
}

function loadClass(rel, name, context) {
  if (name === 'ModernAdvancedSettingsModel' && !context.ShareClipPreferences) {
    context.ShareClipPreferences = loadClass('src/ShareClipPreferences.js', 'ShareClipPreferences', context);
  }
  if (name === 'HoverMenu' && !context.WatchClickNavigation) {
    run(beginSection('packages/zenza/src/menu/WatchClickNavigation.js') + '\nglobalThis.WatchClickNavigation = WatchClickNavigation;', context);
  }
  // Class extraction skips the runtime dependency directives. Load the
  // production geometry module for the existing seekbar/legacy consumers.
  if (!context.TimelineGeometry &&
      ((rel === 'src/VideoControlBar.js' && ['VideoControlBar', 'SmoothSeekBarPointer'].includes(name)) ||
       rel === 'packages/zenza/src/sceneSearch/SceneSearchLegacyAdapter.js')) {
    context.TimelineGeometry = loadClass('packages/zenza/src/sceneSearch/TimelineGeometry.js',
      'TimelineGeometry', context);
  }
  // Inject production DOM ownership dependencies for isolated class probes.
  // This and the TimelineGeometry resolution above are both required.
  run(sceneSearchOwnershipPrelude(rel, read) +
    `${extract(rel, name, 'class')};\nglobalThis.__subject = ${name};`, context);
  if (CLASS_ROLES[name]) { installDialogRoles(rel, context.__subject, context, name); }
  return context.__subject;
}

module.exports = {read, readFamily, SPLIT_FAMILIES, DIALOG_ROLES, VIEW_ROLES, CLASS_ROLES, installDialogRoles, classWithRolesSource, beginSection, extract, createContext, run, loadClass, loadSearchDependencies};
