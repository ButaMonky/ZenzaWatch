// Task451: offline, independent Git fixtures for the common TypeScript build gate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {
  mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync
} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MODULES,MODULE_BY_ID} from '../scripts/module-registry.mjs';
import {
  syncModules,prepareModule,applyPlans,renderLegacy,sha,safeDiagnostic
} from '../scripts/generator-core.mjs';

const sourceRepo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const originals={
  'official-route':'tools/typescript-stage1/test/fixtures/OfficialPlayerRoute.before-task448.js',
  'style-switcher':'tools/typescript-stage1/test/fixtures/StyleSwitcher.before-task450.js',
  'raf-timing':'tools/typescript-stage1/test/fixtures/RequestAnimationFrame.before-task462.js'
};
const read=(root,rel)=>readFileSync(resolve(root,rel),'utf8');
function put(root,rel,content){
  const path=resolve(root,rel);
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,content);
}
function git(root,...args){
  return execFileSync('git',['-C',root,...args],{
    encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']
  }).trim();
}
function isolatedFixture(t){
  const home=mkdtempSync(join(tmpdir(),'zw-ts451-'));
  t.after(()=>rmSync(home,{recursive:true,force:true}));
  const repo=join(home,'repo');
  mkdirSync(repo);
  for(const spec of MODULES){
    for(const item of [spec.source,spec.emitted]){
      put(repo,item,read(sourceRepo,item));
    }
    put(repo,spec.runtime,read(sourceRepo,originals[spec.id]));
  }
  git(repo,'init','-q','-b','main');
  git(repo,'config','user.name','Synthetic Fixture');
  git(repo,'config','user.email','fixture@example.invalid');
  git(repo,'add','.');
  git(repo,'commit','-qm','local baseline');
  return repo;
}

test('registry is fixed, unique and contains only expected product modules',()=>{
  assert.deepEqual(MODULES.map(s=>s.id),['official-route','style-switcher','raf-timing']);
  assert.equal(new Set(MODULES.map(s=>s.runtime)).size,MODULES.length);
  assert.equal(new Set(MODULES.map(s=>s.manifest)).size,MODULES.length);
  for(const spec of MODULES){
    assert.ok(Object.isFrozen(spec));
    assert.ok(Object.isFrozen(spec.errors));
    assert.ok(!spec.runtime.startsWith('/')&&!spec.runtime.includes('..'));
    assert.ok(!spec.source.includes('..')&&!spec.manifest.includes('..'));
  }
});
test('shared renderer preserves canonical legacy runtime bytes',()=>{
  for(const spec of MODULES){
    assert.equal(renderLegacy(spec,read(sourceRepo,spec.emitted)),
      read(sourceRepo,spec.runtime));
  }
});
test('single transaction migrates all modules and verifies their manifests',t=>{
  const repo=isolatedFixture(t);
  const built=syncModules(MODULES,'--write',repo);
  assert.deepEqual(built.map(x=>x.status),['UPDATED','UPDATED','UPDATED']);
  const checked=syncModules(MODULES,'--check',repo);
  assert.deepEqual(checked.map(x=>x.status),['PASS','PASS','PASS']);
  for(const spec of MODULES){
    assert.equal(read(repo,spec.runtime),
      renderLegacy(spec,read(repo,spec.emitted)));
    const manifest=JSON.parse(read(repo,spec.manifest));
    assert.equal(manifest.runtimeSha256,sha(read(repo,spec.runtime)));
    assert.equal(manifest.sourceSha256,sha(read(repo,spec.source)));
  }
  const repeated=syncModules(MODULES,'--write',repo);
  assert.deepEqual(repeated.map(x=>x.status),['UNCHANGED','UNCHANGED','UNCHANGED']);
});
test('manual edit of second module rejects entire batch before first is written',t=>{
  const repo=isolatedFixture(t);
  syncModules(MODULES,'--write',repo);
  const first=MODULE_BY_ID['official-route'];
  const second=MODULE_BY_ID['style-switcher'];
  const before=read(repo,first.manifest);
  put(repo,first.source,read(repo,first.source)+'\n// valid TypeScript-only documentation\n');
  put(repo,second.runtime,read(repo,second.runtime)+'\n// manual edit\n');
  assert.throws(()=>syncModules(MODULES,'--write',repo),
    /STYLE_RUNTIME_HAS_FOREIGN_EDITS/);
  assert.equal(read(repo,first.manifest),before);
});
test('malformed second compiler output prevents all first-module changes',t=>{
  const repo=isolatedFixture(t);
  syncModules(MODULES,'--write',repo);
  const first=MODULE_BY_ID['official-route'];
  const second=MODULE_BY_ID['style-switcher'];
  const before=read(repo,first.manifest);
  put(repo,first.source,read(repo,first.source)+'\n// documentation change\n');
  put(repo,second.emitted,'import unsafe from "elsewhere";\nexport { StyleSwitcher };');
  assert.throws(()=>syncModules(MODULES,'--write',repo),
    /STYLE_TS_OUTPUT_INVALID/);
  assert.equal(read(repo,first.manifest),before);
});
test('stale canonical TS source is a hard check failure',t=>{
  const repo=isolatedFixture(t);
  syncModules(MODULES,'--write',repo);
  const first=MODULE_BY_ID['official-route'];
  put(repo,first.source,read(repo,first.source)+'\n// unseen migration change\n');
  assert.throws(()=>syncModules(MODULES,'--check',repo),/MANIFEST_STALE/);
});
test('commit outside of generator is never silently replaced',t=>{
  const repo=isolatedFixture(t);
  syncModules(MODULES,'--write',repo);
  git(repo,'add','.');
  git(repo,'commit','-qm','generated versions');
  const changed=MODULE_BY_ID['style-switcher'];
  put(repo,changed.runtime,read(repo,changed.runtime)+'\n// foreign committed change\n');
  git(repo,'add',changed.runtime);
  git(repo,'commit','-qm','independent owner edit');
  assert.throws(()=>syncModules(MODULES,'--write',repo),
    /BASELINE_DIFFERS_FROM_MANIFEST/);
});
test('unregistered module, duplicate module and unsupported mode are rejected',t=>{
  const repo=isolatedFixture(t);
  const forged={...MODULES[0],runtime:'../other/secret.js'};
  assert.throws(()=>prepareModule(forged,repo,'--write'),
    /UNREGISTERED_TYPESCRIPT_MODULE/);
  assert.throws(()=>syncModules([MODULES[0],MODULES[0]],'--write',repo),
    /TYPESCRIPT_MODULE_SELECTION_INVALID/);
  assert.throws(()=>syncModules(MODULES,'--delete',repo),
    /TYPESCRIPT_MODE_INVALID/);
});
test('failed staging cannot modify any destination or leave its first temp',t=>{
  const repo=isolatedFixture(t);
  const plans=MODULES.map(spec=>prepareModule(spec,repo,'--write'));
  const changed=plans[0];
  const tmp=changed.manifestPath+'.tsgen-'+process.pid+'-1.tmp';
  writeFileSync(tmp,'occupied',{flag:'wx'});
  t.after(()=>{if(existsSync(tmp))rmSync(tmp)});
  const initial=read(repo,MODULES[0].runtime);
  assert.throws(()=>applyPlans(plans),/EEXIST/);
  assert.equal(read(repo,MODULES[0].runtime),initial);
  assert.equal(existsSync(changed.runtimePath+'.tsgen-'+process.pid+'-0.tmp'),false);
});

test('an input changed after preflight blocks write without touching the runtime',t=>{
  const repo=isolatedFixture(t);
  const plans=MODULES.map(spec=>prepareModule(spec,repo,'--write'));
  const item=MODULE_BY_ID['official-route'];
  const before=read(repo,item.runtime);
  put(repo,item.source,read(repo,item.source)+'\n// intervening owner edit\n');
  assert.throws(()=>applyPlans(plans),/TYPESCRIPT_INPUT_CHANGED_DURING_WRITE/);
  assert.equal(read(repo,item.runtime),before);
  assert.equal(existsSync(resolve(repo,item.manifest)),false);
});

test('failure diagnostics do not reveal local paths or raw fixture content',()=>{
  assert.equal(safeDiagnostic(Error('RUNTIME_FILE_DIRTY_REFUSED')),
    'RUNTIME_FILE_DIRTY_REFUSED');
  assert.equal(safeDiagnostic(Object.assign(Error('cannot open secret local path'),{
    code:'EACCES'
  })),'IO_EACCES');
  assert.equal(safeDiagnostic(Error('C:\\Users\\Private\\token.txt')),
    'TYPESCRIPT_OPERATION_FAILED');
  assert.equal(safeDiagnostic(Error('raw response: Authorization: secret')),
    'TYPESCRIPT_OPERATION_FAILED');
});
