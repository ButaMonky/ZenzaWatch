'use strict';
const assert=require('assert');
const {createContext,extract,run,loadClass}=require('../helpers/extractSource');
const {ZenzaCommentHistorySettings}=require('../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');
function schema(){
 const c=createContext({ZenzaCommentHistorySettings,PRODUCT:'ZenzaWatch',
   navigator:{},location:{host:'www.nicovideo.jp'},localStorage:{},
   buildDefaultKeyConfig:()=>({}),DataStorage:{create(defaults,options){return {default:defaults,options};}}});
 c.CommentDisplayBudget=loadClass('packages/zenza/src/commentLayer/CommentDisplayBudget.js','CommentDisplayBudget',c);
 c.RelatedMenuActions=loadClass('packages/zenza/src/menu/RelatedMenuActions.js','RelatedMenuActions',Object.assign(c,{URL}));
 c.RelatedMenuOrder=loadClass('src/RelatedMenuOrder.js','RelatedMenuOrder',c);
 c.ScreenshotFileName=loadClass('src/ScreenshotFileName.js','ScreenshotFileName',c);
 c.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',c);
 run('const Config='+extract('src/Config.js','Config','var')+';globalThis.config=Config;',c);
 return c.config;
}
describe('SCUI-20 Discussion #6 stored timeout and settings descriptor',()=>{
 it('defaults to two seconds, independent of five-second seek step',()=>{
   const {default:d}=schema();
   assert.strictEqual(d['sceneSearch.idleHideSeconds'],2);
   assert.strictEqual(d['sceneSearch.seekStepSeconds'],5);
   assert.strictEqual(d.enableCommentPreview,false);
   assert.strictEqual(d.enableStoryboard,true);
 });
 it('validates 0–30 in half-second increments and rejects malformed values',()=>{
   const {options}=schema(),key='sceneSearch.idleHideSeconds';
   for(const n of [0,0.5,1,1.5,2,15,29.5,30])assert.strictEqual(options.validateImport(key,n),true,String(n));
   for(const n of [-1,30.5,2.1,1.25,'2',null,NaN,Infinity,-Infinity,{},[]])
     assert.strictEqual(options.validateImport(key,n),false,String(n));
 });
 it('exposes one canonical advanced setting in the new scene-search subsection',()=>{
   const c=createContext();
   c.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',c);
   const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',c);
   const config=schema();
   config.getValue=k=>config.default[k];
   const model=new Model({config,actions:[]});
   const d=model.descriptor('sceneSearch.idleHideSeconds');
   assert.strictEqual(d.category,'画面・映像');
   assert.strictEqual(d.subcategory,'シーンサーチ');
   assert.strictEqual(d.type,'slider');
   assert.deepStrictEqual([d.min,d.max,d.step],[0,30,0.5]);
   assert.strictEqual(model.descriptors.filter(x=>x.id==='sceneSearch.idleHideSeconds').length,1);
   assert(model.sectionDescriptors('画面・映像','シーンサーチ').some(x=>x.id===d.id));
   assert.strictEqual(model.categories.length,7);
   assert(d.description.includes('0秒'));
 });
});
