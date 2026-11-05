'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {createHash}=require('crypto');
const {REPO_ROOT}=require('../helpers/buildSandbox');
const sha=s=>createHash('sha256').update(s).digest('hex');

function sandbox(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'scene-ownership-generate-'));
 const put=(rel,text)=>{const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);return file;};
 const script=put('tools/typescript-stage1/scripts/sync-scui.mjs',fs.readFileSync(path.join(REPO_ROOT,'tools/typescript-stage1/scripts/sync-scui.mjs'),'utf8'));
 const source='tools/typescript-stage1/nico-src/SceneSearchPreviewView.ts',runtime='packages/zenza/src/sceneSearch/SceneSearchPreviewView.js';
 const before='// GENERATED FROM '+source+'\n//===BEGIN===\nclass SceneSearchPreviewView {\n}\n//===END===\nexport {SceneSearchPreviewView};\n';
 put(source,'export class SceneSearchPreviewView {}\n');put(runtime,before);
 const placement='packages/zenza/src/sceneSearch/SceneSearchPlacement.js';
 put(placement,'/* other owner: must stay byte-for-byte intact */\n');
 put('tools/typescript-stage1/nico-src/SceneSearchPlacement.ts','export class SceneSearchPlacement {}\n');
 const other={source:'tools/typescript-stage1/nico-src/SceneSearchPlacement.ts',runtime:placement,sourceSha256:'other-source',runtimeSha256:'other-runtime'};
 const manifest={SceneSearchPreviewView:{source,runtime,sourceSha256:'before-source',runtimeSha256:sha(before)},SceneSearchPlacement:other};
 const mp=put('tools/typescript-stage1/scui-runtime-manifest.json',JSON.stringify(manifest,null,2)+'\n');
 const emit=put('tools/typescript-stage1/.generated/scui/SceneSearchPreviewView.js',
  "import { SceneSearchDomLease } from '../../../packages/zenza/src/sceneSearch/SceneSearchDomLease';\nexport class SceneSearchPreviewView {\n  borrow(node) { return new SceneSearchDomLease(node, {position:true}); }\n}\n");
 return {root,put,script,source,runtime,before,placement,other,mp,emit,
  run:mode=>spawnSync(process.execPath,[script,mode,'--only=SceneSearchPreviewView'],{encoding:'utf8',timeout:20000}),
  done(){fs.rmSync(root,{recursive:true,force:true});}};
}
describe('scene ownership targeted TypeScript generation',function(){
 this.timeout(30000);
 it('generates only PreviewView with its explicit native lease dependency and leaves other owners intact',()=>{
  const h=sandbox();try{
   const protectedBefore=fs.readFileSync(path.join(h.root,h.placement),'utf8');
   const result=h.run('--write');
   assert.strictEqual(result.status,0,result.stderr);
   const output=fs.readFileSync(path.join(h.root,h.runtime),'utf8');
   const parsed=require('@babel/parser').parse(output,{sourceType:'module'});
   const imports=parsed.program.body.filter(n=>n.type==='ImportDeclaration');
   assert.strictEqual(imports.length,1);assert.strictEqual(imports[0].source.value,'./SceneSearchDomLease');
   const body=output.split('//===BEGIN===')[1].split('//===END===')[0];
   let borrowed;
   class Lease{constructor(node,options){borrowed={node,options};}}
   const View=require('vm').runInNewContext(body+';SceneSearchPreviewView',{SceneSearchDomLease:Lease});
   const node={identity:'native'};new View().borrow(node);
   assert.strictEqual(borrowed.node,node);assert.strictEqual(borrowed.options.position,true);
   assert.strictEqual(fs.readFileSync(path.join(h.root,h.placement),'utf8'),protectedBefore);
   assert.deepStrictEqual(JSON.parse(fs.readFileSync(h.mp,'utf8')).SceneSearchPlacement,h.other);
   assert.strictEqual(h.run('--check').status,0,'targeted generation must be reproducible');
  }finally{h.done();}
 });
 it('rejects an unrecognized runtime dependency before writing any product file',()=>{
  const h=sandbox();try{
   fs.writeFileSync(h.emit,"import fs from 'node:fs';\nexport class SceneSearchPreviewView {\n}\n");
   const manifest=fs.readFileSync(h.mp,'utf8'),result=h.run('--write');
   assert.notStrictEqual(result.status,0);assert(/SCUI_INVALID_EMIT/.test(result.stderr));
   assert.strictEqual(fs.readFileSync(path.join(h.root,h.runtime),'utf8'),h.before);
   assert.strictEqual(fs.readFileSync(h.mp,'utf8'),manifest);
  }finally{h.done();}
 });
 it('refuses an unknown target without regenerating the other scene modules',()=>{
  const h=sandbox();try{
   const manifest=fs.readFileSync(h.mp,'utf8');
   const result=spawnSync(process.execPath,[h.script,'--write','--only=NotOwned'],{encoding:'utf8',timeout:20000});
   assert.notStrictEqual(result.status,0);
   assert(/SCUI_UNKNOWN_MODULE/.test(result.stderr));
   assert.strictEqual(fs.readFileSync(path.join(h.root,h.runtime),'utf8'),h.before);
   assert.strictEqual(fs.readFileSync(h.mp,'utf8'),manifest);
  }finally{h.done();}
 });
});
