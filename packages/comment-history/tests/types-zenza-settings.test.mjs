import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical} from '../tools/check-typescript-settings.mjs';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>readFileSync(resolve(base,rel),'utf8');
const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const manifest=JSON.parse(read('zenza-settings-src/ZENZA_SETTINGS_TS_MANIFEST.json'));
test('Task524: Zenza setting repository source and runtime SHA are fixed',()=>{
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.source,'zenza-settings-src/zenza-settings.ts');
  assert.equal(manifest.runtime,'src/zenza-settings.mjs');
  assert.equal(manifest.sourceSha256,sha(read(manifest.source)));
  assert.equal(manifest.runtimeSha256,sha(read(manifest.runtime)));
  assert.equal(manifest.semanticSha256,sha(canonical(read(manifest.runtime))));
});
test('Task524: typed source preserves only feature-prefixed persistence operations',()=>{
  const text=read(manifest.source);
  for(const key of ['ZenzaWatch_','SETTINGS_SCHEMA','SETTINGS_CONFLICT',
    'SETTINGS_WRITE','rollbackComplete']){
    assert(text.includes(key),'missing source contract '+key);
  }
  assert.match(text,/interface FeatureStorage/);
  assert.match(text,/interface FeatureChangeBus/);
});
