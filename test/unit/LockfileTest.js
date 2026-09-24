// Task 085（監査v2 ZW-057）: 依存の解決結果を固定する package-lock.json が
// リポジトリに含まれ（.gitignore で除外されず）、package.json と一致していることの回帰テスト。
// 期待する正常動作（監査の acceptance）:
//   クリーンな環境から npm ci で同じ依存解決になり、同じ（ビルド識別子を除く）dist に到達する。
// 以前は .gitignore に package-lock.json があり、公開用リポジトリには lockfile が無かった。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT, hasGit} = require('../helpers/buildSandbox');

const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));
const lockPath = path.join(REPO_ROOT, 'package-lock.json');

describe('依存の固定 package-lock.json・実行環境の宣言（ZW-057）', function() {
  this.timeout(30000);

  it('package-lock.json があり、npm ci で使える形式で、package.json の依存と一致する', function() {
    assert.ok(fs.existsSync(lockPath), 'package-lock.json が無い');
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    assert.ok(lock.lockfileVersion >= 2, `lockfileVersion ${lock.lockfileVersion}`);
    const root = lock.packages[''];
    assert.deepEqual(root.devDependencies || {}, pkg.devDependencies || {});
    assert.deepEqual(root.dependencies || {}, pkg.dependencies || {});
  });

  it('package-lock.json の取得元はすべて npm 公式レジストリ（https）で、integrity があり、認証情報を含まない', function() {
    const text = fs.readFileSync(lockPath, 'utf-8');
    assert.ok(!/_auth|authToken|:\/\/[^/"\s]+:[^/"\s]+@/.test(text), '認証情報らしき文字列がある');
    const lock = JSON.parse(text);
    const bad = [];
    for (const [name, info] of Object.entries(lock.packages)) {
      if (!name || info.link) { continue; }
      if (!info.resolved || !info.resolved.startsWith('https://registry.npmjs.org/')) { bad.push(`${name}: ${info.resolved}`); }
      if (!info.integrity) { bad.push(`${name}: integrity なし`); }
    }
    assert.deepEqual(bad.slice(0, 10), []);
  });

  it('.gitignore が package-lock.json を除外していない', function() {
    if (hasGit() && fs.existsSync(path.join(REPO_ROOT, '.git'))) {
      const r = spawnSync('git', ['check-ignore', '-q', '--no-index', 'package-lock.json'], {cwd: REPO_ROOT});
      assert.notEqual(r.status, 0, '.gitignore で package-lock.json が除外されている');
    } else {
      const lines = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf-8').split(/\r?\n/).map(l => l.trim());
      assert.ok(!lines.includes('package-lock.json'), '.gitignore で package-lock.json が除外されている');
    }
  });

  it('package.json に対応する Node.js の範囲（engines）が書かれ、テストに使う依存（jsdom）の要求と矛盾しない', function() {
    assert.ok(pkg.engines && pkg.engines.node, 'engines.node が無い');
    const semver = require('semver');
    const jsdomNode = require('jsdom/package.json').engines.node;
    // engines の下限それぞれが jsdom の要求も満たしていること（古すぎる Node を「対応」と書かない）
    for (const part of pkg.engines.node.split('||')) {
      const min = semver.minVersion ? semver.minVersion(part.trim()) : null;
      const v = min ? min.version : part.trim().replace(/^[^\d]*/, '');
      assert.ok(semver.satisfies(v, jsdomNode), `engines の ${part.trim()}（${v}）は jsdom の ${jsdomNode} を満たさない`);
    }
    assert.ok(semver.satisfies(process.version, pkg.engines.node),
      `このテストを実行している Node ${process.version} は engines ${pkg.engines.node} の範囲外`);
  });
});
