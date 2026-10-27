// Task526: offline source/manifest integrity; production code is never replaced.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');

test('Task526 typed Zenza adapter matches pinned non-deployed runtime',()=>{
  const manifest=JSON.parse(read('context-src/ZENZA_CONTEXT_TS_MANIFEST.json'));
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.source,'context-src/zenza-context.ts');
  assert.equal(manifest.runtime,'src/zenza-context.mjs');
  assert.equal(manifest.sourceSha256,sha(read(manifest.source)));
  assert.equal(manifest.runtimeSha256,sha(read(manifest.runtime)));
  assert.match(manifest.semanticSha256,/^[a-f0-9]{64}$/);
});
test('Task526 keeps typed API and runtime adapter boundaries',()=>{
  const source=read('context-src/zenza-context.ts');
  const runtime=read('src/zenza-context.mjs');
  for(const item of ['createZenzaSeed','toZenzaThreads','normalizeWatch','validateThreads',
    'playbackGeneration','normalRevision','historyStartWhen','isWaybackMode']){
    assert(source.includes(item),'Typed source lacks: '+item);
    assert(runtime.includes(item),'Runtime lacks: '+item);
  }
  assert(!source.includes('console.log('));
  assert(!source.includes('fetch('));
});
