import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const names=['ManualBookmarkPolicy','ManualBookmarkStore','ManualBookmarkSession',
 'ManualBookmarkPanel','ManualBookmarkDock'];
const manifest='tools/typescript-stage1/p12-manual-manifest.json';
const generator='tools/typescript-stage1/scripts/sync-p12-manual.mjs';
const source=n=>'tools/typescript-stage1/p12-src/'+n+'.ts';
const emitted=n=>'tools/typescript-stage1/.generated/p12/'+n+'.js';
const runtime=n=>'packages/zenza/src/resume/'+n+'.js';
async function fixture(prepare,action){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'p12-manual-generator-'));
 const at=p=>path.join(root,p);
 const put=(p,text)=>{
  fs.mkdirSync(path.dirname(at(p)),{recursive:true});
  fs.writeFileSync(at(p),text);
 };
 try{
  for(const p of [manifest,generator,...names.flatMap(n=>
   [source(n),emitted(n),runtime(n)])]){
   put(p,fs.readFileSync(path.join(project,p)));
  }
  if(prepare)prepare({at,put});
  const {sync}=await import(pathToFileURL(at(generator)).href);
  await action({sync,at,put});
 }finally{fs.rmSync(root,{recursive:true,force:true,maxRetries:3});}
}
test('five canonical typed manual bookmark modules are synced without mutation',async()=>{
 await fixture(null,({sync,at})=>{
  const before=names.map(n=>fs.readFileSync(at(runtime(n))));
  assert.equal(sync('--check').modules,5);
  const after=names.map(n=>fs.readFileSync(at(runtime(n))));
  before.forEach((x,i)=>assert.deepEqual(x,after[i]));
 });
});
test('legacy userscript sees fixed BEGIN/END, require order and scoped private helpers',async()=>{
 await fixture(null,({at})=>{
  for(const n of names){
   const code=fs.readFileSync(at(runtime(n)),'utf8');
   const start=code.indexOf('//===BEGIN===');
   const end=code.indexOf('//===END===');
   assert(start>=0&&end>start,n+' fixed legacy build boundaries');
   const embedded=code.slice(start,end);
   assert(!/^export\s/m.test(embedded),n+' exports must stay outside flat body');
   assert(embedded.includes('const {'),n+' private helpers must be IIFE scoped');
   assert(code.includes('export {'),n+' usable ESM exports');
  }
  const store=fs.readFileSync(at(runtime('ManualBookmarkStore')),'utf8');
  assert(store.includes('//@require normalizeManualBookmarks'));
  const dock=fs.readFileSync(at(runtime('ManualBookmarkDock')),'utf8');
  assert(dock.includes('//@require ManualBookmarkPanel'));
 });
});
test('fresh runtime adoption creates only its five fixed paths and manifest',async()=>{
 await fixture(({at})=>{
  fs.unlinkSync(at(manifest));
  names.forEach(n=>fs.unlinkSync(at(runtime(n))));
 },({sync})=>{
  assert.equal(sync('--write').status,'PASS');
  assert.equal(sync('--check').status,'PASS');
 });
});
test('foreign runtime is rejected without modifying its bytes',async()=>{
 await fixture(({at,put})=>{
  fs.unlinkSync(at(manifest));
  names.filter(n=>n!=='ManualBookmarkDock').forEach(n=>
    fs.unlinkSync(at(runtime(n))));
  put(runtime('ManualBookmarkDock'),'// someone else owns this code\n');
 },({sync,at})=>{
  assert.throws(()=>sync('--write'),/FOREIGN_RUNTIME_EDIT_ManualBookmarkDock/);
  assert.equal(fs.readFileSync(at(runtime('ManualBookmarkDock')),'utf8'),
    '// someone else owns this code\n');
 });
});
test('unknown external import or dynamic import is rejected with no writes',async()=>{
 for(const change of [
  js=>"import {X} from './Unknown.js';\n"+js,
  js=>js+"\nconst rogue=import('./Unknown.js');\n"
 ]){
  await fixture(({at,put})=>{
   put(emitted('ManualBookmarkDock'),change(
     fs.readFileSync(at(emitted('ManualBookmarkDock')),'utf8')));
  },({sync,at})=>{
   const before=fs.readFileSync(at(runtime('ManualBookmarkDock')));
   assert.throws(()=>sync('--write'),
     /P12_MANUAL_(UNEXPECTED_IMPORT|DYNAMIC_IMPORT|TOP_LEVEL_SHAPE)/);
   assert.deepEqual(fs.readFileSync(at(runtime('ManualBookmarkDock'))),before);
  });
 }
});
test('extra emitted top-level owner is rejected before any runtime write',async()=>{
 await fixture(({at,put})=>{
  const js=fs.readFileSync(at(emitted('ManualBookmarkSession')),'utf8');
  put(emitted('ManualBookmarkSession'),js+'\nconst rogue=1;\n');
 },({sync,at})=>{
  const before=fs.readFileSync(at(manifest));
  assert.throws(()=>sync('--write'),/TOP_LEVEL_SHAPE_ManualBookmarkSession/);
  assert.deepEqual(fs.readFileSync(at(manifest)),before);
 });
});
test('stale source hash or runtime hash makes check fail closed',async()=>{
 for(const key of ['sourceSha256','runtimeSha256']){
  await fixture(({at,put})=>{
   const x=JSON.parse(fs.readFileSync(at(manifest),'utf8'));
   x.modules[0][key]='0'.repeat(64);
   put(manifest,JSON.stringify(x,null,2)+'\n');
  },({sync})=>assert.throws(()=>sync('--check'),/STALE_RUNTIME_OR_MANIFEST/));
 }
});
test('missing compiled output is never silently replaced or skipped',async()=>{
 await fixture(({at})=>fs.unlinkSync(at(emitted('ManualBookmarkStore'))),
  ({sync})=>assert.throws(()=>sync('--write'),/MISSING_EMITTED_ManualBookmarkStore/));
});
test('invalid CLI-style modes cannot select user-controlled output paths',async()=>{
 await fixture(null,({sync})=>{
  for(const value of ['../other','--force','--unsafe','']){
   assert.throws(()=>sync(value),/BAD_MODE/);
  }
 });
});
