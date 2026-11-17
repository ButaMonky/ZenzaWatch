'use strict';
// Task1064: ビルドを ES モジュール＋バンドラへ移すための下準備。今のビルドが読むファイルが、
// ES モジュールとしてどれだけそのまま読めるかを tools/esm/esm-readiness.cjs で測り、悪くならないようにする。
// 計画と残りの課題: docs/design-pack/TASK1064_ESM_MIGRATION_PLAN.md
const assert = require('assert');
const {analyse} = require('../../tools/esm/esm-readiness.cjs');

// import していない外の名前（平坦なスコープ頼み）で、まだ残しているもの。増やさない。
const KNOWN_FREE = {
  'src/UiVisibilityRegistry.js': ['SHORTCUT_ACTIONS', 'formatKeyCombo'],   // advanced-src の生成物（第2段階）
  'src/ModernAdvancedSettingsUI.js': ['NgCompositeRuleEditor'],            // 同上
  'src/_setting.js': ['StoryboardCacheDb'],                                // 同上
  'src/CommentPanel.js': ['NICORU'],                                       // _template.js の中の定数（第3段階）
  'packages/zenza/src/Playlist/VideoListView.js': ['global'],              // 同上
  'packages/zenza/src/Playlist/PlayList.js': ['global'],
};
// ビルドに入っていない開発用の仮のファイル（ZenzaWatchIndex.js など）からの import の数。減らすだけ。
const OFF_GRAPH_LIMIT = 110;

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
});
