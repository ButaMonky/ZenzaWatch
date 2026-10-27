// Task577: type-only screen constants contract, no change to production JS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {canonicalJs,directiveList} from '../scripts/sync-advanced.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const source=readFileSync(resolve(repo,
  'tools/typescript-stage1/comment-src/CommentLayer.ts'),'utf8');
const legacy=readFileSync(resolve(repo,
  'packages/zenza/src/commentLayer/CommentLayer.js'),'utf8');
const tsc=resolve(repo,'tools/typescript-stage1/node_modules/typescript/bin/tsc');

function compile(t,tsSource){
  const work=mkdtempSync(join(tmpdir(),'zlayer-ts-'));
  t.after(()=>rmSync(work,{recursive:true,force:true}));
  const input=resolve(work,'CommentLayer.ts');
  writeFileSync(input,tsSource);
  execFileSync(process.execPath,[tsc,'--noCheck','--target','ES2022',
    '--module','ESNext','--moduleResolution','Bundler',
    '--removeComments','false','--verbatimModuleSyntax','--outDir',work,input],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
  return readFileSync(resolve(work,'CommentLayer.js'),'utf8');
}
test('static comment drawing coordinate definitions have a strict TS source',()=>{
  assert(source.includes('export interface CommentLayoutScreen'));
  assert(source.includes('declare static MAX_COMMENT'));
  assert(source.includes('//===BEGIN==='));
  assert(source.includes('//===END==='));
});
test('native TS7 compiler preserves the entire original JavaScript AST',t=>{
  const emitted=compile(t,source);
  assert.equal(canonicalJs(emitted),canonicalJs(legacy));
  assert.deepEqual(directiveList(emitted),directiveList(legacy));
});
test('modifying a screen width is detected as a runtime compatibility break',t=>{
  const changed=source.replace('WIDTH_INNER: 512,','WIDTH_INNER: 513,');
  assert.notEqual(source,changed);
  assert.notEqual(canonicalJs(compile(t,changed)),canonicalJs(legacy));
});
test('all static layout constants pass strict type verification',()=>{
  execFileSync(process.execPath,[tsc,'--project',
    resolve(repo,'tools/typescript-stage1/tsconfig.comment-layer.strict.json')],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
});
test('TypeScript-only geometry and capacity declarations erase from JS',t=>{
  const output=compile(t,source);
  assert(!output.includes('interface CommentLayoutScreen'));
  assert(!output.includes('declare static SCREEN'));
});
