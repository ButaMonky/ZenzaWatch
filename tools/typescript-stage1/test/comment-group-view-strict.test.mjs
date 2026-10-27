import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const stage=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('Task701 NicoChatGroupViewModel: strict group/worker contracts',()=>{
  const result=spawnSync(process.execPath,
    [resolve(stage,'node_modules/typescript/bin/tsc'),
      '--project','tsconfig.comment-group-view.strict.json'],
    {cwd:stage,windowsHide:true,encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
