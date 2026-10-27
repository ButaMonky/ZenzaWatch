// Task550: Type-check the canonical modern UI and its real model.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const toolDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const tempDir=resolve(toolDir,'.generated/advanced-ui-strict');
const digest=data=>createHash('sha256').update(data).digest('hex');
const moduleFiles=['ModernAdvancedSettingsUI.ts','ModernAdvancedSettingsModel.ts'];
// The dependency boundary is the same one used by check-model-strict.mjs.
// The UiVisibilityRegistry implementation is independently owned (Task454).
const registryBoundary=`export interface SharedVisibilityDescriptor {
  id: string;label: string;category: string;subcategory: string;
  [field: string]: unknown;
}
export declare class UiVisibilityRegistry {
  static get SHARED_SETTINGS(): Array<[string,string]>;
  static descriptors(): SharedVisibilityDescriptor[];
}
`;
const tsconfig={
  compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',
    strict:true,noEmit:true,skipLibCheck:false,types:[],
    lib:['ES2022','DOM']},
  include:[...moduleFiles,'UiVisibilityRegistry.d.ts']
};function main(){
  if(process.argv.length!==2)throw Error('UI_STRICT_ARGUMENTS_INVALID');
  mkdirSync(tempDir,{recursive:true});
  const hashes=[];
  for(const name of moduleFiles){
    const origin=readFileSync(resolve(toolDir,'advanced-src',name));
    const copied=resolve(tempDir,name);
    writeFileSync(copied,origin);
    const hash=digest(origin);
    if(hash!==digest(readFileSync(copied)))throw Error('UI_STRICT_HASH_MISMATCH');
    hashes.push(name+':'+hash);
  }
  writeFileSync(resolve(tempDir,'UiVisibilityRegistry.d.ts'),registryBoundary);
  writeFileSync(resolve(tempDir,'tsconfig.json'),JSON.stringify(tsconfig,null,2)+'\n');
  const compiler=resolve(toolDir,'node_modules/typescript/bin/tsc');
  const result=spawnSync(process.execPath,[compiler,'-p',
    resolve(tempDir,'tsconfig.json')],{
    cwd:toolDir,windowsHide:true,encoding:'utf8',maxBuffer:2*1024*1024
  });
  if(result.status!==0 || result.error){
    console.error('ADVANCED_UI_STRICT=FAILED compiler_exit='+result.status);
    if(result.stdout)process.stderr.write(result.stdout);
    if(result.stderr)process.stderr.write(result.stderr);
    process.exitCode=result.status||1;
    return;
  }
  console.log('ADVANCED_UI_STRICT=PASS '+hashes.join(' '));
}try{main();}
catch(error){
  console.error('ADVANCED_UI_STRICT=FAILED '+String(error?.code||'VALIDATION'));
  process.exitCode=1;
}
