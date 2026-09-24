// Task 085（監査v2 ZW-009）: build.js の監視モード（npm run watch）が、
// ビルドの入力になる全ディレクトリ（src・packages/lib・packages/zenza・packages/components）を監視し、
// 監視対象が欠けている時は「一部だけ監視」で動き続けないことの回帰テスト。
// 期待する正常動作（監査の acceptance）:
//   必須ディレクトリ欠損で部分成功しない。src・lib・zenza 各階層の変更でビルドが一度ずつ実行される。
// 以前は存在しない packages/navi/src の監視登録で例外になり、それ以降の lib・zenza が監視されていなかった。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';
import {spawn} from 'child_process';

const {REPO_ROOT, createBuildSandbox, removeDir} = require('../helpers/buildSandbox');

const BUILD_MARK = />>>>>>build: ZenzaWatch-dev\.user\.js/g;
const countBuilds = text => (text.match(BUILD_MARK) || []).length;
const sleep = ms => new Promise(res => setTimeout(res, ms));

function startWatch(dir) {
  const child = spawn(process.execPath, ['build.js', '--dev', '--watch'], {
    cwd: dir,
    env: {...process.env, NODE_PATH: path.join(REPO_ROOT, 'node_modules'), ZENZA_BUILD_NO_NOTIFY: '1'}
  });
  const state = {out: '', exited: false, code: null};
  child.stdout.on('data', d => { state.out += d; });
  child.stderr.on('data', d => { state.out += d; });
  child.on('exit', code => { state.exited = true; state.code = code; });
  return {child, state};
}

async function waitFor(pred, timeout) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (pred()) { return true; }
    await sleep(100);
  }
  return pred();
}

// ファイルの内容を変える（末尾に空行を1つ足す。ビルド結果の JavaScript は変わらない）
const touch = file => fs.appendFileSync(file, '\n');

describe('build.js の監視モード（ZW-009）', function() {
  this.timeout(120000);
  let dir;
  let running;

  beforeEach(function() {
    dir = createBuildSandbox('zenza-watch-');
    running = null;
  });
  afterEach(async function() {
    if (running && !running.state.exited) {
      running.child.kill();
      await waitFor(() => running.state.exited, 5000);
    }
    removeDir(dir);
  });

  it('src・packages/lib・packages/zenza の変更で、それぞれビルドが1回ずつ実行される', async function() {
    running = startWatch(dir);
    const {state} = running;
    // 最初のビルドと監視開始を待つ
    assert.ok(await waitFor(() => /監視しています/.test(state.out) || state.exited, 20000), state.out);
    assert.ok(!state.exited, '監視モードが終了してしまった\n' + state.out);
    await sleep(500);

    const targets = [
      'src/util.js',
      'packages/lib/src/infra/sleep.js',
      'packages/zenza/src/init/PlayerSession.js'
    ];
    for (const rel of targets) {
      const before = countBuilds(state.out);
      touch(path.join(dir, rel));
      const rebuilt = await waitFor(() => countBuilds(state.out) > before, 10000);
      assert.ok(rebuilt, `${rel} の変更でビルドされなかった\n${state.out.slice(-2000)}`);
      await sleep(4500); // 同じ変更で2回目のビルドが起きないことを確かめる時間
      assert.equal(countBuilds(state.out) - before, 1, `${rel} の変更でビルドが1回ではなかった`);
    }
  });

  it('監視対象（ビルドの入力）のディレクトリが無い時は、一部だけ監視して動き続けず、非0で終了する', async function() {
    removeDir(path.join(dir, 'packages', 'components'));
    running = startWatch(dir);
    const {state} = running;
    const exited = await waitFor(() => state.exited, 20000);
    assert.ok(exited, '監視対象が欠けているのに監視を続けている\n' + state.out.slice(-2000));
    assert.notEqual(state.code, 0, state.out.slice(-2000));
    assert.ok(/packages[\\/]components[\\/]src/.test(state.out), '欠けているディレクトリ名が表示されていない');
  });
});
