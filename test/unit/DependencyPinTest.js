// Task 088（監査v2 ZW-010・ZW-011）: 配布物が読む外部の依存の版が、完全な版番号に固定され、
// 配布物どうし・ソース・テスト（node_modules）で揃っていることの回帰テスト。
//   - ZW-010: 配布物の lodash（CDN）とテストの lodash（package-lock）が違っていた（4.17.11 / 4.17.5 と 4.18.1）
//   - ZW-011: hls.js を @latest で読んでいた（@require・読み込み失敗時の代わり・設定の既定値）
//   - lit: esm.run から版の指定なしで読む箇所があった
// legacy-frozen の3つ（dist-manifest.json）は作り直さない旧版なので対象外（OPS-7 で扱う）。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const {REPO_ROOT} = require('../helpers/buildSandbox');
const {checkPinnedDeps, collectCdnRefs} = require('../helpers/externalDeps');

const read = p => fs.readFileSync(path.join(REPO_ROOT, p), 'utf-8');

function walk(dir) {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) { return []; }
  return fs.readdirSync(abs, {withFileTypes: true}).flatMap(e => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : (e.name.endsWith('.js') ? [rel] : []);
  });
}

function targetFiles() {
  const manifest = JSON.parse(read('dist-manifest.json'));
  const files = {};
  for (const {file} of manifest.active.files) { files[file] = read(file); }
  const sources = [
    ...walk('src').filter(f => !f.startsWith('src/yomi/') && f !== 'src/_my4.js'),
    ...fs.readdirSync(path.join(REPO_ROOT, 'packages')).flatMap(p => walk(`packages/${p}/src`))
  ];
  for (const f of sources) { files[f] = read(f); }
  return files;
}

const real = () => ({
  files: targetFiles(),
  packageJson: JSON.parse(read('package.json')),
  packageLock: JSON.parse(read('package-lock.json'))
});

describe('外部の依存の版の固定（ZW-010・ZW-011）', function() {
  it('配布物とソースが CDN から読む依存は、すべて完全な版番号で、同じ依存は同じ版', function() {
    // Windows/Remote 環境では active dist + 全 source の走査が Mocha 既定の2秒を超えることがある。
    // 検査内容は変えず、実行時間の上限だけ十分に取る。
    this.timeout(60000);
    assert.deepEqual(checkPinnedDeps(real()), []);
  });

  it('lodash は配布物（@require）・package.json・テストの node_modules で同じ版', function() {
    // Windows/Remote 環境では active dist + 全 source の走査が Mocha 既定の2秒を超えることがある。
    // 検査内容は変えず、実行時間の上限だけ十分に取る（Task 091 の全体検証で再現）。
    this.timeout(60000);
    const r = real();
    const refs = collectCdnRefs(r.files).filter(x => x.pkg === 'lodash');
    assert.ok(refs.length >= 3, '本体・上級者用設定・MylistPocket の @require が見つからない');
    const installed = require(path.join(REPO_ROOT, 'node_modules/lodash/package.json')).version;
    for (const x of refs) { assert.equal(x.version, installed, `${x.file}:${x.no}`); }
    assert.equal(r.packageJson.devDependencies.lodash, installed);
  });

  it('テストの node_modules の lodash.min.js は、配布物が読む jsDelivr の lodash@4.18.1/lodash.min.js と同じファイル（SHA-256）', function() {
    // 2026-09-25（Task 088）に https://cdn.jsdelivr.net/npm/lodash@4.18.1/lodash.min.js を取得して計算した値。
    // 版を変える時は、取得したファイルの SHA-256 をここに書き直し、node_modules の同じファイルと一致することを確かめる。
    const JSDELIVR_LODASH_4_18_1_MIN_SHA256 = 'a8d7e6291ad80256f976ace90824a71018d2f706992c9107b20bdced97bee27b';
    const buf = fs.readFileSync(path.join(REPO_ROOT, 'node_modules/lodash/lodash.min.js'));
    const sha = require('crypto').createHash('sha256').update(buf).digest('hex');
    assert.equal(sha, JSDELIVR_LODASH_4_18_1_MIN_SHA256);
  });

  it('hls.js は @require・読み込み失敗時の代わり・プレイヤーが読む URL が同じ1つの版', function() {
    const r = real();
    const hls = collectCdnRefs({'src/_hls.js': r.files['src/_hls.js'], 'dist/ZenzaHLS.user.js': r.files['dist/ZenzaHLS.user.js']})
      .filter(x => x.pkg === 'hls.js');
    assert.ok(hls.some(x => /@require/.test(r.files[x.file].split(/\r?\n/)[x.no - 1])), '@require が見つからない');
    assert.equal(new Set(hls.map(x => x.version)).size, 1, JSON.stringify(hls));
    assert.ok(!/hls_js_ver:\s*'latest'/.test(r.files['src/_hls.js']), '設定の既定値が latest のまま');
    assert.ok(!/hls\.js@\$\{/.test(r.files['src/_hls.js']), '設定の値で版を変えて読む経路が残っている');
  });

  it('HLS: 致命的でないエラーに recoverMediaError を無条件に掛けない（呼び出しが無い）', function() {
    for (const f of ['src/_hls.js', 'dist/ZenzaHLS.user.js']) {
      const calls = read(f).split(/\r?\n/).filter(l => /recoverMediaError\s*\(/.test(l) && !/^\s*\/\//.test(l));
      assert.deepEqual(calls, [], f);
    }
  });

  it('検査が働くこと: @latest・版なし・版の不一致・lodash の食い違いを見つける', function() {
    this.timeout(60000);
    const base = real();
    const broken = Object.assign({}, base.files, {
      'x/a.js': "// @require https://cdn.jsdelivr.net/npm/hls.js@latest\nimport('https://esm.run/lit');\n",
      'x/b.js': "// @require https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.17.11/lodash.min.js\n"
    });
    const errors = checkPinnedDeps({files: broken, packageJson: base.packageJson, packageLock: base.packageLock});
    assert.ok(errors.some(e => /hls\.js@latest/.test(e)), errors.join('\n'));
    assert.ok(errors.some(e => /esm\.run\/lit の版が固定されていない/.test(e)), errors.join('\n'));
    assert.ok(errors.some(e => /lodash の版が配布物・ソースの中で揃っていない/.test(e)), errors.join('\n'));
    assert.ok(errors.some(e => /配布物の lodash 4\.17\.11 とテストの lodash/.test(e)), errors.join('\n'));
    const loose = Object.assign({}, base.packageJson, {devDependencies: Object.assign({}, base.packageJson.devDependencies, {lodash: '^4.17.5'})});
    const e2 = checkPinnedDeps({files: base.files, packageJson: loose, packageLock: base.packageLock});
    assert.ok(e2.some(e => /package\.json の lodash の指定/.test(e)), e2.join('\n'));
    // コメントアウトされた import は対象外、@require は対象
    const e3 = checkPinnedDeps({files: {'x/c.js': "// import * as lit from 'https://esm.run/lit';\n"}, packageJson: base.packageJson, packageLock: base.packageLock});
    assert.ok(!e3.some(e => /x\/c\.js/.test(e)), e3.join('\n'));
  });
});
