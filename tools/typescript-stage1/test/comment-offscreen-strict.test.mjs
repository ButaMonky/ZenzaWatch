import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const stage=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const compiler=resolve(stage,'node_modules/typescript/bin/tsc');
test('OffscreenLayer: strict source and consumer contract',()=>{
  const result=spawnSync(process.execPath,[compiler,'--project',
    'tsconfig.comment-offscreen.strict.json'],{
    cwd:stage,windowsHide:true,encoding:'utf8'
  });
  assert.equal(result.status,0,(result.stdout||'')+'\n'+(result.stderr||''));
});
test('OffscreenLayer: linked parser is included in the strict compiler graph',()=>{
  const config=JSON.parse(readFileSync(resolve(stage,'tsconfig.comment-offscreen.strict.json'),'utf8'));
  assert.notEqual(config.compilerOptions.noResolve,true,'dependency resolution must be enabled');
  const result=spawnSync(process.execPath,[compiler,
    '--project','tsconfig.comment-offscreen.strict.json','--listFilesOnly'],{
    cwd:stage,windowsHide:true,encoding:'utf8'
  });
  assert.equal(result.status,0,(result.stdout||'')+'\n'+(result.stderr||''));
  assert.match(result.stdout,/comment-src[\\/]OffscreenLayer\.ts/);
  assert.match(result.stdout,/comment-src[\\/]NicoTextParser\.ts/);
});
