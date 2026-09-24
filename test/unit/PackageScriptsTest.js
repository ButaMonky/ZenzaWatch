// Task 085（監査v2 ZW-006）: package.json の標準の入口（npm run build / watch）が
// 実際に使える正規ビルド（build.js）を指していることの回帰テスト。
// 期待する正常動作（監査の acceptance）:
//   README に書かれた install・test・build だけで全配布物を生成できる。
// 以前の scripts.build は旧 Babel CLI の --compilers 引数を使っており、終了コード1で失敗していた。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT, createBuildSandbox, readDist, removeDir} = require('../helpers/buildSandbox');

const EXPECTED_OUTPUTS = [
  'ZenzaWatch-dev.user.js', 'uQuery.user.js', 'MylistPocket.user.js', 'MaskedWatch.user.js',
  'ZenzaAdvancedSettings.user.js', 'ZenzaHLS.user.js', 'ZenzaGamePad.user.js',
  'ZenzaBlogPartsButton.user.js', 'CapTube.user.js', 'HeatSync.user.js'
];

const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8'));

describe('package.json の標準ビルド入口（ZW-006）', function() {
  this.timeout(180000);
  let dir;
  beforeEach(function() {
    dir = createBuildSandbox('zenza-npmbuild-');
    fs.copyFileSync(path.join(REPO_ROOT, 'package.json'), path.join(dir, 'package.json'));
    // 既存の dist を消して、scripts.build だけで作り直せるかを確かめる
    for (const f of EXPECTED_OUTPUTS) {
      fs.rmSync(path.join(dir, 'dist', f), {force: true});
    }
  });
  afterEach(function() {
    removeDir(dir);
  });

  it('scripts.build を実行すると終了コード0で、10個の配布物が構文として正しく作られる', function() {
    const bin = path.join(REPO_ROOT, 'node_modules', '.bin');
    const r = spawnSync(pkg.scripts.build, {
      cwd: dir,
      shell: true,
      encoding: 'utf-8',
      timeout: 120000,
      env: {
        ...process.env,
        PATH: `${bin}${path.delimiter}${process.env.PATH}`,
        NODE_PATH: path.join(REPO_ROOT, 'node_modules'),
        ZENZA_BUILD_NO_NOTIFY: '1'
      }
    });
    assert.equal(r.status, 0, `scripts.build が失敗: ${pkg.scripts.build}\n${r.stdout}${r.stderr}`);
    const parser = require('@babel/parser');
    const out = readDist(dir);
    for (const f of EXPECTED_OUTPUTS) {
      assert.ok(out[f], `${f} が作られていない`);
      parser.parse(out[f], {sourceType: 'script'});
    }
  });

  it('scripts.build・watch・build:monkey・watch:monkey は同じ build.js（--dev）を使う', function() {
    assert.ok(/build\.js\b.*--dev/.test(pkg.scripts.build), pkg.scripts.build);
    assert.ok(/build\.js\b.*--dev.*--watch/.test(pkg.scripts.watch), pkg.scripts.watch);
    assert.equal(pkg.scripts.build, pkg.scripts['build:monkey']);
    assert.equal(pkg.scripts.watch, pkg.scripts['watch:monkey']);
    assert.ok(!/--compilers/.test(JSON.stringify(pkg.scripts)), '旧 Babel CLI の --compilers が残っている');
  });

  it('README に開発者向けの install・test・build の手順がある', function() {
    const readme = fs.readFileSync(path.join(REPO_ROOT, 'README.md'), 'utf-8');
    for (const cmd of ['npm ci', 'npm test', 'npm run build']) {
      assert.ok(readme.includes(cmd), `README に ${cmd} が無い`);
    }
  });
});
