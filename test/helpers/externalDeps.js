// Task 088（監査v2 ZW-010・ZW-011）: 配布物が CDN から読む外部の依存（lodash・hls.js・lit 等）の版の検査。
// 入力はすべて引数で受け取る（ファイルを読まない）ので、テストで壊した入力を渡して検出できることも確かめられる。
'use strict';

const CDN_URL = /https?:\/\/(?:cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|esm\.run|unpkg\.com|esm\.sh|cdn\.skypack\.dev)\/[^\s'"`)<>]+/g;
const EXACT = /^\d+\.\d+\.\d+$/;

// コメントの行は除く（ただし Userscript の @require はコメントの形なので残す）
function codeLines(text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (/^\/\/\s*@(require|resource)\b/.test(t)) { out.push({line, no: i + 1}); return; }
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) { return; }
    out.push({line: line.replace(/\s\/\/.*$/, ''), no: i + 1});
  });
  return out;
}

// URL → {pkg, version}（版が無い・@latest・${...} の時は version にそのまま入れる）
function parseCdnUrl(url) {
  let m;
  if ((m = url.match(/^https?:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/([^/]+)\/([^/]+)\//))) {
    return {pkg: m[1] === 'lodash.js' ? 'lodash' : m[1], version: m[2]};
  }
  const path = url.replace(/^https?:\/\/[^/]+\//, '').replace(/^npm\//, '');
  m = path.match(/^((?:@[^/@]+\/)?[^/@?#]+)(?:@([^/?#]+))?/);
  if (!m) { return {pkg: path, version: null}; }
  return {pkg: m[1], version: m[2] || null};
}

/**
 * @param {Object<string,string>} files  相対パス → 中身
 * @returns {{file, no, url, pkg, version}[]}
 */
function collectCdnRefs(files) {
  const refs = [];
  for (const [file, text] of Object.entries(files)) {
    for (const {line, no} of codeLines(text)) {
      for (const url of line.match(CDN_URL) || []) {
        refs.push({file, no, url, ...parseCdnUrl(url)});
      }
    }
  }
  return refs;
}

/**
 * @param {object} p
 * @param {Object<string,string>} p.files  検査するファイル（相対パス → 中身）
 * @param {object} p.packageJson  package.json
 * @param {object} p.packageLock  package-lock.json
 * @returns {string[]} 問題の一覧（空なら問題なし）
 */
function checkPinnedDeps({files, packageJson, packageLock}) {
  const errors = [];
  const refs = collectCdnRefs(files);
  const byPkg = {};
  for (const r of refs) {
    if (!r.version || !EXACT.test(r.version)) {
      errors.push(`${r.file}:${r.no} ${r.url} の版が固定されていない（${r.version || '版の指定なし'}）`);
      continue;
    }
    (byPkg[r.pkg] = byPkg[r.pkg] || new Set()).add(r.version);
  }
  for (const [pkg, vers] of Object.entries(byPkg)) {
    if (vers.size > 1) {
      errors.push(`${pkg} の版が配布物・ソースの中で揃っていない（${[...vers].sort().join(', ')}）`);
    }
  }
  // lodash: 配布物が読む版 = テストが使う版（package-lock の node_modules/lodash）= package.json の指定
  const lockLodash = packageLock.packages && packageLock.packages['node_modules/lodash'];
  const lockVer = lockLodash && lockLodash.version;
  const specs = Object.assign({}, packageJson.dependencies, packageJson.devDependencies);
  const rootSpecs = packageLock.packages && packageLock.packages[''] &&
    Object.assign({}, packageLock.packages[''].dependencies, packageLock.packages[''].devDependencies);
  if (!byPkg.lodash) {
    errors.push('配布物に lodash の @require が見つからない');
  } else {
    for (const v of byPkg.lodash) {
      if (v !== lockVer) { errors.push(`配布物の lodash ${v} とテストの lodash ${lockVer} が違う`); }
    }
  }
  if (specs.lodash !== lockVer) {
    errors.push(`package.json の lodash の指定（${specs.lodash}）がテストの版（${lockVer}）の完全な版ではない`);
  }
  if (rootSpecs && rootSpecs.lodash !== specs.lodash) {
    errors.push(`package-lock.json の lodash の指定（${rootSpecs.lodash}）が package.json（${specs.lodash}）と違う`);
  }
  return errors;
}

module.exports = {collectCdnRefs, parseCdnUrl, checkPinnedDeps, EXACT};
