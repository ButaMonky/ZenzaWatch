// Task521: tracked source fingerprints without a compiler or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const manifest=JSON.parse(read('layers-src/LAYERS_TS_MANIFEST.json'));

test('LayeredCommentStore TS candidate and current JS share pinned fingerprints',()=>{
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.source,'layers-src/layers.ts');
  assert.equal(manifest.runtime,'src/layers.mjs');
  assert.equal(manifest.sourceSha256,sha(read(manifest.source)));
  assert.equal(manifest.runtimeSha256,sha(read(manifest.runtime)));
  assert.match(manifest.semanticSha256,/^[a-f0-9]{64}$/);
});
test('normal wins over additional history and counters remain distinct in TS candidate',()=>{
  const ts=read(manifest.source);
  const js=read(manifest.runtime);
  for(const key of ['#normalCount','#historyCount','#overlapCount',
    '#additionalOrder','historyOnly','historyEnabled','historyLimit',
    'addNormal','addHistory','removeHistory','restoreAdditionalOrder']){
    assert(ts.includes(key),'typed source: '+key);
    assert(js.includes(key),'legacy runtime: '+key);
  }
  assert(ts.includes('export interface LayerCounts'));
  assert(ts.includes('export interface LayerAppendResult'));
});
test('source retains previous-order prefix semantics and 50000 bound',()=>{
  const ts=read(manifest.source);
  const js=read(manifest.runtime);
  for(const invariant of ['integerOption(allowance,0,50000)',
    'integerOption(historyLimit,0,50000)',
    'this.#additionalOrder.push(k)',
    'this.#normalMeta','this.#historyMeta']){
    assert(ts.includes(invariant),'typed source missing '+invariant);
    assert(js.includes(invariant),'runtime missing '+invariant);
  }
});
