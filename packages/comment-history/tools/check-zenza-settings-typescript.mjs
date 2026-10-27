// Task524: strict typed Zenza settings candidate remains exactly runtime equivalent.
// No runtime writes, remote access or unsafe output paths.
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical,sha} from './check-typescript-settings.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const repo=resolve(root,'../..');
export const paths=Object.freeze({
  ts:'zenza-settings-src/zenza-settings.ts',
  runtime:'src/zenza-settings.mjs',
  emitted:'.generated-ts/zenza-settings.js',
  manifest:'zenza-settings-src/ZENZA_SETTINGS_TS_MANIFEST.json'
});
const read=rel=>readFileSync(resolve(root,rel),'utf8');
export function fingerprint(){
  const runtime=read(paths.runtime),emitted=read(paths.emitted);
  if(sha(canonical(runtime))!==sha(canonical(emitted))){
    throw Error('ZENZA_SETTINGS_TS_PARITY_MISMATCH');
  }
  return {
    schemaVersion:1,
    source:paths.ts,
    runtime:paths.runtime,
    emitted:paths.emitted,
    sourceSha256:sha(read(paths.ts)),
    runtimeSha256:sha(runtime),
    semanticSha256:sha(canonical(emitted))
  };
}
export function check(mode='--check'){
  if(!['--check','--write'].includes(mode))throw Error('ZENZA_SETTINGS_INVALID_MODE');
  const actual=fingerprint();
  const dest=resolve(root,paths.manifest);
  if(mode==='--check'){
    let prior;
    try{prior=JSON.parse(read(paths.manifest));}
    catch{throw Error('ZENZA_SETTINGS_MANIFEST_UNAVAILABLE');}
    if(JSON.stringify(prior)!==JSON.stringify(actual)){
      throw Error('ZENZA_SETTINGS_MANIFEST_STALE');
    }
  }else{
    // Refuse to approve a different task's uncommitted runtime modifications.
    let baseline;
    try{
      baseline=execFileSync('git',['-C',repo,
        'show','HEAD:packages/comment-history/src/zenza-settings.mjs'],{
          encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true
        });
    }catch{throw Error('ZENZA_SETTINGS_BASELINE_UNAVAILABLE');}
    if(sha(baseline)!==actual.runtimeSha256){
      throw Error('ZENZA_SETTINGS_RUNTIME_CHANGED');
    }
    const tmp=dest+'.task524-'+process.pid+'.tmp';
    if(existsSync(tmp))throw Error('ZENZA_SETTINGS_TEMP_EXISTS');
    try{
      writeFileSync(tmp,JSON.stringify(actual,null,2)+'\n',{flag:'wx'});
      renameSync(tmp,dest);
    }finally{
      if(existsSync(tmp))unlinkSync(tmp);
    }
  }
  return actual;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length>3)throw Error('ZENZA_SETTINGS_INVALID_ARGUMENTS');
    const data=check(process.argv[2]||'--check');
    console.log('ZENZA_SETTINGS_TS=PASS '+data.semanticSha256);
  }catch(error){
    console.error('ZENZA_SETTINGS_TS=FAILED '+String(error?.message||'UNKNOWN'));
    process.exitCode=1;
  }
}
