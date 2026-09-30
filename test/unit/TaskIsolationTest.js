// Task 094: 別タスクの dirty 変更を npm test / build の検証環境へ混ぜないための回帰テスト。
import assert from 'power-assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT, findPython, hasGit, git, removeDir} = require('../helpers/buildSandbox');

const CHECKER = path.join(REPO_ROOT, 'tools', 'check_task_isolation.py');
const BUILDER = path.join(REPO_ROOT, 'tools', 'build_task_sandbox.js');
const TEMPLATE = path.join(REPO_ROOT, 'tools', '_TEMPLATE_fix_run.ps1');

function withCleanHeadWorktree(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-builder-head-'));
  // git worktree add は空ディレクトリを受け付ける。現在のdirty Taskではなく
  // HEADそのものからsandbox builderの自己テストを行う。
  const add = spawnSync('git', ['-C', REPO_ROOT, 'worktree', 'add', '--detach', dir, 'HEAD'], {
    encoding: 'utf-8'
  });
  assert.equal(add.status, 0, `${add.stdout || ''}${add.stderr || ''}`);
  try {
    fs.symlinkSync(path.join(REPO_ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'junction');
    return fn(dir);
  } finally {
    spawnSync('git', ['-C', REPO_ROOT, 'worktree', 'remove', '--force', dir], {encoding: 'utf-8'});
    removeDir(dir);
  }
}

describe('Task worktree isolation（Task 094）', function() {
  this.timeout(60000);
  let py = null;
  let work;

  before(function() {
    if (!fs.existsSync(CHECKER)) { this.skip(); }
    py = findPython();
    if (!py || !hasGit()) { this.skip(); }
  });

  beforeEach(function() {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-isolation-'));
    git(work, ['init', '-q', '-b', 'develop']);
    fs.mkdirSync(path.join(work, 'src'));
    fs.writeFileSync(path.join(work, 'src', 'task.js'), 'const task = 1;\n');
    fs.writeFileSync(path.join(work, 'src', 'other.js'), 'const other = 1;\n');
    git(work, ['add', '--', 'src/task.js', 'src/other.js']);
    git(work, ['commit', '-q', '-m', 'base']);
  });

  afterEach(function() { removeDir(work); });

  const run = (...args) => {
    const r = spawnSync(py.cmd, [...py.pre, CHECKER, '--repo', work, ...args], {
      encoding: 'utf-8',
      env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1'}
    });
    return {status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`};
  };

  const head = () => git(work, ['rev-parse', 'HEAD']).trim();

  it('clean tree は通る', function() {
    const r = run('--forbid-staged', '--expected-head', head());
    assert.equal(r.status, 0, r.out);
    assert.ok(/ISOLATION_RESULT=OK/.test(r.out), r.out);
  });

  it('今回のTaskで許可した modified / untracked だけなら通る', function() {
    fs.writeFileSync(path.join(work, 'src', 'task.js'), 'const task = 2;\n');
    fs.writeFileSync(path.join(work, 'task-note.md'), 'note\n');
    const r = run('--forbid-staged', '--expected-head', head(), 'src/task.js', 'task-note.md');
    assert.equal(r.status, 0, r.out);
  });

  it('別Taskの tracked dirty があれば test 前に止める', function() {
    fs.writeFileSync(path.join(work, 'src', 'other.js'), 'const other = 2;\n');
    const r = run('--forbid-staged', 'src/task.js');
    assert.equal(r.status, 1, r.out);
    assert.ok(/src\/other\.js/.test(r.out), r.out);
  });

  it('別Taskの untracked があれば test 前に止める', function() {
    fs.writeFileSync(path.join(work, 'foreign.tmp'), 'x\n');
    const r = run('--forbid-staged', 'src/task.js');
    assert.equal(r.status, 1, r.out);
    assert.ok(/foreign\.tmp/.test(r.out), r.out);
  });

  it('許可ファイルでも既に staged なら止める', function() {
    fs.writeFileSync(path.join(work, 'src', 'task.js'), 'const task = 2;\n');
    git(work, ['add', '--', 'src/task.js']);
    const r = run('--forbid-staged', 'src/task.js');
    assert.equal(r.status, 1, r.out);
    assert.ok(/staged changes already exist/.test(r.out), r.out);
  });

  it('test 中に HEAD が変わったら expected-head で止める', function() {
    const oldHead = head();
    fs.writeFileSync(path.join(work, 'src', 'other.js'), 'const other = 3;\n');
    git(work, ['add', '--', 'src/other.js']);
    git(work, ['commit', '-q', '-m', 'parallel commit']);
    const r = run('--expected-head', oldHead);
    assert.equal(r.status, 1, r.out);
    assert.ok(/HEAD changed during the task/.test(r.out), r.out);
  });

  it('allow-prefix はそのディレクトリだけ追加で許可する', function() {
    fs.mkdirSync(path.join(work, 'generated'));
    fs.writeFileSync(path.join(work, 'generated', 'out.tmp'), 'x\n');
    const r = run('--allow-prefix', 'generated');
    assert.equal(r.status, 0, r.out);
  });

  it('task template はsource変更後にdistを同期してからfull npm testを実行する（Task 096）', function() {
    const src = fs.readFileSync(TEMPLATE, 'utf-8').replace(/\r\n/g, '\n');
    const build = src.indexOf('node (Join-Path $PSScriptRoot "build_task_sandbox.js") @buildArgs');
    const test = src.indexOf('\n  npm test\n');
    assert.ok(build >= 0, 'sandbox build 呼び出しが見つからない');
    assert.ok(test >= 0, 'npm test 呼び出しが見つからない');
    assert.ok(build < test, 'full npm test より先にsandbox build / dist同期が必要');
    const guard = src.indexOf('Invoke-TaskIsolationCheck $RepoRoot $TaskStartHead $MyFiles -ForbidStaged', build);
    assert.ok(guard > build && guard < test, 'build後・test前のisolation再確認が必要');
  });

  it('sandbox build の dry-run は検証対象worktreeのdistを1 byteも変えない', function() {
    withCleanHeadWorktree(clean => {
      const builder = path.join(clean, 'tools', 'build_task_sandbox.js');
      const before = spawnSync('git', ['-C', clean, 'status', '--porcelain=v1', '-uall'], {encoding: 'utf-8'});
      assert.equal(before.status, 0, before.stderr);
      const r = spawnSync(process.execPath, [builder, '--dry-run'], {
        cwd: clean, encoding: 'utf-8', timeout: 120000
      });
      assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
      assert.ok(/TASK_SANDBOX_BUILD_RESULT=OK/.test(r.stdout), r.stdout);
      const after = spawnSync('git', ['-C', clean, 'status', '--porcelain=v1', '-uall'], {encoding: 'utf-8'});
      assert.equal(after.status, 0, after.stderr);
      assert.equal(after.stdout, before.stdout, 'dry-run が検証対象worktreeを書き換えた');
    });
  });

  it('sandbox build はactive distでないcopy targetを拒否する', function() {
    const r = spawnSync(process.execPath, [BUILDER, '--copy', 'not-an-active.user.js'], {
      cwd: REPO_ROOT, encoding: 'utf-8', timeout: 30000
    });
    assert.equal(r.status, 3, `${r.stdout}\n${r.stderr}`);
    assert.ok(/not an active dist/.test(r.stderr), r.stderr);
  });

  it('sandbox build は変更指定したdistがHEADと同じならmissingとして拒否する', function() {
    withCleanHeadWorktree(clean => {
      const builder = path.join(clean, 'tools', 'build_task_sandbox.js');
      const r = spawnSync(process.execPath, [builder, '--dry-run', '--copy', 'ZenzaWatch-dev.user.js'], {
        cwd: clean, encoding: 'utf-8', timeout: 120000
      });
      assert.equal(r.status, 2, `${r.stdout}\n${r.stderr}`);
      assert.ok(/missing=ZenzaWatch-dev\.user\.js/.test(r.stderr), r.stderr);
    });
  });
});
