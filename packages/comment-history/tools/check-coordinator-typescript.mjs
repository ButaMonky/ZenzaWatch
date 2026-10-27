// Task522: verify the TypeScript coordinator without changing deployed transport.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const parse=require('@babel/parser');
const print=require('@babel/generator').default;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source='coordinator-src/coordinator.ts';
const emitted='.generated-ts/coordinator/coordinator.js';
const runtime='src/coordinator.mjs';
const manifest='coordinator-src/COORDINATOR_TS_MANIFEST.json';
const read=path=>readFileSync(resolve(root,path),'utf8');
const digest=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
const canonical=s=>print(parse.parse(s,{
  sourceType:'module',
  plugins:['classPrivateMethods','classPrivateProperties','classProperties']
}).program,{compact:true,comments:false}).code;
export function currentFingerprints(){
  const compiled=canonical(read(emitted)),actual=canonical(read(runtime));
  if(compiled!==actual){
    let index=0;while(index<Math.min(compiled.length,actual.length) &&
      compiled[index]===actual[index])index++;
    throw Error('COORDINATOR_TYPESCRIPT_RUNTIME_AST_MISMATCH offset='+index);
  }
  return {
    schemaVersion:1,source,runtime,
    sourceSha256:digest(read(source)),
    runtimeSha256:digest(read(runtime)),
    semanticSha256:digest(compiled)
  };
}
function baselineUnmodified(item){
  let old;
  try{
    old=execFileSync('git',['-C',root,'show',
      'HEAD:packages/comment-history/src/coordinator.mjs'],{
      encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']
    });
  }catch{throw Error('COORDINATOR_GIT_BASELINE_UNAVAILABLE');}
  if(digest(old)!==item.runtimeSha256)throw Error('COORDINATOR_FOREIGN_RUNTIME_CHANGE');
}
export function checkCoordinator(mode='--check'){
  if(!['--check','--write'].includes(mode))throw Error('COORDINATOR_INVALID_MODE');
  const item=currentFingerprints();
  const path=resolve(root,manifest);
  if(mode==='--write'){
    baselineUnmodified(item);
    if(existsSync(path)){
      const prior=JSON.parse(read(manifest));
      if(prior.runtimeSha256!==item.runtimeSha256 ||
        prior.runtime!==item.runtime)throw Error('COORDINATOR_FOREIGN_MANIFEST');
    }
    const temp=path+'.task522-'+process.pid+'.tmp';
    if(existsSync(temp))throw Error('COORDINATOR_TEMP_ALREADY_EXISTS');
    try{
      writeFileSync(temp,JSON.stringify(item,null,2)+'\n',{flag:'wx'});
      renameSync(temp,path);
    }finally{if(existsSync(temp))unlinkSync(temp);}
  }else{
    let prior;
    try{prior=JSON.parse(read(manifest));}
    catch{throw Error('COORDINATOR_MANIFEST_MISSING');}
    if(JSON.stringify(item)!==JSON.stringify(prior)){
      throw Error('COORDINATOR_MANIFEST_STALE');
    }
  }
  return item;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length>3)throw Error('COORDINATOR_INVALID_CLI');
    const mode=process.argv[2]||'--check';
    const item=checkCoordinator(mode);
    console.log('COMMENT_COORDINATOR_TS=PASS '+item.semanticSha256);
  }catch(error){
    console.error('COMMENT_COORDINATOR_TS=FAILED '+
      String(error?.code||error?.message||'UNKNOWN'));
    process.exitCode=1;
  }
}
