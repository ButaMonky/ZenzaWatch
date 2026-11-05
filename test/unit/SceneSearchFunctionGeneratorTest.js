'use strict';
// P13-11: the sole function/CSS runtime preserves original dependency ownership.
// All mutation tests use isolated disposable copies, never the product worktree.
const assert=require('assert');
const fs=require('fs'),os=require('os'),path=require('path');
const {pathToFileURL}=require('url');
const {createHash}=require('crypto');
const rel='packages/zenza/src/sceneSearch/SceneSearchLayouts01_02.js';
const emitted='tools/typescript-stage1/.generated/scui/SceneSearchLayouts01_02.js';
const canonical='tools/typescript-stage1/nico-src/SceneSearchLayouts01_02.ts';
const generator='tools/typescript-stage1/scripts/sync-scui.mjs';
const manifest='tools/typescript-stage1/scui-runtime-manifest.json';
const root=path.resolve(__dirname,'../..');
const hash=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
async function fixture(prepare,check){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scui-function-contract-'));
 const file=n=>path.join(dir,n);
 const put=(n,text)=>{
  fs.mkdirSync(path.dirname(file(n)),{recursive:true});
  fs.writeFileSync(file(n),text);
 };
 try{
  for(const name of [rel,emitted,canonical,generator]){
   put(name,fs.readFileSync(path.join(root,name),'utf8'));
  }
  put(manifest,'{}\n');
  if(prepare)prepare({file,put});
  const url=pathToFileURL(file(generator)).href;
  const mod=await new Function('url','return import(url)')(url);
  await check({file,put,sync:mod.sync});
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:3});}
}
describe('P13-11 classic UI01/02 generator contracts',()=>{
 it('accepts exactly one known legacy function+three CSS constants, then verifies all metadata',async()=>{
  await fixture(null,({file,sync})=>{
   const count=sync('--write','SceneSearchLayouts01_02');
   assert.strictEqual(count,1);
   const script=fs.readFileSync(file(rel),'utf8');
   const meta=JSON.parse(fs.readFileSync(file(manifest),'utf8'));
   assert.strictEqual(meta.SceneSearchLayouts01_02.runtime,rel);
   assert.strictEqual(meta.SceneSearchLayouts01_02.runtimeSha256,hash(script));
   assert(script.startsWith('// GENERATED FROM '+canonical+'\n'));
   assert(script.includes("import {SceneSearchLayoutCard} from './SceneSearchLayoutCard';\n"));
   assert(script.includes('//===BEGIN===\n//@require SceneSearchLayoutCard\n'));
   assert.strictEqual((script.match(/^\s*const SCENE_\S+_CSS\s*=/gm)||[]).length,3);
   assert.strictEqual((script.match(/^function registerSceneLayouts01_02\(/gm)||[]).length,1);
   assert(script.trimEnd().endsWith('export {registerSceneLayouts01_02};'));
   assert.strictEqual(sync('--check','SceneSearchLayouts01_02'),1);
  });
 });
 for(const [name,change,error] of [
  ['removed allowed import',e=>e.replace(/^import\s+\{\s*SceneSearchLayoutCard\s*\}.*$/m,''),'SCUI_CLASSIC_IMPORT_DRIFT'],
  ['unexpected second import',e=>e+'\nimport {ForeignOwner} from "./ForeignOwner";','SCUI_INVALID_EMIT'],
  ['missing UI01 CSS const',e=>e.replace('const SCENE_LAYOUT01_CSS =','const REMOVED_LAYOUT01_CSS ='),'SCUI_CLASSIC_SHAPE_DRIFT']
 ]){
  it('rejects '+name+' without replacing runtime or manifest',async()=>{
   await fixture(({file,put})=>{
    put(emitted,change(fs.readFileSync(file(emitted),'utf8')));
   },({file,sync})=>{
    const before=fs.readFileSync(file(rel),'utf8');
    assert.throws(()=>sync('--write','SceneSearchLayouts01_02'),
      e=>e.message.includes(error));
    assert.strictEqual(fs.readFileSync(file(rel),'utf8'),before);
    assert.strictEqual(fs.readFileSync(file(manifest),'utf8'),'{}\n');
   });
  });
 }
 it('rejects unknown original runtime SHA and preserves it unchanged',async()=>{
  await fixture(({put})=>put(rel,'// unsafe replacement\n'),({file,sync})=>{
   assert.throws(()=>sync('--write','SceneSearchLayouts01_02'),
      /SCUI_CLASSIC_DEPENDENCY_DRIFT/);
   assert.strictEqual(fs.readFileSync(file(rel),'utf8'),'// unsafe replacement\n');
   assert.strictEqual(fs.readFileSync(file(manifest),'utf8'),'{}\n');
  });
 });
 it('rejects content drift even when original import and require look valid',async()=>{
  await fixture(({file,put})=>{
   const legacy=fs.readFileSync(file(rel),'utf8');
   assert(legacy.includes('zenzaSceneLayout01'));
   put(rel,legacy.replace('zenzaSceneLayout01',
     'zenzaSceneLayout01_UNTRUSTED'));
  },({file,sync})=>{
   const before=fs.readFileSync(file(rel),'utf8');
   assert.throws(()=>sync('--write','SceneSearchLayouts01_02'),
     /SCUI_FOREIGN_EDIT_SceneSearchLayouts01_02/);
   assert.strictEqual(fs.readFileSync(file(rel),'utf8'),before);
   assert.strictEqual(fs.readFileSync(file(manifest),'utf8'),'{}\n');
  });
 });
});
