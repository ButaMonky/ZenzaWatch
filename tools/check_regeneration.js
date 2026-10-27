#!/usr/bin/env node
// ============================================================
// tools/check_regeneration.js（Task 084 / 監査v2 ZW-001）
//
// 指定したフォルダ（例: 公開用 repo ZenzaWatch-public）の「ソース」だけから配布物を作り直し、
// そのフォルダの dist/*.user.js と一致するかを確かめる。
// 公開用 repo のソースに一部の変更（例: Task 079b の src/VideoControlBar.js）が入らないまま
// 生成物だけが公開され、第三者や次回の公開作業で再ビルドすると直したはずの挙動が戻る、
// という食い違いを公開前に見つけるためのもの。
//
// 使い方:
//   node tools/check_regeneration.js <ソースのフォルダ> [--reference <作業用repoのフォルダ>]
//
// ・<ソースのフォルダ>の build.js・src・packages/*/src を一時フォルダへコピーし、
//   `node build.js --dev` で作り直す（元のフォルダには何も書き込まない）。
// ・作り直した各配布物を <ソースのフォルダ>/dist の同名ファイルと比べる。
//   違ってよいのはビルド識別子の行（`// build: ...` と `var BUILD = '...';`）だけ。
// ・--reference を付けると、ビルドの入力（build.js・src・packages/*/src）のうち、
//   作業用 repo と内容が違うファイルも一覧にする（どのソースを公開し忘れたかの手がかり）。
//
// 終了コード: 0=一致 / 1=一致しない / 2=検査できなかった（ビルド失敗・入力が無い等）
// build.js が読むモジュール（@babel/parser 等）は、このスクリプトのある repo の node_modules を使う。
// ============================================================
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const {spawnSync} = require('child_process');

const EXIT_OK = 0;
const EXIT_MISMATCH = 1;
const EXIT_CANNOT_CHECK = 2;

const normalize = text => text
  .replace(/\r\n/g, '\n')
  .replace(/^\/\/ build: .*$/mg, '// build: <BUILD_ID>')
  .replace(/^(\s*)var BUILD = '.*';$/mg, "$1var BUILD = '<BUILD_ID>';");

function buildInputs(root) {
  const files = [];
  const walk = (rel) => {
    const abs = path.join(root, rel);
    if (!fs.existsSync(abs)) { return; }
    for (const ent of fs.readdirSync(abs, {withFileTypes: true})) {
      const r = path.join(rel, ent.name);
      if (ent.isDirectory()) { walk(r); } else if (ent.isFile()) { files.push(r.split(path.sep).join('/')); }
    }
  };
  if (fs.existsSync(path.join(root, 'build.js'))) { files.push('build.js'); }
  walk('src');
  const pkgDir = path.join(root, 'packages');
  if (fs.existsSync(pkgDir)) {
    for (const pkg of fs.readdirSync(pkgDir)) {
      walk(path.join('packages', pkg, 'src'));
    }
  }
  return files.sort();
}

function hashFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function firstDifference(a, b) {
  const la = a.split('\n');
  const lb = b.split('\n');
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    if (la[i] !== lb[i]) {
      const cut = s => (s === undefined ? '（行なし）' : s.trim().slice(0, 120));
      return `${i + 1}行目  公開中の dist: ${cut(la[i])}\n      作り直した結果: ${cut(lb[i])}`;
    }
  }
  return '';
}

function main(argv) {
  const args = argv.slice(2);
  let reference = null;
  const refIdx = args.indexOf('--reference');
  if (refIdx >= 0) {
    reference = args[refIdx + 1];
    args.splice(refIdx, 2);
  }
  if (args.length !== 1 || (refIdx >= 0 && !reference)) {
    console.log('  使い方: node tools/check_regeneration.js <ソースのフォルダ> [--reference <作業用repoのフォルダ>]');
    return EXIT_CANNOT_CHECK;
  }
  const sourceDir = path.resolve(args[0]);
  const distDir = path.join(sourceDir, 'dist');
  if (!fs.existsSync(path.join(sourceDir, 'build.js')) || !fs.existsSync(path.join(sourceDir, 'src')) ||
      !fs.existsSync(distDir)) {
    console.log(`  検査できませんでした: ${args[0]} に build.js・src・dist がそろっていません。`);
    return EXIT_CANNOT_CHECK;
  }

  const inputs = buildInputs(sourceDir);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-regen-'));
  try {
    for (const rel of inputs) {
      const dst = path.join(work, rel);
      fs.mkdirSync(path.dirname(dst), {recursive: true});
      fs.copyFileSync(path.join(sourceDir, rel), dst);
    }
    fs.mkdirSync(path.join(work, 'dist'), {recursive: true});

    // The isolated build has no .git directory. Preserve the distribution
    // channel declared by the checked-in script, not the runner's remote.
    const main = fs.readFileSync(path.join(distDir, 'ZenzaWatch-dev.user.js'), 'utf8');
    const privateChannel = /^\/\/ @downloadURL\s+https:\/\/github\.com\/ButaMonky\/ZenzaWatch-Back-up\/raw\/develop\/dist\/ZenzaWatch-dev\.user\.js\s*$/m.test(main);
    const r = spawnSync(process.execPath, ['build.js', '--dev'], {
      cwd: work,
      encoding: 'utf-8',
      timeout: 300000,
      env: {
        ...process.env,
        ZENZA_PUBLISH_CHANNEL: privateChannel ? 'private' : 'public',
        NODE_PATH: path.resolve(__dirname, '..', 'node_modules'),
        ZENZA_BUILD_NO_NOTIFY: '1'
      }
    });
    const produced = fs.readdirSync(path.join(work, 'dist')).filter(f => f.endsWith('.user.js')).sort();
    if (r.status !== 0 || produced.length === 0) {
      console.log(`  検査できませんでした: ソースからのビルドが失敗しました（終了コード ${r.status}）。`);
      const tail = `${r.stdout || ''}${r.stderr || ''}`.split('\n').filter(l => /Error|FAILED|  - /.test(l)).slice(-10);
      tail.forEach(l => console.log(`    ${l.slice(0, 200)}`));
      return EXIT_CANNOT_CHECK;
    }

    const mismatches = [];
    for (const f of produced) {
      const published = path.join(distDir, f);
      const rebuilt = fs.readFileSync(path.join(work, 'dist', f), 'utf-8');
      if (!fs.existsSync(published)) {
        mismatches.push(`${f}: dist にありません`);
        continue;
      }
      const a = normalize(fs.readFileSync(published, 'utf-8'));
      const b = normalize(rebuilt);
      if (a !== b) {
        mismatches.push(`${f}: 内容が違います\n      ${firstDifference(a, b)}`);
      }
    }
    const notRegenerated = fs.readdirSync(distDir).filter(f => f.endsWith('.user.js') && !produced.includes(f)).sort();

    console.log(`  ソースから作り直した配布物: ${produced.length}個（ビルド識別子の行は比較から除外）`);
    // Task 087（ZW-006）: dist-manifest.json があれば、作り直さない dist は legacy-frozen として
    // 登録済みで SHA-256 が一致するものだけを認める（未分類・内容の変わった旧成果物は一致しない扱い）
    const manifestPath = path.join(sourceDir, 'dist-manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      const frozen = new Map(((manifest.legacyFrozen && manifest.legacyFrozen.files) || [])
        .map(e => [e.file.replace(/^dist\//, ''), e]));
      const ok = [];
      for (const f of notRegenerated) {
        const entry = frozen.get(f);
        if (!entry) {
          mismatches.push(`${f}: ビルドで作られず、dist-manifest.json の legacy-frozen にも無い（未分類の配布物）`);
          continue;
        }
        const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(distDir, f))).digest('hex');
        if (sha !== entry.sha256) {
          mismatches.push(`${f}: legacy-frozen の SHA-256 が dist-manifest.json と違う（凍結した旧成果物が変更された）`);
        } else {
          ok.push(f);
        }
      }
      for (const f of produced) {
        if (frozen.has(f)) { mismatches.push(`${f}: ビルドで作られるのに legacy-frozen として登録されている（誤分類）`); }
      }
      if (ok.length) { console.log(`  legacy-frozen（作り直さない・SHA-256 一致）: ${ok.join(', ')}`); }
    } else if (notRegenerated.length) {
      console.log(`  （参考）ビルドの対象外で比較していない dist: ${notRegenerated.join(', ')}`);
    }
    if (reference) {
      const refRoot = path.resolve(reference);
      const refInputs = buildInputs(refRoot);
      const all = Array.from(new Set([...inputs, ...refInputs])).sort();
      const differ = all.filter(rel => {
        const a = path.join(sourceDir, rel);
        const b = path.join(refRoot, rel);
        if (!fs.existsSync(a) || !fs.existsSync(b)) { return true; }
        return hashFile(a) !== hashFile(b);
      });
      if (differ.length) {
        console.log(`  （参考）作業用 repo と内容が違うビルド入力: ${differ.length}個`);
        differ.slice(0, 30).forEach(rel => console.log(`    ${rel}`));
      } else {
        console.log('  （参考）作業用 repo とビルド入力の内容はすべて同じです。');
      }
    }
    if (mismatches.length) {
      console.log(`  一致しない配布物: ${mismatches.length}個`);
      mismatches.forEach(m => console.log(`    ${m}`));
      return EXIT_MISMATCH;
    }
    console.log('  すべての配布物が一致しました。');
    return EXIT_OK;
  } catch (e) {
    console.log(`  検査できませんでした: ${e.message || e}`);
    return EXIT_CANNOT_CHECK;
  } finally {
    try { fs.rmSync(work, {recursive: true, force: true}); } catch (e) { /* 後片付けのみ */ }
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = {main, normalize};
