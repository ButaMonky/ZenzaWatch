import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const stage=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const compiler=resolve(stage,'node_modules/typescript/bin/tsc');
test('NicoChatCss3View: strict renderer and typed input/output contract',()=>{
  const result=spawnSync(process.execPath,
    [compiler,'--project','tsconfig.comment-chatcss.strict.json'],{
    cwd:stage,windowsHide:true,encoding:'utf8'
  });
  assert.equal(result.status,0,(result.stdout||'')+'\n'+(result.stderr||''));
});
