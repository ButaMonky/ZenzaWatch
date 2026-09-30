// Task 087（INV-15）: 検証ランナー tools/r01_verify.ps1 が、必須の検査の失敗・スキップを成功扱いしないことの回帰テスト。
// Task 086 の task086_verify\run_verify.ps1 は最後が無条件の exit 0 で、途中の npm test 等が失敗しても成功終了し得た。
// 本物の検査は実行しない -SelfTest で、終了コードの集約だけを確かめる。
// PowerShell（pwsh / Windows PowerShell）が無い環境では自動的にスキップする（環境変数 ZENZA_PWSH で場所を指定できる）。
// tools/ は GitHub に公開しないため、公開用リポジトリではこのテストは自動的にスキップされる。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT} = require('../helpers/buildSandbox');

const RUNNER = path.join(REPO_ROOT, 'tools', 'r01_verify.ps1');

function findPowerShell() {
  for (const c of [process.env.ZENZA_PWSH, 'pwsh', 'powershell'].filter(Boolean)) {
    const r = spawnSync(c, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], {encoding: 'utf-8'});
    if (r.status === 0) { return c; }
  }
  return null;
}

describe('検証ランナー r01_verify.ps1 の終了コード（INV-15）', function() {
  this.timeout(60000);
  let ps = null;
  before(function() {
    if (!fs.existsSync(RUNNER)) {
      console.log('    （tools/r01_verify.ps1 が無いためスキップ）');
      this.skip();
    }
    ps = findPowerShell();
    if (!ps) {
      console.log('    （PowerShell が見つからないためスキップ）');
      this.skip();
    }
  });
  const run = mode => {
    const r = spawnSync(ps, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', RUNNER, '-SelfTest', mode], {encoding: 'utf-8'});
    return {status: r.status, out: `${r.stdout || ''}${r.stderr || ''}`};
  };

  it('必須がすべて成功なら 0（任意の検査の失敗・スキップだけでは失敗にしない）', function() {
    const r = run('pass');
    assert.equal(r.status, 0, r.out);
    assert.ok(/VERIFY_RESULT=OK/.test(r.out), r.out);
  });

  it('必須の検査が1つでも失敗したら 0 以外', function() {
    const r = run('fail');
    assert.notEqual(r.status, 0, r.out);
    assert.ok(/VERIFY_RESULT=NG.*selftest_mandatory_ng/.test(r.out), r.out);
  });

  it('必須の検査を実行できなかった（スキップ）場合も 0 以外', function() {
    const r = run('skip');
    assert.notEqual(r.status, 0, r.out);
    assert.ok(/VERIFY_RESULT=NG.*selftest_mandatory_skip/.test(r.out), r.out);
  });

  it('検査の一覧で、必須・任意がコード上で分かる（本物の検査の定義）', function() {
    const src = fs.readFileSync(RUNNER, 'utf-8');
    for (const id of ['runner_selftest', 'npm_test', 'watch_sync_tests', 'npm_run_build', 'distcheck_head', 'regeneration_self',
      'watch_temp_copy', 'ps51_parse', 'clean_env']) {
      assert.ok(new RegExp(`Id = "${id}"; Mandatory = \\$true`).test(src), `${id} が必須になっていない`);
    }
    for (const id of ['publish_remote', 'regeneration_public']) {
      assert.ok(new RegExp(`Id = "${id}"; Mandatory = \\$false`).test(src), `${id} が任意になっていない`);
    }
    assert.ok(/if \(\$failedMandatory\.Count -gt 0\) \{[\s\S]*?exit 1\s*\n\}/.test(src), '必須の失敗で exit 1 にする分岐が無い');
  });
});
