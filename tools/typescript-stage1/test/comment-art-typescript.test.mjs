// Task575: TypeScript-canonical, non-destructive comment-art classifier.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalJs,directiveList} from '../scripts/sync-advanced.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const src='tools/typescript-stage1/comment-src/CommentArtProtection.ts';
const runtime='packages/zenza/src/commentLayer/CommentArtProtection.js';
const source=readFileSync(resolve(repo,src),'utf8');
const oldRuntime=readFileSync(resolve(repo,runtime),'utf8');
const tsc=resolve(repo,'tools/typescript-stage1/node_modules/typescript/bin/tsc');
function emit(t,input){
  const work=mkdtempSync(join(tmpdir(),'zca-ts-'));
  t.after(()=>rmSync(work,{recursive:true,force:true}));
  const file=resolve(work,'CommentArtProtection.ts');
  writeFileSync(file,input);
  execFileSync(process.execPath,[tsc,'--noCheck','--target','ES2022',
    '--module','ESNext','--moduleResolution','Bundler','--verbatimModuleSyntax',
    '--removeComments','false','--outDir',work,file],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
  return readFileSync(resolve(work,'CommentArtProtection.js'),'utf8');
}
test('canonical source and runtime are fixed, never product-side overwritten',()=>{
  assert(source.includes('export interface CommentArtCandidate'));
  assert(source.includes('export {CommentArtProtection};'));
  assert.equal(source.includes('//===BEGIN==='),true);
  assert.equal(oldRuntime.includes('//===END==='),true);
});
test('the TypeScript 7 compiler retains the exact comment-art runtime AST',t=>{
  const generated=emit(t,source);
  assert.equal(canonicalJs(generated),canonicalJs(oldRuntime));
  assert.deepEqual(directiveList(generated),directiveList(oldRuntime));
});
test('an accidental destructive code change is blocked by the parity guard',t=>{
  const changed=source.replace('if (!enabled) { return result; }',
    'if (enabled) { return result; }');
  assert.notEqual(changed,source);
  assert.notEqual(canonicalJs(emit(t,changed)),canonicalJs(oldRuntime));
});
test('comment art source and its public contracts pass native TS7 strict',()=>{
  execFileSync(process.execPath,[tsc,'--project',
    resolve(repo,'tools/typescript-stage1/tsconfig.comment-art.strict.json')],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
});
test('all type-only declarations are erased from generated JavaScript',t=>{
  const js=emit(t,source);
  assert(!js.includes('interface CommentArtCandidate'));
  assert(!js.includes('interface CommentArtGroup'));
});
