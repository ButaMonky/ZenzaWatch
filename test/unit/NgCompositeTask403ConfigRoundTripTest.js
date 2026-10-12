'use strict';
const assert=require('assert');
const {execFileSync}=require('child_process');
const {extract,createContext,run}=require('../helpers/extractSource');
const {REPO_ROOT}=require('../helpers/buildSandbox');
const {node,group,rule,chat}=require('../helpers/compositeTask403');
const {ZenzaCommentHistorySettings}=require('../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');
const parser=require('@babel/parser'),traverse=require('@babel/traverse').default;
const KEY='ngComposite.rules';
const variants=process.env.TASK403_ORIGINAL==='1'?['original']:
 process.env.TASK403_DIST==='1'?['source','watch-dist','advanced-dist']:['source'];
const dist=k=>k==='watch-dist'?'dist/ZenzaWatch-dev.user.js':'dist/ZenzaAdvancedSettings.user.js';
const originals=new Map();
function code(kind,relative,name,type='class'){
 if(kind!=='original')return extract(kind==='source'?relative:dist(kind),name,type);
 if(!originals.has(relative))originals.set(relative,execFileSync('git',['show','2e4e192:'+relative],{cwd:REPO_ROOT,encoding:'utf8'}));
 const text=originals.get(relative);let found;
 traverse(parser.parse(text,{sourceType:'unambiguous'}),{
  noScope:true,ClassDeclaration(p){if(type==='class'&&p.node.id.name===name)found=text.slice(p.node.start,p.node.end);},
  VariableDeclarator(p){if(type==='var'&&p.node.id.name===name)found=text.slice(p.node.init.start,p.node.init.end);}
 });
 if(found===undefined)throw new Error('Cannot extract original '+relative+':'+name);
 return found;
}
async function boot(kind,disk={}){
 const writes=[];
 const storage=new Proxy(disk,{set(target,key,value){writes.push([key,value]);return Reflect.set(target,key,value);}});
 const quiet={log(){},warn(){},error(){}};
 const c=createContext({console:quiet,localStorage:storage,ZenzaCommentHistorySettings,
  PRODUCT:'ZenzaWatch',navigator:{},location:{host:'www.nicovideo.jp'},
  buildDefaultKeyConfig:()=>({}),bounce:{time:fn=>fn}});
 run(require('../helpers/extractSource').beginSection('packages/lib/src/Emitter.js'),c);
 run(require('../helpers/extractSource').beginSection('packages/lib/src/infra/objUtil.js'),c);
 run('const NG_COLOR_HEX='+code(kind,'src/NgCompositeRules.js','NG_COLOR_HEX','var')+';',c);
 run(code(kind,'src/NgCompositeRules.js','NgCompositeRules')+';globalThis.Engine=NgCompositeRules;',c);
 for(const [name,path] of [
  ['CommentDisplayBudget','packages/zenza/src/commentLayer/CommentDisplayBudget.js'],
  ['RelatedMenuActions','packages/zenza/src/menu/RelatedMenuActions.js'],
  ['RelatedMenuOrder','src/RelatedMenuOrder.js'],['ScreenshotFileName','src/ScreenshotFileName.js'],
  ['UiVisibilityRegistry','src/UiVisibilityRegistry.js']]){
  run(code(kind,path,name)+';globalThis.'+name+'='+name+';',c);
 }
 run(code(kind,'packages/lib/src/infra/DataStorage.js','DataStorage')+';globalThis.DS=DataStorage;',c);
 run('const Config='+code(kind,'src/Config.js','Config','var')+';globalThis.config=Config;',c);
 await c.config.promise('restore');
 assert.strictEqual(c.config.restoreError,null,'real Config must complete storage restoration');
 return {config:c.config,E:c.Engine,disk,writes};
}
const clone=value=>JSON.parse(JSON.stringify(value));
function goodRule(){return rule('hideAuthor',group([node('text','alpha','equals')]));}
function assertSavedBehavior(h,expected){
 assert.deepStrictEqual(clone(h.config.getValue(KEY)),expected);
 const rows=[chat(1,'alpha','A'),chat(2,'ordinary','A'),chat(3,'ordinary','B')];
 const result=h.E.project(rows,h.config.getValue(KEY));
 assert.deepStrictEqual(rows.map(c=>result.get(c).visible),[false,false,true]);
}
const invalids=[
 ['duplicate rule IDs',r=>[r,{...clone(r),name:'different author',conditions:group([node('text','beta','equals')])}]],
 ['ambiguous regex condition',r=>[{...r,conditions:group([node('regex','(a|aa)+$','regex')])}]],
 ['ambiguous regex replacement',r=>[{...r,action:'replace',regexReplace:true,pattern:'(a|aa)+$'}]],
 ...['__proto__','constructor','hasOwnProperty','toString'].map(color=>
  ['inherited color '+color,r=>[{...r,conditions:group([node('color',color)])}]]),
 ['inherited normalization color',r=>[{...r,action:'normalize',normalizeColor:'__proto__'}]],
 ['nested group NOT',r=>[{...r,conditions:group([{...group([node('score','1','gte')]),not:true}])}]],
 ...[['object',{}],['string','unexpected'],['empty array',[]],['child array',[node('text','child')]]].map(([shape,nodes])=>
  ['unexpected leaf nodes '+shape,r=>[{...r,conditions:group([{...node('text','alpha','equals'),nodes}])}]]),
 ...['ue','naka','shita'].map(position=>['position stripping '+position,r=>[{...r,action:'strip',strip:[position]}]]),
 ['duplicate replacement flags',r=>[{...r,action:'replace',regexReplace:true,pattern:'ab',flags:'gg'}]]
];
for(const kind of variants)describe('Task403 Config roundtrip '+kind,function(){
 this.timeout(15000);
 for(const [label,makeBad] of invalids)it('preserves saved rules and every setting after invalid import: '+label,async()=>{
  const saved=[goodRule()],disk={['ZenzaWatch_'+KEY]:JSON.stringify(saved),ZenzaWatch_volume:'0.7',ZenzaWatch_wordFilter:'KEEP'};
  const h=await boot(kind,disk),beforeDisk=JSON.stringify(disk),beforeMemory=JSON.stringify(h.config._data);
  const beforeExport=h.config.exportJson();
  assertSavedBehavior(h,saved);
  assert.throws(()=>h.config.importJson(JSON.stringify({volume:0.2,wordFilter:'REPLACE', [KEY]:makeBad(clone(saved[0]))})),/ngComposite\.rules/);
  assert.strictEqual(h.writes.length,0,'validation must finish before any storage write');
  assert.strictEqual(JSON.stringify(disk),beforeDisk,'persisted settings remain byte-identical');
  assert.strictEqual(JSON.stringify(h.config._data),beforeMemory,'live settings remain unchanged');
  assert.strictEqual(h.config.exportJson(),beforeExport,'backup remains usable after rejection');
  assertSavedBehavior(await boot(kind,disk),saved);
 });
 it('exports, imports and reloads two author rules without collapsing author identities',async()=>{
  const saved=[goodRule(),rule('hideAuthor',group([node('text','beta','equals')]))];
  const h=await boot(kind);
  h.config.importJson(JSON.stringify({volume:0.6,wordFilter:'KEEP',[KEY]:saved}));
  const backup=h.config.exportJson();
  assert.deepStrictEqual(JSON.parse(backup)[KEY],saved);
  const target=await boot(kind);target.config.importJson(backup);
  const reloaded=await boot(kind,target.disk);
  assert.deepStrictEqual(clone(reloaded.config.getValue(KEY)),saved);
  assert.strictEqual(reloaded.config.getValue('volume'),0.6);
  assert.strictEqual(reloaded.config.getValue('wordFilter'),'KEEP');
  const rows=[chat(1,'alpha','A'),chat(2,'ordinary','A'),chat(3,'beta','B'),chat(4,'ordinary','B'),chat(5,'ordinary','C')];
  const result=reloaded.E.project(rows,reloaded.config.getValue(KEY));
  assert.deepStrictEqual(rows.map(c=>result.get(c).visible),[false,false,false,false,true]);
 });
 it('roundtrips an ordinary repeated regex in both matching and replacement',async()=>{
  const r=rule('replace',group([node('regex','^(ab)+$','regex')]),{pattern:'(ab)+',regexReplace:true,replacement:'SAFE'});
  const h=await boot(kind);h.config.importJson(JSON.stringify({[KEY]:[r]}));
  const next=await boot(kind);next.config.importJson(h.config.exportJson());
  const restored=await boot(kind,next.disk),c=chat(1,'abab');
  assert.strictEqual(restored.E.project([c],restored.config.getValue(KEY)).get(c).text,'SAFE');
  assert.strictEqual(c.text,'abab','saved transformation never mutates raw source input');
 });
});
