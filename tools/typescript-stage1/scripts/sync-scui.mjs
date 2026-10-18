// Only the public scene preview modules are writable by this generator.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const lf=text=>text.replace(/\r\n/g,'\n');
const hash=text=>createHash('sha256').update(lf(text)).digest('hex');
const names=['SceneSearchLayout00','SceneSearchPreferences','SceneSearchPreviewView','SceneSearchPlacement'];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;
export function applyFiles(entries,io=fs){
 for(const e of entries)if(read(e.path)!==e.before)throw Error('SCUI_FOREIGN_EDIT');
 const written=[];
 try{
  for(const e of entries){
   if(read(e.path)!==e.before)throw Error('SCUI_FOREIGN_EDIT');
   written.push(e);io.writeFileSync(e.path,e.after);
  }
 }catch(error){
  for(const e of written.reverse()){
   if(e.before===null){if(fs.existsSync(e.path))fs.unlinkSync(e.path);}
   else fs.writeFileSync(e.path,e.before);
  }
  throw error;
 }
}
export function sync(mode){
 if(!['--write','--check'].includes(mode))throw Error('SCUI_INVALID_MODE');
 const mp=path.join(root,'tools/typescript-stage1/scui-runtime-manifest.json');
 const oldText=read(mp),old=oldText?JSON.parse(oldText):{},next={},entries=[];
 for(const name of names){
  const source='tools/typescript-stage1/nico-src/'+name+'.ts',src=read(path.join(root,source));
  if(src===null)continue;
  const emitted=read(path.join(root,'tools/typescript-stage1/.generated/scui/'+name+'.js'));
  if(emitted===null)throw Error('SCUI_MISSING_EMIT');
  const body=lf(emitted).replace(/^export class /m,'class ').trimEnd();
  if(/^\s*(?:import|export)\b/m.test(body)||!body.includes('class '+name+' {'))throw Error('SCUI_INVALID_EMIT');
  const output='// GENERATED FROM '+source+'\n//===BEGIN===\n'+body+'\n//===END===\nexport {'+name+'};\n';
  const runtime='packages/zenza/src/sceneSearch/'+name+'.js',p=path.join(root,runtime),actual=read(p);
  next[name]={source,runtime,sourceSha256:hash(src),runtimeSha256:hash(output)};
  if(actual!==null && lf(actual)!==output && (!old[name]||hash(actual)!==old[name].runtimeSha256)){
   throw Error('SCUI_FOREIGN_EDIT_'+name);
  }
  if(mode==='--check' && (actual===null||lf(actual)!==output))throw Error('SCUI_STALE_'+name);
  entries.push({path:p,before:actual,after:output});
 }
 const after=JSON.stringify(next,null,2)+'\n';
 if(mode==='--check'&&oldText!==after)throw Error('SCUI_STALE_MANIFEST');
 if(mode==='--write')applyFiles([...entries,{path:mp,before:oldText,after}]);
 return Object.keys(next).length;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log('SCUI_SYNC=PASS modules='+sync(process.argv[2]));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
