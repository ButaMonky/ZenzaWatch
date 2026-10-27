// Task453: record exact compiler inputs after native TypeScript 7 emits JS.
import {readFileSync,writeFileSync,renameSync,existsSync,unlinkSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ADVANCED_MODULES} from './advanced-registry.mjs';
import {sha,safeDiagnostic} from './generator-core.mjs';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
export const relativeStamp='tools/typescript-stage1/.generated/advanced/inputs.json';
export function emissionStamp(root=repo){
  return {
    schemaVersion:1,
    compiler:'typescript@7.0.2',
    files:ADVANCED_MODULES.map(spec=>({
      name:spec.name,
      sourceSha256:sha(readFileSync(resolve(root,spec.source),'utf8')),
      emittedSha256:sha(readFileSync(resolve(root,spec.emitted),'utf8'))
    }))
  };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==2)throw Error('ADVANCED_STAMP_ARGS_INVALID');
    const dest=resolve(repo,relativeStamp);
    const tmp=dest+'.stamp-'+process.pid+'.tmp';
    if(existsSync(tmp))throw Error('ADVANCED_STAMP_TMP_EXISTS');
    try{
      writeFileSync(tmp,JSON.stringify(emissionStamp(),null,2)+'\n',{flag:'wx'});
      renameSync(tmp,dest);
    }finally{
      if(existsSync(tmp))unlinkSync(tmp);
    }
    console.log('ADVANCED_TYPESCRIPT_EMIT=PASS modules='+ADVANCED_MODULES.length);
  }catch(error){
    console.error('ADVANCED_TYPESCRIPT_EMIT=FAILED '+safeDiagnostic(error));
    process.exitCode=1;
  }
}
