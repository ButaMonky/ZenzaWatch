// Task579: strict-check canonical TS in the original logical package layout.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const source=resolve(repo,'tools/typescript-stage1/comment-src/NicoChatGroup.ts');
const tsc=resolve(repo,'tools/typescript-stage1/node_modules/typescript/bin/tsc');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const expected=readFileSync(source);
const workspace=mkdtempSync(join(tmpdir(),'znico-group-strict-'));
const write=(rel,data)=>{
  const path=resolve(workspace,rel);
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path,data);
  return path;
};
try {
  const sourceCopy=write('packages/zenza/src/commentLayer/NicoChatGroup.ts',expected);
  write('packages/lib/src/Emitter.d.ts',`// Focused imported runtime contract for one class dependency.
export declare class Emitter {
  emit(event:string,...args:unknown[]):void;
}
`);
  write('packages/zenza/src/commentLayer/NicoChatFilter.d.ts',`// Type-only boundary; actual runtime JS is unchanged.
export declare class NicoChatFilter {
  static SHARED_NG_LEVEL:Record<string,unknown>;
}
`);
  const config={
    compilerOptions:{
      target:'ES2022',module:'ESNext',moduleResolution:'Bundler',strict:true,
      noEmit:true,skipLibCheck:false,types:[],lib:['ES2022','DOM']
    },
    files:['packages/zenza/src/commentLayer/NicoChatGroup.ts']
  };
  const configFile=write('tsconfig.json',JSON.stringify(config,null,2)+'\n');
  if(sha(readFileSync(sourceCopy))!==sha(expected))throw Error('SHADOW_HASH_MISMATCH');
  execFileSync(process.execPath,[tsc,'--project',configFile],{
    cwd:repo,windowsHide:true,encoding:'utf8',
    stdio:['ignore','pipe','pipe']
  });
  if(sha(readFileSync(source))!==sha(expected))throw Error('SOURCE_CHANGED_DURING_CHECK');
  console.log('NICO_CHAT_GROUP_STRICT=PASS source_sha256='+sha(expected));
} catch(error) {
  console.error('NICO_CHAT_GROUP_STRICT=FAILED '+String(error?.code||'CHECK'));
  if(error?.stdout)process.stderr.write(error.stdout);
  if(error?.stderr)process.stderr.write(error.stderr);
  process.exitCode=1;
} finally {
  rmSync(workspace,{recursive:true,force:true});
}
