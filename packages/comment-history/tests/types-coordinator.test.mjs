// Task522: source integrity guard for the strict TypeScript request coordinator.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {checkCoordinator,currentFingerprints} from '../tools/check-coordinator-typescript.mjs';
const require=createRequire(import.meta.url);
const parse=require('@babel/parser');
const print=require('@babel/generator').default;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
// Recompile from a clean checkout; never rely on ignored stale output files.
// This isolated compiler destination is disjoint from the other TS lanes.
for(const project of ['tsconfig.coordinator.json','tsconfig.coordinator.contract.json']){
  const compiler=resolve(root,'node_modules/typescript/bin/tsc');
  const result=spawnSync(process.execPath,[compiler,'-p',resolve(root,project)],{
    cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:1024*1024
  });
  assert.equal(result.status,0,'Coordinator TS compile '+project+' failed: '+
    String(result.stdout||result.stderr||result.error||''));
}
const read=rel=>readFileSync(resolve(root,rel),'utf8');
const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const canon=s=>print(parse.parse(s,{sourceType:'module',
  plugins:['classPrivateMethods','classPrivateProperties','classProperties']
}).program,{compact:true,comments:false}).code;
const manifestRel='coordinator-src/COORDINATOR_TS_MANIFEST.json';

test('Task522 TypeScript request coordinator manifest locks the intended runtime',()=>{
  const m=JSON.parse(read(manifestRel));
  assert.equal(m.schemaVersion,1);
  assert.equal(m.source,'coordinator-src/coordinator.ts');
  assert.equal(m.runtime,'src/coordinator.mjs');
  assert.equal(m.sourceSha256,sha(read(m.source)));
  assert.equal(m.runtimeSha256,sha(read(m.runtime)));
  assert.match(m.semanticSha256,/^[a-f0-9]{64}$/);
});
test('Task522 emitted JS is AST identical to current deployment',()=>{
  const m=JSON.parse(read(manifestRel));
  const compiled=read('.generated-ts/coordinator/coordinator.js');
  assert.equal(canon(compiled),canon(read(m.runtime)));
  assert.equal(m.semanticSha256,sha(canon(compiled)));
  assert.deepEqual(checkCoordinator('--check'),m);
  assert.deepEqual(currentFingerprints(),m);
});
test('Task522 source limits request types to metadata, comment and key',()=>{
  const ts=read('coordinator-src/coordinator.ts');
  assert.match(ts,/export type RequestKind = 'metadata' \| 'comment' \| 'key'/);
  assert.match(ts,/export interface CoordinatorRetryEvent/);
  assert.match(ts,/export interface CoordinatorRunOptions/);
  assert.match(ts,/export interface CoordinatorStatistics/);
  assert(!ts.includes('@ts-nocheck'));
  assert(!ts.includes('//@require'));
});
test('Task522 unsupported write mode returns failure without editing the deployed JS',()=>{
  const before=sha(read('src/coordinator.mjs'));
  const proc=spawnSync(process.execPath,
    [resolve(root,'tools/check-coordinator-typescript.mjs'),'--remove'],{
      cwd:root,windowsHide:true,encoding:'utf8',maxBuffer:50000
    });
  assert.equal(proc.status,1);
  assert.match(proc.stderr,/COORDINATOR_INVALID_MODE/);
  assert.equal(sha(read('src/coordinator.mjs')),before);
});
