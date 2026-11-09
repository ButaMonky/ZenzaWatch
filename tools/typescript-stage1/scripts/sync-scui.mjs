// Only the public scene preview modules are writable by this generator.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const lf=text=>text.replace(/\r\n/g,'\n');
const hash=text=>createHash('sha256').update(lf(text)).digest('hex');
const names=['SceneSearchLayout00','SceneSearchPreferences','SceneSearchPreviewView','SceneSearchPlacement','SceneSearchController','SceneSearchInteraction','ScenePreviewIdleLimiter','SceneSearchShortcutRouter','SceneCommentSearch','SceneCommentSearchPanel','TimelineGeometry','SceneResumeMarkerPresenter','SceneSearchVisibleRectCollector','SceneSearchLayoutResources','SceneSearchLayoutRegistry','SceneSearchDomLease','SceneSearchPreferenceConnection','SceneSearchObstacleCollector','SceneSeekStepControl','SceneSearchLayoutCatalog','SceneSearchLayoutCard','SceneSearchLegacyAdapter','SceneSearchLayout10','SceneSearchLayouts03_04','SceneSearchLayouts05_06','SceneSearchLayout07','SceneSearchLayouts01_02','SceneSearchLayoutBootstrap','SceneSearchPlayerBinding','SceneSearchIntegrationBridge','SceneSearchLayouts08_09'];
// Nested layouts are an explicit, immutable subset of the scene runtime tree.
// Never accept caller paths, prefixes, traversal sequences or arbitrary modules.
const nestedLayoutModules=new Set([
 'SceneSearchLayout07','SceneSearchLayout10','SceneSearchLayouts03_04',
 'SceneSearchLayouts05_06','SceneSearchLayouts08_09'
]);
export function runtimePathFor(name){
 if(!names.includes(name)&&!nestedLayoutModules.has(name))throw Error('SCUI_UNKNOWN_MODULE');
 return 'packages/zenza/src/sceneSearch/'+
  (nestedLayoutModules.has(name)?'layouts/':'')+name+'.js';
}
const read=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):null;
// Dependency parsing is newline-independent; concurrency/rollback still use raw read().
const readNormalized=p=>{const text=read(p);return text===null?null:lf(text);};
export function applyFiles(entries,io=fs){
 for(const e of entries)if(read(e.path)!==e.before)throw Error('SCUI_FOREIGN_EDIT');
 const written=[];
 try{
  for(const e of entries){
   if(read(e.path)!==e.before)throw Error('SCUI_FOREIGN_EDIT');
   written.push(e);io.writeFileSync(e.path,e.after);
  }
 }catch(error){
  for(const e of written.reverse()){
   if(e.before===null){if(fs.existsSync(e.path))fs.unlinkSync(e.path);}
   else fs.writeFileSync(e.path,e.before);
  }
  throw error;
 }
}
export function sync(mode,only){
 if(!['--write','--check'].includes(mode))throw Error('SCUI_INVALID_MODE');
 if(only!==undefined&&!names.includes(only))throw Error('SCUI_UNKNOWN_MODULE');
 const mp=path.join(root,'tools/typescript-stage1/scui-runtime-manifest.json');
 const oldText=read(mp),old=oldText?JSON.parse(oldText):{},next=only===undefined?{}:{...old},entries=[];
 for(const name of only===undefined?names:[only]){
  const source='tools/typescript-stage1/nico-src/'+name+'.ts',src=read(path.join(root,source));
  if(src===null)throw Error('SCUI_MISSING_TS_SOURCE_'+name);
  const emitted=read(path.join(root,'tools/typescript-stage1/.generated/scui/'+name+'.js'));
  if(emitted===null)throw Error('SCUI_MISSING_EMIT');
  let normalized=lf(emitted),imports='',requires='';
  // PreviewView borrows native DOM through this one explicit runtime boundary.
  // Other imports remain rejected; flat userscript builds need both the import
  // outside BEGIN and the dependency directive inside it.
  if(name==='SceneSearchPreviewView'){
   const leaseImport=/^import\s+\{\s*SceneSearchDomLease\s*\}\s+from\s+['"]\.\.\/\.\.\/\.\.\/packages\/zenza\/src\/sceneSearch\/SceneSearchDomLease(?:\.js)?['"];?\s*$/m;
   if(leaseImport.test(normalized)){
    normalized=normalized.replace(leaseImport,'').trimStart();
    imports="import {SceneSearchDomLease} from './SceneSearchDomLease';\n";
    requires='//@require SceneSearchDomLease\n';
   }
  }
  // Keep the original flat-userscript dependency when migrating the native
  // seek adapter.  A TypeScript-only import must not erase its runtime owner.
  // This branch is allowlisted to one existing module, not inferred from
  // arbitrary TS imports or a caller-supplied output path.
  if(name==='SceneSearchLegacyAdapter'){
   const legacyRuntime=readNormalized(path.join(root,
     'packages/zenza/src/sceneSearch/SceneSearchLegacyAdapter.js'));
   const importLine="import {TimelineGeometry} from './TimelineGeometry';";
   const requireLine='//@require TimelineGeometry';
   if(!legacyRuntime||!legacyRuntime.includes(importLine+'\n')||
     !legacyRuntime.includes(requireLine+'\n')){
    throw Error('SCUI_LEGACY_ADAPTER_DEPENDENCY_DRIFT');
   }
   if(normalized.includes(requireLine)){
    throw Error('SCUI_LEGACY_ADAPTER_DUPLICATE_EMITTED_REQUIRE');
   }
   imports=importLine+'\n';
   requires=requireLine+'\n';
  }
  if(name==='SceneResumeMarkerPresenter'){
   const exactImport=/^import\s+\{\s*TimelineGeometry\s*\}\s+from\s+['"]\.\/TimelineGeometry['"];?\s*$/gm;
   if([...normalized.matchAll(exactImport)].length!==1)throw Error('SCUI_TIMELINE_PRESENTER_DEPENDENCY_DRIFT');
   normalized=normalized.replace(exactImport,'').trimStart();
   imports="import {TimelineGeometry} from './TimelineGeometry';\n";
   requires='//@require TimelineGeometry\n';
  }
  let exportName=name;
  if(name==='SceneSearchLayouts01_02'){
   const legacyRuntime=readNormalized(path.join(root,
     'packages/zenza/src/sceneSearch/SceneSearchLayouts01_02.js'));
   const importLine="import {SceneSearchLayoutCard} from './SceneSearchLayoutCard';";
   const requireLine='//@require SceneSearchLayoutCard';
   if(!legacyRuntime||!legacyRuntime.includes(importLine+'\n')||
     !legacyRuntime.includes('//===BEGIN===\n'+requireLine+'\n')){
    throw Error('SCUI_CLASSIC_DEPENDENCY_DRIFT');
   }
   const exactImport=/^import\s+\{\s*SceneSearchLayoutCard\s*\}\s+from\s+['"]\.\/SceneSearchLayoutCard['"];?\s*$/gm;
   const importsFound=[...normalized.matchAll(exactImport)];
   if(importsFound.length!==1)throw Error('SCUI_CLASSIC_IMPORT_DRIFT');
   normalized=normalized.replace(exactImport,'').trimStart();
   imports=importLine+'\n';requires=requireLine+'\n';
   exportName='registerSceneLayouts01_02';
  }
  // The bootstrap has exactly eleven known imports in an immutable order.
  // All runtime imports and flat-userscript directives are preserved verbatim.
  if(name==='SceneSearchLayoutBootstrap'){
   const dependencies=[
    ['SceneSearchPreviewView','SceneSearchPreviewView','./SceneSearchPreviewView'],
    ['SceneSearchLayoutCard','SceneSearchLayoutCard','./SceneSearchLayoutCard'],
    ['SceneSearchLayout00','SceneSearchLayout00','./SceneSearchLayout00'],
    ['SceneSearchLayoutRegistry','SceneSearchLayoutRegistry','./SceneSearchLayoutRegistry'],
    ['SceneSearchLayoutCatalog','SceneSearchLayoutCatalog','./SceneSearchLayoutCatalog'],
    ['registerSceneLayouts01_02','registerSceneLayouts01_02','./SceneSearchLayouts01_02'],
    ['SceneSearchLayouts03_04','SceneSearchLayouts03_04','./layouts/SceneSearchLayouts03_04'],
    ['SceneSearchLayouts05_06','SceneSearchLayouts05_06','./layouts/SceneSearchLayouts05_06'],
    ['SceneSearchLayout07','SceneSearchLayout07','./layouts/SceneSearchLayout07'],
    ['SceneSearchLayouts08_09','SceneSearchLayouts08_09','./layouts/SceneSearchLayouts08_09'],
    ['SceneSearchLayout10','SceneSearchLayout10','./layouts/SceneSearchLayout10']
   ];
   const legacyRuntime=readNormalized(path.join(root,runtimePathFor(name)));
   if(!legacyRuntime)throw Error('SCUI_BOOTSTRAP_MISSING_BASELINE');
   const emittedImports=normalized.match(/^import\s+.+$/gm)||[];
   const originalImports=legacyRuntime.match(/^import\s+.+$/gm)||[];
   const originalRequires=legacyRuntime.match(/^\/\/@require .+$/gm)||[];
   const expectedImports=dependencies.map(([symbol,,runtimePath])=>
     "import {"+symbol+"} from '"+runtimePath+"';");
   const expectedRequires=dependencies.map(([,requireName])=>'//@require '+requireName);
   if(originalImports.join('\n')!==expectedImports.join('\n')||
     originalRequires.join('\n')!==expectedRequires.join('\n')){
    throw Error('SCUI_BOOTSTRAP_DEPENDENCY_DRIFT');
   }
   if(emittedImports.length!==dependencies.length||
     emittedImports.some((line,index)=>{
      const [symbol,,runtimePath]=dependencies[index];
      const emitPath=runtimePath.replace('/layouts/','/');
      return line.replace(/\s+/g,' ') !==
        "import { "+symbol+" } from '"+emitPath+"';";
     })){
    throw Error('SCUI_BOOTSTRAP_IMPORT_DRIFT');
   }
   normalized=normalized.replace(/^import\s+.+\r?\n/gm,'').trimStart();
   imports=expectedImports.join('\n')+'\n';
   requires=expectedRequires.join('\n')+'\n';
   exportName='createSceneSearchLayoutRegistry';
  }
  // PlayerBinding is the sole owner of 13 event/runtime dependencies. Two
  // external JS owners are imported through compile-only boundary modules:
  // their actual runtime paths and require order remain unchanged.
  if(name==='SceneSearchPlayerBinding'){
   const deps=[
    ['SceneSearchPlacement','./SceneSearchPlacement','./SceneSearchPlacement','SceneSearchPlacement'],
    ['SceneSearchLegacyAdapter','./SceneSearchLegacyAdapter','./SceneSearchLegacyAdapter','SceneSearchLegacyAdapter'],
    ['SceneSearchIntegrationBridge','./SceneSearchIntegrationBridge','./SceneSearchIntegrationBridge','SceneSearchIntegrationBridge'],
    ['createSceneSearchLayoutRegistry','./SceneSearchLayoutBootstrap','./SceneSearchLayoutBootstrap','createSceneSearchLayoutRegistry'],
    ['SceneSearchController','./SceneSearchController','./SceneSearchController','SceneSearchController'],
    ['SceneSearchInteraction','./SceneSearchInteraction','./SceneSearchInteraction','SceneSearchInteraction'],
    ['ScenePreviewIdleLimiter','./ScenePreviewIdleLimiter','./ScenePreviewIdleLimiter','ScenePreviewIdleLimiter'],
    ['SceneSeekStepControl','./SceneSeekStepControl','./SceneSeekStepControl','SceneSeekStepControl'],
    ['SceneCommentSearch','./SceneCommentSearch','./SceneCommentSearch','SceneCommentSearch'],
    ['SceneCommentSearchPanel','./SceneCommentSearchPanel','./SceneCommentSearchPanel','SceneCommentSearchPanel'],
    ['SceneSearchShortcutRouter','./SceneSearchShortcutRouter','./SceneSearchShortcutRouter','SceneSearchShortcutRouter'],
    ['UiVisibilityRegistry','./UiVisibilityRegistry','../../../../src/UiVisibilityRegistry','UiVisibilityRegistry'],
    ['StoryboardWorker','./SceneSearchStoryboardWorkerBoundary','../storyboard/StoryboardWorker','StoryboardWorker']
   ];
   const current=readNormalized(path.join(root,runtimePathFor(name)));
   if(!current)throw Error('SCUI_PLAYER_BINDING_MISSING_BASELINE');
   const tsImports=normalized.match(/^import\s+.+$/gm)||[];
   const legacyImports=current.match(/^import\s+.+$/gm)||[];
   const legacyRequires=current.match(/^\/\/@require .+$/gm)||[];
   const compiledExpected=deps.map(([sym,path])=>"import { "+sym+" } from '"+path+"';");
   const runtimeExpected=deps.map(([sym,,path])=>"import {"+sym+"} from '"+path+"';");
   const requireExpected=deps.map(([,,,directive])=>'//@require '+directive);
   if(runtimeExpected.join('\n')!==legacyImports.join('\n')||
     requireExpected.join('\n')!==legacyRequires.join('\n')){
    throw Error('SCUI_PLAYER_BINDING_DEPENDENCY_DRIFT');
   }
   if(tsImports.join('\n')!==compiledExpected.join('\n')){
    throw Error('SCUI_PLAYER_BINDING_IMPORT_DRIFT');
   }
   normalized=normalized.replace(/^import\s+.+\r?\n/gm,'').trimStart();
   imports=runtimeExpected.join('\n')+'\n';
   requires=requireExpected.join('\n')+'\n';
  }
  // Bridge is the only five-dependency integration owner. The generator
  // cannot replace dependency names, paths, order or flat userscript requires.
  if(name==='SceneSearchIntegrationBridge'){
   const deps=['SceneSearchDomLease','SceneSearchLayoutResources',
    'SceneSearchPreferenceConnection','SceneSearchObstacleCollector',
    'SceneSearchVisibleRectCollector'];
   const current=readNormalized(path.join(root,runtimePathFor(name)));
   if(!current)throw Error('SCUI_BRIDGE_MISSING_BASELINE');
   const expectedImports=deps.map(sym=>
     "import {"+sym+"} from './"+sym+"';");
   const emittedExpected=deps.map(sym=>
     "import { "+sym+" } from './"+sym+"';");
   const expectedRequires=deps.map(sym=>'//@require '+sym);
   const oldImports=current.match(/^import\s+.+$/gm)||[];
   const oldRequires=current.match(/^\/\/@require .+$/gm)||[];
   const newImports=normalized.match(/^import\s+.+$/gm)||[];
   if(oldImports.join('\n')!==expectedImports.join('\n')||
     oldRequires.join('\n')!==expectedRequires.join('\n')){
    throw Error('SCUI_BRIDGE_DEPENDENCY_DRIFT');
   }
   if(newImports.join('\n')!==emittedExpected.join('\n')){
    throw Error('SCUI_BRIDGE_IMPORT_DRIFT');
   }
   normalized=normalized.replace(/^import\s+.+\r?\n/gm,'').trimStart();
   imports=expectedImports.join('\n')+'\n';
   requires=expectedRequires.join('\n')+'\n';
  }
  const body=(name==='SceneSearchLayouts01_02'?
    normalized.replace(/^export function registerSceneLayouts01_02\(/m,'function registerSceneLayouts01_02('):
    name==='SceneSearchLayoutBootstrap'?
      normalized.replace(/^export function createSceneSearchLayoutRegistry\(/m,'function createSceneSearchLayoutRegistry('):
      normalized.replace(/^export class /m,'class ')).trimEnd();
  if(/^\s*(?:import|export)\b/m.test(body))throw Error('SCUI_INVALID_EMIT');
  if(name==='SceneSearchLayouts01_02'){
   if(!body.includes('function registerSceneLayouts01_02(')||
     (body.match(/\bfunction registerSceneLayouts01_02\(/g)||[]).length!==1||
     ['SCENE_01_02_TOOLS_CSS','SCENE_LAYOUT01_CSS','SCENE_LAYOUT02_CSS']
       .some(constName=>(body.match(new RegExp('\\bconst '+constName+'\\s*=', 'g'))||[]).length!==1)){
    throw Error('SCUI_CLASSIC_SHAPE_DRIFT');
   }
  }else if(name==='SceneSearchLayoutBootstrap'){
   if((body.match(/\bfunction createSceneSearchLayoutRegistry\(/g)||[]).length!==1||
     !body.includes('SceneSearchLayoutCatalog.install(')||
     !body.includes('registry.list().length !== 11')){
    throw Error('SCUI_BOOTSTRAP_SHAPE_DRIFT');
   }
  }else if(!body.includes('class '+name+' {'))throw Error('SCUI_INVALID_EMIT');
  const output='// GENERATED FROM '+source+'\n'+imports+'//===BEGIN===\n'+requires+body+'\n//===END===\nexport {'+exportName+'};\n';
  const runtime=runtimePathFor(name),p=path.join(root,runtime),actual=read(p);
  next[name]={source,runtime,sourceSha256:hash(src),runtimeSha256:hash(output)};
  // A single audited pre-migration UI07 runtime may be replaced once.
  // Never accept an unknown first-adoption baseline or unrelated runtime edits.
  const approvedInitialUi07=name==='SceneSearchLayout07'&&!old[name]&&
    actual!==null&&hash(actual)==='a963d2fb01213298c280ec534e4c76f6e812872468ed577d6905cd79cebfeafd';
  // The original UI01/UI02 owner code is a fixed, audited first-adoption input.
  const approvedInitialClassic=name==='SceneSearchLayouts01_02'&&!old[name]&&
    actual!==null&&hash(actual)==='d15133a4ddc3a428131bd2ab5d7fc7021bf240d5b8217804a8f43a4460f17687';
  const approvedInitialBootstrap=name==='SceneSearchLayoutBootstrap'&&!old[name]&&
    actual!==null&&hash(actual)==='eed775ac4ab864e61ee9eba0cee88f22b0dde6f84052644a7dd9ae5f0fce09ac';
  const approvedInitialPlayerBinding=name==='SceneSearchPlayerBinding'&&!old[name]&&
    actual!==null&&hash(actual)==='ac9b8de4119fcebc27e088e9843869912683de1b1a29810775b0f754b7fd4f69';
  const approvedInitialBridge=name==='SceneSearchIntegrationBridge'&&!old[name]&&
    actual!==null&&hash(actual)==='e2b60ad215c976b4a195d208f20366b0d8b29fc16acf6ef4d447dc4628995425';
  if(actual!==null && lf(actual)!==output &&
    (!old[name]||hash(actual)!==old[name].runtimeSha256)&&
    !approvedInitialUi07&&!approvedInitialClassic&&!approvedInitialBootstrap&&
    !approvedInitialPlayerBinding&&!approvedInitialBridge){
   throw Error('SCUI_FOREIGN_EDIT_'+name);
  }
  if(mode==='--check' && (actual===null||lf(actual)!==output))throw Error('SCUI_STALE_'+name);
  entries.push({path:p,before:actual,after:output});
 }
 const after=JSON.stringify(next,null,2)+'\n';
 if(mode==='--check'&&oldText!==after)throw Error('SCUI_STALE_MANIFEST');
 if(mode==='--write')applyFiles([...entries,{path:mp,before:oldText,after}]);
 return Object.keys(next).length;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const only=process.argv.slice(3).find(arg=>arg.startsWith('--only='))?.slice(7);
  console.log('SCUI_SYNC=PASS modules='+sync(process.argv[2],only));
 }
 catch(error){console.error(error.message);process.exitCode=1;}
}
