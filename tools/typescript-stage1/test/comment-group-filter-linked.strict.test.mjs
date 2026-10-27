import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const stage=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const tsc=resolve(stage,'node_modules/typescript/bin/tsc');
test('Task704 group/filter linked strict type contract',()=>{
  const result=spawnSync(process.execPath,[tsc,'--project',
    'tsconfig.comment-group-filter-linked.strict.json'],{
    cwd:stage,encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
test('Task704 graph imports both real typed modules',()=>{
  const result=spawnSync(process.execPath,[tsc,'--project',
    'tsconfig.comment-group-filter-linked.strict.json','--listFilesOnly'],{
    cwd:stage,encoding:'utf8',windowsHide:true});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/comment-src[\\/]NicoChatGroup\.ts/);
  assert.match(result.stdout,/comment-src[\\/]NicoChatFilter\.ts/);
});
