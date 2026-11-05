'use strict';
// P13-09C: five Bridge dependencies, AST parity and local atomicity.
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const crypto=require('crypto'),babel=require('@babel/parser');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..');
const name='SceneSearchIntegrationBridge';
const runtime='packages/zenza/src/sceneSearch/'+name+'.js';
const emitted='tools/typescript-stage1/.generated/scui/'+name+'.js';
const source='tools/typescript-stage1/nico-src/'+name+'.ts';
const generator='tools/typescript-stage1/scripts/sync-scui.mjs';
const manifest='tools/typescript-stage1/scui-runtime-manifest.json';
const symbols=['SceneSearchDomLease','SceneSearchLayoutResources',
 'SceneSearchPreferenceConnection','SceneSearchObstacleCollector',
 'SceneSearchVisibleRectCollector'];
// P15 Issue #152: Bridge.start() now stops after synchronous disposal during
// layout mount and listener registration. The five runtime dependencies remain
// fixed; update this reviewed execution digest only for the verified guard edit.
// Never derive the digest from the generated manifest.
const baseAstHash='ec51f52fc714f774f6073c8572235f831ca04f41495f95d8dae2213bf433f8b8';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function executionAst(script){
 const body=script.split('//===BEGIN===\n')[1]?.split('\n//===END===')[0];
 assert(body,'SCUI runtime markers missing');
 const withoutRequires=body.replace(/^(?:\/\/@require [^\n]+\n){5}/,'');
 const ast=babel.parse(withoutRequires,{sourceType:'script',
  plugins:['classProperties','optionalChaining']}).program.body;
 return sha(JSON.stringify(ast,(key,value)=>
  ['start','end','loc','extra','comments','leadingComments',
    'trailingComments','innerComments'].includes(key)?undefined:value));
}
async function fixture(prepare,check){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'p13-bridge-generator-'));
 const file=p=>path.join(dir,p);
 const put=(rel,contents)=>{
  fs.mkdirSync(path.dirname(file(rel)),{recursive:true});
  fs.writeFileSync(file(rel),contents);
 };
 try{
  for(const rel of [runtime,emitted,source,generator])put(rel,read(rel));
  const manifestData=JSON.parse(read(manifest));
  put(manifest,JSON.stringify({[name]:manifestData[name]},null,2)+'\n');
  if(prepare)prepare({file,put});
  const url=pathToFileURL(file(generator)).href;
  const code=await new Function('url','return import(url)')(url);
  await check({file,put,sync:code.sync});
 }finally{fs.rmSync(dir,{recursive:true,force:true,maxRetries:3});}
}
describe('P13-09C IntegrationBridge typed runtime contract',()=>{
 it('preserves the reviewed native-release execution AST and exactly five original owners',()=>{
  const runtimeText=read(runtime),data=JSON.parse(read(manifest))[name];
  assert.strictEqual(data.runtime,runtime);
  assert.strictEqual(executionAst(runtimeText),baseAstHash);
  assert.deepStrictEqual(runtimeText.match(/^\/\/@require .+$/gm),
   symbols.map(name=>'//@require '+name));
  assert.deepStrictEqual(runtimeText.match(/^import \{.+$/gm),
   symbols.map(name=>"import {"+name+"} from './"+name+"';"));
  assert(runtimeText.startsWith('// GENERATED FROM '+source+'\n'));
 });
 for(const [label,before,after] of [
  ['legacy non-Node exit guard',"!!node && 'nodeType' in node && root.contains(node)",
   '!!node && root.contains(node)'],
  ['modern non-Node focus guard',"!target || !('nodeType' in target) || !node.contains(target)",
   '!target || !node.contains(target)']
 ]){
  it('rejects removal of the '+label+' through the fixed execution digest',()=>{
   const original=read(runtime),mutated=original.replace(before,after);
   assert.notStrictEqual(mutated,original,'mutation must reach the real runtime');
   assert.strictEqual(executionAst(original),baseAstHash);
   assert.notStrictEqual(executionAst(mutated),baseAstHash);
  });
 }
 it('verifies the checked-in manifest and runtime without writes',async()=>{
  await fixture(null,({sync})=>assert.strictEqual(
   sync('--check',name),1));
 });
 const broken=[
  ['additional emitted import',emitted,s=>
    "import { RogueOwner } from './RogueOwner';\n"+s,'SCUI_BRIDGE_IMPORT_DRIFT'],
  ['missing emitted import',emitted,s=>
    s.replace(/^import \{ SceneSearchVisibleRectCollector \}.*\n/m,''),'SCUI_BRIDGE_IMPORT_DRIFT'],
  ['reordered emitted dependency',emitted,s=>
    s.replace("from './SceneSearchDomLease'","from './SceneSearchPreferenceConnection'"),
    'SCUI_BRIDGE_IMPORT_DRIFT'],
  ['removed legacy require',runtime,s=>
    s.replace('//@require SceneSearchDomLease\n',''),'SCUI_BRIDGE_DEPENDENCY_DRIFT'],
  ['reordered legacy requires',runtime,s=>
    s.replace('//@require SceneSearchLayoutResources','//@require UnknownResource'),'SCUI_BRIDGE_DEPENDENCY_DRIFT'],
  ['foreign bridge body',runtime,s=>
    s.replace('_getSeekGeometry(unclipped = false)', '_getSeekGeometry(unclipped = true)'),
    'SCUI_FOREIGN_EDIT_SceneSearchIntegrationBridge']
 ];
 for(const [title,path,change,error] of broken){
  it('rejects '+title+' without touching other outputs',async()=>{
   await fixture(({file,put})=>{
    const old=fs.readFileSync(file(path),'utf8'),altered=change(old);
    assert(altered!==old,'mutation fixture did not change target');
    put(path,altered);
   },({file,sync})=>{
    const original=fs.readFileSync(file(runtime));
    const metadata=fs.readFileSync(file(manifest));
    assert.throws(()=>sync('--write',name),
      failure=>failure.message.includes(error));
    assert.deepStrictEqual(fs.readFileSync(file(runtime)),original);
    assert.deepStrictEqual(fs.readFileSync(file(manifest)),metadata);
   });
  });
 }
});
