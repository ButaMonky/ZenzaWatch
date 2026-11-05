'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..');
const source='tools/typescript-stage1/p12-src/AutoResumePolicy.ts';
const emitted='tools/typescript-stage1/.generated/p12/AutoResumePolicy.js';
const runtime='packages/zenza/src/resume/AutoResumePolicy.js';
const manifest='tools/typescript-stage1/p12-runtime-manifest.json';
const generator='tools/typescript-stage1/scripts/sync-p12-resume.mjs';
async function fixture(change,run,fresh=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p12-resume-gen-'));
 const file=name=>path.join(dir,name);
 const put=(name,content)=>{
  fs.mkdirSync(path.dirname(file(name)),{recursive:true});
  fs.writeFileSync(file(name),content);
 };
 try{
  for(const name of fresh ? [source,emitted,generator] : [source,emitted,runtime,manifest,generator])
   put(name,fs.readFileSync(path.join(root,name)));
  if(change)change({file,put});
  const mod=await new Function('url','return import(url)')(pathToFileURL(file(generator)).href);
  await run({file,put,sync:mod.sync});
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:3});}
}
describe('P12 auto resume policy fixed-path generator safety',()=>{
 it('verifies one generated runtime and one manifest without writes',async()=>{
  await fixture(null,({sync,file})=>{
   const before=fs.readFileSync(file(runtime),'utf8');
   const result=sync('--check');
   assert.strictEqual(result.status,'PASS');
   assert.strictEqual(result.modules,1);
   assert.strictEqual(fs.readFileSync(file(runtime),'utf8'),before);
  });
 });
 it('creates the known runtime from scratch on a fresh branch',async()=>{
  await fixture(null,({sync,file})=>{
   assert.strictEqual(fs.existsSync(file(runtime)),false);
   assert.strictEqual(fs.existsSync(file(manifest)),false);
   assert.strictEqual(sync('--write').status,'PASS');
   assert.strictEqual(sync('--check').status,'PASS');
   assert(fs.readFileSync(file(runtime),'utf8').includes('function selectAutoResume('));
  },true);
 });
 it('rejects an untracked foreign runtime before any write',async()=>{
  await fixture(({file,put})=>{
   fs.unlinkSync(file(manifest));
   put(runtime,'// other owner\n');
  },({sync,file})=>{
   assert.throws(()=>sync('--write'),/P12_RESUME_FOREIGN_EDIT/);
   assert.strictEqual(fs.readFileSync(file(runtime),'utf8'),'// other owner\n');
   assert.strictEqual(fs.existsSync(file(manifest)),false);
  });
 });
 it('rejects a changed runtime without altering tracked manifest',async()=>{
  await fixture(({file,put})=>put(runtime,'// modified current runtime\n'),
   ({sync,file})=>{
    const before=fs.readFileSync(file(manifest));
    assert.throws(()=>sync('--write'),/P12_RESUME_FOREIGN_EDIT/);
    assert.deepStrictEqual(fs.readFileSync(file(manifest)),before);
   });
 });
 it('rejects extra import in compiler output',async()=>{
  await fixture(({file,put})=>{
   const original=fs.readFileSync(file(emitted),'utf8');
   put(emitted,"import { Foreign } from './Foreign';\n"+original);
  },({sync,file})=>{
   const original=fs.readFileSync(file(runtime));
   assert.throws(()=>sync('--write'),/P12_RESUME_UNEXPECTED_IMPORT/);
   assert.deepStrictEqual(fs.readFileSync(file(runtime)),original);
  });
 });
 it('rejects an extra top-level declaration',async()=>{
  await fixture(({file,put})=>{
   const original=fs.readFileSync(file(emitted),'utf8');
   put(emitted,original+'\nconst RogueOwner=1;\n');
  },({sync,file})=>{
   const before=fs.readFileSync(file(manifest));
   assert.throws(()=>sync('--write'),/P12_RESUME_TOP_LEVEL_SHAPE/);
   assert.deepStrictEqual(fs.readFileSync(file(manifest)),before);
  });
 });
 it('refuses stale manifest in check mode',async()=>{
  await fixture(({file,put})=>{
   const j=JSON.parse(fs.readFileSync(file(manifest),'utf8'));
   j.sourceSha256='0'.repeat(64);
   put(manifest,JSON.stringify(j,null,2)+'\n');
  },({sync})=>{
   assert.throws(()=>sync('--check'),/P12_RESUME_STALE_RUNTIME_OR_MANIFEST/);
  });
 });
});
