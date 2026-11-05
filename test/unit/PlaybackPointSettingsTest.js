'use strict';
const assert=require('assert');
const {extract,createContext,run,loadClass,read,beginSection}=require('../helpers/extractSource');
const {createPlaylistContext}=require('../helpers/playlistHarness');
const {ZenzaCommentHistorySettings}=require('../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');
function configSchema(){
 const c=createContext({ZenzaCommentHistorySettings,PRODUCT:'ZenzaWatch',navigator:{},location:{host:'www.nicovideo.jp'},localStorage:{},buildDefaultKeyConfig:()=>({}),DataStorage:{create(d,o){return {default:d,options:o};}}});
 for(const [name,path] of [['CommentDisplayBudget','packages/zenza/src/commentLayer/CommentDisplayBudget.js'],['RelatedMenuActions','packages/zenza/src/menu/RelatedMenuActions.js'],['RelatedMenuOrder','src/RelatedMenuOrder.js'],['ScreenshotFileName','src/ScreenshotFileName.js'],['UiVisibilityRegistry','src/UiVisibilityRegistry.js']])c[name]=loadClass(path,name,c);
 run('const Config='+extract('src/Config.js','Config','var')+';this.cfg=Config;',c);return c.cfg;
}

describe('Playback point advanced settings',()=>{
 it('uses boolean defaults, one category, isolated drafts and reset',()=>{
  const cfg=configSchema(),saved={...cfg.default};cfg.getValue=k=>saved[k];cfg.setValue=(k,v)=>saved[k]=v;
  const c=createContext();c.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',c);
  const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',c),m=new Model({config:cfg});
  const keys=['resume.recordEnabled','resume.clearOnComplete','bookmark.showToolbarButton','abRepeat.enabled'];
  for(const key of keys){
   assert.equal(cfg.default[key],true);
   const d=m.descriptor(key);assert(d);assert.equal(d.category,'再生・音声');assert.equal(d.subcategory,'しおり・ABリピート');
   assert.equal(m.descriptors.filter(x=>x.id===key).length,1);
   m.set(key,false);assert.equal(saved[key],true,'draft must not affect player');
  }
  m.cancel();for(const key of keys)assert.equal(m.get(key),true);
  m.set(keys[0],false);m.resetSubcategory('再生・音声','しおり・ABリピート');assert.equal(m.get(keys[0]),true);
 });
});
