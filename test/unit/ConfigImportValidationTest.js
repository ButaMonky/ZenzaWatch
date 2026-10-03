const assert = require('assert');
const {extract, createContext, run, loadClass} = require('../helpers/extractSource');
const {ZenzaCommentHistorySettings} = require('../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');
function setup() {
  const c = createContext({});
  run(extract('packages/lib/src/infra/DataStorage.js', 'DataStorage')+';this.DS=DataStorage;', c);
  const storage = {CFG_volume:'0.7', CFG_mute:'true'};
  const s = Object.create(c.DS.prototype);
  Object.assign(s, {default:{volume:0.3,mute:false,'view.mode':'normal',secret:'keep'},
    _data:{volume:0.7,mute:true,'view.mode':'wide',secret:'private'},
    props:{volume:0,mute:0,'view.mode':0,view:{}},prefix:'CFG_',storage,
    options:{validateImport:(key,v)=>key!=='volume'||(v>=0&&v<=1)},_ignoreExportKeys:['secret'],_changed:new Map(),_onChange(){}});
  return s;
}
function configSchema() {
 const c=createContext({ZenzaCommentHistorySettings,PRODUCT:'ZenzaWatch',navigator:{},location:{host:'www.nicovideo.jp'},localStorage:{},buildDefaultKeyConfig:()=>({}),DataStorage:{create(defaults,options){return {default:defaults,options};}}});
 c.CommentDisplayBudget=loadClass('packages/zenza/src/commentLayer/CommentDisplayBudget.js','CommentDisplayBudget',c); // Task 206
 run('const Config = '+extract('src/Config.js','Config','var')+';this.config=Config;',c);
 return c.config;
}
describe('Config import validation',()=>{
 for(const value of [null,[],42,'bad',true])it('rejects non-object '+JSON.stringify(value)+' without writes',()=>{
  const s=setup(),before=JSON.stringify([s.storage,s._data]);assert.throws(()=>s.import(value));assert.strictEqual(JSON.stringify([s.storage,s._data]),before);
 });
 for(const value of ['0.5',null,NaN,Infinity,-1,2])it('rejects invalid volume '+String(value)+' atomically',()=>{
  const s=setup(),before=JSON.stringify([s.storage,s._data]);assert.throws(()=>s.import({mute:false,volume:value}));assert.strictEqual(JSON.stringify([s.storage,s._data]),before);
 });
 it('imports flat known keys, resets omitted keys, ignores namespace and private/unknown keys',()=>{
  const s=setup();s.import(JSON.parse('{"volume":0.5,"view.mode":"small","view":{"mode":"bad"},"secret":"bad","unknown":1,"__proto__":{"polluted":true},"hasOwnProperty":false}'));
  assert.strictEqual(s.getValue('volume'),0.5);assert.strictEqual(s.getValue('mute'),false);assert.strictEqual(s.getValue('view.mode'),'small');assert.strictEqual(s.getValue('secret'),'private');assert(!('CFG_view' in s.storage));assert(!('CFG_unknown' in s.storage));
 });
 it('reports storage failure and restores earlier writes without changing memory',()=>{
  const s=setup(),store=s.storage,before=JSON.stringify([store,s._data]);let once=true;
  s.storage=new Proxy(store,{set(o,k,v){if(k==='CFG_mute'&&once){once=false;throw new Error('quota');}o[k]=v;return true;}});
  assert.throws(()=>s.import({volume:0.1,mute:false}),/quota/);assert.strictEqual(JSON.stringify([store,s._data]),before);
 });
 it('rejects a malformed JSON before altering memory or storage',()=>{const s=setup(),before=JSON.stringify([s.storage,s._data]);assert.throws(()=>s.importJson('{'));assert.strictEqual(JSON.stringify([s.storage,s._data]),before);});
 it('validates key-specific ranges and choices from actual Config',()=>{
  const {options}=configSchema();assert.strictEqual(typeof options.validateImport,'function');
  for(const [key,bad,good] of [['volume',1.1,0.5],['playbackRate',0,1],['commentSpeedRate',-1,1],['sharedNgLevel','oops','MID'],['screenMode','oops','normal'],['search.limit',5001,5000],['KEY_PLAY_PAUSE',-1,32],
    ['commentLayer.maxDisplayComment',150,200],['commentLayer.maxDisplayComment','200',800],['commentLayer.maxDisplayComment',20000,40]]) {
   assert.strictEqual(options.validateImport(key,bad),false,key);assert.strictEqual(options.validateImport(key,good),true,key);
  }
 });
 it('accepts every existing default setting',()=>{const {options,default:d}=configSchema();for(const k of Object.keys(d))assert.strictEqual(options.validateImport(k,d[k]),true,k);});
});


describe('Config legacy search range roundtrip',()=>{
 for(const [key,values] of [['videoSearch.f_range',['0','1','2','3','4','5']],['videoSearch.l_range',['0','1','2']]])for(const value of values)it('accepts existing '+key+' select value '+value,()=>{
  const s=setup(),schema=configSchema();
  s.default=schema.default;s.options=schema.options;s._data={...schema.default,[key]:value};
  s.props=Object.fromEntries(Object.keys(s.default).map(k=>[k,null]));
  const json=s.exportJson();s.importJson(json);
  assert.strictEqual(s.getValue(key),Number(value));
 });
 it('still rejects malformed numeric strings before writing',()=>{
  const s=setup(),schema=configSchema();s.default=schema.default;s.options=schema.options;const before=JSON.stringify(s.storage);
  assert.throws(()=>s.import({'videoSearch.f_range':'not-a-number'}));assert.strictEqual(JSON.stringify(s.storage),before);
 });
});
