// Task451: shared, allowlisted TypeScript -> legacy userscript module generator.
// Entire multi-module change is checked before touching any JS or manifest.
// No network, repository checkout/reset, remote push, or build.js edits.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
  existsSync,readFileSync,writeFileSync,renameSync,unlinkSync,realpathSync,
  openSync,closeSync
} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MODULES} from './module-registry.mjs';

export const DEFAULT_REPO=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
export const lf=text=>String(text).replace(/\r\n/g,'\n');
export const sha=text=>createHash('sha256').update(lf(text)).digest('hex');

// Public CI/console diagnostics must not include Windows user paths or fixture bytes.
export function safeDiagnostic(error){
  const message=String(error?.message??'');
  if(/^[A-Z][A-Z0-9_]*(?: [A-Z][A-Z0-9_]*)*$/.test(message))return message;
  const code=String(error?.code??'');
  if(/^[A-Z][A-Z0-9_]*$/.test(code))return 'IO_'+code;
  return 'TYPESCRIPT_OPERATION_FAILED';
}
function demand(yes,code){if(!yes)throw Error(code);}
function specAllowed(spec){
  demand(MODULES.includes(spec),'UNREGISTERED_TYPESCRIPT_MODULE');
  return spec;
}

export function renderLegacy(spec,emitted){
  specAllowed(spec);
  demand(typeof emitted==='string',spec.errors.input);
  const text=lf(emitted).trimEnd();
  const exportLine='\nexport { '+spec.symbol+' };';
  demand(text.endsWith(exportLine),spec.errors.exported);
  const body=text.slice(0,-exportLine.length);
  // Generated modules have exactly one known top-level declaration.
  const valid=spec.kind==='const'?
    /^const OfficialPlayerRoute = Object\.freeze\(\{[\s\S]*\}\);$/.test(body):
    spec.kind==='class' && (spec.symbol==='StyleSwitcher'||
      spec.symbol==='RequestAnimationFrame') &&
      new RegExp('^class '+spec.symbol+' \\{[\\s\\S]*\\n\\}$').test(body);
  demand(valid,spec.errors.body);
  demand(!body.includes('//===BEGIN===')&&!body.includes('//===END===')&&
    !/^\s*(?:import|export)\s/m.test(body)&&!body.includes('\0'),spec.errors.marker);
  return [
    ...spec.preamble,
    spec.header,
    '//===BEGIN===',
    body,
    '//===END===',
    'export {'+spec.symbol+'};',
    ''
  ].join('\n');
}
export function mayReplace(current,baseline,expected,previousDigest){
  return lf(current)===lf(baseline)||lf(current)===lf(expected)||
    (typeof previousDigest==='string'&&/^[a-f0-9]{64}$/.test(previousDigest)&&
      sha(current)===previousDigest);
}
export function expectedManifest(spec,root,expected){
  specAllowed(spec);
  return {
    schemaVersion:1,
    source:spec.source,
    runtime:spec.runtime,
    sourceSha256:sha(readFileSync(resolve(root,spec.source),'utf8')),
    runtimeSha256:sha(expected)
  };
}
function readManifest(spec,root){
  const path=resolve(root,spec.manifest);
  if(!existsSync(path))return null;
  let item;
  try{item=JSON.parse(readFileSync(path,'utf8'));}
  catch{throw Error(spec.prefix+'_MANIFEST_INVALID');}
  demand(item?.schemaVersion===1&&item.source===spec.source&&
    item.runtime===spec.runtime&&
    /^[a-f0-9]{64}$/.test(item.sourceSha256)&&
    /^[a-f0-9]{64}$/.test(item.runtimeSha256),
    spec.prefix+'_MANIFEST_INVALID');
  return item;
}
function baseline(spec,root){
  try{
    return execFileSync('git',['-C',root,'show','HEAD:'+spec.runtime],{
      encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']
    });
  }catch{throw Error(spec.prefix+'_GIT_BASELINE_UNAVAILABLE');}
}

/** Pure preflight with respect to the working tree. No files are changed. */
export function prepareModule(spec,root,mode){
  specAllowed(spec);
  demand(mode==='--check'||mode==='--write','TYPESCRIPT_MODE_INVALID');
  const repo=realpathSync(root);
  const runtimePath=resolve(repo,spec.runtime);
  const manifestPath=resolve(repo,spec.manifest);
  const emittedPath=resolve(repo,spec.emitted);
  const sourcePath=resolve(repo,spec.source);
  const emitted=readFileSync(emittedPath,'utf8');
  const emittedSha256=sha(emitted);
  const sourceSha256=sha(readFileSync(sourcePath,'utf8'));
  const expected=renderLegacy(spec,emitted);
  const actual=readFileSync(runtimePath,'utf8');
  const manifest=readManifest(spec,repo);
  const wanted=expectedManifest(spec,repo,expected);
  if(mode==='--check'){
    demand(lf(actual)===lf(expected),spec.errors.stale);
    demand(manifest&&JSON.stringify(manifest)===JSON.stringify(wanted),
      spec.errors.manifest);
  }else{
    const head=baseline(spec,repo);
    demand(sha(head)===spec.originalSha256||head.includes(spec.header),
      spec.prefix+'_UNOWNED_RUNTIME_BASELINE');
    // Committed runtime changed outside the generator: do not erase that work.
    if(manifest&&sha(head)!==spec.originalSha256&&
      sha(head)!==manifest.runtimeSha256&&lf(actual)===lf(head)){
      throw Error(spec.prefix+'_BASELINE_DIFFERS_FROM_MANIFEST');
    }
    demand(mayReplace(actual,head,expected,manifest?.runtimeSha256),
      spec.errors.dirty);
  }
  const desiredManifest=JSON.stringify(wanted,null,2)+'\n';
  const priorManifest=existsSync(manifestPath)?
    readFileSync(manifestPath,'utf8'):null;
  return {
    id:spec.id,prefix:spec.prefix,runtimePath,manifestPath,
    sourcePath,emittedPath,sourceSha256,emittedSha256,
    actual,priorManifest,expected,desiredManifest,
    hash:sha(expected)
  };
}
function unchangedInputs(plans){
  return plans.every(p=>
    sha(readFileSync(p.sourcePath,'utf8'))===p.sourceSha256 &&
    sha(readFileSync(p.emittedPath,'utf8'))===p.emittedSha256);
}
function changesFromPlans(plans){
  return plans.flatMap(plan=>[
    {path:plan.runtimePath,old:plan.actual,next:plan.expected},
    {path:plan.manifestPath,old:plan.priorManifest,next:plan.desiredManifest}
  ]).filter(x=>x.old===null||lf(x.old)!==lf(x.next));
}
function readExisting(path){
  return existsSync(path)?readFileSync(path,'utf8'):null;
}
function stillMatches(path,old){
  const actual=readExisting(path);
  return (actual===null&&old===null) ||
    (typeof actual==='string'&&typeof old==='string'&&actual===old);
}
function cleanTemps(ops){
  for(const op of ops){
    if(op.tmp&&existsSync(op.tmp))unlinkSync(op.tmp);
  }
}
/** Prepare every output before writing. Roll back partial writes on I/O failure. */
export function applyPlans(plans){
  const operations=changesFromPlans(plans);
  const staged=[];
  const completed=[];
  let failure=null;
  try{
    demand(unchangedInputs(plans),'TYPESCRIPT_INPUT_CHANGED_DURING_WRITE');
    for(const [index,op] of operations.entries()){
      const tmp=op.path+'.tsgen-'+process.pid+'-'+index+'.tmp';
      // Open exclusively before staging: a failed write cannot leave an orphan.
      const fd=openSync(tmp,'wx');
      staged.push({...op,tmp});
      try{writeFileSync(fd,op.next);}finally{closeSync(fd);}
    }
    // Detect concurrent edits to inputs and target files before any commit.
    demand(unchangedInputs(plans),'TYPESCRIPT_INPUT_CHANGED_DURING_WRITE');
    for(const op of staged){
      demand(stillMatches(op.path,op.old),'TYPESCRIPT_CONCURRENT_EDIT_REFUSED');
    }
    for(const op of staged){
      demand(stillMatches(op.path,op.old),'TYPESCRIPT_CONCURRENT_EDIT_REFUSED');
      renameSync(op.tmp,op.path);
      completed.push(op);
    }
  }catch(err){
    failure=err;
    const rollbackErrors=[];
    for(const op of completed.reverse()){
      try{
        if(!stillMatches(op.path,op.next)){
          throw Error('TYPESCRIPT_ROLLBACK_CONCURRENT_EDIT');
        }
        if(op.old===null){
          unlinkSync(op.path);
        }else{
          const backup=op.path+'.tsgen-restore-'+process.pid+'.tmp';
          try{
            writeFileSync(backup,op.old,{flag:'wx'});
            renameSync(backup,op.path);
          }finally{
            if(existsSync(backup))unlinkSync(backup);
          }
        }
      }catch(recovery){
        rollbackErrors.push(op.path+':'+recovery.message);
      }
    }
    if(rollbackErrors.length){
      // Preserve the original failure and every incomplete rollback.
      failure=Error('TYPESCRIPT_ROLLBACK_INCOMPLETE '+failure.message+' '+rollbackErrors.join(';'));
    }
  }finally{
    cleanTemps(staged);
  }
  if(failure)throw failure;
  return operations.length;
}
export function syncModules(modules,mode,repoRoot=DEFAULT_REPO){
  demand(mode==='--check'||mode==='--write','TYPESCRIPT_MODE_INVALID');
  demand(Array.isArray(modules)&&modules.length&&
    new Set(modules).size===modules.length,'TYPESCRIPT_MODULE_SELECTION_INVALID');
  // Validate the complete allowlist before a single file is accessed.
  for(const spec of modules)specAllowed(spec);
  const plans=modules.map(spec=>prepareModule(spec,repoRoot,mode));
  if(mode==='--write')applyPlans(plans);
  return plans.map(plan=>({
    id:plan.id,
    status:mode==='--check'?'PASS':
      (lf(plan.actual)===lf(plan.expected)&&
       plan.priorManifest===plan.desiredManifest?'UNCHANGED':'UPDATED'),
    sha256:plan.hash,prefix:plan.prefix
  }));
}
