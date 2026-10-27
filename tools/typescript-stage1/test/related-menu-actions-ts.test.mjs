// Task572: independent canonical TypeScript source, never changing runtime JS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalJs,directiveList} from '../scripts/sync-advanced.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const sourceRel='tools/typescript-stage1/menu-src/RelatedMenuActions.ts';
const runtimeRel='packages/zenza/src/menu/RelatedMenuActions.js';
const source=readFileSync(resolve(repo,sourceRel),'utf8');
const original=readFileSync(resolve(repo,runtimeRel),'utf8');
const tsc=resolve(repo,'tools/typescript-stage1/node_modules/typescript/bin/tsc');

// Native TypeScript 7 exposes the pinned CLI, not the removed transpileModule API.
function emit(t,typescriptSource){
  const work=mkdtempSync(join(tmpdir(),'zmenu-ts-'));
  t.after(()=>rmSync(work,{recursive:true,force:true}));
  const input=resolve(work,'RelatedMenuActions.ts');
  writeFileSync(input,typescriptSource);
  execFileSync(process.execPath,[tsc,'--noCheck','--target','ES2022',
    '--module','ESNext','--moduleResolution','Bundler',
    '--verbatimModuleSyntax','--removeComments','false',
    '--outDir',work,input],{
    cwd:repo,stdio:['ignore','pipe','pipe'],windowsHide:true,encoding:'utf8'
  });
  return readFileSync(resolve(work,'RelatedMenuActions.js'),'utf8');
}
test('fixed canonical menu source references trusted userscript runtime',()=>{
  assert(source.includes('export interface RelatedMenuActionContext'));
  assert(source.includes('export {RelatedMenuActions};'));
  assert.equal(source.includes('//===BEGIN==='),true);
  assert.equal(source.includes('//===END==='),true);
});
test('pinned TypeScript compiler emits unchanged legacy AST and directives',t=>{
  const compiled=emit(t,source);
  assert.equal(canonicalJs(compiled),canonicalJs(original));
  assert.deepEqual(directiveList(compiled),directiveList(original));
});
test('a functional edit cannot slip through the semantic parity comparison',t=>{
  const changed=source.replace("return 'relatedMenu.customLinks';",
    "return 'relatedMenu.corrupted';");
  assert.notEqual(changed,source);
  assert.notEqual(canonicalJs(emit(t,changed)),canonicalJs(original));
});
test('type-only contracts erase from the emitted userscript',t=>{
  const compiled=emit(t,source);
  assert(!compiled.includes('interface RelatedMenuActionContext'));
  assert(!compiled.includes('interface RelatedMenuActionLink'));
});

test('trusted menu action source and public contracts pass strict TypeScript 7',()=>{
  execFileSync(process.execPath,[tsc,'--project',
    resolve(repo,'tools/typescript-stage1/tsconfig.related-menu-actions.strict.json')],{
    cwd:repo,stdio:['ignore','pipe','pipe'],windowsHide:true,encoding:'utf8'
  });
});
