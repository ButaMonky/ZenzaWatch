#!/usr/bin/env node
// Task1061: `declare const X: Loose;`（平坦なスコープの共有物）を、X を export している nico-src の
// モジュールの実際の型 `typeof import('./M').X` に置き換える道具。
//   node scripts/type-loose-declares.mjs --report          … 置き換え候補と定義元の一覧
//   node scripts/type-loose-declares.mjs --try [名前...]    … 1つずつ置き換えて strict で検査し、
//                                                            エラー0のものだけ残す（他は元に戻して件数を出す）
// 生成される JS は変わらない（declare は型だけ）。
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const STAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(STAGE, 'nico-src');
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts')).sort();
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

// どのモジュールが何を export しているか（`export {A, B as C}` と `export const/class/function`）
const exporters = new Map();
for (const f of files) {
  const text = read(f);
  const mod = f.replace(/\.ts$/, '');
  for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop().trim();
      if (name && !name.startsWith('type ')) (exporters.get(name) || exporters.set(name, []).get(name)).push(mod);
    }
  }
  for (const m of text.matchAll(/^export\s+(?:declare\s+)?(?:const|let|class|function)\s+([A-Za-z_$][\w$]*)/gm)) {
    (exporters.get(m[1]) || exporters.set(m[1], []).get(m[1])).push(mod);
  }
}
const DECL = /^declare const ([A-Za-z_$][\w$]*): Loose;$/gm;
const uses = new Map();
for (const f of files) {
  for (const m of read(f).matchAll(DECL)) (uses.get(m[1]) || uses.set(m[1], []).get(m[1])).push(f);
}
const definer = name => {
  const mods = [...new Set(exporters.get(name) || [])];
  // 同名のファイルを優先（X.ts が X を export）
  return mods.includes(name) ? name : mods.length === 1 ? mods[0] : null;
};

const tsc = () => {
  const r = spawnSync(process.execPath, [path.join(STAGE, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.nico.json', '--noEmit'],
    {cwd: STAGE, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  return (r.stdout + r.stderr).split('\n').filter(l => / error TS\d+/.test(l));
};

const mode = process.argv[2] || '--report';
if (mode === '--report') {
  const rows = [...uses.entries()].map(([name, fs_]) => ({name, count: fs_.length, definer: definer(name)}))
    .sort((a, b) => b.count - a.count);
  for (const r of rows) console.log(String(r.count).padStart(4), r.name.padEnd(34), r.definer ? './' + r.definer : '(定義元なし: JS のみ・または複数)');
  console.log('合計', rows.reduce((s, r) => s + r.count, 0), '件 /', rows.length, '種類');
  process.exit(0);
}
if (mode === '--try') {
  const wanted = process.argv.slice(3);
  const baseline = tsc();
  if (baseline.length) { console.error('検査の開始時点で型エラーがある:\n' + baseline.slice(0, 20).join('\n')); process.exit(1); }
  const names = (wanted.length ? wanted : [...uses.keys()]).filter(n => uses.has(n) && definer(n));
  const results = [];
  for (const name of names) {
    const mod = definer(name);
    const targets = uses.get(name).filter(f => f.replace(/\.ts$/, '') !== mod);
    const backup = new Map(targets.map(f => [f, read(f)]));
    for (const f of targets) {
      fs.writeFileSync(path.join(SRC, f), read(f).replace(
        new RegExp(`^declare const ${name.replace(/\$/g, '\\$')}: Loose;$`, 'm'),
        `declare const ${name}: typeof import('./${mod}').${name};`));
    }
    const errors = tsc();
    if (errors.length) {
      for (const [f, text] of backup) fs.writeFileSync(path.join(SRC, f), text);
      results.push({name, mod, ok: false, errors: errors.length, sample: errors.slice(0, 3)});
      console.log(`NG ${name} (${errors.length})`);
    } else {
      results.push({name, mod, ok: true, files: targets.length});
      console.log(`OK ${name} → ./${mod} (${targets.length} files)`);
    }
  }
  fs.writeFileSync(path.join(STAGE, '.generated/type-loose-results.json'), JSON.stringify(results, null, 2));
  console.log('OK', results.filter(r => r.ok).length, '/ NG', results.filter(r => !r.ok).length);
}
