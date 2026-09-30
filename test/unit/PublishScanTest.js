// Task 084（監査v2 ZW-003）: 公開前スキャン（tools/publish_scan.py）が
// 「検査できなかった」状態を「問題なし（0件）」と扱わないことの回帰テスト。
// 期待する正常動作（監査の acceptance）:
//   非リポジトリ、不正HEAD、git不在、git diff失敗、パターン読み込み失敗はすべて公開中止（終了コード2）。
//   見つかった時は終了コード1で、秘密情報の原文をログに出さない。問題なしの時だけ終了コード0。
// tools/ は GitHub に公開しないため、公開用リポジトリではこのテストは自動的にスキップされる。
// python（3系）か git が無い環境でもスキップする（その旨を表示）。
import assert from 'power-assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT, findPython, hasGit, git, removeDir} = require('../helpers/buildSandbox');

const SCANNER = path.join(REPO_ROOT, 'tools', 'publish_scan.py');

describe('公開前スキャン publish_scan.py（ZW-003）', function() {
  this.timeout(60000);
  let py = null;
  let work;
  let patterns;

  before(function() {
    if (!fs.existsSync(SCANNER)) {
      console.log('    （tools/publish_scan.py が無いためスキップ）');
      this.skip();
    }
    py = findPython();
    if (!py || !hasGit()) {
      console.log('    （python3 または git が見つからないためスキップ）');
      this.skip();
    }
  });

  beforeEach(function() {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-scan-'));
    patterns = path.join(work, 'patterns.txt');
    fs.writeFileSync(patterns, 'zenza-dummy-person\n', 'utf-8');
  });
  afterEach(function() {
    removeDir(work);
  });

  const scan = (repo, listFile = patterns, env = {}) => {
    const r = spawnSync(py.cmd, [...py.pre, SCANNER, repo, listFile], {
      encoding: 'utf-8',
      // 一時フォルダより上（ホームフォルダ等）の git リポジトリを探しに行かないようにする
      env: {...process.env, PYTHONIOENCODING: 'utf-8', GIT_CEILING_DIRECTORIES: work, ...env}
    });
    return {status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`};
  };

  // 1つコミット済みで、1ファイルをステージした公開用リポジトリのひな形
  const makeRepo = (stagedText = 'console.log("hello");\n') => {
    const repo = path.join(work, 'public');
    fs.mkdirSync(repo);
    git(repo, ['init', '-q']);
    fs.writeFileSync(path.join(repo, 'README.md'), 'readme\n');
    git(repo, ['add', '--', 'README.md']);
    git(repo, ['commit', '-q', '-m', 'init']);
    fs.writeFileSync(path.join(repo, 'a.js'), stagedText);
    git(repo, ['add', '--', 'a.js']);
    return repo;
  };

  it('問題の無い変更だけなら終了コード0で、検査したコミットとファイル数を表示する', function() {
    const repo = makeRepo();
    const head = git(repo, ['rev-parse', 'HEAD']).trim();
    const r = scan(repo);
    assert.equal(r.status, 0, r.out);
    assert.ok(r.out.includes(head.slice(0, 12)), '検査対象のHEADが表示されていない\n' + r.out);
    assert.ok(/ステージ済みファイル: 1/.test(r.out), r.out);
  });

  it('秘密情報があれば終了コード1で、その原文はログに出さない', function() {
    const token = 'gh' + 'p_' + 'Zq7'.repeat(12); // テストファイル自体が検出されないよう組み立てる
    const repo = makeRepo(`const t = "${token}";\n`);
    const r = scan(repo);
    assert.equal(r.status, 1, r.out);
    assert.ok(/GitHub のトークン/.test(r.out), r.out);
    assert.ok(!r.out.includes(token), '秘密情報の原文がログに出ている');
    assert.ok(!r.out.includes(token.slice(4, 20)), '秘密情報の一部がログに出ている');
  });

  it('見つかった時の表示は種類・ファイル・行だけで、前後の文字も出さない（Task 088 / 監査v2 ZW-056）', function() {
    const token = 'gh' + 'p_' + 'Zq7'.repeat(12);
    const repo = makeRepo(`const c = "CTXNEAR" + "${token}";\n`);
    const r = scan(repo);
    assert.equal(r.status, 1, r.out);
    assert.ok(/GitHub のトークン/.test(r.out), r.out);
    assert.ok(/a\.js:1/.test(r.out) || /:1\b/.test(r.out), 'ファイルと行が表示されていない\n' + r.out);
    assert.ok(!r.out.includes('CTXNEAR'), '見つかった文字列の前の文字がログに出ている\n' + r.out);
    assert.ok(!r.out.includes(token.slice(0, 6)), '秘密情報の一部がログに出ている');
  });

  it('git リポジトリでないフォルダでは「0件」ではなく検査不能（終了コード2）', function() {
    const dir = path.join(work, 'not-a-repo');
    fs.mkdirSync(dir);
    const r = scan(dir);
    assert.equal(r.status, 2, r.out);
  });

  it('HEAD が無い（コミットが1つも無い）リポジトリでは検査不能（終了コード2）', function() {
    const repo = path.join(work, 'empty');
    fs.mkdirSync(repo);
    git(repo, ['init', '-q']);
    fs.writeFileSync(path.join(repo, 'a.js'), 'x\n');
    git(repo, ['add', '--', 'a.js']);
    const r = scan(repo);
    assert.equal(r.status, 2, r.out);
  });

  it('git が見つからない時は検査不能（終了コード2）', function() {
    const repo = makeRepo();
    const r = scan(repo, patterns, {ZENZA_PUBLISH_SCAN_GIT: path.join(work, 'no-such-git')});
    assert.equal(r.status, 2, r.out);
  });

  it('git diff が失敗した時は検査不能（終了コード2）', function() {
    const repo = makeRepo();
    const brokenIndex = path.join(work, 'broken-index');
    fs.writeFileSync(brokenIndex, 'this is not a git index');
    const r = scan(repo, patterns, {GIT_INDEX_FILE: brokenIndex});
    assert.equal(r.status, 2, r.out);
  });

  it('ステージされた変更が1つも無い時は検査不能（終了コード2）', function() {
    const repo = makeRepo();
    git(repo, ['rm', '-q', '--cached', '--', 'a.js']);
    const r = scan(repo);
    assert.equal(r.status, 2, r.out);
  });

  it('探す文字列の一覧ファイルが読めない時は検査不能（終了コード2）', function() {
    const repo = makeRepo();
    const r = scan(repo, path.join(work, 'no-such-list.txt'));
    assert.equal(r.status, 2, r.out);
  });

  it('探す文字列の一覧に不正な正規表現がある時は検査不能（終了コード2）', function() {
    const repo = makeRepo();
    fs.writeFileSync(patterns, 'zenza-dummy-person\n([unclosed\n', 'utf-8');
    const r = scan(repo);
    assert.equal(r.status, 2, r.out);
  });
});
