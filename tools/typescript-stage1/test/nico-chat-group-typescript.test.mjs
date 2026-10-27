// Task578: typed group-membership source without changing legacy runtime imports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalJs,directiveList} from '../scripts/sync-advanced.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const source=readFileSync(resolve(repo,
  'tools/typescript-stage1/comment-src/NicoChatGroup.ts'),'utf8');
const runtime=readFileSync(resolve(repo,
  'packages/zenza/src/commentLayer/NicoChatGroup.js'),'utf8');
const tsc=resolve(repo,'tools/typescript-stage1/node_modules/typescript/bin/tsc');
function compile(t,sourceText){
  const scratch=mkdtempSync(join(tmpdir(),'zchatgroup-ts-'));
  t.after(()=>rmSync(scratch,{recursive:true,force:true}));
  const input=resolve(scratch,'NicoChatGroup.ts');
  writeFileSync(input,sourceText);
  execFileSync(process.execPath,[tsc,'--noCheck','--target','ES2022',
    '--module','ESNext','--moduleResolution','Bundler',
    '--removeComments','false','--verbatimModuleSyntax','--outDir',scratch,input],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
  return readFileSync(resolve(scratch,'NicoChatGroup.js'),'utf8');
}
test('NicoChatGroup canonical source retains filter and emitter dependency identities',()=>{
  assert(source.includes("import {Emitter} from '../../../lib/src/Emitter'"));
  assert(source.includes("import {NicoChatFilter} from './NicoChatFilter'"));
  assert(source.includes('export interface NicoGroupFilter'));
  assert(source.includes('export {NicoChatGroup};'));
});
test('native TypeScript emits identical group-filter runtime AST and directives',t=>{
  const output=compile(t,source);
  assert.equal(canonicalJs(output),canonicalJs(runtime));
  assert.deepEqual(directiveList(output),directiveList(runtime));
});
test('an accidental member deletion behavior change fails parity',t=>{
  const changed=source.replace('this._members.splice(index,1)',
    'this._members.splice(index,2)');
  assert.notEqual(changed,source);
  assert.notEqual(canonicalJs(compile(t,changed)),canonicalJs(runtime));
});
test('type-only group and filter interfaces are erased from emitted JS',t=>{
  const output=compile(t,source);
  assert(!output.includes('interface NicoGroupChat'));
  assert(!output.includes('interface NicoGroupFilter'));
  assert(!output.includes('declare _members'));
});

test('canonical NicoChatGroup passes isolated strict type verification',()=>{
  execFileSync(process.execPath,[
    resolve(repo,'tools/typescript-stage1/scripts/check-nico-chat-group-strict.mjs')
  ],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
});
