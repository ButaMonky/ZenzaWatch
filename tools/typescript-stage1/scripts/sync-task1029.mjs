// Task1029: TypeScript -> userscript generator for the playback-rate module (warm-swap was removed; see docs/design-pack/reference/task1029-warm-swap/).
// Same fixed allowlist, export check, manifest and transactional writer as sync-hls.mjs.
// No network, no git commands, no arbitrary CLI paths.
import {readFileSync,existsSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {lf,sha,applyPlans,safeDiagnostic} from './generator-core.mjs';
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'../../..'));
// shape: [name, exported symbols joined by comma]
const modules=[
 ['PlaybackRateReconciler','PlaybackRateReconciler,createPlaybackRateReconciler,normalizeRate,MIN_RATE,MAX_RATE']
];
// Only exports present in the reviewed canonical TypeScript may appear in emitted JS.
const exportedValues=text=>{
 const normalized=lf(text);
 const declarations=[...normalized.matchAll(/^export\s+(?:const|let|class|function)\s+([A-Za-z_$][\w$]*)/gm)]
  .map(match=>match[1]).sort();
 const named=[...normalized.matchAll(/^export\s*\{([^}]+)\}\s*;?/gm)]
  .flatMap(match=>match[1].split(',').map(x=>x.trim().replace(/\s+as\s+.+$/,'')).filter(Boolean)).sort();
 return JSON.stringify({declarations,named});
};
const read=path=>existsSync(path)?readFileSync(path,'utf8'):null;
const mode=process.argv[2];
try{
 if(!['--write','--check'].includes(mode)||process.argv.length!==3)throw Error('TASK1029_SYNC_MODE_INVALID');
 const plans=modules.map(([name,exports])=>{
  const source=`tools/typescript-stage1/nico-src/${name}.ts`,runtime=`packages/zenza/src/videoPlayer/${name}.js`;
  const sourcePath=resolve(root,source);
  const emittedPath=resolve(root,`tools/typescript-stage1/.generated/task1029/nico-src/${name}.js`);
  const runtimePath=resolve(root,runtime),manifestPath=resolve(root,`tools/typescript-stage1/task1029-manifests/${name}.json`);
  const sourceText=readFileSync(sourcePath,'utf8'),emitted=readFileSync(emittedPath,'utf8');
  if(exportedValues(sourceText)!==exportedValues(emitted))throw Error('TASK1029_SYNC_BODY_INVALID');
  const body=lf(emitted).replace(/^export (function|class|const|let) /gm,(_,kind)=>kind+' ').replace(/^export \{[^}]*\};\s*$/gm,'').trimEnd();
  if(/^\s*(?:import|export)\s/m.test(body)||body.includes('//===BEGIN===')||body.includes('//===END==='))throw Error('TASK1029_SYNC_BODY_INVALID');
  const expected=[
   `// GENERATED FROM ${source} (Task1029). Edit TypeScript and run npm run task1029:sync.`,
   '//===BEGIN===',body,'//===END===',`export {${exports}};`,''].join('\n');
  const actual=read(runtimePath),priorManifest=read(manifestPath);
  const manifest=priorManifest&&JSON.parse(priorManifest);
  if(manifest&&(manifest.source!==source||manifest.runtime!==runtime||manifest.schemaVersion!==1))throw Error('TASK1029_SYNC_MANIFEST_INVALID');
  const desiredManifest=JSON.stringify({schemaVersion:1,source,runtime,sourceSha256:sha(sourceText),runtimeSha256:sha(expected)},null,2)+'\n';
  if(mode==='--check'){
   if(actual===null||lf(actual)!==expected||lf(priorManifest)!==desiredManifest)throw Error('TASK1029_SYNC_STALE');
  }else if(actual!==null&&lf(actual)!==expected&&(!manifest||sha(actual)!==manifest.runtimeSha256))throw Error('TASK1029_SYNC_FOREIGN_EDIT');
  return {sourcePath,emittedPath,runtimePath,manifestPath,sourceSha256:sha(sourceText),emittedSha256:sha(emitted),actual,expected,priorManifest,desiredManifest};
 });
 if(mode==='--write'){
  for(const p of plans){mkdirSync(dirname(p.runtimePath),{recursive:true});mkdirSync(dirname(p.manifestPath),{recursive:true});}
  applyPlans(plans);
 }
 console.log('TASK1029_SYNC=PASS modules='+modules.length);
}catch(error){console.error(safeDiagnostic(error));process.exitCode=1;}
