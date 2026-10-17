'use strict';
const assert = require('assert');
const {extract, createContext, run, loadClass} = require('../helpers/extractSource');
const {ZenzaCommentHistorySettings} = require(
  '../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');

function configSchema() {
  const c = createContext({ZenzaCommentHistorySettings, PRODUCT:'ZenzaWatch',
    navigator:{},location:{host:'www.nicovideo.jp'},localStorage:{},
    buildDefaultKeyConfig:()=>({}),DataStorage:{create(defaults,options){
      return {default:defaults,options};
    }}});
  c.CommentDisplayBudget=loadClass(
    'packages/zenza/src/commentLayer/CommentDisplayBudget.js','CommentDisplayBudget',c);
  c.RelatedMenuActions=loadClass(
    'packages/zenza/src/menu/RelatedMenuActions.js','RelatedMenuActions',Object.assign(c,{URL}));
  c.RelatedMenuOrder=loadClass('src/RelatedMenuOrder.js','RelatedMenuOrder',c);
  c.ScreenshotFileName=loadClass('src/ScreenshotFileName.js','ScreenshotFileName',c);
  c.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',c);
  run('const Config='+extract('src/Config.js','Config','var')+';globalThis.config=Config;',c);
  return c.config;
}

const defaults = {
  'sceneSearch.layout.normal':'01',
  'sceneSearch.layout.fullscreen':'01',
  'sceneSearch.layout.linkFullscreen':false,
  'sceneSearch.seekStepSeconds':5,
  'sceneSearch.controlsReveal':'hover-focus',
  'sceneSearch.animation':'subtle',
  'sceneSearch.commentPreviewVisible':true
};

describe('SCUI-02 scene-search preference schema and compatibility',function(){
  it('registers seven additive defaults without changing legacy preview semantics',()=>{
    const schema=configSchema(),d=schema.default;
    for(const [k,v] of Object.entries(defaults))assert.strictEqual(d[k],v,k);
    assert.strictEqual(d.enableStoryboard,true);
    assert.strictEqual(d.enableStoryboardBar,false);
    assert.strictEqual(d.enableCommentPreview,false,
      'existing false means hover mode, not invisible');
    assert.strictEqual(d.ui?.bar?.pin,undefined);
    assert.strictEqual(d['ui.bar.pin'],true);
    assert.strictEqual(d.KEY_SEEK_LEFT,37+0x1000);
    assert.strictEqual(d.KEY_SEEK_RIGHT,39+0x1000);
    for(let i=1;i<=10;i++){assert.strictEqual(d['PARAM_CUSTOM_SEEK_'+i],0);}
  });
  it('allows only stable layout IDs 01 through 10 on both screen modes',()=>{
    const {options}=configSchema();
    for(const key of ['sceneSearch.layout.normal','sceneSearch.layout.fullscreen']){
      for(let i=0;i<=10;i++){
        const id=String(i).padStart(2,'0');
        assert.strictEqual(options.validateImport(key,id),true,key+':'+id);
      }
      for(const invalid of ['11','1','010',1,null,[],{},false,'<script>']){
        assert.strictEqual(options.validateImport(key,invalid),false,key+':'+invalid);
      }
    }
  });
  it('accepts only integer step seconds 0 through 600',()=>{
    const {options}=configSchema(),key='sceneSearch.seekStepSeconds';
    for(const n of [0,1,3,5,10,15,30,60,599,600]){
      assert.strictEqual(options.validateImport(key,n),true,'accepted '+n);
    }
    for(const bad of [-1,601,3.5,'5',null,undefined,NaN,Infinity,-Infinity,[],{}]){
      assert.strictEqual(options.validateImport(key,bad),false,'rejected '+bad);
    }
  });
  it('separates reveal/animation enums from persistent boolean flags',()=>{
    const {options}=configSchema();
    for(const [key,choices] of [
      ['sceneSearch.controlsReveal',['hover-focus','click','always']],
      ['sceneSearch.animation',['off','subtle','full']]]){
      for(const x of choices){assert.strictEqual(options.validateImport(key,x),true);}
      for(const x of ['none','always-on','0',false,1,null,{},[]]){
        assert.strictEqual(options.validateImport(key,x),false,key+':'+x);
      }
    }
    for(const key of ['sceneSearch.layout.linkFullscreen',
      'sceneSearch.commentPreviewVisible']){
      assert.strictEqual(options.validateImport(key,true),true);
      assert.strictEqual(options.validateImport(key,false),true);
      for(const x of ['true',null,0,1,{},[]]){
        assert.strictEqual(options.validateImport(key,x),false);
      }
    }
    assert.strictEqual(options.validateImport('sceneSearch.experimental',1),false);
  });
  it('imports/export settings with atomic rejection and existing format',()=>{
    const schema=configSchema(),ctx=createContext({});
    run(extract('packages/lib/src/infra/DataStorage.js','DataStorage')+
      ';globalThis.DS=DataStorage;',ctx);
    const s=Object.create(ctx.DS.prototype);
    const d=schema.default,storage={};
    Object.assign(s,{default:d,_data:{...d},prefix:'SC_',storage,
      props:Object.fromEntries(Object.keys(d).map(k=>[k,null])),
      options:schema.options,_ignoreExportKeys:[],_changed:new Map(),_onChange(){}});
    s.import({'sceneSearch.layout.normal':'06',
      'sceneSearch.layout.fullscreen':'02',
      'sceneSearch.seekStepSeconds':0,
      'sceneSearch.commentPreviewVisible':false});
    assert.strictEqual(s.getValue('sceneSearch.layout.normal'),'06');
    assert.strictEqual(s.getValue('sceneSearch.layout.fullscreen'),'02');
    assert.strictEqual(s.getValue('sceneSearch.seekStepSeconds'),0);
    assert.strictEqual(s.getValue('sceneSearch.commentPreviewVisible'),false);
    const data=JSON.parse(s.exportJson());
    assert.strictEqual(data['sceneSearch.layout.normal'],'06');
    assert.strictEqual(data['sceneSearch.seekStepSeconds'],0);
    const before=JSON.stringify([storage,s._data]);
    assert.throws(()=>s.import({'sceneSearch.layout.fullscreen':'09',
      'sceneSearch.seekStepSeconds':601}),/sceneSearch.seekStepSeconds/);
    assert.strictEqual(JSON.stringify([storage,s._data]),before,
      'invalid mixed input must not write partial changes');
    s.importJson(JSON.stringify(data));
    assert.strictEqual(s.getValue('sceneSearch.layout.normal'),'06');
    assert.strictEqual(s.getValue('sceneSearch.seekStepSeconds'),0);
  });
});
