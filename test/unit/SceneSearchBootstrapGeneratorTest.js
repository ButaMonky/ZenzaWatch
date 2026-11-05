'use strict';
const assert=require('assert');
const fs=require('fs'),os=require('os'),path=require('path');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..');
const runtime='packages/zenza/src/sceneSearch/SceneSearchLayoutBootstrap.js';
const emitted='tools/typescript-stage1/.generated/scui/SceneSearchLayoutBootstrap.js';
const source='tools/typescript-stage1/nico-src/SceneSearchLayoutBootstrap.ts';
const generator='tools/typescript-stage1/scripts/sync-scui.mjs';
const manifest='tools/typescript-stage1/scui-runtime-manifest.json';
const sym=['SceneSearchPreviewView','SceneSearchLayoutCard','SceneSearchLayout00',
 'SceneSearchLayoutRegistry','SceneSearchLayoutCatalog','registerSceneLayouts01_02',
 'SceneSearchLayouts03_04','SceneSearchLayouts05_06','SceneSearchLayout07',
 'SceneSearchLayouts08_09','SceneSearchLayout10'];
async function fixture(prepare,check){
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'scui-bootstrap-policy-'));
 const p=r=>path.join(d,r);
 const write=(n,s)=>{
  fs.mkdirSync(path.dirname(p(n)),{recursive:true});
  fs.writeFileSync(p(n),s);
 };
 try{
  for(const n of [runtime,emitted,source,generator])write(n,fs.readFileSync(path.join(root,n)));
  const data=JSON.parse(fs.readFileSync(path.join(root,manifest),'utf8'));
  write(manifest,JSON.stringify({SceneSearchLayoutBootstrap:data.SceneSearchLayoutBootstrap},null,2)+'\n');
  if(prepare)prepare({p,write});
  const mod=await new Function('url','return import(url)')(pathToFileURL(p(generator)).href);
  await check({p,write,sync:mod.sync});
 }finally{fs.rmSync(d,{recursive:true,force:true,maxRetries:3});}
}
describe('P13-16 bootstrap generator fixed eleven dependencies',()=>{
 it('retains all exact eleven import/require pairs and all eleven canonical layouts',async()=>{
  await fixture(null,({p,sync})=>{
   assert.strictEqual(sync('--check','SceneSearchLayoutBootstrap'),1);
   const js=fs.readFileSync(p(runtime),'utf8');
   const imports=js.match(/^import \{.+$/gm)||[];
   const requires=js.match(/^\/\/@require .+$/gm)||[];
   assert.strictEqual(imports.length,11);
   assert.deepStrictEqual(requires,sym.map(n=>'//@require '+n));
   assert(js.includes('registry.list().length !== 11'));
   assert(js.trimEnd().endsWith('export {createSceneSearchLayoutRegistry};'));
  });
 });
 const changes=[
  ['missing import',s=>s.replace(/^import \{ SceneSearchLayout10 \}.*\n/m,''),'SCUI_BOOTSTRAP_IMPORT_DRIFT',emitted],
  ['foreign import',s=>s+'import { Foreign } from "./Foreign";\n','SCUI_BOOTSTRAP_IMPORT_DRIFT',emitted],
  ['wrong import order',s=>s.replace(
    "import { SceneSearchLayoutCard } from './SceneSearchLayoutCard';",
    "import { SceneSearchLayoutCard } from './SceneSearchLayout00';"),'SCUI_BOOTSTRAP_IMPORT_DRIFT',emitted],
  ['omitted provider registration',s=>s.replace('registry.list().length !== 11','registry.list().length !== 10'),'SCUI_BOOTSTRAP_SHAPE_DRIFT',emitted],
  ['foreign runtime marker',s=>s.replace('//===END===','// modified by foreign owner\n//===END==='),'SCUI_FOREIGN_EDIT_SceneSearchLayoutBootstrap',runtime],
  ['wrong runtime directive',s=>s.replace('//@require SceneSearchLayout10','//@require WrongLayout'),'SCUI_BOOTSTRAP_DEPENDENCY_DRIFT',runtime]
 ];
 for(const [label,change,error,target] of changes){
  it('rejects '+label+' before touching output or manifest',async()=>{
   await fixture(({p,write})=>{
    const s=fs.readFileSync(p(target),'utf8');
    write(target,change(s));
   },({p,sync})=>{
    const before=fs.readFileSync(p(runtime));
    const old=fs.readFileSync(p(manifest));
    assert.throws(()=>sync('--write','SceneSearchLayoutBootstrap'),
      e=>e.message.includes(error));
    assert.deepStrictEqual(fs.readFileSync(p(runtime)),before);
    assert.deepStrictEqual(fs.readFileSync(p(manifest)),old);
   });
  });
 }
});
