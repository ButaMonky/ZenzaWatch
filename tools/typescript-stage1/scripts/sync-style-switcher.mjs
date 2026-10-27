// Task451: backwards-compatible Task450 CLI/exports through the shared generator.
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MODULE_BY_ID} from './module-registry.mjs';
import {renderLegacy as render,syncModules,safeDiagnostic} from './generator-core.mjs';

const spec=MODULE_BY_ID['style-switcher'];
export const renderStyleLegacy=emitted=>render(spec,emitted);
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const mode=process.argv[2];
    if(process.argv.length!==3)throw Error('TYPESCRIPT_MODE_INVALID');
    const result=syncModules([spec],mode)[0];
    console.log(result.prefix+'='+result.status+' '+result.sha256);
  }catch(error){
    console.error('TYPESCRIPT_STYLE_SYNC=FAILED '+safeDiagnostic(error));
    process.exitCode=1;
  }
}
