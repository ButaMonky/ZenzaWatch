'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..');
const source='tools/typescript-stage1/p12-src/AutoResumeClearCoordinator.ts';
const emitted='tools/typescript-stage1/.generated/p12/AutoResumeClearCoordinator.js';
const runtime='packages/zenza/src/resume/AutoResumeClearCoordinator.js';
const manifest='tools/typescript-stage1/p12-auto-clear-manifest.json';
const generator='tools/typescript-stage1/scripts/sync-p12-auto-clear.mjs';
async function fixture(prepare,action,fresh=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p12-clear-gen-'));
 const file=name=>path.join(dir,name);
 const put=(name,content)=>{
  fs.mkdirSync(path.dirname(file(name)),{recursive:true});
  fs.writeFileSync(file(name),content);
 };
 try{
  for(const name of fresh ? [source,emitted,generator] : [source,emitted,runtime,manifest,generator])
   put(name,fs.readFileSync(path.join(root,name)));
  if(prepare)prepare({file,put});
  const mod=await new Function('url','return import(url)')(pathToFileURL(file(generator)).href);
  await action({file,put,sync:mod.sync});
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:3});}
}
describe('P12 fixed auto-clear class generator safety',()=>{
 it('checks canonical class runtime and manifest unchanged',async()=>{
  await fixture(null,({sync,file})=>{
   const before=fs.readFileSync(file(runtime));
   assert.equal(sync('--check').modules,1);
   assert.deepStrictEqual(fs.readFileSync(file(runtime)),before);
  });
 });
 it('first adoption only creates its own canonical runtime',async()=>{
  await fixture(null,({sync,file})=>{
   assert.equal(fs.existsSync(file(runtime)),false);
   assert.equal(fs.existsSync(file(manifest)),false);
   assert.equal(sync('--write').status,'PASS');
   assert.equal(sync('--check').status,'PASS');
  },true);
 });
 it('refuses a foreign untracked implementation',async()=>{
  await fixture(({file,put})=>{
   fs.unlinkSync(file(manifest));put(runtime,'// foreign owner\n');
  },({sync,file})=>{
   assert.throws(()=>sync('--write'),/P12_AUTO_CLEAR_FOREIGN_RUNTIME_EDIT/);
   assert.equal(fs.readFileSync(file(runtime),'utf8'),'// foreign owner\n');
  });
 });
 it('rejects unexpected emitted imports and preserves runtime',async()=>{
  await fixture(({file,put})=>{
   const prev=fs.readFileSync(file(emitted),'utf8');
   put(emitted,"import { Rogue } from './Rogue';\n"+prev);
  },({sync,file})=>{
   const before=fs.readFileSync(file(runtime));
   assert.throws(()=>sync('--write'),/P12_AUTO_CLEAR_UNEXPECTED_IMPORT/);
   assert.deepStrictEqual(fs.readFileSync(file(runtime)),before);
  });
 });
 it('rejects a missing class and a new top-level owner',async()=>{
  for(const transform of [
   text=>text.replace('export class AutoResumeClearCoordinator {','export class OtherCoordinator {'),
   text=>text+'\nconst Forged=1;\n'
  ]){
   await fixture(({file,put})=>put(emitted,transform(fs.readFileSync(file(emitted),'utf8'))),
    ({sync,file})=>{
     const before=fs.readFileSync(file(manifest));
     assert.throws(()=>sync('--write'),/P12_AUTO_CLEAR_(CLASS_SHAPE|TOP_LEVEL_SHAPE)/);
     assert.deepStrictEqual(fs.readFileSync(file(manifest)),before);
    });
  }
 });
 it('rejects stale manifest in check mode',async()=>{
  await fixture(({file,put})=>{
   const obj=JSON.parse(fs.readFileSync(file(manifest),'utf8'));
   obj.runtimeSha256='0'.repeat(64);
   put(manifest,JSON.stringify(obj,null,2)+'\n');
  },({sync})=>assert.throws(()=>sync('--check'),/P12_AUTO_CLEAR_STALE_OUTPUT/));
 });
});
