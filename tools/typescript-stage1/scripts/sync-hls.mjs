// Fixed allowlist, canonical TypeScript only. Reuse the transactional writer.
import {readFileSync,existsSync,mkdirSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {lf,sha,applyPlans,safeDiagnostic} from './generator-core.mjs';
const root=realpathSync(resolve(dirname(fileURLToPath(import.meta.url)),'../../..'));
const modules=[['HlsLibrary','HlsLibrary'],['HlsConfig','createHlsConfig'],
 ['HlsStorage','createHlsStorage'],['HlsVideoElement','createHlsVideoElement'],
 ['HlsDebugElements','defineHlsDebugElements'],['PlaylistPreloader','PlaylistPreloader'],
 ['HlsStartupPrefetch','HlsPrefetch'],
 // Nico-side helpers share the same fully allowlisted, transactional generator.
 ['PlaylistStartupPreparer','createPlaylistStartupPreparer','nico-src','createPlaylistStartupPreparer,describeError'],
 ['PrefetchReporter','createPrefetchReporter','nico-src'],['HlsRuntime','HlsRuntime']];
// Only exports present in the reviewed canonical TypeScript may appear in emitted JS.
// The generator strips export keywords when joining the userscript; without this
// check an extra emitted `export const ...` could slip in as a new global symbol.
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
 if(!['--write','--check'].includes(mode)||process.argv.length!==3)throw Error('HLS_SYNC_MODE_INVALID');
 const plans=modules.map(([name,symbol,srcDir='hls-src',exports=symbol])=>{
  const source=`tools/typescript-stage1/${srcDir}/${name}.ts`,runtime=`packages/zenza/src/hls/${name}.js`;
  const sourcePath=resolve(root,source),emittedPath=resolve(root,`tools/typescript-stage1/.generated/hls/${srcDir}/${name}.js`);
  const runtimePath=resolve(root,runtime),manifestPath=resolve(root,`tools/typescript-stage1/hls-manifests/${name}.json`);
  const sourceText=readFileSync(sourcePath,'utf8'),emitted=readFileSync(emittedPath,'utf8');
  if(exportedValues(sourceText)!==exportedValues(emitted))throw Error('HLS_SYNC_BODY_INVALID');
  const body=lf(emitted).replace(/^export (function|class|const|let) /gm,(_,kind)=>kind+' ').replace(/^export \{[^}]*\};\s*$/gm,'').trimEnd();
  if(/^\s*(?:import|export)\s/m.test(body)||body.includes('//===BEGIN===')||body.includes('//===END==='))throw Error('HLS_SYNC_BODY_INVALID');
  const dependencies=name==='HlsRuntime'?modules.slice(0,-1):[];
  const expected=[...dependencies.map(([file,item,_dir,exportNames=item])=>`import {${exportNames}} from './${file}';`),
   `// GENERATED FROM ${source} (Task997). Edit TypeScript and run npm run hls:sync.`,
   '//===BEGIN===',...dependencies.map(([,item])=>`//@require ${item}`),body,'//===END===',`export {${exports}};`,''].join('\n');
  const actual=read(runtimePath),priorManifest=read(manifestPath);
  const manifest=priorManifest&&JSON.parse(priorManifest);
  if(manifest&&(manifest.source!==source||manifest.runtime!==runtime||manifest.schemaVersion!==1))throw Error('HLS_SYNC_MANIFEST_INVALID');
  const desiredManifest=JSON.stringify({schemaVersion:1,source,runtime,sourceSha256:sha(sourceText),runtimeSha256:sha(expected)},null,2)+'\n';
  if(mode==='--check'){
   if(actual===null||lf(actual)!==expected||lf(priorManifest)!==desiredManifest)throw Error('HLS_SYNC_STALE');
  }else if(actual!==null&&lf(actual)!==expected&&(!manifest||sha(actual)!==manifest.runtimeSha256))throw Error('HLS_SYNC_FOREIGN_EDIT');
  return {sourcePath,emittedPath,runtimePath,manifestPath,sourceSha256:sha(sourceText),emittedSha256:sha(emitted),actual,expected,priorManifest,desiredManifest};
 });
 if(mode==='--write'){
  for(const p of plans){mkdirSync(dirname(p.runtimePath),{recursive:true});mkdirSync(dirname(p.manifestPath),{recursive:true});}
  applyPlans(plans);
 }
 console.log('HLS_SYNC=PASS modules='+modules.length);
}catch(error){console.error(safeDiagnostic(error));process.exitCode=1;}
