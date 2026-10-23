'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path');
describe('Scene runtime canonical TypeScript',()=>{
 for(const name of ['SceneSearchController','SceneSearchInteraction','ScenePreviewIdleLimiter','SceneSearchShortcutRouter','SceneCommentSearch','SceneCommentSearchPanel']){
  it(name+' is generated from a strict source with a manifest entry',()=>{
   const source='tools/typescript-stage1/nico-src/'+name+'.ts';
   assert(fs.existsSync(source),'missing canonical source: '+source);
   const manifest=JSON.parse(fs.readFileSync('tools/typescript-stage1/scui-runtime-manifest.json','utf8'));
   assert(manifest[name],'missing sync protection');
   const body=fs.readFileSync(source,'utf8');
   assert(!/@ts-(?:ignore|nocheck)|\bany\b/.test(body),'must not bypass type checking');
   assert(fs.readFileSync(path.join('packages/zenza/src/sceneSearch',name+'.js'),'utf8').startsWith('// GENERATED FROM '+source));
  });
 }
});
