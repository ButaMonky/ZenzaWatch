// Task1061: `declare const X: Loose` を本物の型に置き換えた結果を守る。
// - Loose のまま残っている共有物の数は増やさない（ラチェット）
// - 別ステージから写した型（nico-src/external）が元と一致している
// - 手書きの共有型（nico-src/shared-types）が実物の JS と食い違っていない
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const STAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(STAGE, '../..');
const SRC = path.join(STAGE, 'nico-src');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// 302件・132種類（Task1060 時点）→ 12種類。JS にしか無い部品（ZenzaWatch・dll・Config など）と、
// 静的プロパティを後から足している NicoComment / NicoChatViewModel だけが残っている。
// Task1063: ファイルを分けると同じ名前の declare が増えるので、件数ではなく名前の種類で数える。
const LOOSE_DECLARE_NAMES = new Set(['ZenzaWatch', 'dll', 'ZenzaCommentHistoryCore', 'OfficialPlayerRoute',
  'ZenzaDetector', 'initializeGinzaSlayer', 'ThumbnailSourcePolicy', 'RequestAnimationFrame', 'NicoComment',
  'NicoChatViewModel', 'NICORU']);

test('Loose のままの共有物（declare const X: Loose）の種類は増やさない', () => {
  const found = new Map();
  for (const f of fs.readdirSync(SRC).filter(f => f.endsWith('.ts'))) {
    for (const m of fs.readFileSync(path.join(SRC, f), 'utf8').matchAll(/^declare const ([\w$]+): Loose;/gm)) {
      (found.get(m[1]) || found.set(m[1], []).get(m[1])).push(f);
    }
  }
  const extra = [...found.keys()].filter(n => !LOOSE_DECLARE_NAMES.has(n));
  assert.deepEqual(extra, [], `型を付けずに参照している共有物が増えた。型のある部品は typeof import('./X').X で参照する:\n` +
    extra.map(n => `${n}: ${found.get(n).join(', ')}`).join('\n'));
});

test('nico-src/external の型は別ステージの元ファイルから作り直したものと一致する', () => {
  const r = spawnSync(process.execPath, [path.join(STAGE, 'scripts/gen-external-types.mjs'), '--check'],
    {cwd: STAGE, encoding: 'utf8'});
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /EXTERNAL_TYPES=PASS/);
});

test('shared-types/Constant.d.ts のキーは src/constant.js の CONSTANT と同じ', () => {
  const js = read('src/constant.js');
  const body = js.slice(js.indexOf('const CONSTANT = {'), js.indexOf('\n};', js.indexOf('const CONSTANT = {')));
  const keys = new Set([
    ...[...body.matchAll(/^ {2}([A-Z_]+):/gm)].map(m => m[1]),
    ...[...js.matchAll(/^CONSTANT\.([A-Z_]+) =/gm)].map(m => m[1]),
  ]);
  const dts = fs.readFileSync(path.join(SRC, 'shared-types/Constant.d.ts'), 'utf8');
  const typed = new Set([...dts.matchAll(/^ {2}([A-Z_]+):/gm)].map(m => m[1]));
  assert.deepEqual([...typed].sort(), [...keys].sort());
});

test('shared-types/ZenzaUtil.d.ts は src/util.js が util に直接足す名前をすべて持つ', () => {
  const js = read('src/util.js');
  const assigned = [...new Set([...js.matchAll(/^util\.([\w$]+) =/gm)].map(m => m[1]))];
  const dts = fs.readFileSync(path.join(SRC, 'shared-types/ZenzaUtil.d.ts'), 'utf8');
  const missing = assigned.filter(name => !new RegExp('^ {2}' + name.replaceAll('$', '\\$') + '\\??[:(]', 'm').test(dts));
  assert.deepEqual(missing, []);
  // Object.assign でまとめている部品も同じ並びで型に入っている
  const merged = [...js.matchAll(/^Object\.assign\(util, (\w+)\);/gm)].map(m => m[1]);
  assert.deepEqual(merged, ['css', 'textUtil', 'nicoUtil', 'messageUtil', 'env', 'netUtil', 'domEvent']);
});

test('shared-types/Lodash.d.ts の関数は配布物が @require する lodash 4 にすべて存在する', () => {
  const template = read('src/_template.js');
  const version = template.match(/lodash@([\d.]+)\/lodash\.min\.js/)[1];
  const lodash = createRequire(path.join(ROOT, 'package.json'))('lodash');
  assert.equal(lodash.VERSION, version, 'テストに使う lodash と配布物の @require の版がずれている');
  const dts = fs.readFileSync(path.join(SRC, 'shared-types/Lodash.d.ts'), 'utf8');
  const iface = dts.slice(dts.indexOf('export interface LodashSubset'));
  const names = [...iface.matchAll(/^ {2}(\w+)[<(]/gm)].map(m => m[1]);
  assert.ok(names.length >= 10);
  for (const name of names) {
    assert.equal(typeof lodash[name], 'function', `lodash.${name} が無い`);
  }
  // Task1061 で見つけた不具合: lodash 4 には contains が無い（HeatSync の設定初期化で TypeError になっていた）
  assert.equal(lodash.contains, undefined);
  assert.doesNotMatch(fs.readFileSync(path.join(SRC, 'HeatSyncEntry.ts'), 'utf8'), /_\.contains\(/);
});

test('Task1073: shared-types/ZenzaConfig.d.ts のメソッドは DataStorage（と橋渡しした Emitter）にすべてある', () => {
  const dts = read('tools/typescript-stage1/nico-src/shared-types/ZenzaConfig.d.ts');
  const body = dts.slice(dts.indexOf('export interface ZenzaConfig {'));
  const methods = [...body.matchAll(/^\s+([a-zA-Z]+)\(/gm)].map(m => m[1]);
  assert(methods.length >= 15, methods.join(','));
  const storage = read('packages/lib/src/infra/DataStorage.js');
  const emitter = read('packages/lib/src/Emitter.js');
  const has = name => new RegExp(`^\\s+(?:async\\s+)?${name}\\s*\\(`, 'm').test(storage) ||
    new RegExp(`^\\s+(?:async\\s+)?${name}\\s*\\(`, 'm').test(emitter);
  assert.deepEqual(methods.filter(name => !has(name)), []);
  for (const field of ['props', 'default', 'storage']) {
    assert.match(storage, new RegExp(`this\\.${field} = `), field);
  }
});
