// Task581: non-destructive TypeScript migration of the existing NG filter.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalJs,directiveList} from '../scripts/sync-advanced.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const sourceFile='tools/typescript-stage1/comment-src/NicoChatFilter.ts';
const productFile='packages/zenza/src/commentLayer/NicoChatFilter.js';
const source=readFileSync(resolve(repo,sourceFile),'utf8');
const oldRuntime=readFileSync(resolve(repo,productFile),'utf8');
const tsc=resolve(repo,'tools/typescript-stage1/node_modules/typescript/bin/tsc');

function emit(t,typescriptSource){
  const scratch=mkdtempSync(join(tmpdir(),'znico-filter-ts-'));
  t.after(()=>rmSync(scratch,{recursive:true,force:true}));
  const input=resolve(scratch,'NicoChatFilter.ts');
  writeFileSync(input,typescriptSource);
  execFileSync(process.execPath,[tsc,'--noCheck','--target','ES2022',
    '--module','ESNext','--moduleResolution','Bundler',
    '--removeComments','false','--verbatimModuleSyntax',
    '--outDir',scratch,input],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
  return readFileSync(resolve(scratch,'NicoChatFilter.js'),'utf8');
}

test('typed filter source preserves trusted composite and legacy imports',()=>{
  for(const expected of [
    "import {Emitter} from '../../../lib/src/Emitter'",
    "import {textUtil} from '../../../lib/src/text/textUtil'",
    "import {Config} from '../../../../src/Config'",
    "import {NgCompositeRules} from '../../../../src/NgCompositeRules'",
    'export interface NicoChatFilterOptions',
    'export interface NicoFilterSourceChat',
    'export {NicoChatFilter};'
  ]) assert(source.includes(expected),expected);
  assert(source.includes('//===BEGIN==='));
  assert(source.includes('//@require NgCompositeRules'));
  assert(source.includes('//===END==='));
});

test('TypeScript 7 output retains the complete existing NG filter JavaScript AST',t=>{
  const compiled=emit(t,source);
  assert.equal(canonicalJs(compiled),canonicalJs(oldRuntime));
  assert.deepEqual(directiveList(compiled),directiveList(oldRuntime));
});

test('a changed filter enabled getter is blocked by the AST parity check',t=>{
  const changed=source.replace('return this._enable;','return !this._enable;');
  assert.notEqual(changed,source);
  assert.notEqual(canonicalJs(emit(t,changed)),canonicalJs(oldRuntime));
});

test('typed declarations remain compile-time only',t=>{
  const js=emit(t,source);
  for(const fragment of [
    'interface NicoChatFilterOptions',
    'interface NicoFilterSourceChat',
    'declare static SHARED_NG_LEVEL'
  ]) assert(!js.includes(fragment),fragment);
});

test('runtime bundle directives and public filter method names are unchanged',()=>{
  assert.deepEqual(directiveList(source),directiveList(oldRuntime));
  for(const method of [
    'setCompositeChatPool','addCompositeChat','removeCompositeChat',
    'updateCompositeChat','getFilterFunc','applyFilter','isSafe'
  ]) {
    assert(source.includes(method+'('),method);
    assert(oldRuntime.includes(method+'('),method);
  }
});

test('canonical NicoChatFilter passes isolated strict TypeScript contract checks',()=>{
  const checker=resolve(repo,'tools/typescript-stage1/scripts/check-nico-chat-filter-strict.mjs');
  const result=execFileSync(process.execPath,[checker],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
  assert(result.includes('NICO_CHAT_FILTER_STRICT=PASS'));
});
