// P12 acceptance gate: no stale TypeScript emit or source-only UI features.
// This script is read-only. It cannot write files or bypass a Windows lock.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const read=relative=>{
 const target=path.join(root,relative);
 if(!fs.existsSync(target))throw Error('P12_MISSING_FILE_'+relative);
 return fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n');
};
const sha=text=>createHash('sha256').update(text).digest('hex');
const errors=[];
const assert=(condition,message)=>{if(!condition)errors.push(message);};
const includesOnce=(text,needle)=>
 text.split(needle).length===2;
const groups=[
 {name:'VideoControlBar',features:[
  '_onResumeMarkerDelete(', 'refreshAutoResumePointers(',
  "'deleteAutomaticResume'", "addEventListener('contextmenu'"]},
 {name:'NicoVideoPlayerDialog',features:[
  '_deleteAutomaticResume(', "case 'deleteAutomaticResume':",
  'AutoResumeClearCoordinator(', '_isAutoResumeSaveSuppressed(',
  'ManualBookmarkDock.mount(', 'manualBookmarkDock?.deactivate()']},
 {name:'VideoInfo',features:[
  'selectAutoResume({','resumeClearedAt']}
];
for(const group of groups){
 const ts=read('tools/typescript-stage1/nico-src/'+group.name+'.ts');
 const generated=read('tools/typescript-stage1/.generated/nico/'+group.name+'.js');
 const runtime=read('src/'+group.name+'.js');
 const manifest=JSON.parse(read('tools/typescript-stage1/nico-api-manifests/'+group.name+'.json'));
 assert(manifest.sourceSha256===sha(ts),group.name+'_SOURCE_MANIFEST_DRIFT');
 assert(manifest.runtimeSha256===sha(runtime),group.name+'_RUNTIME_MANIFEST_DRIFT');
 for(const keyword of group.features){
  assert(ts.includes(keyword),group.name+'_TS_MISSING_'+keyword);
  assert(generated.includes(keyword),group.name+'_EMITTED_MISSING_'+keyword);
  assert(runtime.includes(keyword),group.name+'_RUNTIME_STALE_'+keyword);
 }
}
const template=read('src/_template.js');
const dist=read('dist/ZenzaWatch-dev.user.js');
const sources=[
 ["selectAutoResume","../packages/zenza/src/resume/AutoResumePolicy"],
 ["AutoResumeClearCoordinator","../packages/zenza/src/resume/AutoResumeClearCoordinator"],
 ["ManualBookmarkSession","../packages/zenza/src/resume/ManualBookmarkSession"],
 ["ManualBookmarkDock","../packages/zenza/src/resume/ManualBookmarkDock"]
];
for(const [name,rel] of sources){
 assert(includesOnce(template,'import {'+name+"} from '"+rel+"';"),
  'TEMPLATE_IMPORT_DRIFT_'+name);
 assert(includesOnce(template,'//@require '+name),'TEMPLATE_REQUIRE_DRIFT_'+name);
 assert(dist.includes('function '+name+'(')||dist.includes('class '+name+' {'),
  'DIST_MISSING_'+name);
}
const manualImport="import {IndexedDbManualBookmarkBackend, ManualBookmarkRepository} "+
 "from '../packages/zenza/src/resume/ManualBookmarkStore';";
assert(includesOnce(template,manualImport),'MANUAL_STORE_TEMPLATE_IMPORT');
assert(includesOnce(template,'//@require ManualBookmarkRepository'),
 'MANUAL_STORE_TEMPLATE_REQUIRE');
const manualModules=['ManualBookmarkPolicy','ManualBookmarkStore',
 'ManualBookmarkSession','ManualBookmarkPanel','ManualBookmarkDock'];
const manualManifest=JSON.parse(read('tools/typescript-stage1/p12-manual-manifest.json'));
assert(manualManifest.version===1&&manualManifest.modules?.length===5,
 'MANUAL_MANIFEST_SHAPE');
for(const [i,name] of manualModules.entries()){
 const item=manualManifest.modules?.[i];
 const expectedSource='tools/typescript-stage1/p12-src/'+name+'.ts';
 const expectedEmitted='tools/typescript-stage1/.generated/p12/'+name+'.js';
 const expectedRuntime='packages/zenza/src/resume/'+name+'.js';
 const src=read(expectedSource),emitted=read(expectedEmitted),runtime=read(expectedRuntime);
 assert(item?.name===name&&item?.source===expectedSource&&
   item?.runtime===expectedRuntime,'MANUAL_MANIFEST_MODULE_'+name);
 assert(item?.sourceSha256===sha(src),'MANUAL_SOURCE_HASH_'+name);
 assert(item?.emittedSha256===sha(emitted),'MANUAL_EMIT_HASH_'+name);
 assert(item?.runtimeSha256===sha(runtime),'MANUAL_RUNTIME_HASH_'+name);
 assert(runtime.includes('//===BEGIN===')&&runtime.includes('//===END==='),
   'MANUAL_LEGACY_BOUNDARIES_'+name);
 assert(runtime.includes('export {')&&runtime.includes('const {'),
   'MANUAL_EXPORT_OWNER_'+name);
}
assert((template.indexOf('//@require ManualBookmarkRepository')<
 template.indexOf('//@require ManualBookmarkSession')&&
 template.indexOf('//@require ManualBookmarkSession')<
 template.indexOf('//@require ManualBookmarkDock')&&
 template.indexOf('//@require ManualBookmarkDock')<
 template.indexOf('//@require NicoVideoPlayerDialog')),
 'MANUAL_DEPENDENCY_ORDER');
assert(dist.includes('class ManualBookmarkDock {')&&
 dist.includes('class ManualBookmarkSession {')&&
 dist.includes('class ManualBookmarkRepository {'),
 'MANUAL_DIST_RUNTIME_MISSING');
assert((template.indexOf('//@require selectAutoResume')<
  template.indexOf('//@require VideoInfoModel')),'VIDEOINFO_OWNER_ORDER');
assert((template.indexOf('//@require AutoResumeClearCoordinator')<
  template.indexOf('//@require NicoVideoPlayerDialog')),'DIALOG_OWNER_ORDER');
assert((dist.match(/class="resumePointer"/g)||[]).length===5,
 'NATIVE_FIVE_MARKERS_CHANGED');
if(errors.length){
 for(const name of errors)console.error('P12_RUNTIME_BLOCKED '+name);
 process.exitCode=1;
}else{
 console.log('P12_UI_RUNTIME_PARITY PASS: 3 Nico modules, 5 P12 manual'+
  ' runtime modules, onepoint/delete owners and original five native markers');
}
