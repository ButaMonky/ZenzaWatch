// Task 085（監査v2 ZW-007）: src と packages/*/src の import 宣言が、実在するファイルを
// 大文字・小文字まで正しく指していることの回帰テスト。
// Task 087: さらに、名前付き import した名前が import 先で export されていること、
// default import なら import 先に default export があることも検査する（監査の「単独 import テスト」の代わり。
// このコードは連結ビルド前提のため、各モジュールを実際に単独で読み込んで実行するところまではしない）。
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

// 1つのファイルが export している名前（export * from は辿る）
function collectExports(file, parse, seen = new Set()) {
  const result = {names: new Set(), hasDefault: false};
  if (seen.has(file)) { return result; }
  seen.add(file);
  const ast = parse(file);
  for (const node of ast.program.body) {
    if (node.type === 'ExportDefaultDeclaration') { result.hasDefault = true; continue; }
    if (node.type === 'ExportAllDeclaration') {
      if (node.exported) { result.names.add(node.exported.name || node.exported.value); continue; }
      const target = node.source.value.startsWith('.') ? resolveRelative(file, node.source.value) : null;
      if (target) { collectExports(target, parse, seen).names.forEach(n => result.names.add(n)); }
      continue;
    }
    if (node.type !== 'ExportNamedDeclaration') { continue; }
    const d = node.declaration;
    if (d && d.id) { result.names.add(d.id.name); }
    if (d && d.declarations) {
      d.declarations.forEach(v => {
        if (v.id.type === 'Identifier') { result.names.add(v.id.name); }
        if (v.id.type === 'ObjectPattern') { v.id.properties.forEach(p => p.value && p.value.name && result.names.add(p.value.name)); }
        if (v.id.type === 'ArrayPattern') { v.id.elements.forEach(e => e && e.name && result.names.add(e.name)); }
      });
    }
    (node.specifiers || []).forEach(sp => {
      const name = sp.exported.name || sp.exported.value;
      if (name === 'default') { result.hasDefault = true; } else { result.names.add(name); }
    });
  }
  return result;
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

  it('名前付き import した名前は import 先で export され、default import なら default export がある（Task 087）', function() {
    const parser = require('@babel/parser');
    const cache = new Map();
    const parse = file => {
      if (!cache.has(file)) {
        cache.set(file, parser.parse(fs.readFileSync(file, 'utf-8'), {sourceType: 'unambiguous', allowReturnOutsideFunction: true}));
      }
      return cache.get(file);
    };
    const roots = [path.join(REPO_ROOT, 'src'),
      ...fs.readdirSync(path.join(REPO_ROOT, 'packages')).map(p => path.join(REPO_ROOT, 'packages', p, 'src'))
        .filter(p => fs.existsSync(p))];
    const files = roots.flatMap(walk)
      .filter(f => !QUARANTINED.some(q => path.relative(REPO_ROOT, f).split(path.sep).join('/').startsWith(q)));
    const bad = [];
    let checked = 0;
    for (const file of files) {
      for (const node of parse(file).program.body) {
        if (node.type !== 'ImportDeclaration' || !node.source.value.startsWith('.')) { continue; }
        const target = resolveRelative(file, node.source.value);
        if (!target || !/\.js$/.test(target)) { continue; } // 実在しない import は上のテストが見る
        const ex = collectExports(target, parse);
        const where = `${path.relative(REPO_ROOT, file).split(path.sep).join('/')}:${node.loc.start.line}`;
        for (const sp of node.specifiers) {
          checked++;
          if (sp.type === 'ImportDefaultSpecifier' && !ex.hasDefault) {
            bad.push(`${where} default from '${node.source.value}'（default export が無い）`);
          } else if (sp.type === 'ImportSpecifier') {
            const name = sp.imported.name || sp.imported.value;
            if (name === 'default' ? !ex.hasDefault : !ex.names.has(name)) {
              bad.push(`${where} {${name}} from '${node.source.value}'（export されていない）`);
            }
          }
        }
      }
    }
    assert.ok(checked > 300, `検査した import が少なすぎる（${checked}）`);
    assert.deepEqual(bad, []);
  });
});
