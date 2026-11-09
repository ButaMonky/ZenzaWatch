/**
 * Task210: deterministic, allowlisted TypeScript -> MylistPocket metadata runtime.
 * The JS loader is a build artifact; ONLY the .ts module is hand-maintained.
 * Do not alter source/user-script require order or use this on arbitrary paths.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const SOURCE='packages/zenza/src/pocket/PocketCardMetadataLoader.ts';
const EMITTED='tools/typescript-stage1/.generated/pocket-metadata/PocketCardMetadataLoader.js';
const RUNTIME='packages/zenza/src/pocket/PocketCardMetadataLoader.js';
const MANIFEST='tools/typescript-stage1/pocket-metadata-runtime-manifest.json';
const HEADER='// GENERATED FROM '+SOURCE+' (Task210). Do not edit this JS.\n';
const ORIGINAL_GIT_BLOB='087f732bbecb4a7108ecfdb4c4c309bb25680894';
const MARKER='const PocketCardMetadataLoader = (() => {';
const END='export { PocketCardMetadataLoader };';
const lf=s=>s.replace(/\r\n/g,'\n');
const sha=s=>createHash('sha256').update(lf(s),'utf8').digest('hex');
const blob=s=>createHash('sha1')
  .update('blob '+Buffer.byteLength(s,'utf8')+'\0'+s,'utf8').digest('hex');
const read=path=>readFileSync(resolve(root,path),'utf8');

function render(compiled,source){
  const text=lf(compiled).trimEnd();
  const at=text.indexOf(MARKER),end=text.lastIndexOf(END);
  if(at<0||end<=at||text.indexOf(MARKER,at+MARKER.length)>=0||
      text.slice(end+END.length).trim()||
      /^(?:\s*)(?:import|export)\s+(?!\{)/m.test(text.slice(at,end))||
      text.includes('\0'))throw Error('POCKET_METADATA_EMIT_INVALID');
  const body=text.slice(at,end).trimEnd();
  if(!body.endsWith('})();'))throw Error('POCKET_METADATA_EMIT_SHAPE_INVALID');
  return HEADER+'// SOURCE_SHA256 '+sha(source)+'\n//===BEGIN===\n'+
    body+'\n//===END===\nexport {PocketCardMetadataLoader};\n';
}
function targetManifest(source,output){
  return {schemaVersion:1,source:SOURCE,runtime:RUNTIME,
    sourceSha256:sha(source),runtimeSha256:sha(output)};
}

try{
  const mode=process.argv[2];
  if(process.argv.length!==3||!['--check','--write'].includes(mode)){
    throw Error('POCKET_METADATA_MODE_INVALID');
  }
  if(!existsSync(resolve(root,SOURCE))||!existsSync(resolve(root,EMITTED))||
      !existsSync(resolve(root,RUNTIME))){
    throw Error('POCKET_METADATA_INPUT_MISSING');
  }
  const source=read(SOURCE),next=render(read(EMITTED),source);
  const wanted=targetManifest(source,next);
  const wantedText=JSON.stringify(wanted,null,2)+'\n';
  if(mode==='--check'){
    if(lf(read(RUNTIME))!==next)throw Error('POCKET_METADATA_RUNTIME_STALE');
    if(!existsSync(resolve(root,MANIFEST))||
        read(MANIFEST)!==wantedText)throw Error('POCKET_METADATA_MANIFEST_STALE');
  }else{
    const current=read(RUNTIME);
    const existing=existsSync(resolve(root,MANIFEST))?
      JSON.parse(read(MANIFEST)):null;
    const owned=blob(current)===ORIGINAL_GIT_BLOB||
      (current.startsWith(HEADER)&&existing?.runtimeSha256===sha(current));
    if(!owned)throw Error('POCKET_METADATA_UNOWNED_RUNTIME');
    writeFileSync(resolve(root,RUNTIME),next,'utf8');
    writeFileSync(resolve(root,MANIFEST),wantedText,'utf8');
  }
  process.stdout.write('POCKET_METADATA_TS_SYNC=PASS\n');
}catch(error){
  process.stderr.write('POCKET_METADATA_TS_SYNC=FAILED '+
    String(error?.message||'UNKNOWN').slice(0,100)+'\n');
  process.exitCode=1;
}
