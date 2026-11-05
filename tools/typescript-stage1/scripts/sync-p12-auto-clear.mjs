// P12-02 fixed one-class generator; no arbitrary paths or code upload.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source='tools/typescript-stage1/p12-src/AutoResumeClearCoordinator.ts';
const emitted='tools/typescript-stage1/.generated/p12/AutoResumeClearCoordinator.js';
const runtime='packages/zenza/src/resume/AutoResumeClearCoordinator.js';
const manifest='tools/typescript-stage1/p12-auto-clear-manifest.json';
const at=p=>path.join(root,p);
const read=p=>fs.existsSync(at(p))?fs.readFileSync(at(p),'utf8'):null;
const lf=s=>s.replace(/\r\n/g,'\n');
const sha=s=>createHash('sha256').update(lf(s)).digest('hex');
const fail=code=>{throw Error('P12_AUTO_CLEAR_'+code);};
function generated(compiled){
 if(typeof compiled!=='string')fail('EMIT_MISSING');
 if(/^\s*import\s/m.test(compiled))fail('UNEXPECTED_IMPORT');
 if((compiled.match(/^export class AutoResumeClearCoordinator\s*\{/gm)||[]).length!==1){
  fail('CLASS_SHAPE');
 }
 const body=lf(compiled).replace(/^export class AutoResumeClearCoordinator/m,
  'class AutoResumeClearCoordinator').trimEnd();
 if(/^\s*(?:import|export)\s/m.test(body)||body.includes('//===BEGIN===')||
   body.includes('//===END==='))fail('UNEXPECTED_EMIT');
 const lines=body.split('\n').filter(s=>/^\S/.test(s)&&
   !s.startsWith('/**')&&!s.startsWith('*/')&&!s.startsWith('*')&&!s.startsWith('//'));
 if(lines.length!==3||!lines[0].startsWith('const valid =')||
   !lines[1].startsWith('class AutoResumeClearCoordinator {')||
   lines[2]!=='}')fail('TOP_LEVEL_SHAPE');
 return '// GENERATED FROM '+source+'\n//===BEGIN===\n'+body+
  '\n//===END===\nexport {AutoResumeClearCoordinator};\n';
}
export function sync(mode){
 if(mode!=='--check'&&mode!=='--write')fail('BAD_MODE');
 const src=read(source),compiler=read(emitted);
 if(src===null||compiler===null)fail('SOURCE_OR_EMIT_MISSING');
 const output=generated(compiler),actual=read(runtime),oldText=read(manifest);
 let previous=null;
 if(oldText!==null){
  try{previous=JSON.parse(oldText);}catch{fail('MANIFEST_INVALID');}
  if(previous?.source!==source||previous?.runtime!==runtime||
    !/^[a-f0-9]{64}$/.test(previous?.runtimeSha256||''))fail('MANIFEST_DRIFT');
 }
 const next=JSON.stringify({
  version:1,source,runtime,sourceSha256:sha(src),runtimeSha256:sha(output)
 },null,2)+'\n';
 if(mode==='--check'){
  if(actual===null||lf(actual)!==lf(output)||oldText!==next)fail('STALE_OUTPUT');
  return {modules:1,status:'PASS',runtimeSha256:sha(output)};
 }
 if(actual!==null&&(!previous||sha(actual)!==previous.runtimeSha256))
  fail('FOREIGN_RUNTIME_EDIT');
 if(actual===null&&previous)fail('MISSING_TRACKED_RUNTIME');
 if(read(runtime)!==actual||read(manifest)!==oldText)fail('CONCURRENT_EDIT');
 try{
  fs.mkdirSync(path.dirname(at(runtime)),{recursive:true});
  fs.writeFileSync(at(runtime),output,'utf8');
  fs.writeFileSync(at(manifest),next,'utf8');
 }catch(error){
  if(actual===null){if(fs.existsSync(at(runtime)))fs.unlinkSync(at(runtime));}
  else fs.writeFileSync(at(runtime),actual,'utf8');
  if(oldText===null){if(fs.existsSync(at(manifest)))fs.unlinkSync(at(manifest));}
  else fs.writeFileSync(at(manifest),oldText,'utf8');
  throw error;
 }
 return {modules:1,status:'PASS',runtimeSha256:sha(output)};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)fail('INVALID_ARGUMENTS');
  console.log('P12_AUTO_CLEAR_SYNC '+JSON.stringify(sync(process.argv[2])));
 }catch(error){console.error(error.message);process.exitCode=1;}
}
