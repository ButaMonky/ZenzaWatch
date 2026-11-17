#!/usr/bin/env node
// Task1063: クラスのメソッドの一部を「役割オブジェクト」（Task1060 の NicoVideoPlayerDialog と同じ形）へ移す道具（作業用）。
//   node scripts/extract-class-role.mjs <ファイル名> <クラス名> <役割の名前> "<説明>" <メソッド名> [...]
// - メソッドは 2 文字下げの `  name(...) {` 〜 `  }` を、直前のコメントごと移す（本文は1文字も変えない）。
// - 先頭の引数に `this: <型名>` を足す。静的メソッド・get/set は移さない（クラスに残す）。
// - 元のクラスの末尾に、取り付けの for 文・型のマージ・declare を足す（既にあれば役割を追加する）。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const STAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(STAGE, 'nico-src');
const [baseName, className, roleName, description, ...methods] = process.argv.slice(2);
const basePath = path.join(SRC, baseName + '.ts');
let lines = fs.readFileSync(basePath, 'utf8').replace(/\r\n/g, '\n').split('\n');
const classStart = lines.findIndex(l => new RegExp(`^class ${className}\\b`).test(l));
const classEnd = lines.findIndex((l, i) => i > classStart && l === '}');
if (classStart < 0 || classEnd < 0) { throw Error('クラスが見つからない: ' + className); }
const alias = className === 'NicoVideoPlayerDialogView' ? 'View' : className;

const blocks = [];
for (const name of methods) {
  const re = new RegExp(`^  (?:async )?${name.replace(/\$/g, '\\$')}\\(`);
  const start = lines.findIndex((l, i) => i > classStart && i < classEnd && re.test(l));
  if (start < 0) { throw Error('メソッドが見つからない: ' + name); }
  let end = start;
  while (end < classEnd && lines[end] !== '  }') { end++; }
  if (lines[end] !== '  }') { throw Error('メソッドの終わりが見つからない: ' + name); }
  let head = start;
  while (head - 1 > classStart && /^  (\/\/|\/\*\*|\*| \*|\*\/)/.test(lines[head - 1])) { head--; }
  blocks.push({name, head, start, end});
}
blocks.sort((a, b) => a.head - b.head);
const moved = [];
for (const b of blocks) {
  const body = lines.slice(b.head, b.end + 1);
  const sigIndex = b.start - b.head;
  body[sigIndex] = body[sigIndex].replace(new RegExp(`^(  (?:async )?${b.name.replace(/\$/g, '\\$')})\\((\\)?)`),
    (m, pre, close) => close ? `${pre}(this: ${alias})` : `${pre}(this: ${alias}, `);
  body[body.length - 1] = '  },';
  moved.push(...body);
}
// 元から取り除く（後ろから）
for (const b of [...blocks].reverse()) { lines.splice(b.head, b.end - b.head + 1); }
// 空行が3つ以上続くところを詰める
lines = lines.filter((l, i, a) => !(l === '' && a[i - 1] === '' && a[i - 2] === ''));

// 役割のファイル
const header = fs.readFileSync(basePath, 'utf8').split('\n');
const declares = header.filter(l => /^declare const [\w$]+:/.test(l) || /^import type /.test(l) || /^type (?!Loose\b)[\w$]+ =/.test(l));
const text = moved.join('\n');
const uses = n => new RegExp(`(^|[^\\w$.])${n.replace(/\$/g, '\\$')}\\b`).test(text);
const keep = declares.filter(l => {
  const m = l.match(/^declare const ([\w$]+):/) || l.match(/^type ([\w$]+) =/);
  if (m) { return uses(m[1]); }
  const names = l.replace(/^import type \{|\} from .*$/g, '').split(',').map(s => s.trim().split(/\s+as\s+/).pop());
  return names.some(uses);
});
const role = [
  '/**',
  ` * Canonical TypeScript source for src/${roleName}.js (Task1063: ${baseName}.ts から役割ごとに分割).`,
  ` * ${description}`,
  ` * ${className}.prototype へそのまま取り付ける（クラスのメソッドと同じく列挙されない）。`,
  ' */',
  ...keep.filter(l => l.startsWith('import type ')),
  '/**', ' * Values that come from raw API/DOM records or from modules that are still JS; this one',
  ' * documented loose alias covers them.', ' */',
  '// eslint-disable-next-line @typescript-eslint/no-explicit-any', 'type Loose = any;',
  ...keep.filter(l => l.startsWith('type ')),
  `// 本体のクラス（実行時は同じスコープにある）。`,
  `type ${alias} = import('./${baseName}').${className};`,
  ...(uses(className) ? [`declare const ${className}: typeof import('./${baseName}').${className};`] : []),
  '// legacy-to-ts: names provided by other bundled modules',
  ...keep.filter(l => l.startsWith('declare const ') && !l.startsWith(`declare const ${className}:`)),
  '',
  `/** ${description} */`,
  `const ${roleName} = {`,
  ...moved,
  '};',
  '',
  `export {${roleName}};`,
  ''
].join('\n');
fs.writeFileSync(path.join(SRC, roleName + '.ts'), role);

// 元のファイル: declare と取り付け
const out = lines.join('\n');
let next = out.replace('// legacy-to-ts: names provided by other bundled modules\n',
  `declare const ${roleName}: typeof import('./${roleName}').${roleName};\n// legacy-to-ts: names provided by other bundled modules\n`);
const rolesType = `${className}RoleMethods`;
const loopRe = new RegExp(`for \\(const role of \\[([^\\]]*)\\]\\) \\{\\n  for \\(const \\[key, descriptor\\] of Object\\.entries\\(Object\\.getOwnPropertyDescriptors\\(role\\)\\)\\) \\{\\n    Object\\.defineProperty\\(${className}\\.prototype`);
if (loopRe.test(next)) {
  next = next.replace(loopRe, (m, list) => m.replace(`[${list}]`, `[${list}, ${roleName}]`));
  next = next.replace(new RegExp(`(type ${rolesType} = [^;]*);`), `$1 &\n  typeof ${roleName};`);
} else {
  const ls = next.split('\n');
  const end = ls.findIndex((l, i) => i > ls.findIndex(x => new RegExp(`^class ${className}\\b`).test(x)) && l === '}');
  ls.splice(end + 1, 0,
    `// Task1063: 役割ごとのファイルへ分けたメソッドを、クラスのメソッドと同じく列挙されない形で取り付ける。`,
    `type ${rolesType} = typeof ${roleName};`,
    `// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging`,
    `interface ${className} extends ${rolesType} {}`,
    `for (const role of [${roleName}]) {`,
    `  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(role))) {`,
    `    Object.defineProperty(${className}.prototype, key, {...descriptor, enumerable: false});`,
    `  }`,
    `}`);
  next = ls.join('\n');
}
fs.writeFileSync(basePath, next);
console.log(`${roleName}.ts: ${role.split('\n').length} 行（${methods.length} メソッド）/ ${baseName}.ts: ${next.split('\n').length} 行`);
