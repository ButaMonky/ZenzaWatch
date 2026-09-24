// Task 085（監査v2 ZW-005）: 公開用 repo の送信先（origin の fetch URL・すべての push URL）を
// ネットワーク送信の前に確かめる tools/check_publish_remote.py の回帰テスト。
// 期待する正常動作（監査の acceptance）:
//   別の origin または別の pushurl を持つ一時リポジトリでは、ネットワーク送信前に停止する（終了コード1）。
// 以前の publish_to_github.ps1 は、既存の origin が何を指していても確かめずに fetch・push していた。
// tools/ は GitHub に公開しないため、公開用リポジトリではこのテストは自動的にスキップされる。
import assert from 'power-assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT, findPython, hasGit, git, removeDir} = require('../helpers/buildSandbox');

const CHECKER = path.join(REPO_ROOT, 'tools', 'check_publish_remote.py');
const OWNER = 'example-owner';
const NAME = 'example-repo';
const GOOD = `https://github.com/${OWNER}/${NAME}.git`;

describe('公開先の確認 check_publish_remote.py（ZW-005）', function() {
  this.timeout(60000);
  let py = null;
  let work;
  let repo;

  before(function() {
    if (!fs.existsSync(CHECKER)) {
      console.log('    （tools/check_publish_remote.py が無いためスキップ）');
      this.skip();
    }
    py = findPython();
    if (!py || !hasGit()) {
      console.log('    （python3 または git が見つからないためスキップ）');
      this.skip();
    }
  });
  beforeEach(function() {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-remote-'));
    repo = path.join(work, 'public');
    fs.mkdirSync(repo);
    git(repo, ['init', '-q']);
  });
  afterEach(function() {
    removeDir(work);
  });

  const check = (dir = repo) => {
    const r = spawnSync(py.cmd, [...py.pre, CHECKER, dir, OWNER, NAME], {
      encoding: 'utf-8',
      env: {...process.env, PYTHONIOENCODING: 'utf-8', GIT_CEILING_DIRECTORIES: work,
        GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(work, 'no-global-config')}
    });
    return {status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`};
  };

  it('公開先の GitHub リポジトリだけを指していれば 0（ユーザー名付きの https も可）', function() {
    git(repo, ['remote', 'add', 'origin', GOOD]);
    assert.equal(check().status, 0, check().out);
    git(repo, ['remote', 'set-url', 'origin', `https://${OWNER}@github.com/${OWNER}/${NAME}.git`]);
    assert.equal(check().status, 0, check().out);
  });

  it('origin が別のリポジトリを指していれば 1', function() {
    git(repo, ['remote', 'add', 'origin', `https://github.com/someone-else/${NAME}.git`]);
    assert.equal(check().status, 1, check().out);
  });

  it('fetch は正しくても、push URL が別のところを指していれば 1', function() {
    git(repo, ['remote', 'add', 'origin', GOOD]);
    git(repo, ['remote', 'set-url', '--add', '--push', 'origin', GOOD]);
    git(repo, ['remote', 'set-url', '--add', '--push', 'origin', `https://github.com/someone-else/${NAME}.git`]);
    const r = check();
    assert.equal(r.status, 1, r.out);
    assert.ok(/someone-else/.test(r.out), '問題の送信先が表示されていない');
  });

  it('pushInsteadOf で送信先が書き換わる設定があれば 1', function() {
    git(repo, ['remote', 'add', 'origin', GOOD]);
    git(repo, ['config', 'url.https://example.invalid/mirror/.pushInsteadOf', 'https://github.com/']);
    assert.equal(check().status, 1, check().out);
  });

  it('ローカルのフォルダを指す origin は 1', function() {
    git(repo, ['remote', 'add', 'origin', path.join(work, 'somewhere.git')]);
    assert.equal(check().status, 1, check().out);
  });

  it('URL にトークン等が埋め込まれていれば 1 で、その値は表示しない', function() {
    const secret = 'gh' + 'p_' + 'Q9'.repeat(18);
    git(repo, ['remote', 'add', 'origin', `https://${OWNER}:${secret}@github.com/${OWNER}/${NAME}.git`]);
    const r = check();
    assert.equal(r.status, 1, r.out);
    assert.ok(!r.out.includes(secret), 'トークンが表示されている');
  });

  it('origin が無ければ 1、git リポジトリでなければ 2', function() {
    assert.equal(check().status, 1, check().out);
    const plain = path.join(work, 'plain');
    fs.mkdirSync(plain);
    assert.equal(check(plain).status, 2, check(plain).out);
  });
});
