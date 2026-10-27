// Task590: validate canonical NicoChatFilter in its original logical import layout.
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const source=resolve(repo,'tools/typescript-stage1/comment-src/NicoChatFilter.ts');
const tsc=resolve(repo,'tools/typescript-stage1/node_modules/typescript/bin/tsc');
const contract=resolve(repo,'tools/typescript-stage1/test/nico-chat-filter-contract.ts');
const sha=data=>createHash('sha256').update(data).digest('hex');
const original=readFileSync(source);
const temp=mkdtempSync(join(tmpdir(),'zfilter-strict-'));
function put(relative,data){
  const dest=resolve(temp,relative);
  mkdirSync(dirname(dest),{recursive:true});
  writeFileSync(dest,data);
  return dest;
}
try {
  const target=put('packages/zenza/src/commentLayer/NicoChatFilter.ts',original);
  put('packages/lib/src/Emitter.d.ts',
    'export declare class Emitter { emit(name:string,...args:unknown[]):void; }\n');
  put('packages/lib/src/text/textUtil.d.ts',
    'export declare const textUtil:{escapeRegs(text:string):string};\n');
  put('src/Config.d.ts',
    'export declare const Config:{getValue(key:string):unknown};\n');
  put('src/NgCompositeRules.d.ts',[
    'import type {',
    '  NicoFilterSourceChat, NicoFilterEvaluatedChat, NicoCompositeDisplayState,',
    '  NicoCompositeProgramState, NicoCompositeProjectionOutput,',
    '  NicoCompositeAuthorKey',
    "} from '../packages/zenza/src/commentLayer/NicoChatFilter';",
    'export declare const NgCompositeRules:{',
    '  compile(input:unknown): NicoCompositeProgramState|null;',
    '  initialState(chat:NicoFilterSourceChat,videoId:string): NicoCompositeDisplayState;',
    '  projectWithMeta(',
    '    chats: readonly NicoFilterSourceChat[],',
    '    program:NicoCompositeProgramState,',
    '    predicate: (chat:NicoFilterEvaluatedChat)=>boolean,',
    '    videoId:string,',
    '    baselines:WeakMap<NicoFilterSourceChat,NicoCompositeDisplayState>,',
    '    seedBans?:Map<string,Set<NicoCompositeAuthorKey|null|undefined>>',
    '  ):NicoCompositeProjectionOutput|null;',
    '};'
  ].join('\n')+'\n');
  const contractCopy=put('test/nico-chat-filter-contract.ts',readFileSync(contract));
  const config={
    compilerOptions:{
      target:'ES2022',module:'ESNext',moduleResolution:'Bundler',
      strict:true,noEmit:true,skipLibCheck:false,
      types:[],lib:['ES2022','DOM']
    },
    files:['packages/zenza/src/commentLayer/NicoChatFilter.ts',
      'test/nico-chat-filter-contract.ts']
  };
  const configPath=put('tsconfig.json',JSON.stringify(config,null,2)+'\n');
  if(sha(readFileSync(target))!==sha(original))throw Error('SHADOW_SOURCE_MISMATCH');
  execFileSync(process.execPath,[tsc,'--project',configPath],{
    cwd:repo,encoding:'utf8',windowsHide:true,
    stdio:['ignore','pipe','pipe']
  });
  if(sha(readFileSync(source))!==sha(original))throw Error('CANONICAL_SOURCE_CHANGED');
  if(sha(readFileSync(contractCopy))!==sha(readFileSync(contract)))throw Error('CONTRACT_CHANGED');
  console.log('NICO_CHAT_FILTER_STRICT=PASS source_sha256='+sha(original));
}catch(error){
  console.error('NICO_CHAT_FILTER_STRICT=FAILED CHECK');
  if(error.stdout)process.stderr.write(error.stdout);
  if(error.stderr)process.stderr.write(error.stderr);
  if(!error.stdout && !error.stderr)console.error(String(error.message||error));
  process.exitCode=1;
}finally{
  rmSync(temp,{recursive:true,force:true});
}
