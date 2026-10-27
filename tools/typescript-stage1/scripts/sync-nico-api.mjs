// Task457: TypeScript -> legacy userscript generator for NicoNico API clients.
// Reuses Task451's hash, rollback and concurrent-edit protection (applyPlans).
// No network, git checkout/reset, push, build.js edits or arbitrary CLI paths.
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {NICO_API_MODULES} from './nico-api-registry.mjs';
import {DEFAULT_REPO,lf,sha,mayReplace,applyPlans,safeDiagnostic} from './generator-core.mjs';

function demand(yes,code){if(!yes)throw Error(code);}
function allowed(spec){
  demand(NICO_API_MODULES.includes(spec),'UNREGISTERED_NICO_API_MODULE');
  return spec;
}

/**
 * Task966: split a userscript entry file (no //===BEGIN===) into its JS-owned preamble
 * (the ==UserScript== header, the imports the build reads, and the blank lines after them)
 * and the TypeScript-owned body.
 */
export function splitEntry(text){
  const lines=lf(text).split('\n');
  let last=-1;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    if(/^import\s/.test(line)){last=i;continue;}
    if(line===''||line.startsWith('//'))continue;
    break;
  }
  demand(last>=0,'NICO_API_ENTRY_IMPORTS_MISSING');
  let end=last+1;
  while(end<lines.length&&lines[end]==='')end++;
  return {preamble:lines.slice(0,end),body:lines.slice(end).join('\n')};
}
/**
 * Task966: the lines of `text` that start in code, not inside a template literal, string or
 * block comment (entry scripts embed whole worker/module sources in template literals).
 * A small scanner for tsc output: quotes, comments, templates with nested `${}`.
 */
export function codeLines(text){
  const src=lf(text);
  const lines=src.split('\n');
  const out=[];
  const stack=[];// 'tpl' or 'expr' (with brace depth)
  let depth=0,state='code',i=0;
  for(let n=0;n<lines.length;n++){
    out.push(state==='code'&&!stack.some(x=>x.t==='tpl'&&x.open));
    const line=lines[n];
    for(i=0;i<line.length;i++){
      const c=line[i],d=line[i+1];
      if(state==='block'){if(c==='*'&&d==='/'){state='code';i++;}continue;}
      if(state==="'"||state==='"'){if(c==='\\'){i++;continue;}if(c===state)state='code';continue;}
      if(state==='tpl'){
        if(c==='\\'){i++;continue;}
        if(c==='`'){state='code';stack.pop();continue;}
        if(c==='$'&&d==='{'){stack[stack.length-1].open=false;stack.push({t:'expr',depth});depth=0;state='code';i++;continue;}
        continue;
      }
      // code
      if(c==='/'&&d==='/')break;
      if(c==='/'&&d==='*'){state='block';i++;continue;}
      if(c==="'"||c==='"'){state=c;continue;}
      if(c==='`'){stack.push({t:'tpl',open:true});state='tpl';continue;}
      if(c==='{'){depth++;continue;}
      if(c==='}'){
        if(depth===0&&stack.length&&stack[stack.length-1].t==='expr'){
          const e=stack.pop();depth=e.depth;stack[stack.length-1].open=true;state='tpl';continue;
        }
        depth--;continue;
      }
    }
    if(state==="'"||state==='"')state='code';
  }
  return out;
}
/** Build-time directives (`//@require X`, `//@version`, ...) in order, trimmed. */
export function entryDirectives(body){
  const code=codeLines(body);
  return lf(body).split('\n').filter((line,i)=>code[i]&&/^\s*\/\/@/.test(line)).map(line=>line.trim());
}
/** Top-level structural lines of an entry body (code lines at column 0, not comments). */
export function entryTopLevel(body){
  const code=codeLines(body);
  return lf(body).split('\n').filter((line,i)=>code[i]&&/^\S/.test(line)&&
    !line.startsWith('/**')&&!line.startsWith('//')&&!line.startsWith('export '));
}

const MODULE_STATEMENT=/^\s*(?:import|export)\b(?!\s*[:(])/m;

/**
 * Task966: an entry script. The emitted body (made a module only by a trailing
 * `export {};`) must keep exactly the registry's top-level lines and build directives;
 * the preamble is read from the current runtime file, so its ==UserScript== header
 * (@version) and imports stay hand-edited JS.
 */
function renderEntry(spec,text,runtime){
  demand(typeof runtime==='string',spec.prefix+'_INPUT_INVALID');
  const tail='\nexport {};';
  demand(text.endsWith(tail),spec.prefix+'_UNEXPECTED_EXPORT');
  const body=text.slice(0,-tail.length).trimEnd();
  // Template literals may hold whole module sources; only code lines are module statements.
  const code=codeLines(body);
  const codeText=body.split('\n').filter((line,i)=>code[i]).join('\n');
  demand(!MODULE_STATEMENT.test(codeText)&&!body.includes('\0')&&
    !body.includes('//===BEGIN===')&&!body.includes('//===END==='),
    spec.prefix+'_UNEXPECTED_OUTPUT');
  const structural=entryTopLevel(body);
  demand(structural.length===spec.topLevel.length&&structural.every((line,i)=>line===spec.topLevel[i]),
    spec.prefix+'_UNEXPECTED_TOP_LEVEL');
  const directives=entryDirectives(body);
  demand(directives.length===spec.directives.length&&directives.every((line,i)=>line===spec.directives[i]),
    spec.prefix+'_DIRECTIVES_CHANGED');
  const lines=lf(runtime).split('\n');
  const at=lines.indexOf(spec.header);
  const preamble=at>=0?lines.slice(0,at):splitEntry(runtime).preamble;
  return [...preamble,spec.header,body,''].join('\n');
}

/**
 * Validate tsc output shape: exactly one top-level declaration of the registered
 * shape, or (shape 'declarations') exactly the registry's allowlisted lines.
 */
export function renderNicoLegacy(spec,emitted,runtime){
  allowed(spec);
  demand(typeof emitted==='string',spec.prefix+'_INPUT_INVALID');
  const text=lf(emitted).trimEnd();
  if(spec.shape==='entry')return renderEntry(spec,text,runtime);
  const isDeclarations=spec.shape==='declarations';
  const exportNames=isDeclarations?spec.exportNames:[spec.symbol];
  const exportLine='\nexport { '+exportNames.join(', ')+' };';
  demand(text.endsWith(exportLine),spec.prefix+'_UNEXPECTED_EXPORT');
  const body=text.slice(0,-exportLine.length).trimEnd();
  // Task965: an object key (`import:`) or a method (`export() {`) is not a module statement.
  demand(!/^\s*(?:import|export)\b(?!\s*[:(])/m.test(body)&&!body.includes('\0')&&
    !body.includes('//===BEGIN===')&&!body.includes('//===END==='),
    spec.prefix+'_UNEXPECTED_OUTPUT');
  const topLevel=body.split('\n').filter(line=>/^\S/.test(line));
  if(isDeclarations){
    // Task643: the exact allowlisted open/close lines, in order; comments may sit between.
    const structural=topLevel.filter(line=>!line.startsWith('/**')&&!line.startsWith('//'));
    demand(structural.length===spec.topLevel.length&&structural.every((line,i)=>line===spec.topLevel[i]),
      spec.prefix+'_UNEXPECTED_TOP_LEVEL');
  }else{
    const iife=spec.shape==='iife';
    const isClass=spec.shape==='class';
    const declaration=isClass?'class '+spec.symbol+' {':
      'const '+spec.symbol+(iife?' = (() => {':' = {');
    const closing=isClass?'}':iife?'})();':'};';
    let declarations=0;
    for(const line of topLevel){
      if(line===declaration){declarations++;continue;}
      if(line===closing||line.startsWith('/**')||line.startsWith('//'))continue;
      throw Error(spec.prefix+'_UNEXPECTED_TOP_LEVEL');
    }
    demand(declarations===1&&topLevel.at(-1)===closing,spec.prefix+'_UNEXPECTED_TOP_LEVEL');
  }
  return [
    ...spec.preamble,
    spec.header,
    '//===BEGIN===',
    ...spec.beginLines,
    body,
    '//===END===',
    ...(spec.afterEnd||[]),
    (isDeclarations?'export {\n  '+[...exportNames,...(spec.afterEndExports||[])].join(',\n  ')+'\n};':
      'export {'+[spec.symbol,...spec.extraExports].join(', ')+'};'),
    ''
  ].join('\n');
}

function manifestFor(spec,sourceText,expected){
  return {
    schemaVersion:1,
    source:spec.source,
    runtime:spec.runtime,
    sourceSha256:sha(sourceText),
    runtimeSha256:sha(expected)
  };
}
function readManifest(spec,root){
  const path=resolve(root,spec.manifest);
  if(!existsSync(path))return null;
  let item;
  try{item=JSON.parse(readFileSync(path,'utf8'));}
  catch{throw Error(spec.prefix+'_MANIFEST_INVALID');}
  demand(item?.schemaVersion===1&&item.source===spec.source&&item.runtime===spec.runtime&&
    /^[a-f0-9]{64}$/.test(item.sourceSha256)&&/^[a-f0-9]{64}$/.test(item.runtimeSha256),
    spec.prefix+'_MANIFEST_INVALID');
  return item;
}
function headRuntime(spec,root){
  try{
    return execFileSync('git',['-C',root,'show','HEAD:'+spec.runtime],{
      encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']
    });
  }catch{throw Error(spec.prefix+'_GIT_BASELINE_UNAVAILABLE');}
}

/** Read-only preflight of one module. */
export function prepareNicoModule(spec,root,mode){
  allowed(spec);
  demand(mode==='--check'||mode==='--write','TYPESCRIPT_MODE_INVALID');
  const repo=realpathSync(root);
  const sourcePath=resolve(repo,spec.source);
  const emittedPath=resolve(repo,spec.emitted);
  const runtimePath=resolve(repo,spec.runtime);
  const manifestPath=resolve(repo,spec.manifest);
  demand(existsSync(emittedPath),spec.prefix+'_EMITTED_MISSING');
  const sourceText=readFileSync(sourcePath,'utf8');
  const emitted=readFileSync(emittedPath,'utf8');
  const actual=readFileSync(runtimePath,'utf8');
  const expected=renderNicoLegacy(spec,emitted,actual);
  const manifest=readManifest(spec,repo);
  const wanted=manifestFor(spec,sourceText,expected);
  if(mode==='--check'){
    demand(lf(actual)===lf(expected),spec.prefix+'_RUNTIME_STALE');
    demand(manifest&&JSON.stringify(manifest)===JSON.stringify(wanted),
      spec.prefix+'_MANIFEST_STALE');
  }else{
    const head=headRuntime(spec,repo);
    demand(sha(head)===spec.originalSha256||lf(head).includes(spec.header),
      spec.prefix+'_UNOWNED_RUNTIME_BASELINE');
    // A committed runtime edited outside the generator must not be erased.
    if(manifest&&sha(head)!==spec.originalSha256&&sha(head)!==manifest.runtimeSha256&&
      lf(actual)===lf(head)){
      throw Error(spec.prefix+'_BASELINE_DIFFERS_FROM_MANIFEST');
    }
    demand(mayReplace(actual,head,expected,manifest?.runtimeSha256),
      spec.prefix+'_RUNTIME_HAS_FOREIGN_EDITS');
  }
  const desiredManifest=JSON.stringify(wanted,null,2)+'\n';
  return {
    id:spec.id,prefix:spec.prefix,runtimePath,manifestPath,sourcePath,emittedPath,
    sourceSha256:sha(sourceText),emittedSha256:sha(emitted),
    actual,expected,desiredManifest,
    priorManifest:existsSync(manifestPath)?readFileSync(manifestPath,'utf8'):null,
    hash:sha(expected)
  };
}

/** Validate every selected module before writing any of them. */
export function syncNicoApi(mode,{root=DEFAULT_REPO,modules=NICO_API_MODULES}={}){
  demand(mode==='--check'||mode==='--write','TYPESCRIPT_MODE_INVALID');
  demand(Array.isArray(modules)&&modules.length>0&&new Set(modules).size===modules.length,
    'TYPESCRIPT_MODULE_SELECTION_INVALID');
  for(const spec of modules)allowed(spec);
  const plans=modules.map(spec=>prepareNicoModule(spec,root,mode));
  if(mode==='--write')applyPlans(plans);
  return plans.map(plan=>({
    id:plan.id,prefix:plan.prefix,sha256:plan.hash,
    status:mode==='--check'?'PASS':
      (lf(plan.actual)===lf(plan.expected)&&plan.priorManifest===plan.desiredManifest?
        'UNCHANGED':'UPDATED')
  }));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==3)throw Error('TYPESCRIPT_MODE_INVALID');
    const results=syncNicoApi(process.argv[2]);
    for(const r of results)console.log(r.prefix+'='+r.status+' '+r.sha256);
    console.log('NICO_API_SYNC=PASS modules='+results.length);
  }catch(error){
    // Never print source text, credentials, response bodies or user paths.
    console.error('NICO_API_SYNC=FAILED '+safeDiagnostic(error));
    process.exitCode=1;
  }
}
