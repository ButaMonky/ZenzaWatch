// Task514: guarded parity check of strict browser preference TypeScript.
// Never writes to the deployed runtime or executes browser/network code.
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,unlinkSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const parser=require('@babel/parser');
const generate=require('@babel/generator').default;
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const paths=Object.freeze({
  source:'typescript-src/browser-preferences.ts',
  compiled:'.generated-ts/browser-preferences.js',
  runtime:'src/browser-preferences.mjs',
  manifest:'typescript-src/BROWSER_PREFERENCES_TS_MANIFEST.json'
});
const read=rel=>readFileSync(resolve(root,rel),'utf8');
const sha=text=>createHash('sha256')
  .update(text.replace(/\r\n/g,'\n')).digest('hex');
const canonical=text=>generate(parser.parse(text,{
  sourceType:'module',plugins:['classProperties','classPrivateProperties']
}).program,{compact:true,comments:false}).code;

function checkedState(){
  const runtime=read(paths.runtime),compiled=read(paths.compiled);
  const current=sha(canonical(runtime)),emitted=sha(canonical(compiled));
  if(current!==emitted){
    throw Error('COMMENT_BROWSER_TS_AST_MISMATCH');
  }
  return {
    schemaVersion:1,
    source:paths.source,runtime:paths.runtime,
    sourceSha256:sha(read(paths.source)),
    runtimeSha256:sha(runtime),
    semanticSha256:emitted
  };
}
function run(){
  const mode=process.argv[2]||'--check';
  if(process.argv.length>3||!['--check','--write'].includes(mode)){
    throw Error('COMMENT_BROWSER_TS_ARGUMENTS_INVALID');
  }
  const expected=checkedState(),destination=resolve(root,paths.manifest);
  if(mode==='--write'){
    const repo=resolve(root,'../..');
    let baseline;
    try{
      baseline=execFileSync('git',['-C',repo,'show',
        'HEAD:packages/comment-history/src/browser-preferences.mjs'],{
          encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']
        });
    }catch{throw Error('COMMENT_BROWSER_GIT_BASELINE_UNAVAILABLE');}
    if(sha(baseline)!==expected.runtimeSha256){
      throw Error('COMMENT_BROWSER_FOREIGN_RUNTIME_EDIT');
    }
    const tmp=destination+'.task514-'+process.pid+'.tmp';
    if(existsSync(tmp))throw Error('COMMENT_BROWSER_TEMP_COLLISION');
    try{
      writeFileSync(tmp,JSON.stringify(expected,null,2)+'\n',{flag:'wx'});
      renameSync(tmp,destination);
    }finally{
      if(existsSync(tmp))unlinkSync(tmp);
    }
  }else{
    let actual;
    try{actual=JSON.parse(read(paths.manifest));}
    catch{throw Error('COMMENT_BROWSER_MANIFEST_MISSING');}
    if(JSON.stringify(expected)!==JSON.stringify(actual)){
      throw Error('COMMENT_BROWSER_MANIFEST_STALE');
    }
  }
  console.log('COMMENT_BROWSER_TYPESCRIPT=PASS mode='+mode+
    ' runtimeSha256='+expected.runtimeSha256);
}
try{run();}
catch(error){
  console.error('COMMENT_BROWSER_TYPESCRIPT=FAILED '+
    String(error?.message||'CHECK_FAILED'));
  process.exitCode=1;
}
