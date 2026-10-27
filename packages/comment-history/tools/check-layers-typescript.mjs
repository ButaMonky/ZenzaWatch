// Task521: guard the exact runtime parity of the LayeredCommentStore.
// The existing src/layers.mjs remains the deployed, unchanged implementation.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical,digest} from './check-probe-typescript.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const paths=Object.freeze({
  source:'layers-src/layers.ts',
  emitted:'.generated-layers/layers.js',
  runtime:'src/layers.mjs',
  manifest:'layers-src/LAYERS_TS_MANIFEST.json'
});
const read=rel=>readFileSync(resolve(root,rel),'utf8');
export function layerFingerprint(){
  const typed=read(paths.source);
  const generated=read(paths.emitted);
  const runtime=read(paths.runtime);
  const expected=digest(canonical(generated));
  const actual=digest(canonical(runtime));
  if(expected!==actual)throw Error('LAYERS_RUNTIME_SEMANTIC_MISMATCH');
  return {
    schemaVersion:1,
    source:paths.source,
    runtime:paths.runtime,
    sourceSha256:digest(typed),
    runtimeSha256:digest(runtime),
    semanticSha256:expected
  };
}
export function verifyLayers(mode){
  if(!['--check','--write'].includes(mode))throw Error('LAYERS_MODE_INVALID');
  const manifest=resolve(root,paths.manifest);
  const info=layerFingerprint();
  if(mode==='--check'){
    let previous;
    try{previous=JSON.parse(read(paths.manifest));}
    catch{throw Error('LAYERS_MANIFEST_MISSING_OR_INVALID');}
    if(JSON.stringify(previous)!==JSON.stringify(info)){
      throw Error('LAYERS_MANIFEST_STALE');
    }
    return info;
  }
  const repo=resolve(root,'../..');
  let baseline;
  try{
    baseline=execFileSync('git',['-C',repo,'show',
      'HEAD:packages/comment-history/src/layers.mjs'],{
      encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']
    });
  }catch{throw Error('LAYERS_GIT_BASELINE_MISSING');}
  if(digest(baseline)!==info.runtimeSha256){
    throw Error('LAYERS_FOREIGN_RUNTIME_EDIT');
  }
  if(existsSync(manifest)){
    let earlier;
    try{earlier=JSON.parse(read(paths.manifest));}
    catch{throw Error('LAYERS_MANIFEST_INVALID');}
    if(earlier?.runtimeSha256!==info.runtimeSha256){
      throw Error('LAYERS_STALE_RUNTIME_MANIFEST');
    }
  }
  const temporary=manifest+'.task521-'+process.pid+'.tmp';
  if(existsSync(temporary))throw Error('LAYERS_STAGING_COLLISION');
  try{
    writeFileSync(temporary,JSON.stringify(info,null,2)+'\n',{flag:'wx'});
    renameSync(temporary,manifest);
  }finally{
    if(existsSync(temporary))unlinkSync(temporary);
  }
  return info;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==3)throw Error('LAYERS_ARGS_INVALID');
    const result=verifyLayers(process.argv[2]);
    console.log('COMMENT_LAYERS_TYPESCRIPT=PASS '+result.semanticSha256);
  }catch(error){
    console.error('COMMENT_LAYERS_TYPESCRIPT=FAIL '+
      String(error?.message||'UNEXPECTED'));
    process.exitCode=1;
  }
}
