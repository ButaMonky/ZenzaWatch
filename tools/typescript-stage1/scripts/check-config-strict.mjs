// Task459: strict TypeScript check of byte-identical canonical Config.ts.
// The adjacent legacy modules are represented by narrowly typed external contracts
// in an ignored isolated directory. Never edits runtime JS or the source file.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const toolDir=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sourcePath=resolve(toolDir,'advanced-src/Config.ts');
const tempDir=resolve(toolDir,'.generated/config-strict');
const digest=data=>createHash('sha256').update(data).digest('hex');
const stubs={
  'packages/zenza/src/sceneSearch/SceneSearchPreferences.d.ts':`
    export declare class SceneSearchPreferences {
      static resolve(get:(key:string)=>unknown,owns:(key:string)=>boolean):{enabled:boolean;normal:string;fullscreen:string;miniVisible:boolean};
    }
  `,
  'packages/lib/src/infra/DataStorage.d.ts':`
    export interface ConfigStorage {
      default: Record<string,unknown>;
      storage: {[key:string]: string | undefined};
      getStorageKey(key:string):string;
      getValue(key:string):unknown;
      readonly:boolean; silently:boolean;
      options:{validateImport(key:string,value:unknown):boolean};
      _data:Record<string,unknown>;
      _changed:Map<string,unknown>;
      _onChange():void;
      hasStoredValue(key:string):boolean;
      resolveSceneSearch():{enabled:boolean;normal:string;fullscreen:string;miniVisible:boolean}|null;
      persistSceneSearchSelection(values:Record<string,unknown>):void;
      export(): unknown;
      import(value: unknown): unknown;
      exportJson(): string;
      exportConfig?: () => unknown;
      importConfig?: (value: unknown) => unknown;
      exportToFile?: () => void;
    }
    export declare const DataStorage: {
      create(defaults: Record<string,unknown>, options: {
        normalizeImport(key:string,value:unknown):unknown;
        validateImport(key:string,value:unknown):boolean;
        preserveInvalidKeys: string[];
        prefix:string;
        ignoreExportKeys:string[];
        readonly:boolean;
        storage:Storage;
      }): ConfigStorage;
    };
  `,
  'packages/zenza/src/ShortcutActions.d.ts':`
    export declare function buildDefaultKeyConfig(
      defaults:Record<string,unknown>):Record<string,number>;
  `,
  'packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.d.ts':`
    export declare const ZenzaCommentHistorySettings:{
      HISTORY_PREFERENCE_DEFAULTS:Record<string,unknown>;
      SETTINGS_SCHEMA:readonly {key:string;name:string}[];
      normalizeSettings(input:Record<string,unknown>):Record<string,unknown>;
    };
  `,
  'packages/zenza/src/commentLayer/CommentDisplayBudget.d.ts':`
    export declare const CommentDisplayBudget:{
      CONFIG_KEY:string;
      DEFAULT:number;
      isValidLimit(value:unknown):boolean;
    };
  `,
  'packages/zenza/src/menu/RelatedMenuActions.d.ts':`
    export declare const RelatedMenuActions:{
      CONFIG_KEY:string;
      validateLinks(value:unknown):{valid:boolean};
    };
  `,
  'advanced-src/RelatedMenuOrder.d.ts':`
    export declare const RelatedMenuOrder:{
      CONFIG_KEY:string;HIDDEN_KEY:string;OPTIONS_KEY:string;
      validateOrder(value:unknown):boolean;
      validateHiddenItems(value:unknown):boolean;
      validateOptions(value:unknown):boolean;
    };
  `,
  'advanced-src/ScreenshotFileName.d.ts':`
    export declare const ScreenshotFileName:{
      validateTemplate(value:unknown):boolean;
    };
  `,
  'advanced-src/UiVisibilityRegistry.d.ts':`
    export declare class UiVisibilityRegistry{
      static defaults():Record<string,boolean>;
      static isVisibilityKey(key:string):boolean;
    }
  `,
  'advanced-src/NgCompositeRules.d.ts':`
    export declare const NgCompositeRules:{
      validate(value:unknown):boolean;
    };
  `
};
const config={
  compilerOptions:{
    target:'ES2022',module:'ESNext',moduleResolution:'Bundler',
    strict:true,noEmit:true,types:[],lib:['ES2022','DOM'],
    skipLibCheck:false
  },
  include:['advanced-src/Config.ts','advanced-src/*.d.ts',
    'packages/**/*.d.ts']
};
function stage(){
  if(process.argv.length!==2)throw Error('CONFIG_CHECK_INVALID_ARGUMENTS');
  const source=readFileSync(sourcePath);
  mkdirSync(resolve(tempDir,'advanced-src'),{recursive:true});
  const dest=resolve(tempDir,'advanced-src/Config.ts');
  writeFileSync(dest,source);
  if(digest(source)!==digest(readFileSync(dest))){
    throw Error('CONFIG_STRICT_SOURCE_MISMATCH');
  }
  for(const [relative,text] of Object.entries(stubs)){
    const file=resolve(tempDir,relative);
    mkdirSync(dirname(file),{recursive:true});
    writeFileSync(file,text);
  }
  writeFileSync(resolve(tempDir,'tsconfig.json'),
    JSON.stringify(config,null,2)+'\n');
  const compiler=resolve(toolDir,'node_modules/typescript/bin/tsc');
  const proc=spawnSync(process.execPath,[compiler,
    '--project',resolve(tempDir,'tsconfig.json')],{
      cwd:toolDir,encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024
    });
  if(proc.status!==0||proc.error){
    console.error('ADVANCED_CONFIG_STRICT=FAILED compiler_exit='+proc.status);
    if(proc.stdout)process.stderr.write(proc.stdout);
    if(proc.stderr)process.stderr.write(proc.stderr);
    process.exitCode=proc.status||1;
    return;
  }
  console.log('ADVANCED_CONFIG_STRICT=PASS source_sha256='+digest(source));
}
try{stage();}
catch(e){
  console.error('ADVANCED_CONFIG_STRICT=FAILED '+String(e?.code||'VALIDATION'));
  process.exitCode=1;
}
