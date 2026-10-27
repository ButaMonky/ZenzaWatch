// Task526: verify read-only Zenza history adapter without changing deployed JS.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical,digest} from './check-probe-typescript.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const paths=Object.freeze({
  source:'context-src/zenza-context.ts',
  emitted:'.generated-ts/zenza-context/zenza-context.js',
  runtime:'src/zenza-context.mjs',
  manifest:'context-src/ZENZA_CONTEXT_TS_MANIFEST.json'
});
const read=name=>readFileSync(resolve(root,name),'utf8');

export function contextFingerprint(){
  const typed=read(paths.source);
  const emitted=read(paths.emitted);
  const runtime=read(paths.runtime);
  const compiled=digest(canonical(emitted));
  const deployed=digest(canonical(runtime));
  if(compiled!==deployed)throw Error('ZENZA_CONTEXT_RUNTIME_SEMANTIC_MISMATCH');
  return {
    schemaVersion:1,source:paths.source,runtime:paths.runtime,
    sourceSha256:digest(typed),runtimeSha256:digest(runtime),
    semanticSha256:compiled
  };
}
export function verifyZenzaContext(mode){
  if(!['--check','--write'].includes(mode))throw Error('ZENZA_CONTEXT_MODE_INVALID');
  const info=contextFingerprint();
  if(mode==='--check'){
    let previous;
    try{previous=JSON.parse(read(paths.manifest));}
    catch{throw Error('ZENZA_CONTEXT_MANIFEST_MISSING_OR_INVALID');}
    if(JSON.stringify(previous)!==JSON.stringify(info)){
      throw Error('ZENZA_CONTEXT_MANIFEST_STALE');
    }
    return info;
  }
  // The runtime must be exactly the Git baseline, not a concurrent user's edit.
  const repo=resolve(root,'../..');
  let baseline;
  try{
    baseline=execFileSync('git',['-C',repo,'show',
      'HEAD:packages/comment-history/src/zenza-context.mjs'],{
      encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']
    });
  }catch{throw Error('ZENZA_CONTEXT_GIT_BASELINE_MISSING');}
  if(digest(baseline)!==info.runtimeSha256){
    throw Error('ZENZA_CONTEXT_FOREIGN_RUNTIME_EDIT');
  }
  const manifest=resolve(root,paths.manifest);
  if(existsSync(manifest)){
    let previous;
    try{previous=JSON.parse(read(paths.manifest));}
    catch{throw Error('ZENZA_CONTEXT_MANIFEST_INVALID');}
    if(previous?.runtimeSha256!==info.runtimeSha256){
      throw Error('ZENZA_CONTEXT_STALE_RUNTIME_MANIFEST');
    }
  }
  const temporary=manifest+'.task526-'+process.pid+'.tmp';
  if(existsSync(temporary))throw Error('ZENZA_CONTEXT_STAGING_COLLISION');
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
    if(process.argv.length!==3)throw Error('ZENZA_CONTEXT_ARGS_INVALID');
    const info=verifyZenzaContext(process.argv[2]);
    console.log('COMMENT_ZENZA_CONTEXT_TYPESCRIPT=PASS '+info.semanticSha256);
  }catch(error){
    console.error('COMMENT_ZENZA_CONTEXT_TYPESCRIPT=FAIL '+String(error?.message||'UNEXPECTED'));
    process.exitCode=1;
  }
}
