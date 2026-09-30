// Task 087（監査v2 ZW-055）: 生成側 tools/make_sync_zip.py → zip → 反映側 tools/zenza_sync_watcher.py の
// 往復（round-trip）の回帰テスト。すべて一時フォルダの中だけで行い、実際の repo・ダウンロードフォルダには触れない。
// tools/ は GitHub に公開しないため、公開用リポジトリではこのテストは自動的にスキップされる。
import assert from 'power-assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {spawnSync} from 'child_process';

const {REPO_ROOT, findPython, hasGit, removeDir} = require('../helpers/buildSandbox');

const MAKER = path.join(REPO_ROOT, 'tools', 'make_sync_zip.py');
const WATCHER = path.join(REPO_ROOT, 'tools', 'zenza_sync_watcher.py');

const DRIVER = String.raw`
import hashlib, io, json, os, subprocess, sys, zipfile
from pathlib import Path
sys.dont_write_bytecode = True
tools_dir, work, scenario = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
sys.path.insert(0, tools_dir)
import zenza_sync_watcher as w
import make_sync_zip as m

repo = work / 'pc-repo'; src = work / 'src'; watch = work / 'Downloads'
for d in (repo, src, watch): d.mkdir(parents=True, exist_ok=True)
def git(*a):
    return subprocess.run(['git', '-C', str(repo), '-c', 'user.name=t', '-c', 'user.email=t@example.invalid',
                           '-c', 'core.autocrlf=false', *a], check=True, capture_output=True, text=True).stdout.strip()
git('init', '-q')
(repo / 'src').mkdir()
(repo / 'src' / 'a.js').write_bytes(b'const a = 1;\r\nconst b = 2;\r\n')   # Windows の改行コード
(repo / 'README.md').write_bytes(b'readme\n')
git('add', '-A'); git('commit', '-q', '-m', 'base')

w.REPO_DIR = repo; w.WATCH_DIR = watch; w.REVIEW_DIR = work / 'review'; w.DONE_DIR = watch / '_zenza_processed'
w.wait_until_stable = lambda p, *a, **k: True
LOG = []
w.log = lambda msg: LOG.append(str(msg))

NEW_A = b'const a = 10;\r\nconst b = 2;\r\n'
NEW_F = b'export const x = 1;\n'
def put(rel, data):
    p = src / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_bytes(data)
def make(files=None):
    z = watch / 'task900_manual_sync.zip'
    out = io.StringIO(); old = sys.stdout; sys.stdout = out
    try:
        code = m.main(['--base', str(repo), '--src', str(src), '--out', str(z), '--force'] + (files or []))
    finally:
        sys.stdout = old
    return code, z, out.getvalue()
def apply(z):
    try:
        return w.process_one(z), None
    except Exception as e:
        return None, type(e).__name__
def rewrite_zip(z, fn):
    with zipfile.ZipFile(z) as zf:
        items = {i.filename: zf.read(i) for i in zf.infolist()}
    items = fn(items)
    with zipfile.ZipFile(z, 'w') as zf:
        for k, v in items.items(): zf.writestr(k, v)
sha = lambda b: hashlib.sha256(b).hexdigest()
out = {}

if scenario == 'ok':
    put('src/a.js', NEW_A); put('src/new/b.js', NEW_F)
    code, z, text = make()
    with zipfile.ZipFile(z) as zf:
        man = json.loads(zf.read('zenza_sync_manifest.json'))
        names = sorted(zf.namelist())
    out.update(code=code, names=names, base_ok=man['base'] == git('rev-parse', 'HEAD'),
               a=man['files']['src/a.js'], new=man['files']['src/new/b.js'],
               a_before_expected=sha(b'const a = 1;\r\nconst b = 2;\r\n'), a_after_expected=sha(NEW_A), new_after_expected=sha(NEW_F))
    r, err = apply(z)
    out.update(result=r, error=err, a_bytes_ok=(repo / 'src' / 'a.js').read_bytes() == NEW_A,
               new_ok=(repo / 'src' / 'new' / 'b.js').read_bytes() == NEW_F)
elif scenario == 'base_mismatch':
    put('src/a.js', NEW_A); code, z, _ = make()
    (repo / 'README.md').write_bytes(b'readme 2\n'); git('commit', '-qam', 'later')
    r, err = apply(z); out.update(code=code, result=r, error=err)
elif scenario == 'before_mismatch':
    put('src/a.js', NEW_A); code, z, _ = make()
    (repo / 'src' / 'a.js').write_bytes(b'const a = "local edit";\r\n')
    r, err = apply(z); out.update(code=code, result=r, error=err, local_kept=(repo / 'src' / 'a.js').read_bytes() == b'const a = "local edit";\r\n')
elif scenario == 'after_mismatch':
    put('src/a.js', NEW_A); code, z, _ = make()
    rewrite_zip(z, lambda it: {**it, 'repo/src/a.js': b'const a = "tampered";\r\n'})
    r, err = apply(z); out.update(code=code, result=r, error=err)
elif scenario == 'new_file_conflict':
    put('src/new/b.js', NEW_F); code, z, _ = make()
    (repo / 'src' / 'new').mkdir(); (repo / 'src' / 'new' / 'b.js').write_bytes(b'someone else made this\n')
    r, err = apply(z); out.update(code=code, result=r, error=err)
elif scenario == 'forbidden':
    res = {}
    for rel in ['.env', '.git/config', 'node_modules/x/index.js', 'logs/capture.har', 'keys/server.key', '../outside.js']:
        s2 = work / ('src_' + str(len(res))); s2.mkdir()
        src = s2
        if rel.startswith('..'):
            put('ok.js', b'x')
            code, z, text = make(['../outside.js'])
        else:
            put(rel, b'secret=1\n')
            code, z, text = make()
        res[rel] = {'code': code, 'zip': z.exists()}
    out['forbidden'] = res
elif scenario == 'manifest_tamper':
    put('src/a.js', NEW_A); put('src/new/b.js', NEW_F); code, z, _ = make()
    def drop(it):
        man = json.loads(it['zenza_sync_manifest.json']); del man['files']['src/new/b.js']
        return {**it, 'zenza_sync_manifest.json': json.dumps(man).encode()}
    rewrite_zip(z, drop)
    r1, e1 = apply(z)
    code2, z2, _ = make(['src/a.js'])  # もう一度正しく作ってから after の hash を書き換える
    def fake_after(it):
        man = json.loads(it['zenza_sync_manifest.json']); man['files']['src/a.js']['after'] = '0' * 64
        return {**it, 'zenza_sync_manifest.json': json.dumps(man).encode()}
    rewrite_zip(z2, fake_after)
    r2, e2 = apply(z2)
    out.update(code=code, drop_result=r1, drop_error=e1, fake_result=r2, fake_error=e2)
elif scenario == 'symlink':
    target = work / 'outside.txt'; target.write_bytes(b'x')
    outside_dir = work / 'outside-dir'; outside_dir.mkdir(); (outside_dir / 'b.js').write_bytes(b'x')
    (src / 'src').mkdir(parents=True)
    try:
        os.symlink(target, src / 'src' / 'link.js')
        out['kind'] = 'symlink'
    except (OSError, NotImplementedError):
        # Windows で symlink を作る権限が無い時は、権限なしで作れるディレクトリジャンクション（mklink /J と同じ）で確かめる
        try:
            import _winapi
            _winapi.CreateJunction(str(outside_dir), str(src / 'src' / 'linkdir'))
            out['kind'] = 'junction'
        except (ImportError, AttributeError, OSError):
            out['skipped'] = True
    if not out.get('skipped'):
        code, z, _ = make()
        out.update(code=code, zip=z.exists())
elif scenario == 'manifest_name':
    put('zenza_sync_manifest.json', b'{}'); put('src/a.js', NEW_A)
    code, z, text = make()
    with zipfile.ZipFile(z) as zf: names = sorted(zf.namelist())
    code2, z2, _ = make(['zenza_sync_manifest.json'])
    out.update(code=code, names=names, explicit_code=code2)
else:
    raise SystemExit('unknown scenario')

out['a_now'] = (repo / 'src' / 'a.js').read_bytes().decode('utf-8', 'replace')
out['log'] = LOG
print(json.dumps(out, ensure_ascii=False))
`;

describe('同期 zip の往復 make_sync_zip.py → zenza_sync_watcher.py（ZW-055）', function() {
  this.timeout(60000);
  let py = null;
  let work;

  before(function() {
    if (!fs.existsSync(MAKER) || !fs.existsSync(WATCHER)) {
      console.log('    （tools/make_sync_zip.py・zenza_sync_watcher.py が無いためスキップ）');
      this.skip();
    }
    py = findPython();
    if (!py || !hasGit()) {
      console.log('    （python3 または git が見つからないためスキップ）');
      this.skip();
    }
  });
  beforeEach(function() {
    work = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-roundtrip-'));
  });
  afterEach(function() {
    removeDir(work);
  });

  const run = (scenario) => {
    const r = spawnSync(py.cmd, [...py.pre, '-c', DRIVER, path.dirname(MAKER), work, scenario], {
      encoding: 'utf-8',
      env: {...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1', GIT_CEILING_DIRECTORIES: work,
        GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(work, 'no-global-config')}
    });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    out.dump = JSON.stringify(out, null, 1);
    return out;
  };
  const ORIGINAL_A = 'const a = 1;\r\nconst b = 2;\r\n';

  it('正常: HEAD を基準に、反映前・反映後の SHA-256（CRLF を含む実際のバイト列）を記録し、そのまま反映できる', function() {
    const o = run('ok');
    assert.equal(o.code, 0, o.dump);
    assert.deepEqual(o.names, ['repo/src/a.js', 'repo/src/new/b.js', 'zenza_sync_manifest.json'], o.dump);
    assert.ok(o.base_ok, o.dump);
    assert.equal(o.a.before, o.a_before_expected, o.dump);
    assert.equal(o.a.after, o.a_after_expected, o.dump);
    assert.equal(o.new.before, null, '新規ファイルの before は null');
    assert.equal(o.new.after, o.new_after_expected, o.dump);
    assert.equal(o.result, true, o.dump);
    assert.ok(o.a_bytes_ok && o.new_ok, `反映後のバイト列が違う（改行コードが変わった等）: ${o.dump}`);
  });

  it('base 不一致: zip を作った後に反映先の HEAD が進んでいたら反映しない', function() {
    const o = run('base_mismatch');
    assert.equal(o.code, 0, o.dump);
    assert.equal(o.result, false, o.dump);
    assert.equal(o.a_now, ORIGINAL_A, o.dump);
  });

  it('before 不一致: 反映先のファイルが作った時と違えば（手元の変更）上書きしない', function() {
    const o = run('before_mismatch');
    assert.equal(o.result, false, o.dump);
    assert.equal(o.local_kept, true, o.dump);
  });

  it('after 不一致: zip の中身が manifest と違えば（途中で書き換えられた）反映しない', function() {
    const o = run('after_mismatch');
    assert.equal(o.result, false, o.dump);
    assert.equal(o.a_now, ORIGINAL_A, o.dump);
  });

  it('新規ファイル: 反映先に同じ名前のファイルが後からできていたら上書きしない', function() {
    const o = run('new_file_conflict');
    assert.equal(o.code, 0, o.dump);
    assert.equal(o.result, false, o.dump);
  });

  it('禁止パス: .env・.git・node_modules・HAR・鍵・repo の外は、作る時点で拒否し zip を作らない', function() {
    const o = run('forbidden');
    for (const [rel, r] of Object.entries(o.forbidden)) {
      assert.equal(r.code, 1, `${rel}: ${o.dump}`);
      assert.equal(r.zip, false, `${rel} の zip が作られた: ${o.dump}`);
    }
  });

  it('manifest 改ざん: 一覧からファイルを消す・after の hash を書き換えると反映しない', function() {
    const o = run('manifest_tamper');
    assert.equal(o.drop_result, false, o.dump);
    assert.equal(o.fake_result, false, o.dump);
    assert.equal(o.a_now, ORIGINAL_A, o.dump);
  });

  it('symlink・ジャンクションは作る時点で拒否する（Windows で symlink を作る権限が無ければジャンクションで確かめる）', function() {
    const o = run('symlink');
    if (o.skipped) { this.skip(); }
    assert.ok(['symlink', 'junction'].includes(o.kind), o.dump);
    assert.equal(o.code, 1, o.dump);
    assert.equal(o.zip, false, o.dump);
  });

  it('manifest 自身の名前のファイルは入れない（自動で集める時は除外、指定されたら拒否）', function() {
    const o = run('manifest_name');
    assert.equal(o.code, 0, o.dump);
    assert.deepEqual(o.names, ['repo/src/a.js', 'zenza_sync_manifest.json'], o.dump);
    assert.equal(o.explicit_code, 1, o.dump);
  });
});
