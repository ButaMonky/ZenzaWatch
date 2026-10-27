// Task520 offline source identity checks. Does not need generated artifacts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>readFileSync(resolve(root,rel),'utf8');
const digest=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const manifest=JSON.parse(read('probe-src/PROBE_TS_MANIFEST.json'));

test('comment probe uses tracked typed source and unchanged deployed JS',()=>{
  assert.equal(manifest.schemaVersion,1);
  assert.equal(manifest.source,'probe-src/probe.ts');
  assert.equal(manifest.runtime,'src/probe.mjs');
  assert.equal(manifest.sourceSha256,digest(read(manifest.source)));
  assert.equal(manifest.runtimeSha256,digest(read(manifest.runtime)));
  assert.match(manifest.semanticSha256,/^[0-9a-f]{64}$/);
});
test('the TypeScript candidate preserves five bounded probe steps',()=>{
  const typed=read(manifest.source);
  const runtime=read(manifest.runtime);
  for(const name of ['baseline_all','main_only','res_from',
    'when_now','when_oldest']){
    assert(typed.includes("'"+name+"'"),name+' typed source');
    assert(runtime.includes("'"+name+"'"),name+' deployed runtime');
  }
  assert(typed.includes("export interface ProbeOptions"));
  assert(typed.includes("export interface ProbeReport"));
  assert(typed.includes("maxRequests:5"));
});
test('probe retains explicit no-complete-coverage and bounded I/O contracts',()=>{
  const ts=read(manifest.source);
  const js=read(manifest.runtime);
  for(const text of ['completeCoverageVerified:false',
    'integerOption(intervalMs,0,60000)',
    'integerOption(timeoutMs,1,30000)',
    'abortableDelay(intervalMs,signal)',
    'assertNotCancelled(signal)']){
    assert(ts.includes(text),'typed source '+text);
    assert(js.includes(text),'deployed runtime '+text);
  }
});
