// Task 085（監査v2 ZW-007）: src と packages/*/src の import 宣言が、実在するファイルを
// 大文字・小文字まで正しく指していることの回帰テスト。
// 期待する正常動作（監査の acceptance）:
//   全公開エントリの依存解決検査に成功する（Linux のように大文字・小文字を区別する環境でも）。
// build.js の連結ビルド（BEGIN/END と //@require）は import のパスを使わないことが多く、
// 間違った import（例: playlist/PlayList と Playlist/PlayList、存在しない ./loader/ThreadLoader）が隠れていた。
// ビルドしていない旧モジュール（src/yomi、ShadowDancer に依存）は QUARANTINED として検査から外している。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const {REPO_ROOT} = require('../helpers/buildSandbox');

// ビルド対象でない旧モジュール（build.js の templates でもコメントアウトされている _yomi.js 用）
const QUARANTINED = ['src/yomi/'];

function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(e =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : (e.name.endsWith('.js') ? [path.join(dir, e.name)] : []));
}

// 大文字・小文字まで一致するファイルがあるか（Windows・macOS でも Linux と同じ判定にする）
function existsExactCase(abs) {
  const rel = path.relative(REPO_ROOT, abs);
  if (rel.startsWith('..')) { return fs.existsSync(abs); }
  let cur = REPO_ROOT;
  for (const seg of rel.split(path.sep)) {
    let names;
    try { names = fs.readdirSync(cur); } catch (e) { return false; }
    if (!names.includes(seg)) { return false; }
    cur = path.join(cur, seg);
  }
  return fs.statSync(cur).isFile();
}

function resolveRelative(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  return [base, `${base}.js`, path.join(base, 'index.js')].find(existsExactCase) || null;
}

describe('import 宣言の解決（ZW-007）', function() {
  this.timeout(60000);

  it('src と packages/*/src の import が、実在するファイル・パッケージを大文字小文字まで正しく指している', function() {
    const parser = require('@babel/parser');
    const roots = [path.join(REPO_ROOT, 'src'),
      ...fs.readdirSync(path.join(REPO_ROOT, 'packages')).map(p => path.join(REPO_ROOT, 'packages', p, 'src'))
        .filter(p => fs.existsSync(p))];
    const files = roots.flatMap(walk)
      .filter(f => !QUARANTINED.some(q => path.relative(REPO_ROOT, f).split(path.sep).join('/').startsWith(q)));
    assert.ok(files.length > 100, `ソースが少なすぎる（${files.length}）`);
    const bad = [];
    for (const file of files) {
      const ast = parser.parse(fs.readFileSync(file, 'utf-8'), {sourceType: 'unambiguous', allowReturnOutsideFunction: true});
      for (const node of ast.program.body) {
        if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) || !node.source) { continue; }
        const spec = node.source.value;
        const where = `${path.relative(REPO_ROOT, file).split(path.sep).join('/')}:${node.loc.start.line} '${spec}'`;
        if (/^https?:\/\//.test(spec)) { continue; } // CDN（esm.run 等）はビルド・実行時にブラウザが読む。版の固定は監査 R02
        if (spec.startsWith('.')) {
          if (!resolveRelative(file, spec)) { bad.push(where); }
        } else {
          try { require.resolve(spec, {paths: [REPO_ROOT]}); } catch (e) { bad.push(`${where}（パッケージが無い）`); }
        }
      }
    }
    assert.deepEqual(bad, []);
  });
});
