'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {JSDOM}=require('jsdom');
const {extract,beginSection,createContext,loadClass,run}=require('../helpers/extractSource');
const {ZenzaCommentHistorySettings}=require('../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');

describe('Task318 real source setting inventory',()=>{
  it('covers all real visible keys plus registered shortcut slots and feature pref keys',()=>{
    const ctx=createContext({ZenzaCommentHistorySettings,PRODUCT:'ZenzaWatch',
      navigator:{userAgent:''},location:{host:'www.nicovideo.jp'},localStorage:{},
      DataStorage:{create(defaults,options){
        return {default:defaults,options,getValue(key){return defaults[key]}};
      }}
    });
    ctx.CommentDisplayBudget=loadClass(
      'packages/zenza/src/commentLayer/CommentDisplayBudget.js','CommentDisplayBudget',ctx);
    ctx.RelatedMenuActions=loadClass(
      'packages/zenza/src/menu/RelatedMenuActions.js','RelatedMenuActions',ctx);
    ctx.RelatedMenuOrder=loadClass('src/RelatedMenuOrder.js','RelatedMenuOrder',ctx);
    ctx.ScreenshotFileName=loadClass('src/ScreenshotFileName.js','ScreenshotFileName',ctx);
    ctx.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',ctx);
    run(beginSection('packages/zenza/src/ShortcutActions.js')+';this.actions=SHORTCUT_ACTIONS;',ctx);
    run('const Config='+extract('src/Config.js','Config','var')+';this.actual=Config;',ctx);
    const defaults=ctx.actual.default;
    const source=fs.readFileSync(require('path').resolve(__dirname,'../../src/_setting.js'),'utf8');
    const backtick=String.fromCharCode(96);
    const start=source.indexOf('SettingPanel.__tpl__ = ('+backtick);
    const end=source.indexOf(backtick+').trim();',start);
    assert(start>0&&end>start,'legacy settings template markers');
    const template=source.slice(start+'SettingPanel.__tpl__ = ('.length,end+1);
    const featureIds=Object.keys(defaults).filter(k=>
      k.startsWith('screenFilter.') || k.startsWith('commentHistory.'));
    const screen=featureIds.filter(k=>k.startsWith('screenFilter.')).map(k=>
      '<div class="control"><label><input data-setting-name="'+k+'">'+k+'</label></div>').join('');
    const history=featureIds.filter(k=>k.startsWith('commentHistory.')).map(k=>
      '<div class="control"><label><input data-history-setting="'+k.slice(15)+'">'+k+'</label></div>').join('');
    const html=vm.runInNewContext(template,{
      renderScreenFilterSettingsHtml:()=>screen,
      renderShortcutKeySettingsHtml:()=>'',commands:'<option value="">なし</option>',
      CommentDisplayBudget:{CHOICES:[40,100,200,400,800],DEFAULT:200}
    });
    const dom=new JSDOM(html,{url:'https://www.nicovideo.jp/my'});
    const root=dom.window.document.querySelector('.settingPanelInner');
    root.querySelector('.commentHistorySettingsContainer').innerHTML=history;
    const modelCtx=createContext({document:dom.window.document});
    const Model=loadClass('src/ModernAdvancedSettingsModel.js',
      'ModernAdvancedSettingsModel',modelCtx);
    const model=new Model({config:ctx.actual,legacyRoot:root,actions:ctx.actions,
      historySchema:ZenzaCommentHistorySettings.SETTINGS_SCHEMA});
    const legacy=[...root.querySelectorAll('[data-setting-name]')].map(x=>x.dataset.settingName);
    const internalKeys=new Set(['screenFilter.enable','screenFilter.saved']);
    const missing=legacy.filter(key=>!model.descriptor(key)&&!internalKeys.has(key));
    const ignored=featureIds.filter(key=>!model.descriptor(key)&&!internalKeys.has(key));
    assert.deepStrictEqual(missing,[]);
    assert.deepStrictEqual(ignored,[]);
    // Task396 adds the previously absent original-video action, unbound by default.
    assert.strictEqual(ctx.actions.length,126);
    assert(ctx.actions.some(a=>a.id==='OPEN_ORIGINAL_VIDEO' && a.defaultKey===0));
    assert.strictEqual(model.descriptors.filter(d=>d.type==='shortcut').length,126);
    assert.strictEqual(model.descriptors.filter(d=>d.type==='seconds').length,10);
    assert(model.descriptors.length>=195);
    assert.strictEqual(model.descriptors.length,
      new Set(model.descriptors.map(d=>d.id)).size);
    assert.strictEqual(model.validate().length,0);
    assert.strictEqual(model.descriptor('commentLayer.maxDisplayComment').category,'コメント表示');
    assert.strictEqual(model.descriptor('screenFilter.enable'),null);
    assert.strictEqual(model.descriptor('screenFilter.saved'),null);
    assert(model.descriptor('enableFilter'));
    assert(model.descriptor('sharedNgLevel'));
    assert(model.descriptor('screenFilter.applyToScreenshot'));
    assert(model.descriptor('enableCommentPanelAutoScroll'));
    assert.strictEqual(model.descriptor('relatedMenu.customLinks').subcategory,
      '関連メニュー › カスタムリンク');
    dom.window.close();
  });
});
