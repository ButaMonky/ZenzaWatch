// Task456: strictly type-check the tracked canonical Model without changing
// the separately-owned UiVisibilityRegistry.ts (Task454 is BLOCKED).
// A typed dependency declaration shadows *only* the adjacent imported module
// in an ignored, byte-for-byte staged copy of the Model source.
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const toolDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sourcePath=resolve(toolDir,'advanced-src/ModernAdvancedSettingsModel.ts');
const tempDir=resolve(toolDir,'.generated/model-strict');
const digest=s=>createHash('sha256').update(s).digest('hex');
const dependencyTypes=`// Explicitly typed replacement of the independent UI registry *boundary*.
export interface SharedVisibilityDescriptor {
  id: string;
  label: string;
  category: string;
  subcategory: string;
  [field: string]: unknown;
}
export declare class UiVisibilityRegistry {
  static get SHARED_SETTINGS(): Array<[string, string]>;
  static descriptors(): SharedVisibilityDescriptor[];
}
`;
const project={
  compilerOptions:{
    target:'ES2022',module:'ESNext',moduleResolution:'Bundler',
    strict:true,noEmit:true,skipLibCheck:false,types:[],
    lib:['ES2022','DOM']
  },
  include:['ModernAdvancedSettingsModel.ts','UiVisibilityRegistry.d.ts']
};
function run(){
  if(process.argv.length!==2)throw Error('TYPECHECK_INVALID_ARGUMENTS');
  const input=readFileSync(sourcePath);
  mkdirSync(tempDir,{recursive:true});
  const copied=resolve(tempDir,'ModernAdvancedSettingsModel.ts');
  // Preserve exact bytes to prevent a typecheck of a modified/different source.
  writeFileSync(copied,input);
  writeFileSync(resolve(tempDir,'UiVisibilityRegistry.d.ts'),dependencyTypes);
  writeFileSync(resolve(tempDir,'tsconfig.json'),
    JSON.stringify(project,null,2)+'\n');
  if(digest(input)!==digest(readFileSync(copied))){
    throw Error('TYPECHECK_COPY_HASH_MISMATCH');
  }
  const compiler=resolve(toolDir,'node_modules/typescript/bin/tsc');
  const result=spawnSync(process.execPath,[compiler,'-p',
    resolve(tempDir,'tsconfig.json')],{
    cwd:toolDir,encoding:'utf8',windowsHide:true,
    maxBuffer:1024*1024
  });
  if(result.error||result.status!==0){
    // No secrets from user data are printed; TypeScript errors contain source
    // positions and diagnostic text but are not passed to external services.
    console.error('ADVANCED_MODEL_STRICT=FAILED compiler_exit='+result.status);
    if(result.stdout)process.stderr.write(result.stdout);
    if(result.stderr)process.stderr.write(result.stderr);
    process.exitCode=result.status||1;
    return;
  }
  console.log('ADVANCED_MODEL_STRICT=PASS source_sha256='+digest(input));
}
try{run();}
catch(error){
  console.error('ADVANCED_MODEL_STRICT=FAILED '+String(error?.code||'VALIDATION'));
  process.exitCode=1;
}
