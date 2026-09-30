// Task 087: 単独では公開していないが、後のタスクの公開に含まれて公開されたタスク（例: Task 084 → Task 085）を、
// 公開状態ファイルの coveredBy で表し、taskNNN_fix_run の2回目・publish_to_github が二度と公開しようとしないことの回帰テスト。
// PowerShell（pwsh / Windows PowerShell）が無い環境では自動的にスキップする（環境変数 ZENZA_PWSH で場所を指定できる）。
// tools/ は GitHub に公開しないため、公開用リポジトリではこのテストは自動的にスキップされる。
import assert from 'power-assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT, removeDir, hasGit, git} = require('../helpers/buildSandbox');

const COMMON = path.join(REPO_ROOT, 'tools', 'publish_common.ps1');
const PUBLISHER = path.join(REPO_ROOT, 'tools', 'publish_to_github.ps1');

function findPowerShell() {
  const cands = [process.env.ZENZA_PWSH, 'pwsh', 'powershell'].filter(Boolean);
  for (const c of cands) {
    const r = spawnSync(c, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], {encoding: 'utf-8'});
    if (r.status === 0) { return c; }
  }
  return null;
}

describe('公開状態 coveredBy（Task 084 は Task 085 の公開に含まれた）', function() {
  this.timeout(60000);
  let ps = null;
  let work;
  let stateDirName = null;  // 公開状態の記録のフォルダ名。publish_common.ps1 の Get-PublishStateDir から取る（名前をここに書かない）

  before(function() {
    if (!fs.existsSync(COMMON)) {
      console.log('    （tools/publish_common.ps1 が無いためスキップ）');
      this.skip();
    }
    ps = findPowerShell();
    if (!ps) {
      console.log('    （PowerShell が見つからないためスキップ）');
      this.skip();
    }
    const r = spawnSync(ps, ['-NoProfile', '-Command',
      `. '${COMMON.replace(/'/g, "''")}'; Write-Output ('STATE_DIR=' + (Split-Path -Leaf (Get-PublishStateDir (Join-Path ([IO.Path]::GetTempPath()) 'repo'))))`],
    {encoding: 'utf-8'});
    const m = /STATE_DIR=(\S+)/.exec(r.stdout || '');
    assert.ok(m, `Get-PublishStateDir を呼べませんでした: ${r.stdout}${r.stderr}`);
    stateDirName = m[1];
  });
  beforeEach(function() {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-pubstate-'));
    fs.mkdirSync(path.join(work, 'repo'));
    fs.mkdirSync(path.join(work, stateDirName));
  });
  afterEach(function() {
    removeDir(work);
  });

  const writeState = (n, extra) => fs.writeFileSync(path.join(work, stateDirName, `task${n}.json`), JSON.stringify({
    taskNumber: n, taskTag: `Task ${n}`, sourceCommit: '0'.repeat(40), sourceSubject: `x (Task ${n})`,
    taskFiles: ['build.js'], publicFiles: ['build.js'], userscriptVersions: {},
    committedAt: '2026-09-24T21:15:33+09:00', published: false, publishedAt: null, publicCommit: null, ...extra
  }, null, 2), 'utf-8');

  const runPs = (body) => {
    const script = [
      '$ErrorActionPreference = "Stop"',
      'function Wait-ExitOnSuccess($msg) { Write-Output ("EXIT_OK: " + $msg); exit 0 }',
      'function Wait-ExitOnFailure($msg) { Write-Output ("EXIT_NG: " + $msg); exit 1 }',
      `. '${COMMON.replace(/'/g, "''")}'`,
      body
    ].join('\n');
    const file = path.join(work, 'run.ps1');
    fs.writeFileSync(file, '﻿' + script, 'utf-8');
    const r = spawnSync(ps, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file], {encoding: 'utf-8', cwd: work});
    return {status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`};
  };

  const initGateRepo = () => {
    const repo = path.join(work, 'repo');
    const g = (...a) => git(repo, a);
    g('init', '-q', '-b', 'develop');
    fs.mkdirSync(path.join(repo, 'src'));
    fs.mkdirSync(path.join(repo, 'docs'));
    fs.writeFileSync(path.join(repo, 'src', 'a.js'), 'const a = 1;\n');
    fs.writeFileSync(path.join(repo, 'docs', 'task.md'), 'task\n');
    g('add', '--', 'src/a.js', 'docs/task.md');
    g('commit', '-q', '-m', 'base (Task 900)');
    return {repo, g, source: g('rev-parse', 'HEAD').trim()};
  };

  it('coveredBy のあるタスクは published=false のままでも「公開済み扱い」と判定される', function() {
    writeState('900', {coveredBy: {taskNumber: '901', sourceCommit: '1'.repeat(40), publicCommit: '2'.repeat(40), publishedAt: '2026-09-24T22:07:43'}});
    writeState('902', {});
    writeState('903', {published: true, publishedAt: '2026-09-19T20:02:23', publicCommit: '3'.repeat(40)});
    const repo = path.join(work, 'repo').replace(/'/g, "''");
    const r = runPs([
      `foreach ($n in @('900','902','903')) { $s = Read-PublishState '${repo}' $n; Write-Output ("$n=" + (Test-TaskPublishedOrCovered $s)) }`
    ].join('\n'));
    assert.equal(r.status, 0, r.out);
    assert.ok(/900=True/.test(r.out), r.out);
    assert.ok(/902=False/.test(r.out), r.out);
    assert.ok(/903=True/.test(r.out), r.out);
  });

  it('coveredBy のあるタスクの run.bat の2回目は、git も公開も触らずに「含まれて公開済み」で止まる', function() {
    writeState('900', {coveredBy: {taskNumber: '901', sourceCommit: '1'.repeat(40), publicCommit: '2'.repeat(40), publishedAt: '2026-09-24T22:07:43'}});
    const repo = path.join(work, 'repo').replace(/'/g, "''");
    // repo は git リポジトリではない。coveredBy の確認が git より先に行われなければ、ここで失敗する
    const r = runPs(`Invoke-PublishGate '${repo}' '900' 'Task 900' @('build.js') 'task900_fix_run.bat'\nWrite-Output 'CONTINUED'`);
    assert.equal(r.status, 0, r.out);
    // Windows PowerShell の子プロセス出力は親 Node 側で CP932/UTF-8 の表示差が出ることがある。
    // 日本語の文面そのものではなく、成功経路・対象Task・後続処理へ進まないことを検査する。
    assert.ok(/EXIT_OK:/.test(r.out), r.out);
    assert.ok(/Task 900/.test(r.out), r.out);
    assert.ok(/Task 901/.test(r.out), r.out);
    assert.ok(!/CONTINUED/.test(r.out), '公開の判定を続けてしまった');
  });

  it('state済みTaskは、後続Taskの非公開docs dirtyだけでは再commit経路へ戻らない', function() {
    const {repo, source} = initGateRepo();
    writeState('900', {
      sourceCommit: source,
      sourceSubject: 'base (Task 900)',
      taskFiles: ['src/a.js', 'docs/task.md'],
      publicFiles: ['src/a.js'],
      published: true,
      publishedAt: '2026-09-26T03:00:00',
      publicCommit: '9'.repeat(40)
    });
    fs.writeFileSync(path.join(repo, 'docs', 'task.md'), 'changed by later task\n');
    const q = repo.replace(/'/g, "''");
    const r = runPs(`Set-Location -LiteralPath '${q}'\nInvoke-PublishGate '${q}' '900' 'Task 900' @('src/a.js','docs/task.md') 'task900_fix_run.bat'\nWrite-Output 'CONTINUED'`);
    assert.equal(r.status, 0, r.out);
    assert.ok(/EXIT_OK:/.test(r.out), r.out);
    assert.ok(!/CONTINUED/.test(r.out), '旧Taskの1回目経路へ戻った');
  });

  it('state済みTaskのpublic fileがdirtyなら、旧Taskを再commitせず新Taskを要求する', function() {
    const {repo, source} = initGateRepo();
    writeState('900', {
      sourceCommit: source,
      sourceSubject: 'base (Task 900)',
      taskFiles: ['src/a.js', 'docs/task.md'],
      publicFiles: ['src/a.js']
    });
    fs.writeFileSync(path.join(repo, 'src', 'a.js'), 'const a = 2;\n');
    const q = repo.replace(/'/g, "''");
    const r = runPs(`Set-Location -LiteralPath '${q}'\nInvoke-PublishGate '${q}' '900' 'Task 900' @('src/a.js','docs/task.md') 'task900_fix_run.bat'\nWrite-Output 'CONTINUED'`);
    assert.equal(r.status, 1, r.out);
    assert.ok(/EXIT_NG:/.test(r.out), r.out);
    assert.ok(!/CONTINUED/.test(r.out), 'dirty public fileから旧Taskを続行した');
  });

  it('stateのsourceCommit後にpublic fileを別commitが変えたら公開を停止する', function() {
    const {repo, g, source} = initGateRepo();
    writeState('900', {
      sourceCommit: source,
      sourceSubject: 'base (Task 900)',
      taskFiles: ['src/a.js', 'docs/task.md'],
      publicFiles: ['src/a.js']
    });
    fs.writeFileSync(path.join(repo, 'src', 'a.js'), 'const a = 3;\n');
    g('add', '--', 'src/a.js');
    g('commit', '-q', '-m', 'later task');
    const q = repo.replace(/'/g, "''");
    const r = runPs(`Set-Location -LiteralPath '${q}'\nInvoke-PublishGate '${q}' '900' 'Task 900' @('src/a.js','docs/task.md') 'task900_fix_run.bat'\nWrite-Output 'CONTINUED'`);
    assert.equal(r.status, 1, r.out);
    assert.ok(/EXIT_NG:/.test(r.out), r.out);
    assert.ok(!/CONTINUED/.test(r.out), '後続commitを混ぜて公開判定を続けた');
  });

  it('stateが無い初回TaskだけはdirtyなMyFilesがあれば通常の1回目へ進む', function() {
    const {repo} = initGateRepo();
    fs.writeFileSync(path.join(repo, 'src', 'a.js'), 'const a = 4;\n');
    const q = repo.replace(/'/g, "''");
    const r = runPs(`Set-Location -LiteralPath '${q}'\nInvoke-PublishGate '${q}' '901' 'Task 901' @('src/a.js') 'task901_fix_run.bat'\nWrite-Output 'CONTINUED'`);
    assert.equal(r.status, 0, r.out);
    assert.ok(/CONTINUED/.test(r.out), r.out);
  });

  it('publish_to_github.ps1 は、未公開タスクの一覧・古い未公開タスクの注意・番号指定のどれでも coveredBy を公開済みとして扱う', function() {
    const src = fs.readFileSync(PUBLISHER, 'utf-8');
    assert.ok(/if \(-not \(Test-TaskPublishedOrCovered \$s\)\) \{ \$cands \+= \$s \}/.test(src), '未公開タスクの一覧');
    assert.ok(/\(Test-TaskPublishedOrCovered \$s\) -or \$s\.taskNumber -eq \$TaskNumber/.test(src), '古い未公開タスクの注意');
    assert.ok(/\$cov = Get-PublishCoverage \$state\s*\n\s*if \(\$cov\) \{ Wait-ExitOnSuccess/.test(src), '番号を指定した時');
  });

  it('公開に成功した時、前の未公開のタスクで公開対象がすべて含まれたものだけを coveredBy で記録する（Task 088）', function() {
    if (!hasGit()) { this.skip(); }
    const repo = path.join(work, 'repo');
    const g = (...a) => git(repo, a);
    g('init', '-q');
    const commit = name => {
      fs.writeFileSync(path.join(repo, `${name}.txt`), name);
      g('add', '--', `${name}.txt`);
      g('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '-m', `${name}`);
      return g('rev-parse', 'HEAD').trim();
    };
    const c900 = commit('a');
    const c902 = commit('b');
    const c901 = commit('c');
    g('checkout', '-q', '-b', 'other', c900);
    const c903 = commit('d'); // 901 の祖先ではない
    writeState('900', {sourceCommit: c900, publicFiles: ['src/a.js', 'dist/x.user.js']});
    writeState('902', {sourceCommit: c902, publicFiles: ['src/a.js', 'src/only902.js']});
    writeState('903', {sourceCommit: c903, publicFiles: ['src/a.js']});
    writeState('904', {sourceCommit: c900, publicFiles: ['src/a.js'], published: true, publishedAt: 'x', publicCommit: '5'.repeat(40)});
    writeState('901', {sourceCommit: c901, publicFiles: ['src/a.js', 'dist/x.user.js', 'src/c.js']});
    const r = runPs([
      `$st = Read-PublishState '${repo.replace(/'/g, "''")}' '901'`,
      `$rec = Add-CoveredTasks '${repo.replace(/'/g, "''")}' $st @('src/a.js', 'dist/x.user.js', 'src/c.js') '${'6'.repeat(40)}' '2026-09-26T10:00:00'`,
      `Write-Output ('RECORDED=' + ($rec -join ','))`
    ].join('\n'));
    assert.equal(r.status, 0, r.out);
    assert.ok(/RECORDED=900$/m.test(r.out), r.out);
    // 警告文の日本語表示は PowerShell のコードページ差に依存するため、下のJSON状態で
    // 「902は含めない」を直接検査する。こちらの方が実際の永続状態を強く検証できる。
    const read = n => JSON.parse(fs.readFileSync(path.join(work, stateDirName, `task${n}.json`), 'utf-8').replace(/^\uFEFF/, ''));
    const s900 = read('900');
    assert.equal(s900.published, false, '単独では公開していないので published は false のまま');
    assert.equal(s900.coveredBy.taskNumber, '901');
    assert.equal(s900.coveredBy.sourceCommit, c901);
    assert.equal(s900.coveredBy.publicCommit, '6'.repeat(40));
    assert.ok(!read('902').coveredBy, '含まれていないファイルがあるタスクは記録しない');
    assert.ok(!read('903').coveredBy, '祖先でないタスクは記録しない');
    assert.ok(!read('904').coveredBy, '公開済みのタスクは変えない');
  });

  it('publish_to_github.ps1 は push に成功した後で Add-CoveredTasks を呼ぶ（Task 088）', function() {
    const src = fs.readFileSync(PUBLISHER, 'utf-8');
    const push = src.indexOf('git -C $PublicDir push origin $Branch');
    const call = src.indexOf('Add-CoveredTasks $RepoRoot $state $PubFiles');
    assert.ok(push > 0 && call > push, 'push の後に呼んでいない');
    assert.ok(src.indexOf('Save-PublishState $RepoRoot $state | Out-Null', push) < call, '自分の公開状態を保存する前に呼んでいる');
  });
});
