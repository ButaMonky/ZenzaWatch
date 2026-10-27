// Task472: strict checking of byte-identical TS for the standalone legacy panel.
// External runtime libraries are mirrored as *typed boundaries* in an ignored tree.
// No product JS, stored settings or unrelated worktree files are changed.
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const toolRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(toolRoot,'advanced-src/_setting.ts');
const temp=resolve(toolRoot,'.generated/legacy-panel-strict');
const digest=data=>createHash('sha256').update(data).digest('hex');
const stubs={
  'packages/components/src/util/ZenzaDetector.d.ts':
    "export declare const ZenzaDetector: any;",
  'packages/lib/src/uQuery.d.ts':
    "export declare const uq: any;",
  'packages/lib/src/css/css.d.ts':
    "export declare const cssUtil: {addStyle(css:string):void};",
  'packages/lib/src/infra/DataStorage.d.ts':
    "export declare const DataStorage: any;",
  'advanced-src/Config.d.ts':
    "export declare const Config: any;",
  'packages/lib/src/Emitter.d.ts':
    "export declare const Emitter: any;export declare const Handler: any;",
  'packages/zenza/src/ShortcutActions.d.ts':`
    export interface ShortcutAction {
      id: string;
      label: string;
      category?: string;
      defaultKey: number;
      customSeekSlot?: number;
    }
    export declare const SHORTCUT_ACTIONS: readonly ShortcutAction[];
    export declare function formatKeyCombo(code: number): string;
    export declare function encodeKeyCombo(event: KeyboardEvent): number;
    export declare function groupShortcutActionsByCategory():
      Array<{category:string,actions:ShortcutAction[]}>;
  `,
  'packages/zenza/src/videoPlayer/ScreenFilter.d.ts':`
    interface ScreenFilterParam {
      key:string;type:string;label:string;desc?:string;min?:number;
      max?:number;unit?:string;def:number;heavy?:boolean;
      options:Array<[string,string]>;
    }
    interface Preset {id:string;label:string;desc:string;values:Record<string,unknown>;}
    export declare const ScreenFilter: {
      PREFIX:string;PARAMS:ScreenFilterParam[];
      PARAM_MAP:Record<string, ScreenFilterParam>;
      PRESETS:Preset[];
      normalize(key:string,value:unknown):number;
      formatValue(key:string,value:number):string;
    };
  `,
  'packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.d.ts':
    "export declare const ZenzaCommentHistorySettings:any;",
  'advanced-src/RelatedMenuSettings.d.ts':
    "export declare const RelatedMenuSettings:any;",
  'advanced-src/RelatedMenuOrder.d.ts':
    "export declare const RelatedMenuOrder:any;",
  'advanced-src/ScreenshotFileName.d.ts':
    "export declare const ScreenshotFileName:any;",
  'packages/zenza/src/menu/RelatedMenuActions.d.ts':
    "export declare const RelatedMenuActions:any;",
  'advanced-src/ModernAdvancedSettingsModel.d.ts':
    "export declare const ModernAdvancedSettingsModel:any;",
  'advanced-src/ModernAdvancedSettingsUI.d.ts':
    "export declare const ModernAdvancedSettingsUI:any;",
  'advanced-src/NgCompositeRuleEditor.d.ts':
    "export declare const NgCompositeRuleEditor:any;",
  'packages/zenza/src/commentLayer/CommentDisplayBudget.d.ts':
    "export declare const CommentDisplayBudget:{CONFIG_KEY:string;DEFAULT:number;CHOICES:readonly number[];normalizeLimit(v:unknown):number};"
};
const config={
  compilerOptions:{
    target:'ES2022',module:'ESNext',moduleResolution:'Bundler',
    strict:true,noEmit:true,types:[],lib:['ES2022','DOM'],
    skipLibCheck:false
  },
  include:['advanced-src/_setting.ts','advanced-src/*.d.ts',
    'packages/**/*.d.ts']
};
function check(){
  if(process.argv.length!==2)throw Error('LEGACY_TYPECHECK_INVALID_ARGUMENTS');
  const before=readFileSync(source);
  mkdirSync(resolve(temp,'advanced-src'),{recursive:true});
  const dest=resolve(temp,'advanced-src/_setting.ts');
  writeFileSync(dest,before);
  if(digest(before)!==digest(readFileSync(dest))){
    throw Error('LEGACY_TYPECHECK_SOURCE_MISMATCH');
  }
  for(const [rel,content] of Object.entries(stubs)){
    const output=resolve(temp,rel);
    mkdirSync(dirname(output),{recursive:true});
    writeFileSync(output,content);
  }
  writeFileSync(resolve(temp,'tsconfig.json'),JSON.stringify(config,null,2)+'\n');
  const bin=resolve(toolRoot,'node_modules/typescript/bin/tsc');
  const result=spawnSync(process.execPath,[bin,'--project',
    resolve(temp,'tsconfig.json')],{
    cwd:toolRoot,encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024
  });
  if(result.status!==0||result.error){
    console.error('ADVANCED_LEGACY_PANEL_STRICT=FAILED exit='+result.status);
    if(result.stdout)process.stderr.write(result.stdout);
    if(result.stderr)process.stderr.write(result.stderr);
    process.exitCode=result.status||1;return;
  }
  console.log('ADVANCED_LEGACY_PANEL_STRICT=PASS sha256='+digest(before));
}
try{check();}
catch(error){
  console.error('ADVANCED_LEGACY_PANEL_STRICT=FAILED '+String(error?.code||'VALIDATION'));
  process.exitCode=1;
}
