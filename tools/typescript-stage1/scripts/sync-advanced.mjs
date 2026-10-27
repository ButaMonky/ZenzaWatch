// Task453: safely bind TypeScript advanced-settings sources to existing userscript JS.
// No arbitrary paths, live network, deployment or UI edits in this gate.
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFileSync,existsSync,realpathSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ADVANCED_MODULES} from './advanced-registry.mjs';
import {emissionStamp,relativeStamp} from './stamp-advanced.mjs';
import {sha,lf,applyPlans,safeDiagnostic} from './generator-core.mjs';

const require=createRequire(import.meta.url);
const babel=require('@babel/parser');
const generate=require('@babel/generator').default;
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');

function err(code){throw Error(code);}
export function canonicalJs(source){
  const ast=babel.parse(lf(source),{
    sourceType:'module',plugins:['classProperties','classPrivateProperties'],
    errorRecovery:false
  });
  return generate(ast.program,{compact:true,comments:false}).code;
}
export function restoreLegacyRequires(spec,compiled){
  if(spec.name!=='_setting'||lf(compiled).includes('//@require uq'))return compiled;
  const anchor=/(await Config\.promise\('restore'\);\s*\n)([ \t]*)(const \$ = uq;)/;
  if(!anchor.test(compiled))err('ADVANCED_UQUERY_REQUIRE_ANCHOR_MISSING');
  return compiled.replace(anchor,(_,before,indent,line)=>
    before+indent+'//@require uq\n'+indent+line);
}
export function directiveList(source){
  return lf(source).split('\n').map(s=>s.trim()).filter(s=>
    /^\/\/@(?:require|dev-require|ignore-)/.test(s) ||
    /^\/\/===BEGIN===$/.test(s) || /^\/\/===END===$/.test(s)
  );
}
const read=(root,rel)=>readFileSync(resolve(root,rel),'utf8');
function headAt(root,rel){
  try{
    return execFileSync('git',['-C',root,'show','HEAD:'+rel],{
      encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']
    });
  }catch{err('ADVANCED_GIT_BASELINE_UNAVAILABLE');}
}
export function prepareAdvanced(spec,root,mode,allowCodeChange=false){
  if(!ADVANCED_MODULES.includes(spec))err('ADVANCED_MODULE_NOT_REGISTERED');
  if(!['--check','--write'].includes(mode))err('ADVANCED_INVALID_MODE');
  const sourcePath=resolve(root,spec.source);
  const emittedPath=resolve(root,spec.emitted);
  const runtimePath=resolve(root,spec.runtime);
  const manifestPath=resolve(root,spec.manifest);
  const source=readFileSync(sourcePath,'utf8');
  const rawCompiled=readFileSync(emittedPath,'utf8');
  const compiled=restoreLegacyRequires(spec,rawCompiled);
  const actual=readFileSync(runtimePath,'utf8');
  const desiredSemantic=sha(canonicalJs(compiled));
  const currentSemantic=sha(canonicalJs(actual));
  const compDirectives=directiveList(compiled);
  const currentDirectives=directiveList(actual);
  if(JSON.stringify(compDirectives)!==JSON.stringify(currentDirectives)){
    err('ADVANCED_LEGACY_BUILD_DIRECTIVE_MISMATCH');
  }
  const differs=desiredSemantic!==currentSemantic;
  if(differs&&!(mode==='--write'&&allowCodeChange)){
    err('ADVANCED_CODE_CHANGE_REQUIRES_EXPLICIT_REVIEW');
  }
  let prior=null;
  if(existsSync(manifestPath)){
    try{prior=JSON.parse(readFileSync(manifestPath,'utf8'));}
    catch{err('ADVANCED_MANIFEST_INVALID');}
    if(prior?.schemaVersion!==1||prior.source!==spec.source||
      prior.runtime!==spec.runtime||prior.emitted!==spec.emitted||
      !/^[a-f0-9]{64}$/.test(prior.sourceSha256)||
      !/^[a-f0-9]{64}$/.test(prior.runtimeSha256)||
      !/^[a-f0-9]{64}$/.test(prior.semanticSha256)){
      err('ADVANCED_MANIFEST_INVALID');
    }
  }
  if(mode==='--write'){
    const baseline=headAt(root,spec.runtime);
    // A different task's non-committed edit must never be overwritten.
    if(lf(actual)!==lf(baseline)&&
      (!prior||sha(actual)!==prior.runtimeSha256)){
      err('ADVANCED_FOREIGN_RUNTIME_EDIT');
    }
    if(prior&&sha(actual)!==prior.runtimeSha256&&
      lf(actual)===lf(baseline)){
      err('ADVANCED_COMMITTED_RUNTIME_CHANGED');
    }
  }
  const expected=differs?compiled:actual;
  const wanted={
    schemaVersion:1,source:spec.source,emitted:spec.emitted,
    runtime:spec.runtime,sourceSha256:sha(source),
    runtimeSha256:sha(expected),semanticSha256:desiredSemantic
  };
  if(mode==='--check'){
    if(!prior||JSON.stringify(prior)!==JSON.stringify(wanted)){
      err('ADVANCED_MANIFEST_STALE');
    }
  }
  const priorManifest=existsSync(manifestPath)?
    readFileSync(manifestPath,'utf8'):null;
  return {
    id:spec.name,prefix:'ADVANCED_TS',
    sourcePath,emittedPath,sourceSha256:sha(source),
    emittedSha256:sha(rawCompiled),runtimePath,manifestPath,
    actual,priorManifest,expected,
    desiredManifest:JSON.stringify(wanted,null,2)+'\n',
    semanticSha256:desiredSemantic,changedCode:differs
  };
}
export function syncAdvanced(mode,options={}){
  const current=realpathSync(options.root||repo);
  let stamp;
  try{stamp=JSON.parse(read(current,relativeStamp));}
  catch{err('ADVANCED_EMISSION_STAMP_MISSING');}
  if(JSON.stringify(stamp)!==JSON.stringify(emissionStamp(current))){
    err('ADVANCED_EMISSION_STALE');
  }
  const plans=ADVANCED_MODULES.map(spec=>
    prepareAdvanced(spec,current,mode,options.allowCodeChange===true));
  if(mode==='--write')applyPlans(plans);
  return plans.map(p=>({
    name:p.id,code:p.changedCode?'CHANGED':'UNCHANGED',
    semanticSha256:p.semanticSha256
  }));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const [mode,flag]=process.argv.slice(2);
    if(process.argv.length<3||process.argv.length>4 ||
      (flag!==undefined&&flag!=='--accept-runtime-change')){
      err('ADVANCED_INVALID_CLI_ARGUMENTS');
    }
    const result=syncAdvanced(mode,{allowCodeChange:flag==='--accept-runtime-change'});
    for(const item of result){
      console.log('ADVANCED_TS='+item.name+' '+item.code);
    }
    console.log('ADVANCED_TS=PASS modules='+result.length);
  }catch(error){
    console.error('ADVANCED_TS=FAILED '+safeDiagnostic(error));
    process.exitCode=1;
  }
}
