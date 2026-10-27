import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFileSync(resolve(root,relative),'utf8');
const hash=value=>createHash('sha256')
  .update(value.replace(/\r\n/g,'\n')).digest('hex');
const manifest=JSON.parse(read('typescript-src/BROWSER_PREFERENCES_TS_MANIFEST.json'));

test('browser bridge TS and shipped JS stay owned by a verified immutable manifest',()=>{
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.source,'typescript-src/browser-preferences.ts');
  assert.equal(manifest.runtime,'src/browser-preferences.mjs');
  assert.match(manifest.semanticSha256,/^[a-f0-9]{64}$/);
  assert.equal(manifest.sourceSha256,hash(read(manifest.source)));
  assert.equal(manifest.runtimeSha256,hash(read(manifest.runtime)));
});
test('browser bridge TypeScript defines typed storage and event boundaries',()=>{
  const source=read(manifest.source);
  const runtime=read(manifest.runtime);
  for(const key of ['commentHistory.enabled','commentHistory.',
    'ZenzaWatch-comment-history-settings','storage','subscribe']){
    assert(source.includes(key),key+' in canonical TS');
    assert(runtime.includes(key),key+' in deployed JS');
  }
  assert.match(source,/export interface BrowserHistorySnapshot/);
  assert.match(source,/export interface BrowserHistoryConfig/);
  assert.match(source,/export interface BrowserHistoryPreferences/);
  assert(!source.includes('ts-nocheck'),'strict compilation may not be bypassed');
});
