// Task460: compare compiled, strict TypeScript settings with deployed settings.mjs.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const parser=require('@babel/parser');
const generate=require('@babel/generator').default;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const paths=Object.freeze({
  ts:'typescript-src/settings.ts',
  generated:'.generated-ts/settings.js',
  runtime:'src/settings.mjs',
  manifest:'typescript-src/SETTINGS_TS_MANIFEST.json'
});
const read=path=>readFileSync(resolve(root,path),'utf8');
export const sha=s=>createHash('sha256').update(s.replace(/\r\n/g,'\n')).digest('hex');
export const canonical=s=>generate(parser.parse(s,{
  sourceType:'module',plugins:['classProperties','classPrivateProperties']
}).program,{comments:false,compact:true}).code;
export const fingerprint=()=>({
  schemaVersion:1,
  tsSource:paths.ts,
  runtime:paths.runtime,
  tsSha256:sha(read(paths.ts)),
  runtimeSha256:sha(read(paths.runtime)),
  semanticSha256:sha(canonical(read(paths.generated)))
});
export function checkSettingsTypes(){
  if(sha(canonical(read(paths.generated)))!==sha(canonical(read(paths.runtime)))){
    throw Error('COMMENT_INCREASE_TS_RUNTIME_MISMATCH');
  }
  return fingerprint();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const mode=process.argv[2]||'--check';
    if(process.argv.length>3||!['--write','--check'].includes(mode)){
      throw Error('COMMENT_INCREASE_TS_ARGUMENTS_INVALID');
    }
    const item=checkSettingsTypes();
    const dest=resolve(root,paths.manifest);
    if(mode==='--write'){
      // Prevent a new, unrelated edit to the deployed source being endorsed.
      let base;
      try{
        const repo=resolve(root,'../..');
        base=execFileSync('git',['-C',repo,'show',
          'HEAD:packages/comment-history/src/settings.mjs'],{
          encoding:'utf8',stdio:['ignore','pipe','pipe'],windowsHide:true
        });
      }catch{throw Error('COMMENT_INCREASE_GIT_BASELINE_UNAVAILABLE');}
      if(sha(base)!==item.runtimeSha256){
        throw Error('COMMENT_INCREASE_FOREIGN_RUNTIME_EDIT');
      }
      const tmp=dest+'.task460-'+process.pid+'.tmp';
      if(existsSync(tmp))throw Error('COMMENT_INCREASE_TEMP_FILE_EXISTS');
      try{
        writeFileSync(tmp,JSON.stringify(item,null,2)+'\n',{flag:'wx'});
        renameSync(tmp,dest);
      }finally{
        if(existsSync(tmp))unlinkSync(tmp);
      }
    }else{
      let expected;
      try{expected=JSON.parse(read(paths.manifest));}
      catch{throw Error('COMMENT_INCREASE_MANIFEST_MISSING');}
      if(JSON.stringify(expected)!==JSON.stringify(item)){
        throw Error('COMMENT_INCREASE_MANIFEST_STALE');
      }
    }
    console.log('COMMENT_INCREASE_TS_AST=PASS '+item.semanticSha256);
  }catch(e){
    console.error('COMMENT_INCREASE_TS_AST=FAILED '+String(e?.code||e?.message||'CHECK'));
    process.exitCode=1;
  }
}
