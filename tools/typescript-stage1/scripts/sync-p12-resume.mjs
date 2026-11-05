// P12 fixed, local-only TypeScript policy -> userscript runtime generator.
// No network, arbitrary paths, Git history rewrite, or publication.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source='tools/typescript-stage1/p12-src/AutoResumePolicy.ts';
const emitted='tools/typescript-stage1/.generated/p12/AutoResumePolicy.js';
const runtime='packages/zenza/src/resume/AutoResumePolicy.js';
const manifest='tools/typescript-stage1/p12-runtime-manifest.json';
const file=name=>path.join(root,name);
const read=name=>fs.existsSync(file(name))?fs.readFileSync(file(name),'utf8'):null;
const lf=text=>text.replace(/\r\n/g,'\n');
const sha=text=>createHash('sha256').update(lf(text)).digest('hex');
const fail=msg=>{throw Error('P12_RESUME_'+msg);};
function expectedRuntime(compiled){
 if(typeof compiled!=='string')fail('EMIT_MISSING');
 const imports=compiled.match(/^\s*import\s+.*$/gm)||[];
 if(imports.length)fail('UNEXPECTED_IMPORT');
 const functionDeclaration='export function selectAutoResume(';
 if(!compiled.includes(functionDeclaration)||
   (compiled.match(/^export function selectAutoResume\(/gm)||[]).length!==1){
  fail('FUNCTION_SHAPE');
 }
 const body=lf(compiled).replace(/^export function selectAutoResume\(/m,
   'function selectAutoResume(').trimEnd();
 const top=body.split('\n').filter(line=>/^\S/.test(line)&&
   !line.startsWith('/**')&&!line.startsWith('*/')&&
   !line.startsWith('//')&&!line.startsWith('*'));
 const expected=['const marginSeconds','const epoch','const eligible',
  'const matches','function selectAutoResume','}'];
 if(top.length!==expected.length||
   top.some((line,i)=>line!==expected[i]&&
     !line.startsWith(expected[i]+' ')&& !line.startsWith(expected[i]+'(')))fail('TOP_LEVEL_SHAPE');
 if(/^\s*(?:import|export)\s/m.test(body)||
   body.includes('//===BEGIN===')||body.includes('//===END===')){
  fail('UNEXPECTED_EMIT');
 }
 return '// GENERATED FROM '+source+'\n//===BEGIN===\n'+body+
   '\n//===END===\nexport {selectAutoResume};\n';
}
export function sync(mode){
 if(mode!=='--write'&&mode!=='--check')fail('INVALID_MODE');
 const src=read(source),out=read(emitted),actual=read(runtime);
 if(src===null)fail('SOURCE_MISSING');
 if(out===null)fail('EMIT_MISSING');
 const generated=expectedRuntime(out);
 const oldText=read(manifest);
 let old=null;
 if(oldText!==null){
  try{old=JSON.parse(oldText);}catch{fail('BAD_MANIFEST');}
  if(old?.source!==source||old?.runtime!==runtime||
    !/^[a-f0-9]{64}$/.test(old?.runtimeSha256||''))fail('MANIFEST_DRIFT');
 }
 const next=JSON.stringify({version:1,source,runtime,
  sourceSha256:sha(src),runtimeSha256:sha(generated)},null,2)+'\n';
 if(mode==='--check'){
  if(actual===null||lf(actual)!==lf(generated)||oldText!==next){
   fail('STALE_RUNTIME_OR_MANIFEST');
  }
  return {modules:1,status:'PASS',runtimeSha256:sha(generated)};
 }
 // Never take ownership of a pre-existing, untracked file.
 if(actual!==null&&(!old||sha(actual)!==old.runtimeSha256))fail('FOREIGN_EDIT');
 if(actual===null&&old)fail('MISSING_TRACKED_RUNTIME');
 // Cross-file preflight before first write.
 if(read(runtime)!==actual||read(manifest)!==oldText)fail('CONCURRENT_EDIT');
 try{
  fs.mkdirSync(path.dirname(file(runtime)),{recursive:true});
  fs.writeFileSync(file(runtime),generated,'utf8');
  fs.writeFileSync(file(manifest),next,'utf8');
 }catch(error){
  if(actual===null){if(fs.existsSync(file(runtime)))fs.unlinkSync(file(runtime));}
  else fs.writeFileSync(file(runtime),actual,'utf8');
  if(oldText===null){if(fs.existsSync(file(manifest)))fs.unlinkSync(file(manifest));}
  else fs.writeFileSync(file(manifest),oldText,'utf8');
  throw error;
 }
 return {modules:1,status:'PASS',runtimeSha256:sha(generated)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)fail('INVALID_ARGS');
  console.log('P12_RESUME_SYNC '+JSON.stringify(sync(process.argv[2])));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
