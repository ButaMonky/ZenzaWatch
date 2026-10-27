import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>readFileSync(resolve(root,relative),'utf8');
const digest=text=>createHash('sha256').update(text.replace(/\r\n/g,'\n')).digest('hex');
const manifest=JSON.parse(read('typescript-src/SETTINGS_TS_MANIFEST.json'));

test('TypeScript comment increase settings source is tracked as the canonical candidate',()=>{
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.tsSource,'typescript-src/settings.ts');
  assert.equal(manifest.runtime,'src/settings.mjs');
  assert.match(manifest.semanticSha256,/^[a-f0-9]{64}$/);
  assert.equal(manifest.tsSha256,digest(read(manifest.tsSource)));
  assert.equal(manifest.runtimeSha256,digest(read(manifest.runtime)));
});
test('TypeScript source exposes the nine stable settings identities',()=>{
  const ts=read(manifest.tsSource);
  const js=read(manifest.runtime);
  const names=['maxAdditionalComments','maxPages','maxRequests',
    'minIntervalMs','requestTimeoutMs','maxElapsedMs',
    'maxRetries','maxKeyRefreshes','includeEasy'];
  for(const name of names){
    assert.match(ts,new RegExp('\\b'+name+'\\b'));
    assert.match(js,new RegExp('\\b'+name+'\\b'));
  }
  assert.match(ts,/export interface CommentIncreaseSettings/);
});
