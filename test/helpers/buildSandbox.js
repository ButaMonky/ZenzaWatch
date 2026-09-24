// Task 084（監査v2 ZW-001/002/003）: ビルド・公開まわりの回帰テスト用の補助関数。
// test/**/unit/*.js には一致しない場所に置き、テストとしては実行されない。
// 実際のリポジトリ（dist など）には一切書き込まず、OS の一時フォルダに作った
// 使い捨てのコピー（サンドボックス）の中だけでビルド・git 操作を行う。
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '../..');

// build.js が読む入力（src と packages/*/src）と、比較用の dist を持つコピーを作る
function createBuildSandbox(prefix = 'zenza-build-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.copyFileSync(path.join(REPO_ROOT, 'build.js'), path.join(dir, 'build.js'));
  fs.cpSync(path.join(REPO_ROOT, 'src'), path.join(dir, 'src'), {recursive: true});
  for (const pkg of fs.readdirSync(path.join(REPO_ROOT, 'packages'))) {
    const src = path.join(REPO_ROOT, 'packages', pkg, 'src');
    if (fs.existsSync(src)) {
      fs.cpSync(src, path.join(dir, 'packages', pkg, 'src'), {recursive: true});
    }
  }
  fs.mkdirSync(path.join(dir, 'dist'), {recursive: true});
  for (const f of fs.readdirSync(path.join(REPO_ROOT, 'dist'))) {
    if (f.endsWith('.user.js')) {
      fs.copyFileSync(path.join(REPO_ROOT, 'dist', f), path.join(dir, 'dist', f));
    }
  }
  return dir;
}

function runNode(args, {cwd, env = {}, timeout = 120000} = {}) {
  const r = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf-8',
    timeout,
    env: {
      ...process.env,
      NODE_PATH: path.join(REPO_ROOT, 'node_modules'),
      ZENZA_BUILD_NO_NOTIFY: '1',
      ...env
    }
  });
  return {status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error};
}

function runBuild(dir, extraArgs = ['--dev']) {
  return runNode(['build.js', ...extraArgs], {cwd: dir});
}

// dist の中身を「ファイル名 → 種類とSHA-256」で記録する（比較時の出力を小さくするため）
function snapshotDist(dir) {
  const crypto = require('crypto');
  const result = {};
  const distDir = path.join(dir, 'dist');
  for (const f of fs.readdirSync(distDir).sort()) {
    const p = path.join(distDir, f);
    const st = fs.statSync(p);
    result[f] = st.isFile() ?
      'file:' + crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') :
      'dir';
  }
  return result;
}

function readDist(dir) {
  const result = {};
  const distDir = path.join(dir, 'dist');
  for (const f of fs.readdirSync(distDir)) {
    const p = path.join(distDir, f);
    if (fs.statSync(p).isFile()) {
      result[f] = fs.readFileSync(p, 'utf-8');
    }
  }
  return result;
}

function removeDir(dir) {
  try {
    fs.rmSync(dir, {recursive: true, force: true});
  } catch (e) { /* 一時フォルダの後片付け失敗はテスト結果に影響させない */ }
}

// python（3系）を探す。見つからなければ null。
function findPython() {
  const candidates = [['python3'], ['python'], ['py', '-3']];
  for (const [cmd, ...pre] of candidates) {
    const r = spawnSync(cmd, [...pre, '--version'], {encoding: 'utf-8'});
    if (r.status === 0 && /Python 3/.test(`${r.stdout}${r.stderr}`)) {
      return {cmd, pre};
    }
  }
  return null;
}

function hasGit() {
  const r = spawnSync('git', ['--version'], {encoding: 'utf-8'});
  return r.status === 0;
}

function git(cwd, args, env = {}) {
  const r = spawnSync('git', ['-c', 'user.name=zenza-test', '-c', 'user.email=zenza-test@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args],
  {cwd, encoding: 'utf-8', env: {...process.env, ...env}});
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  }
  return r.stdout;
}

module.exports = {
  REPO_ROOT, createBuildSandbox, runNode, runBuild, snapshotDist, readDist, removeDir, findPython, hasGit, git
};
