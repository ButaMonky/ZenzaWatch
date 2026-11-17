'use strict';
// Task1064: ビルドを ES モジュール＋バンドラへ移すための下準備。今のビルドが読むファイルが、
// ES モジュールとしてどれだけそのまま読めるかを tools/esm/esm-readiness.cjs で測り、悪くならないようにする。
// 計画と残りの課題: docs/design-pack/TASK1064_ESM_MIGRATION_PLAN.md
const assert = require('assert');
const {analyse} = require('../../tools/esm/esm-readiness.cjs');

// import していない外の名前（平坦なスコープ頼み）で、まだ残しているもの。増やさない。
const KNOWN_FREE = {
  'src/ZenzaContext.js': ['_product'],                                     // Task1070: monkey の引数（第5段階で起動の関数から渡す）
};
// ビルドに入っていない開発用の仮のファイル（ZenzaWatchIndex.js など）からの import の数。減らすだけ。
const OFF_GRAPH_LIMIT = 38;  // Task1069: global・ZenzaWatch を src/ZenzaContext から引くようにして 110 → 45、Task1070: PRODUCT・TOKEN も → 38

describe('Task1064 ES モジュールへの移行の下準備（esm-readiness）', function() {
  this.timeout(120000);
  let result;
  before(() => { result = analyse('src/_template.js'); });

  it('ビルドが読むファイルをすべて見つけられる', () => {
    assert.deepStrictEqual(result.missing, []);
    assert(result.files.length > 200, String(result.files.length));
    assert(result.files.includes('src/VideoSearchForm.js'));
  });
  it('本文で使う名前は import している（決めた例外だけ残す）', () => {
    const extra = [];
    for (const r of result.results) {
      assert(!r.error, r.file + ': ' + r.error);
      const allowed = new Set(KNOWN_FREE[r.file] || []);
      for (const name of r.free) { if (!allowed.has(name)) { extra.push(`${r.file}: ${name}`); } }
    }
    assert.deepStrictEqual(extra, [], '新しく import 漏れの名前がある:\n' + extra.join('\n'));
  });
  it('import した名前は import 先が export している', () => {
    const bad = result.results.flatMap(r => r.unexportedImports.map(x => `${r.file}: ${x}`));
    assert.deepStrictEqual(bad, []);
  });
  it('ビルドに入っていない仮のファイルからの import は増やさない', () => {
    const total = result.results.reduce((s, r) => s + r.offGraphImports.length, 0);
    assert(total <= OFF_GRAPH_LIMIT, `${total} > ${OFF_GRAPH_LIMIT}`);
  });
  it('Task1068: 1つのファイルの中で同じ名前を2か所から import しない（//@require の読み込み先が変わってしまう）', () => {
    // build.js は「//@require 名前」を、そのファイルの import で引いたファイルに置き換える。同じ名前を2か所から import すると
    // 後の方が勝ち、本来のファイル（例: util → src/util.js）が読み込まれなくなる（Task1068 で一度起きた。build は警告だけで通る）。
    const fs = require('fs');
    const path = require('path');
    const root = path.resolve(__dirname, '../..');
    const bad = [];
    for (const r of result.results) {
      const text = fs.readFileSync(path.join(root, r.file), 'utf8');
      const seen = new Map();
      for (const m of text.matchAll(/^\s*import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gm)) {
        for (const raw of m[1].split(',')) {
          const name = raw.trim().split(/\s+as\s+/).pop().trim();
          if (!name) { continue; }
          if (seen.has(name) && seen.get(name) !== m[2]) { bad.push(`${r.file}: ${name} (${seen.get(name)} / ${m[2]})`); }
          seen.set(name, m[2]);
        }
      }
    }
    assert.deepStrictEqual(bad, []);
  });
  it('Task1069: global・ZenzaWatch は src/ZenzaContext から import する（書き換え漏れが無い）', () => {
    const {spawnSync} = require('child_process');
    const path = require('path');
    const r = spawnSync(process.execPath, [path.resolve(__dirname, '../../tools/esm/rewrite-context-imports.cjs')], {encoding: 'utf8'});
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  });
  it('Task1071: 本体の部品をバンドラ（esbuild）で ES モジュールとして1つにまとめられる（エラー・警告なし）', function() {
    this.timeout(60000);
    const {spawnSync} = require('child_process');
    const path = require('path');
    const r = spawnSync(process.execPath, [path.resolve(__dirname, '../../tools/esm/bundle-check.cjs')], {encoding: 'utf8'});
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  });
  it('Task1074: 読み込んだ瞬間に「起動の時の中身」を使う文は、ファイルごとに基準より増やさない（起動の作り直し）', function() {
    this.timeout(60000);
    const fs = require('fs');
    const {audit, BASELINE} = require('../../tools/esm/startup-audit.cjs');
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).counts;
    const now = audit();
    const worse = Object.entries(now).filter(([f, list]) => list.length > (base[f] || 0))
      .map(([f, list]) => `${f}: ${base[f] || 0} → ${list.length}（${list.map(x => x.line + ':' + x.code).join(' / ')}）`);
    assert.deepStrictEqual(worse, [], '増えた（startup.add の中へ移す。docs/handoff/CODEX_STARTUP_REFACTOR.md）');
  });
  it('Task1074: startup.add の名前は重ならない', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.resolve(__dirname, '../..');
    const names = new Map();
    for (const r of result.results) {
      const text = fs.readFileSync(path.join(root, r.file), 'utf8');
      for (const m of text.matchAll(/^startup\.add\('([^']+)'/gm)) {
        assert(!names.has(m[1]), `${m[1]} が ${names.get(m[1])} と ${r.file} で重なっている`);
        names.set(m[1], r.file);
        assert.match(m[1], /^[A-Za-z0-9]+:[a-z0-9-]+$/, `名前は「部品名:用途」（例 VideoHoverMenu:style）: ${m[1]}`);
      }
    }
  });
  it('Task1074: startup を使う部品は、本体だけで使う部品（MylistPocket など他の配布物には入らない）', function() {
    this.timeout(60000);
    const fs = require('fs');
    const path = require('path');
    const root = path.resolve(__dirname, '../..');
    const users = result.results.map(r => r.file)
      .filter(f => f !== 'src/ZenzaContext.js' && /\bstartup\.add\(/.test(fs.readFileSync(path.join(root, f), 'utf8')));
    const bad = [];
    for (const f of fs.readdirSync(path.join(root, 'src')).filter(f => /^_.*\.js$/.test(f) && f !== '_template.js')) {
      let other;
      try { other = analyse('src/' + f); } catch (_) { continue; }
      for (const r of other.results) { if (users.includes(r.file)) { bad.push(`${r.file} は src/${f} にも入る`); } }
    }
    assert.deepStrictEqual(bad, [], '他の配布物には ZenzaContext の startup が無いので、その部品では startup.add を使わない');
  });
});
