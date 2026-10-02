import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {normalizeWatch} from '../src/core.mjs';
import {watch,comment} from './fixtures.mjs';
const tool=new URL('../tools/build-zenza.mjs',import.meta.url);
const api=fs.existsSync(tool)?await import(tool):{};
const sourceDir=fileURLToPath(new URL('../src',import.meta.url));
function build(entries=['core.mjs','session.mjs','zenza-context.mjs'],namespace='TestCore',dir=sourceDir){
  assert.equal(typeof api.renderZenzaBundle,'function','the generator is implemented');
  return api.renderZenzaBundle({sourceDir:dir,entries,namespace});
}
function scriptOnly(code){return [...code.matchAll(/\/\/===BEGIN===([\s\S]*?)\/\/===END===/g)].map(m=>m[1]).join('\n');}
function evaluate(code,names=['TestCore']){
  const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,URL,URLSearchParams,performance,Response});
  vm.runInContext(scriptOnly(code)+'\nthis.result={'+names.join(',')+'};',context);
  return context.result;
}
function sandbox(files,work){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch-build-test-'));try{for(const [name,text]of Object.entries(files))fs.writeFileSync(path.join(dir,name),text);return work(dir);}finally{fs.rmSync(dir,{recursive:true,force:true});}}
const json=v=>JSON.parse(JSON.stringify(v));
test('generated source contains one Zenza section and no standalone UI entry',()=>{
  const code=build();assert.equal(code.split('//===BEGIN===').length,2);assert.equal(code.split('//===END===').length,2);
  assert(!/GM_registerMenuCommand|window\.alert|document\.querySelector/.test(code));
  assert(!/^\s*(import|export)\b/m.test(scriptOnly(code)));assert(code.includes('export {TestCore};'));assert.equal(typeof evaluate(code).TestCore.HistorySession,'function');
});
test('generated and native core return the same normalized context',()=>{
  const {TestCore}=evaluate(build());const raw=watch();
  assert.deepEqual(json(TestCore.normalizeWatch(raw,'sm1')),json(normalizeWatch(raw,'sm1')));
  assert(!JSON.stringify(TestCore.normalizeWatch(raw,'sm1')).includes('SYNTHETIC_TEST_SECRET'));
});
test('core and settings bundles coexist without leaking their module internals',()=>{
  const code=build(undefined,'TestCore')+'\n'+build(['settings.mjs','zenza-settings.mjs'],'TestSettings');
  const context=vm.createContext({console,setTimeout,clearTimeout,AbortController,URL,performance});
  vm.runInContext(scriptOnly(code)+'\nthis.result={TestCore,TestSettings,leaked:typeof HistoryError};',context);
  assert.equal(context.result.leaked,'undefined');assert.equal(context.result.TestSettings.SETTINGS_SCHEMA.length,9);
  assert.equal(typeof context.result.TestSettings.ZenzaSettingsRepository,'function');
});
test('generated session uses provided baseline without normal-load or metadata requests',async()=>{
  const {TestCore}=evaluate(build(['core.mjs','session.mjs','coordinator.mjs']));
  const ctx=TestCore.normalizeWatch(watch(),'sm1');const calls=[];let now=0;
  const settings={maxAdditionalComments:1};
  const coordinator=new TestCore.RequestCoordinator({settings,now:()=>now,sleep:async ms=>{now+=ms;}});
  const s=new TestCore.HistorySession(ctx,{settings,coordinator,
    baseline:[{id:'10',fork:'owner',commentCount:0,comments:[]},{id:'10',fork:'main',commentCount:500,comments:[comment(10,100)]}],
    fetchPage:async(c,opts)=>{calls.push(opts);return[{id:'10',fork:'main',commentCount:400,comments:[comment(9,90)]}];}});
  const report=await s.run({startWhen:120});assert.equal(calls.length,1);assert.equal(report.counts.additionalCount,1);
  assert.equal(report.network.requestsByKind.metadata,0);assert.equal(report.network.requestsByKind.comment,1);
});
test('duplicate entry and dependency is included only once',()=>{
  const code=build(['core.mjs','core.mjs','session.mjs']);assert.equal((code.match(/class HistoryError extends Error/g)||[]).length,1);
});
test('module-private identical names do not collide',()=>sandbox({'a.mjs':'const hidden=1;\nexport const first=hidden;','b.mjs':'const hidden=2;\nexport const second=hidden;'},dir=>{
  const result=evaluate(build(['a.mjs','b.mjs'],'TestCore',dir)).TestCore;assert.equal(result.first,1);assert.equal(result.second,2);
}));
test('generation is deterministic and changes when a dependency changes',()=>sandbox({'a.mjs':"import {value} from './b.mjs';\nexport const output=value;",'b.mjs':'export const value=1;'},dir=>{
  const first=build(['a.mjs'],'TestCore',dir);assert.equal(first,build(['a.mjs'],'TestCore',dir));
  fs.writeFileSync(path.join(dir,'b.mjs'),'export const value=2;');assert.notEqual(first,build(['a.mjs'],'TestCore',dir));
}));
test('unknown namespace and source paths are rejected',()=>{
  for(const ns of ['','x.y','x;throw 1','class'])assert.throws(()=>build(undefined,ns));
  assert.throws(()=>build(['../private.mjs']));
});
test('unsupported default, alias, reexport and dynamic import fail explicitly',()=>{
  for(const text of ["import v from './b.mjs';\nexport const output=v;","import {v as w} from './b.mjs';\nexport const output=w;","export {v} from './b.mjs';","export default 1;","export async function get(){return import('./b.mjs');}"]){
    sandbox({'a.mjs':text,'b.mjs':'export const v=1;'},dir=>assert.throws(()=>build(['a.mjs'],'TestCore',dir)));
  }
});
test('cyclic and missing dependencies or missing imported exports fail',()=>{
  for(const files of [
    {'a.mjs':"import {b} from './b.mjs';\nexport const a=1;",'b.mjs':"import {a} from './a.mjs';\nexport const b=2;"},
    {'a.mjs':"import {b} from './b.mjs';\nexport const a=1;"},
    {'a.mjs':"import {b} from './b.mjs';\nexport const a=1;",'b.mjs':'export const c=2;'}]){
    sandbox(files,dir=>assert.throws(()=>build(['a.mjs'],'TestCore',dir)));
  }
});
test('duplicate public exports from different entries fail rather than overwrite',()=>sandbox({'a.mjs':'export const shared=1;','b.mjs':'export const shared=2;'},dir=>assert.throws(()=>build(['a.mjs','b.mjs'],'TestCore',dir))));
test('symlink escaping the source root is rejected',()=>sandbox({'a.mjs':'export const value=1;'},dir=>{
  const other=fs.mkdtempSync(path.join(os.tmpdir(),'ch-outside-'));try{fs.writeFileSync(path.join(other,'b.mjs'),'export const b=2;');// A Windows directory junction needs no file-symlink privilege; both fixtures must hit the same realpath escape check.
  if(process.platform==='win32'){fs.symlinkSync(other,path.join(dir,'b.mjs'),'junction');}else{fs.symlinkSync(path.join(other,'b.mjs'),path.join(dir,'b.mjs'));}
  assert.throws(()=>build(['b.mjs'],'TestCore',dir),/Module escapes source root: b[.]mjs/);}finally{fs.rmSync(other,{recursive:true,force:true});}
}));
test('CLI builds deterministic files and check-only does not change them',()=>{
  assert(fs.existsSync(tool),'generator CLI exists');const root=fileURLToPath(new URL('..',import.meta.url));
  const buildRun=spawnSync(process.execPath,[fileURLToPath(tool)],{cwd:root,encoding:'utf8'});assert.equal(buildRun.status,0,buildRun.stderr);
  const folder=path.join(root,'src','generated');const names=fs.readdirSync(folder).sort();assert.equal(names.length,4);
  const before=names.map(n=>fs.readFileSync(path.join(folder,n),'utf8'));
  const run=spawnSync(process.execPath,[fileURLToPath(tool),'--check'],{cwd:root,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  assert.deepEqual(names.map(n=>fs.readFileSync(path.join(folder,n),'utf8')),before);
});

test('check-only detects edited output and never repairs it implicitly',()=>{
  const root=fileURLToPath(new URL('..',import.meta.url));
  const run=()=>spawnSync(process.execPath,[fileURLToPath(tool),'--check'],{cwd:root,encoding:'utf8'});
  const artifact=path.join(root,'src','generated','ZenzaCommentHistoryCore.generated.js');
  const previous=fs.readFileSync(artifact,'utf8');
  try{fs.writeFileSync(artifact,previous+'// deliberate mismatch\n');const changed=fs.readFileSync(artifact,'utf8');assert.equal(run().status,1);assert.equal(fs.readFileSync(artifact,'utf8'),changed);}finally{fs.writeFileSync(artifact,previous);}
});
test('source validation failure does not overwrite pre-existing generated artifacts',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ch-build-cli-'));
  try{
    for(const name of ['src','tools','src/generated'])fs.mkdirSync(path.join(dir,name));
    fs.copyFileSync(tool,path.join(dir,'tools','build-zenza.mjs'));
    for(const name of ['core','coordinator','session','zenza-context','settings','zenza-settings'])fs.writeFileSync(path.join(dir,'src',name+'.mjs'),'export const v'+name.replaceAll('-','')+'=1;');
    fs.writeFileSync(path.join(dir,'src','zenza-settings.mjs'),'export default 1;');
    const names=['ZenzaCommentHistoryCore.generated.js','ZenzaCommentHistorySettings.generated.js','MANIFEST.json'];
    for(const name of names)fs.writeFileSync(path.join(dir,'src','generated',name),'unchanged');
    const run=spawnSync(process.execPath,[path.join(dir,'tools','build-zenza.mjs')],{encoding:'utf8'});
    assert.equal(run.status,1);for(const name of names)assert.equal(fs.readFileSync(path.join(dir,'src','generated',name),'utf8'),'unchanged');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
