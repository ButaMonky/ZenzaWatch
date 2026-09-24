// Task 084（監査v2 ZW-002）: build.js の失敗を「成功」と誤認しないことの回帰テスト。
// 期待する正常動作（監査の acceptance）:
//   依存1個欠損・構文不正・出力先書き込み不可の各ケースで非0終了し、
//   最後の正常な dist を壊さない（1つも書き換えない）。
// 実際のリポジトリの dist には触れず、一時フォルダのコピーの中だけでビルドする。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const {createBuildSandbox, runBuild, snapshotDist, readDist, removeDir} = require('../helpers/buildSandbox');

const EXPECTED_OUTPUTS = [
  'ZenzaWatch-dev.user.js', 'uQuery.user.js', 'MylistPocket.user.js', 'MaskedWatch.user.js',
  'ZenzaAdvancedSettings.user.js', 'ZenzaHLS.user.js', 'ZenzaGamePad.user.js',
  'ZenzaBlogPartsButton.user.js', 'CapTube.user.js', 'HeatSync.user.js'
];

// ビルドごとに変わってよいのはビルド識別子の行だけ
const stripBuildId = text => text
  .replace(/^\/\/ build: .*$/m, '// build: <BUILD_ID>')
  .replace(/^(\s*)var BUILD = '.*';$/m, "$1var BUILD = '<BUILD_ID>';");

describe('build.js の失敗検出（ZW-002）', function() {
  this.timeout(180000);
  let dir;

  beforeEach(function() {
    dir = createBuildSandbox();
  });
  afterEach(function() {
    removeDir(dir);
  });

  it('正常な入力では終了コード0で、10個の配布物が構文として正しく、内容はビルド識別子以外変わらない', function() {
    const before = readDist(dir);
    const r = runBuild(dir);
    assert.equal(r.status, 0, r.stdout + r.stderr);
    const parser = require('@babel/parser');
    const after = readDist(dir);
    for (const f of EXPECTED_OUTPUTS) {
      assert.ok(after[f], `${f} が出力されていない`);
      parser.parse(after[f], {sourceType: 'script'});
      assert.ok(/^\/\/ build: /m.test(after[f]), `${f} にビルド識別子が無い`);
      assert.ok(stripBuildId(after[f]) === stripBuildId(before[f]), `${f} の内容がビルド識別子以外で変わった`);
    }
  });

  it('依存ファイルが1個欠けていたら非0で終了し、dist を1つも書き換えない', function() {
    fs.unlinkSync(path.join(dir, 'packages/lib/src/Emitter.js'));
    const before = snapshotDist(dir);
    const r = runBuild(dir);
    assert.notEqual(r.status, 0, 'ビルドが成功扱い（終了コード0）になった\n' + r.stdout + r.stderr);
    assert.ok(/Emitter\.js/.test(r.stdout + r.stderr), '欠けたファイル名が表示されていない');
    assert.deepEqual(snapshotDist(dir), before);
  });

  it('生成物が JavaScript として不正になる入力では非0で終了し、dist を1つも書き換えない', function() {
    const blog = path.join(dir, 'src/_blog.js');
    const text = fs.readFileSync(blog, 'utf-8');
    assert.ok(/\/\/ *==\/UserScript==/.test(text));
    fs.writeFileSync(blog, text.replace(/(\/\/ *==\/UserScript==)/, '$1\nvar zw002_broken = ;'));
    const before = snapshotDist(dir);
    const r = runBuild(dir);
    assert.notEqual(r.status, 0, '構文不正の生成物でも成功扱いになった\n' + r.stdout + r.stderr);
    assert.ok(/ZenzaBlogPartsButton\.user\.js/.test(r.stdout + r.stderr), '不正になった配布物の名前が表示されていない');
    assert.deepEqual(snapshotDist(dir), before);
  });

  it('出力先に書き込めない時は非0で終了し、他の dist も書き換えない', function() {
    const target = path.join(dir, 'dist/ZenzaHLS.user.js');
    fs.unlinkSync(target);
    fs.mkdirSync(target); // 同名のフォルダがあるとファイルとして書き込めない
    const before = snapshotDist(dir);
    const r = runBuild(dir);
    assert.notEqual(r.status, 0, '書き込めなかったのに成功扱いになった\n' + r.stdout + r.stderr);
    assert.ok(/ZenzaHLS\.user\.js/.test(r.stdout + r.stderr), '書き込めなかった配布物の名前が表示されていない');
    assert.deepEqual(snapshotDist(dir), before);
    assert.ok(fs.statSync(target).isDirectory());
  });
});
