// Task 085（監査v2 ZW-004）: 公開前スキャンが「今回ステージした差分」だけでなく、
// まだ送っていないコミット全部と、公開される全ファイルのパス（allowlist）を検査することの回帰テスト。
// 期待する正常動作（監査の acceptance）:
//   禁止ファイル、既存コミット内の合成秘密文字列、リネームした禁止ファイルを用いた負のテストがすべて停止する。
// 以前はステージした差分の追加行だけを見ていたため、ステージ0件で既存の未送信コミットを push する経路や、
// 除外リストに無い種類のファイル（.env・HAR 等）を検査できなかった。
// tools/ は GitHub に公開しないため、公開用リポジトリではこのテストは自動的にスキップされる。
import assert from 'power-assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT, findPython, hasGit, git, removeDir} = require('../helpers/buildSandbox');

const SCANNER = path.join(REPO_ROOT, 'tools', 'publish_scan.py');
const POLICY = path.join(REPO_ROOT, 'tools', 'publish_policy.py');
// テストファイル自体が検出されないよう、秘密情報らしき文字列は実行時に組み立てる
const SECRET = 'gh' + 'p_' + 'Rk4'.repeat(12);

describe('公開前スキャン：未送信コミット・公開される全ファイルの検査（ZW-004）', function() {
  this.timeout(60000);
  let py = null;
  let work;
  let origin;
  let repo;
  let patterns;

  before(function() {
    if (!fs.existsSync(SCANNER) || !fs.existsSync(POLICY)) {
      console.log('    （tools/publish_scan.py・publish_policy.py が無いためスキップ）');
      this.skip();
    }
    py = findPython();
    if (!py || !hasGit()) {
      console.log('    （python3 または git が見つからないためスキップ）');
      this.skip();
    }
  });

  // 公開済み（origin/develop）の状態を1つ持つ公開用 repo のひな形
  beforeEach(function() {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-scanrange-'));
    patterns = path.join(work, 'patterns.txt');
    fs.writeFileSync(patterns, 'zenza-dummy-person\n', 'utf-8');
    origin = path.join(work, 'origin.git');
    repo = path.join(work, 'public');
    git(work, ['init', '-q', '--bare', origin]);
    fs.mkdirSync(repo);
    git(repo, ['init', '-q', '-b', 'develop']);
    fs.mkdirSync(path.join(repo, 'src'));
    fs.writeFileSync(path.join(repo, 'README.md'), 'readme\n');
    fs.writeFileSync(path.join(repo, 'src', 'a.js'), 'const a = 1;\n');
    git(repo, ['add', '--', 'README.md', 'src/a.js']);
    git(repo, ['commit', '-q', '-m', 'published']);
    git(repo, ['remote', 'add', 'origin', origin]);
    git(repo, ['push', '-q', 'origin', 'develop']);
  });
  afterEach(function() {
    removeDir(work);
  });

  const scan = (...extra) => {
    const r = spawnSync(py.cmd, [...py.pre, SCANNER, repo, patterns, ...extra], {
      encoding: 'utf-8',
      env: {...process.env, PYTHONIOENCODING: 'utf-8', GIT_CEILING_DIRECTORIES: work}
    });
    return {status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`};
  };
  const commit = (msg) => git(repo, ['commit', '-q', '-m', msg]);

  it('問題の無い変更だけなら 0（公開してよい場所のファイル）', function() {
    fs.writeFileSync(path.join(repo, 'src', 'b.js'), 'const b = 2;\n');
    git(repo, ['add', '--', 'src/b.js']);
    const r = scan('--base', 'origin/develop');
    assert.equal(r.status, 0, r.out);
  });

  it('公開してよい一覧に無い種類のファイル（HAR）がステージされていれば 1', function() {
    fs.writeFileSync(path.join(repo, 'capture.har'), '{"log":{}}\n');
    git(repo, ['add', '--', 'capture.har']);
    const r = scan('--base', 'origin/develop');
    assert.equal(r.status, 1, r.out);
    assert.ok(/capture\.har/.test(r.out), r.out);
  });

  it('ステージは空でも、まだ送っていない既存コミットに秘密情報があれば 1（原文は出さない）', function() {
    fs.writeFileSync(path.join(repo, 'src', 'c.js'), `const t = "${SECRET}";\n`);
    git(repo, ['add', '--', 'src/c.js']);
    commit('unpushed with secret');
    fs.writeFileSync(path.join(repo, 'src', 'c.js'), 'const t = "";\n'); // 後のコミットで消しても履歴に残る
    git(repo, ['add', '--', 'src/c.js']);
    commit('remove secret');
    const r = scan('--base', 'origin/develop');
    assert.equal(r.status, 1, r.out);
    assert.ok(!r.out.includes(SECRET), '秘密情報の原文がログに出ている');
  });

  it('禁止ファイルをリネームして持ち込んだ未送信コミットも 1', function() {
    fs.writeFileSync(path.join(repo, 'src', 'dump.js'), `// ${SECRET}\n`);
    git(repo, ['add', '--', 'src/dump.js']);
    commit('add');
    git(repo, ['mv', 'src/dump.js', 'src/renamed.js']);
    commit('rename');
    // 2つ目のコミットだけを未送信にする（1つ目は送信済み扱い）
    git(repo, ['update-ref', 'refs/remotes/origin/develop', 'HEAD~1']);
    const r = scan('--base', 'origin/develop');
    assert.equal(r.status, 1, r.out);
  });

  it('未送信コミットの作者メールアドレスが個人情報の一覧に当たれば 1', function() {
    fs.writeFileSync(patterns, 'zenza-dummy-person\\.example\n', 'utf-8');
    fs.writeFileSync(path.join(repo, 'src', 'b.js'), 'const b = 2;\n');
    git(repo, ['add', '--', 'src/b.js']);
    const r0 = spawnSync('git', ['-c', 'user.name=someone', '-c', 'user.email=me@zenza-dummy-person.example',
      'commit', '-q', '-m', 'by personal address'], {cwd: repo, encoding: 'utf-8'});
    assert.equal(r0.status, 0, r0.stderr);
    const r = scan('--base', 'origin/develop');
    assert.equal(r.status, 1, r.out);
    assert.ok(!r.out.includes('me@zenza-dummy-person.example'), 'メールアドレスの原文が出ている');
  });

  it('初めての公開（--base -）では全履歴を検査する', function() {
    fs.writeFileSync(path.join(repo, 'src', 'c.js'), `const t = "${SECRET}";\n`);
    git(repo, ['add', '--', 'src/c.js']);
    commit('secret');
    git(repo, ['rm', '-q', '--', 'src/c.js']);
    commit('remove');
    const r = scan('--base', '-');
    assert.equal(r.status, 1, r.out);
  });

  it('比べる ref が存在しない時は検査不能（2）', function() {
    fs.writeFileSync(path.join(repo, 'src', 'b.js'), 'const b = 2;\n');
    git(repo, ['add', '--', 'src/b.js']);
    const r = scan('--base', 'origin/no-such-branch');
    assert.equal(r.status, 2, r.out);
  });

  it('公開してよいパスの決まり: 今の公開用ファイル構成は通り、禁止の種類は通らない', function() {
    const allowed = ['README.md', 'LICENSE', 'package.json', 'package-lock.json', '.gitignore', 'build.js', 'dist-manifest.json',
      'src/_template.js', 'src/_jshintrc', 'src/yomi/YomiPage.js', 'packages/lib/src/nico/ThreadLoader.js',
      'packages/components/src/template.txt', 'packages/components/mock/config.js', 'packages/components/dist/main.js',
      'dist/ZenzaWatch-dev.user.js', 'test/unit/utilTest.js', 'test/fixtures/VideoInfoRawData.json',
      'test/mocha.opts', 'sample/CA_TEST.playlist.json',
      'packages/comment-history/src/core.mjs', 'packages/comment-history/src/panel.mjs',
      'packages/comment-history/src/generated/MANIFEST.json', 'packages/comment-history/src/generated/package.json',
      'packages/comment-history/package.json', 'packages/comment-history/README.md',
      'packages/comment-history/tools/build.mjs', 'packages/comment-history/tools/build-zenza.mjs',
      'packages/comment-history/tests/fixtures.mjs', 'packages/comment-history/tests/core.test.mjs'];
    const denied = ['.env', 'src/.env.local', 'capture.har', 'tools/publish_scan.py', 'docs/design-pack/x.md',
      'dist/_versions/ZenzaWatch-dev.task081.user.js', '.npmrc', 'test/fixtures/cookies.json', 'id_rsa',
      'notes.txt', 'src/data.bin', 'server.key', 'debug.log',
      'packages/comment-history/capture.har', 'packages/comment-history/src/cookies.mjs',
      'packages/comment-history/evidence/results.json', 'packages/comment-history/tools/unknown.mjs',
      'packages/other/src/unreviewed.mjs', 'packages/comment-history/src/generated/credentials.json'];
    const code = [
      'import sys, json',
      `sys.path.insert(0, ${JSON.stringify(path.dirname(POLICY))})`,
      'from publish_policy import check_path',
      'print(json.dumps({p: check_path(p) for p in json.loads(sys.argv[1])}))'
    ].join('\n');
    const r = spawnSync(py.cmd, [...py.pre, '-c', code, JSON.stringify([...allowed, ...denied])],
      {encoding: 'utf-8', env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1'}});
    assert.equal(r.status, 0, r.stderr);
    const result = JSON.parse(r.stdout);
    for (const p of allowed) { assert.equal(result[p], null, `${p} が拒否された: ${result[p]}`); }
    for (const p of denied) { assert.ok(result[p], `${p} が許可された`); }
  });
});
