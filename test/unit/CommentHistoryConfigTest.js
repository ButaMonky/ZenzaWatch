'use strict';
const assert = require('assert');
const {extract,createContext,run,loadClass} = require('../helpers/extractSource');
const {ZenzaCommentHistorySettings:H} = require('../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');
function schema(){
 const c=createContext({PRODUCT:'ZenzaWatch',navigator:{},location:{host:'www.nicovideo.jp'},localStorage:{},buildDefaultKeyConfig:()=>({}),ZenzaCommentHistorySettings:H,DataStorage:{create(defaults,options){return {default:defaults,options};}}});
 c.CommentDisplayBudget=loadClass('packages/zenza/src/commentLayer/CommentDisplayBudget.js','CommentDisplayBudget',c); // Task 206
 c.RelatedMenuActions=loadClass('packages/zenza/src/menu/RelatedMenuActions.js','RelatedMenuActions',Object.assign(c,{URL}));
 run('const Config = '+extract('src/Config.js','Config','var')+';this.config=Config;',c);return c.config;
}
describe('Task200 shared comment-history configuration',()=>{
 it('registers every real shared setting plus persistent enable, without changing volume',()=>{
  const s=schema();for(const [k,v] of Object.entries(H.HISTORY_PREFERENCE_DEFAULTS)) assert.strictEqual(s.default[k],v,k);
  assert.strictEqual(s.default.volume,0.3);assert.strictEqual(s.default['commentHistory.maxAdditionalComments'],5000);
 });
 it('validates import using the same bounds as the live controls',()=>{
  const s=schema();for(const d of H.SETTINGS_SCHEMA){
   assert(s.options.validateImport(d.key,d.default));
   assert.strictEqual(s.options.validateImport(d.key,d.type==='boolean'?'true':d.max+1),false,d.key);
  }
  assert.strictEqual(s.options.validateImport('commentHistory.enabled',true),true);
  assert.strictEqual(s.options.validateImport('commentHistory.enabled','true'),false);
 });
 it('preserves corrupt feature settings on disk while retaining legacy recovery elsewhere',async()=>{
  const c=createContext();const D=loadClass('packages/lib/src/infra/DataStorage.js','DataStorage',c),s=Object.create(D.prototype);
  s.default={'commentHistory.enabled':false,volume:0.3};s._data={};s.prefix='Z_';s.options={preserveInvalidKeys:['commentHistory.enabled']};
  const storage={'Z_commentHistory.enabled':'broken','Z_volume':'broken'};await s.restore(storage);
  assert.strictEqual(storage['Z_commentHistory.enabled'],'broken');assert(!('Z_volume' in storage));assert.strictEqual(s._data.volume,0.3);
 });
});
