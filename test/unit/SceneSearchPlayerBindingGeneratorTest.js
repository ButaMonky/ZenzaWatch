'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..');
const name='SceneSearchPlayerBinding';
const base='packages/zenza/src/sceneSearch/';
const runtime=base+name+'.js',source='tools/typescript-stage1/nico-src/'+name+'.ts';
const emitted='tools/typescript-stage1/.generated/scui/'+name+'.js';
const generator='tools/typescript-stage1/scripts/sync-scui.mjs';
const manifest='tools/typescript-stage1/scui-runtime-manifest.json';
const names=['SceneSearchPlacement','SceneSearchLegacyAdapter','SceneSearchIntegrationBridge',
 'createSceneSearchLayoutRegistry','SceneSearchController','SceneSearchInteraction',
 'ScenePreviewIdleLimiter','SceneSeekStepControl','SceneCommentSearch',
 'SceneCommentSearchPanel','SceneSearchShortcutRouter','UiVisibilityRegistry','StoryboardWorker'];
async function fixture(prepare,check){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scui-binding-policy-'));
 const f=p=>path.join(dir,p);
 const put=(p,s)=>{
  fs.mkdirSync(path.dirname(f(p)),{recursive:true});fs.writeFileSync(f(p),s);
 };
 try{
  for(const file of [runtime,source,emitted,generator])
   put(file,fs.readFileSync(path.join(root,file)));
  const m=JSON.parse(fs.readFileSync(path.join(root,manifest),'utf8'));
  put(manifest,JSON.stringify({[name]:m[name]},null,2)+'\n');
  if(prepare)prepare({f,put});
  const url=pathToFileURL(f(generator)).href;
  const mod=await new Function('url','return import(url)')(url);
  await check({f,put,sync:mod.sync});
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:3});}
}
describe('P13-06 PlayerBinding fixed thirteen owner dependencies',()=>{
 it('matches the exact flat-userscript and runtime dependency count',async()=>{
  await fixture(null,({f,sync})=>{
   assert.strictEqual(sync('--check',name),1);
   const script=fs.readFileSync(f(runtime),'utf8');
   assert.strictEqual((script.match(/^import \{.+$/gm)||[]).length,13);
   assert.deepStrictEqual(script.match(/^\/\/@require .+$/gm),names.map(x=>'//@require '+x));
   assert(script.includes('class SceneSearchPlayerBinding {'));
   assert(script.trimEnd().endsWith('export {SceneSearchPlayerBinding};'));
  });
 });
 const mutations=[
  ['missing import',emitted,s=>s.replace(/^import \{ SceneSearchController \}.*\n/m,''),'SCUI_PLAYER_BINDING_IMPORT_DRIFT'],
  ['extra import',emitted,s=>'import { ForeignOwner } from "./ForeignOwner";\n'+s,'SCUI_PLAYER_BINDING_IMPORT_DRIFT'],
  ['external worker replaced',emitted,s=>s.replace(
    "'./SceneSearchStoryboardWorkerBoundary'","'./StoryboardWorker'"),'SCUI_PLAYER_BINDING_IMPORT_DRIFT'],
  ['runtime dependency order',runtime,s=>s.replace(
    '//@require SceneSearchPlacement','//@require OtherPlacement'),'SCUI_PLAYER_BINDING_DEPENDENCY_DRIFT'],
  ['unreviewed runtime change',runtime,s=>s.replace(
    'class SceneSearchPlayerBinding {','class SceneSearchPlayerBinding { /* foreign */'),
    'SCUI_FOREIGN_EDIT_SceneSearchPlayerBinding']
 ];
 for(const [title,file,mutate,error]of mutations){
  it('rejects '+title+' before any product write',async()=>{
   await fixture(({f,put})=>{
    const original=fs.readFileSync(f(file),'utf8'),changed=mutate(original);
    assert.notStrictEqual(changed,original);
    put(file,changed);
   },({f,sync})=>{
    const before=fs.readFileSync(f(runtime));
    const meta=fs.readFileSync(f(manifest));
    assert.throws(()=>sync('--write',name),e=>e.message.includes(error));
    assert.deepStrictEqual(fs.readFileSync(f(runtime)),before);
    assert.deepStrictEqual(fs.readFileSync(f(manifest)),meta);
   });
  });
 }
});
