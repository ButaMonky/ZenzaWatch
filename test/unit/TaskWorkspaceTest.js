// Task 094: 並行チャットを同じworking treeで編集させないためのgit worktree運用テスト。
import assert from 'power-assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT, findPython, hasGit, git, removeDir} = require('../helpers/buildSandbox');

const TOOL = path.join(REPO_ROOT, 'tools', 'task_workspace.py');

describe('per-task git worktree（Task 094）', function() {
  this.timeout(60000);
  let py = null;
  let root;
  let main;

  before(function() {
    if (!fs.existsSync(TOOL)) { this.skip(); }
    py = findPython();
    if (!py || !hasGit()) { this.skip(); }
  });

  beforeEach(function() {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-task-worktree-'));
    main = path.join(root, 'repo');
    fs.mkdirSync(main);
    git(main, ['init', '-q', '-b', 'develop']);
    fs.writeFileSync(path.join(main, 'README.md'), 'base\n');
    fs.writeFileSync(path.join(main, '.gitignore'), 'node_modules/\n');
    git(main, ['add', '--', 'README.md', '.gitignore']);
    git(main, ['commit', '-q', '-m', 'base']);
    fs.mkdirSync(path.join(main, 'node_modules'));
    fs.writeFileSync(path.join(main, 'node_modules', 'shared-marker.txt'), 'shared\n');
  });

  afterEach(function() { removeDir(root); });

  const runTool = (...args) => {
    const r = spawnSync(py.cmd, [...py.pre, TOOL, '--repo', main, ...args], {
      encoding: 'utf-8',
      env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1'}
    });
    return {status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`};
  };

  const worktreeFor = (task) => path.join(root, 'task-worktrees', `task${task}`);

  it('Task番号を原子的に予約し、同じ番号の2個目を拒否する', function() {
    const a = runTool('create', '900');
    assert.equal(a.status, 0, a.out);
    assert.ok(/TASK_WORKSPACE_RESULT=CREATED/.test(a.out), a.out);
    assert.ok(fs.existsSync(path.join(worktreeFor('900'), '.git')), a.out);
    assert.equal(fs.readFileSync(path.join(worktreeFor('900'), 'node_modules', 'shared-marker.txt'), 'utf-8'), 'shared\n');

    const b = runTool('create', '900');
    assert.equal(b.status, 1, b.out);
    assert.ok(/already reserved/.test(b.out), b.out);
  });

  it('task branchをcommit後、developへff-onlyで統合してcloseできる', function() {
    assert.equal(runTool('create', '900').status, 0);
    const wt = worktreeFor('900');
    fs.writeFileSync(path.join(wt, 'task.txt'), 'task900\n');
    git(wt, ['add', '--', 'task.txt']);
    git(wt, ['commit', '-q', '-m', 'task900']);

    const taskHead = git(wt, ['rev-parse', 'HEAD']).trim();
    const integrated = runTool('integrate', '900');
    assert.equal(integrated.status, 0, integrated.out);
    assert.equal(git(main, ['rev-parse', 'HEAD']).trim(), taskHead);

    const closed = runTool('close', '900');
    assert.equal(closed.status, 0, closed.out);
    assert.ok(!fs.existsSync(wt));
    assert.equal(fs.readFileSync(path.join(main, 'node_modules', 'shared-marker.txt'), 'utf-8'), 'shared\n');
  });

  it('同じbaseから並行した2Taskは、先にdevelopが進んだら後発を自動mergeしない', function() {
    assert.equal(runTool('create', '901').status, 0);
    assert.equal(runTool('create', '902').status, 0);
    const a = worktreeFor('901');
    const b = worktreeFor('902');

    fs.writeFileSync(path.join(a, 'a.txt'), 'a\n');
    git(a, ['add', '--', 'a.txt']);
    git(a, ['commit', '-q', '-m', 'task901']);

    fs.writeFileSync(path.join(b, 'b.txt'), 'b\n');
    git(b, ['add', '--', 'b.txt']);
    git(b, ['commit', '-q', '-m', 'task902']);

    const first = runTool('integrate', '901');
    assert.equal(first.status, 0, first.out);
    const headAfterFirst = git(main, ['rev-parse', 'HEAD']).trim();

    const second = runTool('integrate', '902');
    assert.equal(second.status, 1, second.out);
    assert.ok(/cannot fast-forward/.test(second.out), second.out);
    assert.equal(git(main, ['rev-parse', 'HEAD']).trim(), headAfterFirst,
      '失敗した統合がdevelopを変更した');
  });

  it('別Taskのrun lock中はdevelopへ統合しない', function() {
    assert.equal(runTool('create', '904').status, 0);
    const wt = worktreeFor('904');
    fs.writeFileSync(path.join(wt, 'task.txt'), 'task904\n');
    git(wt, ['add', '--', 'task.txt']);
    git(wt, ['commit', '-q', '-m', 'task904']);
    const before = git(main, ['rev-parse', 'HEAD']).trim();

    const lock = path.join(root, '.task-run.lock');
    fs.mkdirSync(lock);
    fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({task: 'Task 999', pid: 1}), 'utf-8');
    const r = runTool('integrate', '904');
    assert.equal(r.status, 1, r.out);
    assert.ok(/cannot integrate while a task run/.test(r.out), r.out);
    assert.equal(git(main, ['rev-parse', 'HEAD']).trim(), before);
  });

  it('main repoがdirtyなら新しいworktreeを作らない', function() {
    fs.writeFileSync(path.join(main, 'README.md'), 'dirty\n');
    const r = runTool('create', '903');
    assert.equal(r.status, 1, r.out);
    assert.ok(/main integration repo is dirty/.test(r.out), r.out);
    assert.ok(!fs.existsSync(worktreeFor('903')));
  });
});
