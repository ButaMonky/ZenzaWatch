'use strict';
const fs=require('fs');
const {createContext,extract,run,loadClass}=require('./extractSource');
const {ZenzaCommentHistorySettings}=require('../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');
function fixture(storage={},dom=null){
  const c=createContext({...(dom?{window:dom.window,document:dom.window.document}:{}),
    ZenzaCommentHistorySettings,PRODUCT:'ZenzaWatch',
    navigator:{},location:{host:'www.nicovideo.jp'},localStorage:{},
    buildDefaultKeyConfig:()=>({}),DataStorage:{create(defaults,options){
      return {default:defaults,options};
    }}});
  c.CommentDisplayBudget=loadClass('packages/zenza/src/commentLayer/CommentDisplayBudget.js','CommentDisplayBudget',c);
  c.RelatedMenuActions=loadClass('packages/zenza/src/menu/RelatedMenuActions.js','RelatedMenuActions',Object.assign(c,{URL}));
  c.RelatedMenuOrder=loadClass('src/RelatedMenuOrder.js','RelatedMenuOrder',c);
  c.ScreenshotFileName=loadClass('src/ScreenshotFileName.js','ScreenshotFileName',c);
  c.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',c);
  if(fs.existsSync('packages/zenza/src/sceneSearch/SceneSearchPreferences.js')) c.SceneSearchPreferences=loadClass('packages/zenza/src/sceneSearch/SceneSearchPreferences.js','SceneSearchPreferences',c);
  run('const Config='+extract('src/Config.js','Config','var')+';globalThis.config=Config;',c);
  const schema=c.config;
  const storageContext=createContext();
  const DS=loadClass('packages/lib/src/infra/DataStorage.js','DataStorage',storageContext);
  const config=Object.create(DS.prototype);
  Object.assign(config,{default:schema.default,_data:{...schema.default},
    options:schema.options,storage,prefix:'SC_',readonly:false,
    props:Object.fromEntries(Object.keys(schema.default).map(k=>[k,null])),
    _ignoreExportKeys:schema.options.ignoreExportKeys,_changed:new Map(),_onChange(){},
    on(){},off(){}});
  for(const key of ['hasStoredValue','persistSceneSearchSelection','resolveSceneSearch','import','export']) { if(schema[key]) config[key]=schema[key]; }
  const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',c);
  return {config,storage,context:c,model:new Model({config,actions:[]})};
}

module.exports={fixture};
