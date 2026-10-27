// Task576: independent strict TypeScript source; preserve the userscript runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalJs,directiveList} from '../scripts/sync-advanced.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const sourcePath='tools/typescript-stage1/comment-src/CommentDisplayBudget.ts';
const legacyPath='packages/zenza/src/commentLayer/CommentDisplayBudget.js';
const source=readFileSync(resolve(repo,sourcePath),'utf8');
const oldRuntime=readFileSync(resolve(repo,legacyPath),'utf8');
const tsc=resolve(repo,'tools/typescript-stage1/node_modules/typescript/bin/tsc');
function emit(t,input){
  const work=mkdtempSync(join(tmpdir(),'zbudget-ts-'));
  t.after(()=>rmSync(work,{recursive:true,force:true}));
  const sourceFile=resolve(work,'CommentDisplayBudget.ts');
  writeFileSync(sourceFile,input);
  execFileSync(process.execPath,[tsc,'--noCheck','--target','ES2022',
    '--module','ESNext','--moduleResolution','Bundler','--verbatimModuleSyntax',
    '--removeComments','false','--outDir',work,sourceFile],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
  return readFileSync(resolve(work,'CommentDisplayBudget.js'),'utf8');
}
test('display budget canonical source has a fixed read-only production counterpart',()=>{
  assert(source.includes('export interface CommentBudgetOptions'));
  assert(source.includes('export {CommentDisplayBudget};'));
  assert(source.includes('//===BEGIN==='));
  assert(oldRuntime.includes('//===END==='));
});
test('native TypeScript output preserves comment admission priorities and AST',t=>{
  const compiled=emit(t,source);
  assert.equal(canonicalJs(compiled),canonicalJs(oldRuntime));
  assert.deepEqual(directiveList(compiled),directiveList(oldRuntime));
});
test('a changed maximum display budget cannot silently pass the compatibility check',t=>{
  const changed=source.replace('static get DEFAULT() { return 200; }',
    'static get DEFAULT() { return 201; }');
  assert.notEqual(changed,source);
  assert.notEqual(canonicalJs(emit(t,changed)),canonicalJs(oldRuntime));
});
test('display budget TypeScript and public contract pass native strict checking',()=>{
  execFileSync(process.execPath,[tsc,'--project',
    resolve(repo,'tools/typescript-stage1/tsconfig.comment-display-budget.strict.json')],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
});
test('no TypeScript-only budget interfaces enter emitted JavaScript',t=>{
  const output=emit(t,source);
  assert(!output.includes('interface CommentBudgetCandidate'));
  assert(!output.includes('interface CommentBudgetOptions'));
});
