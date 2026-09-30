// Task 087（監査v2 ZW-006）: dist-manifest.json と dist/*.user.js・build.js の templates の突き合わせ。
// 入力はすべて引数で受け取る（ファイルを読まない）ので、テストで壊した入力を渡して検出できることも確かめられる。
'use strict';
const crypto = require('crypto');

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

// build.js の templates から、npm run build（--dev）が作る配布物の一覧を求める
function buildOutputs(buildJsText) {
  const block = buildJsText.match(/var templates\s*=\s*\[([\s\S]*?)\];/);
  if (!block) { throw new Error('build.js に templates が見つからない'); }
  const outputs = [];
  for (const line of block[1].split('\n')) {
    if (/^\s*\/\//.test(line)) { continue; } // コメントアウトされたテンプレート
    const m = line.match(/src:\s*'([^']+)'\s*,\s*dist:\s*'([^']+)'\s*,\s*dev:\s*(true|false)/);
    if (!m) { continue; }
    const [, src, dist, dev] = m;
    const file = dev === 'true' && !/-dev\.user\.js$/.test(dist) ? dist.replace(/\.user\.js$/, '-dev.user.js') : dist;
    outputs.push({file, source: `src/${src}`});
  }
  return outputs;
}

function header(text, key) {
  const m = text.match(new RegExp(`^//\\s*@${key}\\s+(.+?)\\s*$`, 'm'));
  return m ? m[1] : null;
}

/**
 * @param {object} manifest  dist-manifest.json の中身
 * @param {string} buildJsText  build.js の中身
 * @param {Object<string, Buffer>} distFiles  'dist/xxx.user.js' → 中身（dist 直下の .user.js すべて）
 * @returns {string[]} 問題の一覧（空なら問題なし）
 */
function checkDistManifest(manifest, buildJsText, distFiles) {
  const errors = [];
  const active = (manifest.active && manifest.active.files) || [];
  const frozen = (manifest.legacyFrozen && manifest.legacyFrozen.files) || [];
  const outputs = buildOutputs(buildJsText);
  const outputSet = new Set(outputs.map(o => o.file));
  const activeSet = new Set(active.map(e => e.file));
  const frozenSet = new Set(frozen.map(e => e.file));

  // active = npm run build が作る物、と一致すること
  for (const o of outputs) {
    const e = active.find(a => a.file === o.file);
    if (!e) { errors.push(`${o.file}: build が作るのに active に無い`); continue; }
    if (e.source !== o.source) { errors.push(`${o.file}: active の source が build.js と違う（${e.source} / ${o.source}）`); }
  }
  for (const e of active) {
    if (!outputSet.has(e.file)) { errors.push(`${e.file}: active だが build（npm run build）では作られない`); }
    if (!distFiles[e.file]) { errors.push(`${e.file}: active だが dist に無い`); }
  }
  // legacy-frozen = build では作られず、内容が固定されていること
  for (const e of frozen) {
    if (outputSet.has(e.file)) { errors.push(`${e.file}: build で作られる active な配布物なのに legacy-frozen に分類されている`); }
    if (activeSet.has(e.file)) { errors.push(`${e.file}: active と legacy-frozen の両方にある`); }
    const buf = distFiles[e.file];
    if (!buf) { errors.push(`${e.file}: legacy-frozen だが dist に無い`); continue; }
    // 改行コードを CRLF に変える git 設定で取り出した場合も同じ内容とみなす（それ以外の変更は失敗）
    const raw = sha256(buf);
    const lf = sha256(Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1'));
    if (raw !== e.sha256 && lf !== e.sha256) { errors.push(`${e.file}: SHA-256 が dist-manifest.json と違う（凍結した旧成果物が変更された）`); }
    const text = buf.toString('utf-8');
    const us = e.userscript || {};
    for (const key of ['name', 'namespace', 'version', 'downloadURL', 'updateURL']) {
      if ((header(text, key) || null) !== (us[key] === undefined ? null : us[key])) {
        errors.push(`${e.file}: @${key} が dist-manifest.json と違う`);
      }
    }
  }
  // 未分類の dist が無いこと
  for (const file of Object.keys(distFiles)) {
    if (!activeSet.has(file) && !frozenSet.has(file)) { errors.push(`${file}: 未分類の配布物（dist-manifest.json の active にも legacy-frozen にも無い）`); }
  }
  return errors;
}

module.exports = {checkDistManifest, buildOutputs, sha256};
