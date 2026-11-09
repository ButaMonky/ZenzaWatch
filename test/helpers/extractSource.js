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
  if (rel === 'packages/lib/src/nico/ThreadLoader.js') {
    return beginSection('packages/lib/src/nico/CommentPostWire.js') + '\n' +
      beginSection('packages/lib/src/nico/CommentReadAdapter.js') + '\n' + body;
  }
  if (rel === 'packages/lib/src/nico/VideoInfoLoader.js') {
    return beginSection('packages/lib/src/nico/CommentPostTarget.js') + '\n' + body;
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
  traverse(parser.parse(text, {sourceType: 'unambiguous', plugins: ['classProperties']}), {
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

// Keep only source offsets/text, never ASTs, classes or live VM state.
const extractionCache = new Map();
function extract(rel, name, kind = 'class') {
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
  return vm.createContext(c);
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
  return context.__subject;
}

module.exports = {read, beginSection, extract, createContext, run, loadClass, loadSearchDependencies};
