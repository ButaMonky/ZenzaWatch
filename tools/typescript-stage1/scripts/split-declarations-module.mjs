#!/usr/bin/env node
// Task1063: 'declarations' 形の大きな nico-src モジュールを、上から順に連続した部分へ切り分ける道具（1回きりの作業用）。
//   node scripts/split-declarations-module.mjs <元の名前> <本文の開始行> <新しい名前>:<開始行> [...]
// 例: node scripts/split-declarations-module.mjs VideoInfoPanel 43 VideoHeaderPanel:1723 VideoSearchForm:2485
// - 元のファイルは「先頭の宣言部分 + 最初の部分」になり、残りはそれぞれ新しいファイルになる。
// - 各ファイルの declare は、そのファイルの本文で使う名前だけを残す。他の部分へ移ったものは
//   `declare const X: typeof import('./新しい名前').X;` で参照する。
// - 他の nico-src ファイルの `typeof import('./元の名前').X`（X が移ったもの）も付け替える。
// 生成される JS の中身（BEGIN〜END の本文）は、ビルドで同じ順に読み込めば分割前と同じになる。
// registry・テストの道具・ビルドの読み込み順は別に手で直す（docs/design-pack/TASK1063_LARGE_MODULE_SPLIT.md）。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const STAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(STAGE, 'nico-src');
const [orig, bodyStartArg, ...cutArgs] = process.argv.slice(2);
if (!orig || !bodyStartArg || !cutArgs.length) {
  console.error('使い方: split-declarations-module.mjs <元の名前> <本文の開始行> <名前>:<開始行> ...'); process.exit(2);
}
const file = path.join(SRC, orig + '.ts');
const lines = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
const bodyStart = Number(bodyStartArg);
const cuts = cutArgs.map(a => { const [name, line] = a.split(':'); return {name, line: Number(line)}; });
// 末尾の export ブロック（と export type）を探す
let tail = lines.length;
for (let i = lines.length - 1; i >= 0; i--) {
  if (/^export\s*\{/.test(lines[i])) { tail = i; break; }
}
while (tail > 0 && /^(export type |\/\*\* .*\*\/\s*$)/.test(lines[tail - 1])) { tail--; }
const tailText = lines.slice(tail).join('\n');
const exportBlock = tailText.match(/export\s*\{([^}]*)\}/);
const exported = exportBlock[1].split(',').map(s => s.trim()).filter(Boolean);
const exportTypes = [...tailText.matchAll(/^(\/\*\*.*\*\/\n)?export type [^\n]+$/gm)].map(m => m[0]);

const header = lines.slice(0, bodyStart - 1);
const parts = [{name: orig, from: bodyStart - 1}, ...cuts.map(c => ({name: c.name, from: c.line - 1}))];
parts.forEach((p, i) => { p.to = i + 1 < parts.length ? parts[i + 1].from : tail; p.body = lines.slice(p.from, p.to); });

const definedIn = body => {
  const names = new Set();
  for (const l of body) {
    const m = l.match(/^\s{0,2}(?:class|function)\s+([A-Za-z_$][\w$]*)/) || l.match(/^\s{0,2}(?:const|let)\s+([A-Za-z_$][\w$]*)\s*[:=]/);
    if (m) { names.add(m[1]); }
  }
  return names;
};
for (const p of parts) { p.defines = definedIn(p.body); }
const owner = new Map();
for (const p of parts) for (const n of p.defines) owner.set(n, p.name);

const uses = (text, name) => new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, '\\$')}\\b`).test(text);
const declareLines = header.filter(l => /^declare const [\w$]+:/.test(l));
const importTypeLines = header.filter(l => /^import type /.test(l));
const typeAliasLines = header.filter(l => /^(type|interface) [\w$]+/.test(l) && !/^type Loose\b/.test(l));

const build = p => {
  const text = p.body.join('\n');
  const isOrig = p.name === orig;
  const out = [];
  if (isOrig) {
    // 元のファイルは先頭の宣言部分をそのまま使い、declare だけ整える
    for (const l of header) {
      const m = l.match(/^declare const ([\w$]+):/);
      if (m && !uses(text, m[1])) { continue; }
      if (/^\/\/ legacy-to-ts: names provided by other bundled modules$/.test(l)) {
        out.push(l);
        for (const q of parts) {
          if (q === p) continue;
          for (const n of [...q.defines].sort()) {
            if (uses(text, n) && !declareLines.some(d => d.startsWith(`declare const ${n}:`))) {
              out.push(`declare const ${n}: typeof import('./${q.name}').${n};`);
            }
          }
        }
        continue;
      }
      out.push(l);
    }
  } else {
    out.push('/**', ` * Canonical TypeScript source for src/${p.name}.js (Task1063: ${orig}.ts から分割).`, ' */');
    for (const l of importTypeLines) {
      const names = l.replace(/^import type \{|\} from .*$/g, '').split(',').map(s => s.trim().split(/\s+as\s+/).pop());
      if (names.some(n => uses(text, n))) { out.push(l); }
    }
    out.push('/**', ' * Values that come from raw API/DOM records or from modules that are still JS; this one',
      ' * documented loose alias covers them.', ' */', '// eslint-disable-next-line @typescript-eslint/no-explicit-any', 'type Loose = any;');
    for (const l of typeAliasLines) {
      const n = l.match(/^(?:type|interface) ([\w$]+)/)[1];
      if (uses(text, n)) { out.push(l); }
    }
    out.push('// legacy-to-ts: names provided by other bundled modules');
    const declared = [];
    for (const l of declareLines) {
      const n = l.match(/^declare const ([\w$]+):/)[1];
      if (uses(text, n) && !p.defines.has(n)) { declared.push(l); }
    }
    for (const q of parts) {
      if (q === p) continue;
      for (const n of [...q.defines].sort()) {
        if (uses(text, n) && !declared.some(d => d.startsWith(`declare const ${n}:`))) {
          declared.push(`declare const ${n}: typeof import('./${q.name}').${n};`);
        }
      }
    }
    out.push(...declared.sort());
    out.push('');
  }
  out.push(...p.body);
  while (out.length && out[out.length - 1] === '') { out.pop(); }
  // 他の部分から参照される名前と、元々 export していた名前を export する
  const others = parts.filter(q => q !== p).map(q => q.body.join('\n')).join('\n');
  const names = [...p.defines].filter(n => exported.includes(n) || uses(others, n));
  // どの部分でも定義していない名前の export（他の部品の再 export。例: VideoControlBar の HeatMapWorker）は元のファイルに残す
  if (isOrig) { names.push(...exported.filter(n => !owner.has(n))); }
  const types = exportTypes.filter(t => [...p.defines].some(n => uses(t.replace(/^\/\*\*.*\*\/\n/, ''), n)));
  out.push('');
  if (types.length) { out.push(...types, ''); }
  out.push('export {', names.map(n => '  ' + n).join(',\n'), '};', '');
  return {text: out.join('\n'), names};
};

const results = parts.map(p => ({p, ...build(p)}));
for (const {p, text, names} of results) {
  fs.writeFileSync(path.join(SRC, p.name + '.ts'), text);
  console.log(`${p.name}.ts: ${text.split('\n').length} 行, export ${names.join(', ')}`);
}
// 他のファイルの参照を付け替える
const moved = new Map();
for (const {p, names} of results) if (p.name !== orig) for (const n of names) moved.set(n, p.name);
for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.ts'))) {
  const t = fs.readFileSync(path.join(SRC, f), 'utf8');
  let next = t;
  for (const [n, target] of moved) {
    next = next.replaceAll(`typeof import('./${orig}').${n}`, `typeof import('./${target}').${n}`)
      .replaceAll(`import('./${orig}').${n}`, `import('./${target}').${n}`);
  }
  if (next !== t) { fs.writeFileSync(path.join(SRC, f), next); console.log('参照を付け替え:', f); }
}
