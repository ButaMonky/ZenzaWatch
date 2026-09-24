// Task 084（監査v2 ZW-001）: 「ソースから作り直した配布物が dist と一致するか」の検査
// （tools/check_regeneration.js）の回帰テスト。
// 期待する正常動作（監査の acceptance）:
//   ソースからの再生成結果が、明示的に許可したビルド識別子以外で全配布ファイルと一致する時だけ 0。
//   ソースに入っていない変更が dist にある（公開し忘れ）時は 1 で、該当の配布物と入力ファイルを示す。
//   ビルドできない時は「一致」ではなく検査不能（2）。
// tools/ は GitHub に公開しないため、公開用リポジトリではこのテストは自動的にスキップされる。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const {REPO_ROOT, createBuildSandbox, runNode, removeDir} = require('../helpers/buildSandbox');

const CHECKER = path.join(REPO_ROOT, 'tools', 'check_regeneration.js');

describe('公開用ソースからの再生成チェック check_regeneration.js（ZW-001）', function() {
  this.timeout(180000);
  let dir;

  before(function() {
    if (!fs.existsSync(CHECKER)) {
      console.log('    （tools/check_regeneration.js が無いためスキップ）');
      this.skip();
    }
  });
  beforeEach(function() {
    dir = createBuildSandbox('zenza-regen-src-');
  });
  afterEach(function() {
    removeDir(dir);
  });

  const check = (...args) => {
    const r = runNode([CHECKER, dir, ...args], {cwd: REPO_ROOT});
    return {status: r.status, out: r.stdout + r.stderr};
  };

  it('ソースと dist がそろっていれば 0（ビルド識別子の違いは無視する）', function() {
    const r = check('--reference', REPO_ROOT);
    assert.equal(r.status, 0, r.out);
    assert.ok(/すべての配布物が一致しました/.test(r.out), r.out);
  });

  it('dist にだけ入っている変更（ソースの公開し忘れ）があれば 1 で、配布物と入力ファイルを示す', function() {
    const blog = path.join(dir, 'src/_blog.js');
    const text = fs.readFileSync(blog, 'utf-8');
    // 公開用ソースが古いまま、という状況を「ソース側だけ1行違う」ことで再現する
    fs.writeFileSync(blog, text.replace(/(\/\/ *==\/UserScript==)/, '$1\nvar zw001_stale_marker = 1;'));
    const r = check('--reference', REPO_ROOT);
    assert.equal(r.status, 1, r.out);
    assert.ok(/ZenzaBlogPartsButton\.user\.js: 内容が違います/.test(r.out), r.out);
    assert.ok(/src\/_blog\.js/.test(r.out), '違うビルド入力が示されていない\n' + r.out);
  });

  it('ソースからビルドできない時は「一致」ではなく検査不能（2）', function() {
    fs.unlinkSync(path.join(dir, 'packages/lib/src/Emitter.js'));
    const r = check();
    assert.equal(r.status, 2, r.out);
  });

  it('build.js や dist が無いフォルダは検査不能（2）', function() {
    fs.unlinkSync(path.join(dir, 'build.js'));
    const r = check();
    assert.equal(r.status, 2, r.out);
  });
});
