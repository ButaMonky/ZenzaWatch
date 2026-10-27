// Task453/553: offline, disposable Git regression for ten advanced-settings modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ADVANCED_MODULES} from '../scripts/advanced-registry.mjs';
import {
  syncAdvanced,prepareAdvanced,restoreLegacyRequires,canonicalJs,directiveList
} from '../scripts/sync-advanced.mjs';
import {emissionStamp,relativeStamp} from '../scripts/stamp-advanced.mjs';
import {sha} from '../scripts/generator-core.mjs';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const read=(root,rel)=>readFileSync(resolve(root,rel),'utf8');
function put(root,rel,data){
  const file=resolve(root,rel);
  mkdirSync(dirname(file),{recursive:true});
  writeFileSync(file,data);
}
function git(root,...args){
  return execFileSync('git',['-C',root,...args],{
    encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true
  }).trim();
}
function fixture(t){
  const home=mkdtempSync(join(tmpdir(),'zadvts-'));
  t.after(()=>rmSync(home,{recursive:true,force:true}));
  const dir=join(home,'repo');
  mkdirSync(dir);
  for(const spec of ADVANCED_MODULES){
    for(const rel of [spec.source,spec.runtime,spec.emitted]){
      put(dir,rel,read(repo,rel));
    }
  }
  put(dir,relativeStamp,JSON.stringify(emissionStamp(dir),null,2)+'\n');
  mkdirSync(resolve(dir,'tools/typescript-stage1/advanced-manifests'),{recursive:true});
  git(dir,'init','-q','-b','develop');
  git(dir,'config','user.name','Synthetic Fixture');
  git(dir,'config','user.email','fixture@example.invalid');
  git(dir,'add','.');
  git(dir,'commit','-qm','test baseline');
  return dir;
}
test('fixed advanced-settings registry includes exactly ten source families',()=>{
  assert.deepEqual(ADVANCED_MODULES.map(s=>s.name),[
    'ModernAdvancedSettingsModel','ModernAdvancedSettingsUI',
    'UiVisibilityRegistry','Config','_setting','ScreenshotFileName','RelatedMenuOrder',
    'RelatedMenuSettings','NgCompositeRules','NgCompositeRuleEditor'
  ]);
  for(const spec of ADVANCED_MODULES){
    assert(Object.isFrozen(spec));
    for(const rel of [spec.source,spec.runtime,spec.emitted,spec.manifest]){
      assert(!rel.startsWith('/')&&!rel.includes('..'));
    }
  }
});
test('native TS7 output preserves all ten exact JavaScript ASTs and directives',()=>{
  for(const spec of ADVANCED_MODULES){
    const actual=read(repo,spec.runtime);
    const emitted=restoreLegacyRequires(spec,read(repo,spec.emitted));
    assert.equal(sha(canonicalJs(actual)),sha(canonicalJs(emitted)),spec.name);
    assert.deepEqual(directiveList(actual),directiveList(emitted),spec.name);
  }
  const setting=ADVANCED_MODULES.find(s=>s.name==='_setting');
  // Native TS7 may retain this directive directly; both forms must resolve.
  assert(restoreLegacyRequires(setting,read(repo,setting.emitted))
    .includes('//@require uq'));
});
test('a ten-module sync updates only manifests when generated JS is equivalent',t=>{
  const dir=fixture(t);
  const before=ADVANCED_MODULES.map(spec=>sha(read(dir,spec.runtime)));
  const results=syncAdvanced('--write',{root:dir});
  assert.equal(results.length,10);
  assert(results.every(result=>result.code==='UNCHANGED'));
  assert.equal(syncAdvanced('--check',{root:dir}).length,10);
  assert.deepEqual(ADVANCED_MODULES.map(spec=>sha(read(dir,spec.runtime))),before);
  for(const spec of ADVANCED_MODULES){
    const m=JSON.parse(read(dir,spec.manifest));
    assert.equal(m.sourceSha256,sha(read(dir,spec.source)));
    assert.equal(m.runtimeSha256,sha(read(dir,spec.runtime)));
  }
  assert.equal(syncAdvanced('--write',{root:dir}).length,10);
});
test('CLI rejects stale TypeScript source without a fresh compiler stamp',t=>{
  const dir=fixture(t);
  syncAdvanced('--write',{root:dir});
  const spec=ADVANCED_MODULES[0];
  put(dir,spec.source,read(dir,spec.source)+'\n// changed\n');
  assert.throws(()=>syncAdvanced('--check',{root:dir}),/ADVANCED_EMISSION_STALE/);
  assert.throws(()=>syncAdvanced('--write',{root:dir}),/ADVANCED_EMISSION_STALE/);
});
test('CLI rejects forged or stale emitted JavaScript',t=>{
  const dir=fixture(t);
  const spec=ADVANCED_MODULES[1];
  put(dir,spec.emitted,read(dir,spec.emitted)+'\n// changed\n');
  assert.throws(()=>syncAdvanced('--write',{root:dir}),/ADVANCED_EMISSION_STALE/);
});
test('an unexpected runtime edit cannot be silently overwritten',t=>{
  const dir=fixture(t);
  syncAdvanced('--write',{root:dir});
  const spec=ADVANCED_MODULES[2];
  put(dir,spec.runtime,read(dir,spec.runtime)+'\nvoid 5;\n');
  assert.throws(()=>syncAdvanced('--write',{root:dir}),
    /ADVANCED_CODE_CHANGE_REQUIRES_EXPLICIT_REVIEW/);
});
test('an unsupported module or mode never enters the writer',t=>{
  const dir=fixture(t);
  assert.throws(()=>prepareAdvanced({
    ...ADVANCED_MODULES[0]
  },dir,'--write'),/ADVANCED_MODULE_NOT_REGISTERED/);
  assert.throws(()=>syncAdvanced('--destroy',{root:dir}),/ADVANCED_INVALID_MODE/);
});
test('missing manifests fail read-only verification',t=>{
  const dir=fixture(t);
  assert.throws(()=>syncAdvanced('--check',{root:dir}),/ADVANCED_MANIFEST_STALE/);
});
