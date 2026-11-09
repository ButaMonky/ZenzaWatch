// Task212: Five source-only promotions plus three narrowly guarded entry modules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const strict=read('tsconfig.nico.json'),legacy=read('tsconfig.nico-legacy.json');
const promoted=['BaseCommandElement','CommentInputPanel','TagListView',
  'SettingPanelElement','VideoControlBar','HeatSyncEntry','UQueryEntry','initializer'];
test('#212 promoted modules remain strictly checked with canonical generator provenance',()=>{
  assert.equal(strict.exclude.length,11);
  assert.equal(legacy.files.length,11);
  for(const n of promoted){
    assert(!strict.exclude.includes('nico-src/'+n+'.ts'),'still excluded '+n);
    assert(!legacy.files.includes('nico-src/'+n+'.ts'),'still relaxed '+n);
    const m=read('nico-api-manifests/'+n+'.json');
    assert.equal(m.source,'tools/typescript-stage1/nico-src/'+n+'.ts');
    assert.match(m.sourceSha256,/^[0-9a-f]{64}$/);
    assert.match(m.runtimeSha256,/^[0-9a-f]{64}$/);
  }
});
