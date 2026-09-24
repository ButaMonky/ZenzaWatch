// Task 085（監査v2 ZW-055）: ZIP 自動反映 tools/zenza_sync_watcher.py の安全確認の回帰テスト。
// 期待する正常動作（監査の acceptance）:
//   ../ と絶対パスに加え、.git、symlink、古い base、dirty ファイル、途中失敗、重複 ZIP を検査する。
// 以前は「repo の外へ書き出さない」防御（Zip Slip 対策）はあったが、
//   - repo 内の .git 等への書き込み、symlink の項目、基準コミットの違い、未コミットの変更の上書き
//   - 途中で失敗した時の部分反映、同じ ZIP の再反映による上書き
// を防げず、処理済み ZIP は既定で削除していた（元に戻す材料が残らない）。
// 各ケースは一時フォルダの中だけで行い、実際のダウンロードフォルダ・repo には触れない。
// tools/ は GitHub に公開しないため、公開用リポジトリではこのテストは自動的にスキップされる。
import assert from 'power-assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT, findPython, hasGit, removeDir} = require('../helpers/buildSandbox');

const WATCHER = path.join(REPO_ROOT, 'tools', 'zenza_sync_watcher.py');

// Python 側の手順（一時 repo・ZIP の作成 → process_one の実行 → 結果を JSON で返す）
const DRIVER = String.raw`
import hashlib, io, json, os, subprocess, sys, zipfile
from pathlib import Path
sys.dont_write_bytecode = True
tools_dir, work, scenario = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
sys.path.insert(0, tools_dir)
import zenza_sync_watcher as w

repo = work / 'repo'; watch = work / 'Downloads'; review = work / 'review'
for d in (repo, watch, review): d.mkdir(parents=True, exist_ok=True)
def git(*a):
    return subprocess.run(['git', '-C', str(repo), '-c', 'user.name=t', '-c', 'user.email=t@example.invalid',
                           '-c', 'core.autocrlf=false', *a], check=True, capture_output=True, text=True).stdout.strip()
git('init', '-q')
(repo / 'src').mkdir()
(repo / 'src' / 'a.js').write_bytes(b'const a = 1;\n')
(repo / 'src' / 'b.js').write_bytes(b'const b = 1;\n')
git('add', '-A'); git('commit', '-q', '-m', 'base')
HEAD = git('rev-parse', 'HEAD')
GIT_CONFIG = (repo / '.git' / 'config').read_bytes()

w.REPO_DIR = repo; w.WATCH_DIR = watch; w.REVIEW_DIR = review; w.DONE_DIR = watch / '_zenza_processed'
w.wait_until_stable = lambda p, *a, **k: True
w.log = lambda msg: LOG.append(str(msg))
LOG = []

def sha(b): return hashlib.sha256(b).hexdigest()
def cur(rel):
    p = repo / rel
    return p.read_bytes() if p.is_file() else None

def make_zip(name, entries, manifest='auto', base=None, symlinks=()):
    """entries: {zip 内の名前: bytes}。manifest='auto' なら repo/ 以下から正しい manifest を作る"""
    z = watch / name
    with zipfile.ZipFile(z, 'w') as zf:
        for n, data in entries.items():
            zf.writestr(n, data)
        for n, target in symlinks:
            info = zipfile.ZipInfo(n)
            info.external_attr = (0o120777 << 16)
            zf.writestr(info, target)
        if manifest == 'auto':
            files = {}
            for n, data in entries.items():
                if n.startswith('repo/'):
                    rel = n[len('repo/'):]
                    before = cur(rel)
                    files[rel] = {'before': sha(before) if before is not None else None, 'after': sha(data)}
            manifest = {'format': 1, 'base': base or HEAD, 'files': files}
        if manifest is not None:
            zf.writestr('zenza_sync_manifest.json', json.dumps(manifest))
    return z

def run(z):
    try:
        r = w.process_one(z)
        return {'result': r, 'error': None}
    except Exception as e:
        return {'result': None, 'error': type(e).__name__}

NEW_A = b'const a = 2;\n'
NEW_B = b'const b = 2;\n'
out = {}

if scenario == 'ok':
    z = make_zip('task900_manual_sync.zip', {'repo/src/a.js': NEW_A, 'repo/src/new.js': b'x\n'})
    out.update(run(z))
    out['zip_kept'] = z.exists() or any((watch / '_zenza_processed').glob('*.zip'))
elif scenario == 'escape':
    outside = work / 'outside.txt'
    z = make_zip('task900_manual_sync.zip', {'repo/src/a.js': NEW_A, 'repo/../outside.txt': b'x', '/abs.txt': b'x'},
                 manifest={'format': 1, 'base': HEAD, 'files': {'src/a.js': {'before': sha(cur('src/a.js')), 'after': sha(NEW_A)}}})
    out.update(run(z)); out['outside_written'] = outside.exists() or Path('/abs.txt').exists()
elif scenario == 'dotgit':
    z = make_zip('task900_manual_sync.zip', {'repo/src/a.js': NEW_A, 'repo/.git/config': b'[core]\n'})
    out.update(run(z)); out['git_config_changed'] = (repo / '.git' / 'config').read_bytes() != GIT_CONFIG
elif scenario == 'secret':
    z = make_zip('task900_manual_sync.zip', {'repo/src/a.js': NEW_A, 'repo/.env': b'X=1\n'})
    out.update(run(z)); out['env_written'] = (repo / '.env').exists()
elif scenario == 'symlink':
    z = make_zip('task900_manual_sync.zip', {'repo/src/a.js': NEW_A}, symlinks=[('repo/src/link.js', '../../outside.txt')])
    out.update(run(z)); out['link_written'] = os.path.lexists(repo / 'src' / 'link.js')
elif scenario == 'no_manifest':
    z = make_zip('task900_manual_sync.zip', {'repo/src/a.js': NEW_A}, manifest=None)
    out.update(run(z))
elif scenario == 'stale_base':
    z = make_zip('task900_manual_sync.zip', {'repo/src/a.js': NEW_A}, base='0' * 40)
    out.update(run(z))
elif scenario == 'dirty':
    z = make_zip('task900_manual_sync.zip', {'repo/src/a.js': NEW_A})  # manifest の before はコミット済みの内容
    (repo / 'src' / 'a.js').write_bytes(b'const a = "local edit";\n')   # 未コミットの手元の変更
    out.update(run(z)); out['local_edit_kept'] = cur('src/a.js') == b'const a = "local edit";\n'
elif scenario == 'midway_fs':
    (repo / 'zz').write_bytes(b'file, not a folder\n')  # 2つ目の書き込み先の親がファイル → 書き込み時に失敗する
    git('add', '-A'); git('commit', '-q', '-m', 'zz'); HEAD = git('rev-parse', 'HEAD')
    z = make_zip('task900_manual_sync.zip', {'repo/src/a.js': NEW_A, 'repo/zz/b.js': NEW_B})
    out.update(run(z))
elif scenario == 'midway_replace':
    z = make_zip('task900_manual_sync.zip', {'repo/src/a.js': NEW_A, 'repo/src/b.js': NEW_B})
    real_replace = os.replace; calls = [0]
    def flaky(src, dst):
        calls[0] += 1
        if calls[0] == 2:
            raise OSError('injected failure on the 2nd file')
        return real_replace(src, dst)
    os.replace = flaky
    try:
        out.update(run(z))
    finally:
        os.replace = real_replace
    out['b_unchanged'] = cur('src/b.js') == b'const b = 1;\n'
    out['leftovers'] = sorted(p.name for p in (repo / 'src').iterdir() if p.name not in ('a.js', 'b.js'))
elif scenario == 'duplicate':
    entries = {'repo/src/a.js': NEW_A}
    z1 = make_zip('task900_manual_sync.zip', entries)
    first = run(z1)
    (repo / 'src' / 'a.js').write_bytes(b'const a = "edited after sync";\n')  # 反映後に手元で直した
    z2 = watch / 'task900b_manual_sync.zip'
    (watch / '_zenza_processed').mkdir(exist_ok=True)
    src_zip = z1 if z1.exists() else next((watch / '_zenza_processed').glob('*.zip'), None)
    if src_zip is None:
        out.update({'result': None, 'error': 'first zip was deleted'})
    else:
        z2.write_bytes(src_zip.read_bytes())  # 同じ ZIP をもう一度ダウンロードした
        out.update(run(z2))
    out['first'] = first
    out['edit_kept'] = cur('src/a.js') == b'const a = "edited after sync";\n'
    out['zip2_kept'] = z2.exists()
else:
    raise SystemExit('unknown scenario ' + scenario)

out['a'] = (cur('src/a.js') or b'').decode('utf-8', 'replace')
out['zip_left'] = sorted(p.name for p in watch.glob('*.zip'))
out['log'] = LOG
print(json.dumps(out, ensure_ascii=False))
`;

describe('ZIP 自動反映 zenza_sync_watcher.py の安全確認（ZW-055）', function() {
  this.timeout(60000);
  let py = null;
  let work;

  before(function() {
    if (!fs.existsSync(WATCHER)) {
      console.log('    （tools/zenza_sync_watcher.py が無いためスキップ）');
      this.skip();
    }
    py = findPython();
    if (!py || !hasGit()) {
      console.log('    （python3 または git が見つからないためスキップ）');
      this.skip();
    }
  });
  beforeEach(function() {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-sync-'));
  });
  afterEach(function() {
    removeDir(work);
  });

  const run = (scenario) => {
    const r = spawnSync(py.cmd, [...py.pre, '-c', DRIVER, path.dirname(WATCHER), work, scenario], {
      encoding: 'utf-8',
      env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1', GIT_CEILING_DIRECTORIES: work,
        GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(work, 'no-global-config')}
    });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    out.dump = JSON.stringify(out, null, 1);
    return out;
  };
  const ORIGINAL_A = 'const a = 1;\n';
  // 「ZIP 全体を反映しない」: 1つも書き込まず、失敗を返し、元の ZIP を残す
  const assertRejected = (o) => {
    assert.equal(o.error, null, o.dump);
    assert.equal(o.result, false, o.dump);
    assert.equal(o.a, ORIGINAL_A, `一部だけ反映された: ${o.dump}`);
    assert.deepEqual(o.zip_left, ['task900_manual_sync.zip'], `元の ZIP が残っていない: ${o.dump}`);
  };

  it('正しい manifest の ZIP は反映し、元の ZIP は削除せず残す', function() {
    const o = run('ok');
    assert.equal(o.error, null, o.dump);
    assert.equal(o.result, true, o.dump);
    assert.equal(o.a, 'const a = 2;\n', o.dump);
    assert.ok(o.zip_kept, `元の ZIP が削除された: ${o.dump}`);
  });

  it('../ や絶対パスの項目があれば、repo の外へ書かず、ZIP 全体を反映しない', function() {
    const o = run('escape');
    assert.equal(o.outside_written, false, o.dump);
    assertRejected(o);
  });

  it('repo 内の .git への書き込みを含む ZIP は反映しない', function() {
    const o = run('dotgit');
    assert.equal(o.git_config_changed, false, o.dump);
    assertRejected(o);
  });

  it('.env 等の秘密情報の置き場所への書き込みを含む ZIP は反映しない', function() {
    const o = run('secret');
    assert.equal(o.env_written, false, o.dump);
    assertRejected(o);
  });

  it('symlink の項目を含む ZIP は反映しない', function() {
    const o = run('symlink');
    assert.equal(o.link_written, false, o.dump);
    assertRejected(o);
  });

  it('manifest（基準コミット・反映前後の hash）の無い ZIP は反映しない', function() {
    assertRejected(run('no_manifest'));
  });

  it('基準コミットが今の HEAD と違う（古い）ZIP は反映しない', function() {
    assertRejected(run('stale_base'));
  });

  it('未コミットの手元の変更がある（反映前の hash が合わない）ファイルは上書きしない', function() {
    const o = run('dirty');
    assert.equal(o.local_edit_kept, true, o.dump);
    assert.equal(o.result, false, o.dump);
    assert.deepEqual(o.zip_left, ['task900_manual_sync.zip'], o.dump);
  });

  it('途中で書き込めないファイルがあれば、1つも反映しない（例外で止まらない）', function() {
    assertRejected(run('midway_fs'));
  });

  it('差し替えの途中で失敗したら、それまでに差し替えたファイルを元に戻す', function() {
    const o = run('midway_replace');
    assertRejected(o);
    assert.equal(o.b_unchanged, true, o.dump);
    assert.deepEqual(o.leftovers, [], `作業用の一時ファイルが残っている: ${o.dump}`);
  });

  it('同じ ZIP をもう一度受け取っても、その後の手元の変更を上書きしない', function() {
    const o = run('duplicate');
    assert.equal(o.first.result, true, o.dump);
    assert.equal(o.edit_kept, true, o.dump);
    assert.equal(o.result, false, o.dump);
    assert.equal(o.zip2_kept, true, o.dump);
  });
});
