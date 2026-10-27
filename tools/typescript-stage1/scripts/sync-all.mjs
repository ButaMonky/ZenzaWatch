// Task451: one preflight, guarded write and verification for all TypeScript modules.
import {MODULES} from './module-registry.mjs';
import {syncModules,safeDiagnostic} from './generator-core.mjs';
try{
  if(process.argv.length!==3)throw Error('TYPESCRIPT_MODE_INVALID');
  const results=syncModules(MODULES,process.argv[2]);
  for(const result of results){
    console.log(result.prefix+'='+result.status+' '+result.sha256);
  }
  console.log('TYPESCRIPT_ALL_SYNC=PASS modules='+results.length);
}catch(error){
  // Never print source data, credentials or user-specific paths.
  console.error('TYPESCRIPT_ALL_SYNC=FAILED '+safeDiagnostic(error));
  process.exitCode=1;
}
