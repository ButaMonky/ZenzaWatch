/**
 * Task713: deterministic TypeScript -> MylistPocket userscript generator.
 * Only one hard-coded source and runtime path can be synced.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const source=resolve(root,'packages/zenza/src/pocket/PocketThumbnail.ts');
const emitted=resolve(root,'tools/typescript-stage1/.generated/pocket/PocketThumbnail.js');
const runtime=resolve(root,'packages/zenza/src/pocket/PocketThumbnail.js');
const header='// GENERATED FROM packages/zenza/src/pocket/PocketThumbnail.ts (Task713). Do not edit this JS.\n';
const oldHeader='// GENERATED FROM tools/typescript-stage1/pocket-src/PocketThumbnail.ts (Task713). Do not edit this JS.\n';
const marker='const PocketThumbnail = (() => {';
const suffix='export { PocketThumbnail };';

function render(input,tsSource) {
  const lf=input.replace(/\r\n/g,'\n');
  const at=lf.indexOf(marker);
  const last=lf.lastIndexOf(suffix);
  if(at<0||last<at||lf.indexOf(marker,at+marker.length)>=0||
    lf.slice(last+suffix.length).trim().length!==0||
    /\b(?:import|eval|Function)\s*\(/.test(lf.slice(at,last))) {
    throw Error('POCKET_TS_EMIT_INVALID');
  }
  const body=lf.slice(at,last).trimEnd();
  if(!body.endsWith('})();'))throw Error('POCKET_TS_EMIT_STRUCTURE_INVALID');
  const fingerprint=createHash('sha256').update(tsSource,'utf8').digest('hex');
  return header+'// SOURCE_SHA256 '+fingerprint+'\n//===BEGIN===\n'+
    body+'\n//===END===\nexport {PocketThumbnail};\n';
}
try {
  if(process.argv.length!==3||!['--write','--check'].includes(process.argv[2]))
    throw Error('POCKET_TS_MODE_INVALID');
  if(!existsSync(emitted)||!existsSync(source))throw Error('POCKET_TS_SOURCE_OR_EMIT_MISSING');
  const next=render(readFileSync(emitted,'utf8'),readFileSync(source,'utf8'));
  const current=existsSync(runtime)?readFileSync(runtime,'utf8'):'';
  if(process.argv[2]==='--check'){
    if(current!==next)throw Error('POCKET_TS_SOURCE_RUNTIME_MISMATCH');
  }else if(current!==next){
    if(current&&!current.startsWith(header)&&!current.startsWith(oldHeader))
      throw Error('POCKET_TS_UNOWNED_RUNTIME');
    mkdirSync(dirname(runtime),{recursive:true});
    writeFileSync(runtime,next,{encoding:'utf8'});
  }
  console.log('POCKET_THUMBNAIL_TS_PARITY=PASS');
}catch(error){
  console.error('POCKET_THUMBNAIL_TS_PARITY=FAILED '+
    String(error?.message||'UNKNOWN').slice(0,100));
  process.exitCode=1;
}
