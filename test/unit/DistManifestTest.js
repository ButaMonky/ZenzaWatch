// Task 087（監査v2 ZW-006）: すべての dist/*.user.js が dist-manifest.json で
// active（npm run build でソースから生成）か legacy-frozen（旧作者の成果物をそのまま保持・SHA-256 で固定）の
// どちらかとして管理され、未分類の配布物が無いことの回帰テスト。
// 監査の acceptance「READMEの手順だけで全成果物を生成」は、「全 dist が active か legacy-frozen として明示的に管理され、
// 未分類が無い」に変更した（94・95番の設計文書）。legacy-frozen の3つは今回削除しない（OPS-7・INV-13）。
import assert from 'power-assert';
import fs from 'fs';
import path from 'path';

const {REPO_ROOT} = require('../helpers/buildSandbox');
const {checkDistManifest, buildOutputs} = require('../helpers/distManifest');

const read = rel => fs.readFileSync(path.join(REPO_ROOT, rel));
const loadDist = () => {
  const out = {};
  for (const f of fs.readdirSync(path.join(REPO_ROOT, 'dist'))) {
    if (f.endsWith('.user.js')) { out[`dist/${f}`] = read(`dist/${f}`); }
  }
  return out;
};

describe('配布物の分類 dist-manifest.json（ZW-006）', function() {
  let manifest;
  let buildJs;
  let dist;
  beforeEach(function() {
    manifest = JSON.parse(read('dist-manifest.json').toString('utf-8'));
    buildJs = read('build.js').toString('utf-8');
    dist = loadDist();
  });

  it('今の dist は active 10本・legacy-frozen 3本に分類され、未分類が無く、legacy の SHA-256 が一致する', function() {
    assert.deepEqual(checkDistManifest(manifest, buildJs, dist), []);
    assert.equal(manifest.active.files.length, 10);
    assert.deepEqual(manifest.legacyFrozen.files.map(e => e.file).sort(),
      ['dist/MylistFilter.user.js', 'dist/WatchDump.user.js', 'dist/ZenzaWatch.user.js']);
    assert.equal(buildOutputs(buildJs).length, 10);
  });

  it('legacy-frozen の中身が1バイトでも変わったら失敗する（改行コードの CRLF 化だけは同じとみなす）', function() {
    const f = 'dist/WatchDump.user.js';
    const changed = {...dist, [f]: Buffer.concat([dist[f], Buffer.from('\n')])};
    assert.ok(checkDistManifest(manifest, buildJs, changed).some(e => e.includes(f) && e.includes('SHA-256')));
    const crlf = {...dist, [f]: Buffer.from(dist[f].toString('latin1').replace(/\r?\n/g, '\r\n'), 'latin1')};
    assert.deepEqual(checkDistManifest(manifest, buildJs, crlf), []);
  });

  it('未分類の dist/*.user.js が増えたら失敗する', function() {
    const added = {...dist, 'dist/Unknown.user.js': Buffer.from('// ==UserScript==\n')};
    assert.ok(checkDistManifest(manifest, buildJs, added).some(e => e.includes('dist/Unknown.user.js') && e.includes('未分類')));
  });

  it('active な配布物を legacy-frozen に誤分類したら失敗する', function() {
    const moved = JSON.parse(JSON.stringify(manifest));
    const entry = moved.active.files.splice(moved.active.files.findIndex(e => e.file === 'dist/HeatSync.user.js'), 1)[0];
    moved.legacyFrozen.files.push({file: entry.file, sha256: 'x', userscript: {}});
    const errors = checkDistManifest(moved, buildJs, dist);
    assert.ok(errors.some(e => e.includes('dist/HeatSync.user.js') && e.includes('legacy-frozen に分類')), errors.join('\n'));
  });

  it('active・legacy-frozen の予定の配布物が dist から消えても失敗する', function() {
    const missing = {...dist};
    delete missing['dist/uQuery.user.js'];
    delete missing['dist/MylistFilter.user.js'];
    const errors = checkDistManifest(manifest, buildJs, missing);
    assert.ok(errors.some(e => e.startsWith('dist/uQuery.user.js')), errors.join('\n'));
    assert.ok(errors.some(e => e.startsWith('dist/MylistFilter.user.js')), errors.join('\n'));
  });

  it('build.js に新しいテンプレートを足したのに manifest を直さないと失敗する', function() {
    const more = buildJs.replace("  // { src: '_my4.js'", "  { src: '_new.js', dist: 'dist/New.user.js', dev: false },\n  // { src: '_my4.js'");
    assert.ok(checkDistManifest(manifest, more, dist).some(e => e.includes('dist/New.user.js')));
  });
});
