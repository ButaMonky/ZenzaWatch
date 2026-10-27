// Task520: strict, runtime-preserving TypeScript probe source integrity.
// Does NOT replace deployed src/probe.mjs or perform any network request.
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const require=createRequire(import.meta.url);
const parser=require('@babel/parser');
const printer=require('@babel/generator').default;
const packageRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const owned=Object.freeze({
  source:'probe-src/probe.ts',
  output:'.generated-probe/probe.js',
  runtime:'src/probe.mjs',
  manifest:'probe-src/PROBE_TS_MANIFEST.json'
});
const read=(relative)=>readFileSync(resolve(packageRoot,relative),'utf8');
export const digest=text=>createHash('sha256')
  .update(text.replace(/\r\n/g,'\n')).digest('hex');
export const canonical=text=>{
  const ast=parser.parse(text,{sourceType:'module',plugins:['classProperties']});
  return printer(ast.program,{compact:true,comments:false}).code;
};
export function probeFingerprint(){
  const ts=read(owned.source);
  const emitted=read(owned.output);
  const actual=read(owned.runtime);
  if(digest(canonical(emitted))!==digest(canonical(actual))){
    throw Error('PROBE_RUNTIME_SEMANTIC_MISMATCH');
  }
  return {
    schemaVersion:1,
    source:owned.source,
    runtime:owned.runtime,
    sourceSha256:digest(ts),
    runtimeSha256:digest(actual),
    semanticSha256:digest(canonical(emitted))
  };
}
export function syncProbe(mode){
  if(!['--write','--check'].includes(mode)){
    throw Error('PROBE_INVALID_MODE');
  }
  const item=probeFingerprint();
  const manifest=resolve(packageRoot,owned.manifest);
  if(mode==='--check'){
    let stored;
    try{stored=JSON.parse(read(owned.manifest));}
    catch{throw Error('PROBE_MANIFEST_MISSING_OR_INVALID');}
    if(JSON.stringify(stored)!==JSON.stringify(item)){
      throw Error('PROBE_MANIFEST_STALE');
    }
    return item;
  }
  let original;
  try{
    const repo=resolve(packageRoot,'../..');
    original=execFileSync('git',['-C',repo,'show',
      'HEAD:packages/comment-history/src/probe.mjs'],{
      encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true
    });
  }catch{throw Error('PROBE_GIT_BASELINE_UNAVAILABLE');}
  if(digest(original)!==item.runtimeSha256){
    throw Error('PROBE_FOREIGN_RUNTIME_EDIT');
  }
  if(existsSync(manifest)){
    let current;
    try{current=JSON.parse(read(owned.manifest));}
    catch{throw Error('PROBE_MANIFEST_INVALID');}
    if(current?.runtimeSha256!==item.runtimeSha256){
      throw Error('PROBE_MANIFEST_RUNTIME_CONFLICT');
    }
  }
  const temp=manifest+'.task520-'+process.pid+'.tmp';
  if(existsSync(temp))throw Error('PROBE_TEMP_COLLISION');
  try{
    writeFileSync(temp,JSON.stringify(item,null,2)+'\n',{flag:'wx'});
    renameSync(temp,manifest);
  }finally{if(existsSync(temp))unlinkSync(temp);}
  return item;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==3)throw Error('PROBE_INVALID_ARGS');
    const report=syncProbe(process.argv[2]);
    console.log('COMMENT_PROBE_TYPESCRIPT=PASS '+report.semanticSha256);
  }catch(error){
    console.error('COMMENT_PROBE_TYPESCRIPT=FAIL '+
      String(error?.message||'UNEXPECTED_ERROR'));
    process.exitCode=1;
  }
}
