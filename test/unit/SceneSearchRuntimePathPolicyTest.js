'use strict';
const assert=require('assert');
const path=require('path');
const {pathToFileURL}=require('url');

describe('P13 scene generator fixed runtime path policy',()=>{
 let resolve;
 before(async()=>{
  const script=path.resolve('tools/typescript-stage1/scripts/sync-scui.mjs');
  const mod=await new Function('url','return import(url)')(pathToFileURL(script).href);
  resolve=mod.runtimePathFor;
 });
 it('leaves all existing root-scene output locations unchanged',()=>{
  for(const name of ['SceneSearchLayoutCard','SceneSearchLayoutCatalog',
    'SceneSearchLegacyAdapter','SceneSearchDomLease','SceneSearchLayoutBootstrap','SceneSearchPlayerBinding',
    'SceneSearchController','SceneSearchIntegrationBridge']){
   // All original scene modules, including the fully migrated Bridge, use
   // fixed allowlisted paths. Never derive paths from caller-supplied input.
   assert.strictEqual(resolve(name),
     'packages/zenza/src/sceneSearch/'+name+'.js');
  }
 });
 it('resolves only five explicitly reviewed nested layouts',()=>{
  const names=['SceneSearchLayout07','SceneSearchLayout10',
    'SceneSearchLayouts03_04','SceneSearchLayouts05_06','SceneSearchLayouts08_09'];
  for(const name of names)assert.strictEqual(resolve(name),
    'packages/zenza/src/sceneSearch/layouts/'+name+'.js');
 });
 it('rejects unknown modules, paths and traversal before any write',()=>{
  for(const value of ['../SceneSearchLayout07','./SceneSearchLayout10',
    'SceneSearchLayout07/../../src','SceneSearchLayout11',
    'SceneSearchLayoutBootstrap/../','../SceneSearchIntegrationBridge','',null,undefined]){
   assert.throws(()=>resolve(value),/SCUI_UNKNOWN_MODULE/);
  }
 });
});


describe('UI07 first adoption refuses an unknown runtime baseline',()=>{
 it('rejects changed legacy JS before writing any generated file',async()=>{
  const fs=require('fs'),os=require('os');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'scui-ui07-guard-'));
  const copy=rel=>{
   const dst=path.join(temp,rel);
   fs.mkdirSync(path.dirname(dst),{recursive:true});
   fs.copyFileSync(path.resolve(rel),dst);
  };
  const runtimeRel='packages/zenza/src/sceneSearch/layouts/SceneSearchLayout07.js';
  const manifestRel='tools/typescript-stage1/scui-runtime-manifest.json';
  try{
   for(const rel of [
    'tools/typescript-stage1/scripts/sync-scui.mjs',
    'tools/typescript-stage1/nico-src/SceneSearchLayout07.ts',
    'tools/typescript-stage1/.generated/scui/SceneSearchLayout07.js'
   ])copy(rel);
   const runtime=path.join(temp,runtimeRel);
   fs.mkdirSync(path.dirname(runtime),{recursive:true});
   const foreign='// foreign first-adoption runtime; never overwrite\n';
   fs.writeFileSync(runtime,foreign);
   const mp=path.join(temp,manifestRel);
   fs.writeFileSync(mp,'{}\n');
   const url=pathToFileURL(path.join(temp,'tools/typescript-stage1/scripts/sync-scui.mjs')).href;
   const generator=await new Function('url','return import(url)')(url);
   assert.throws(()=>generator.sync('--write','SceneSearchLayout07'),
     /SCUI_FOREIGN_EDIT_SceneSearchLayout07/);
   assert.strictEqual(fs.readFileSync(runtime,'utf8'),foreign);
   assert.strictEqual(fs.readFileSync(mp,'utf8'),'{}\n');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
 });
});
