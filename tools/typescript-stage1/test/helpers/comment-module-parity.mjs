// Shared Stage A parity contract for independently migrated comment-layer sources.
// Test-only bridge: the live userscript continues to read its existing JavaScript.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalJs,directiveList} from '../../scripts/sync-advanced.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const tsc=resolve(repo,'tools/typescript-stage1/node_modules/typescript/bin/tsc');
function emit(t,source,filename) {
  const scratch=mkdtempSync(join(tmpdir(),'zcomment-migration-'));
  t.after(()=>rmSync(scratch,{recursive:true,force:true}));
  const input=resolve(scratch,filename+'.ts');
  writeFileSync(input,source);
  execFileSync(process.execPath,[tsc,'--noCheck','--target','ES2022',
    '--module','ESNext','--moduleResolution','Bundler','--verbatimModuleSyntax',
    '--removeComments','false','--outDir',scratch,input],{
    cwd:repo,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe']
  });
  const js=readFileSync(resolve(scratch,filename+'.js'),'utf8');
  // Task1083: these typed sources declare startup; the matching runtime JS
  // imports it explicitly (CODEX_STARTUP_REFACTOR section 4-2). Preserve the
  // complete AST comparison, including the exact runtime import and order.
  const declaration="declare const startup: import('../../../src/ZenzaContext').ZenzaStartup;";
  if(!source.includes(declaration))return js;
  assert(['NicoChatViewModel','NicoCommentCss3PlayerView','CommentPictureInPicture'].includes(filename));
  assert.equal(source.split(declaration).length,2);
  return "import {startup} from '../../../../src/ZenzaContext';\n"+js;
}
export function runCommentModuleParity({moduleName,contractName}) {
  if(!/^[A-Za-z][A-Za-z0-9]+$/.test(moduleName))throw Error('Invalid module name');
  if(!/^[A-Za-z][A-Za-z0-9]+$/.test(contractName))throw Error('Invalid contract name');
  const canonical=readFileSync(resolve(repo,
    'tools/typescript-stage1/comment-src',moduleName+'.ts'),'utf8');
  const original=readFileSync(resolve(repo,
    'packages/zenza/src/commentLayer',moduleName+'.js'),'utf8');

  test(moduleName+': typed source retains original runtime boundaries and type contract',()=>{
    assert(canonical.includes('export interface '+contractName));
    assert(canonical.includes('//===BEGIN==='));
    assert(canonical.includes('//===END==='));
    assert(original.includes('//===BEGIN==='));
    assert(original.includes('//===END==='));
  });
  test(moduleName+': native TS7 output preserves runtime AST and directives',t=>{
    const js=emit(t,canonical,moduleName);
    assert.equal(canonicalJs(js),canonicalJs(original));
    assert.deepEqual(directiveList(js),directiveList(original));
  });
  test(moduleName+': an executable change triggers the compatibility gate',t=>{
    const mutated=canonical.replace('//===BEGIN===',
      '//===BEGIN===\nconst __intentional_test_mutation__ = 591;');
    assert.notEqual(mutated,canonical);
    assert.notEqual(canonicalJs(emit(t,mutated,moduleName)),canonicalJs(original));
  });
  if(canonical.includes('declare const startup:')) {
    test(moduleName+': missing or changed startup import triggers the compatibility gate',t=>{
      const bridge="import {startup} from '../../../../src/ZenzaContext';";
      assert.equal(original.split(bridge).length,2);
      const compiled=canonicalJs(emit(t,canonical,moduleName));
      assert.notEqual(compiled,canonicalJs(original.replace(bridge,'')));
      assert.notEqual(compiled,canonicalJs(original.replace(bridge,bridge.replace('ZenzaContext','WrongContext'))));
    });
  }
  test(moduleName+': TypeScript-only declarations disappear from generated JS',t=>{
    const js=emit(t,canonical,moduleName);
    assert(!js.includes('interface '+contractName));
    assert(!js.includes('declare static '));
  });
}
