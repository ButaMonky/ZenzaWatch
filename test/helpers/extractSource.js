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

const read = rel => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8');

function beginSection(rel) {
  const text = read(rel);
  const parts = text.split('//===BEGIN===');
  if (parts.length < 2) { throw new Error(`${rel} に //===BEGIN=== が無い`); }
  return parts[1].split('//===END===')[0];
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

function run(code, context) {
  return new vm.Script(code).runInContext(context, {timeout: 5000});
}

function loadClass(rel, name, context) {
  run(`${extract(rel, name, 'class')};\nglobalThis.__subject = ${name};`, context);
  return context.__subject;
}

module.exports = {read, beginSection, extract, createContext, run, loadClass};
