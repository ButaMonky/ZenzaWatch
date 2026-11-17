'use strict';
// Task933: old public Task801 is a floor, not an alternative to private Task926+.
// Task1049: 2.6MB の review/task801 バンドルの代わりに、そこから抽出した ID・メンバー名の
// 一覧（test/fixtures/public-task801-baseline.json）と比べる。検査の中身は同じ。
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const {createContext,loadClass}=require('../helpers/extractSource');

const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/public-task801-baseline.json'),'utf8'));

describe('Task933 public Task801 to private setting coverage',function(){
  this.timeout(30000);
  let trial;
  before(function(){
    const c=createContext({});
    c.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',c);
    const M=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',c);
    trial={
      settings:new Set(M.visibleExtraSettings().map(x=>x.id)),
      visibility:new Set(c.UiVisibilityRegistry.descriptors().map(x=>x.id))
    };
  });
  it('retains all public Task801 setting IDs without importing old UI over new UI',()=>{
    const missing=baseline.settings.filter(x=>!trial.settings.has(x));
    assert.deepStrictEqual(missing,[],'Missing public setting descriptors');
    assert(trial.settings.has('popup.notifyColor'));
    assert(trial.settings.has('popup.alertColor'));
    assert(trial.settings.has('popup.backgroundTransparency'));
  });
  it('retains public visibility toggles with the extra notification history button',()=>{
    const missing=baseline.visibility.filter(x=>!trial.visibility.has(x));
    assert.deepStrictEqual(missing,[],'Missing public visibility toggles');
    assert(trial.visibility.has('ui.bar.notificationHistory'));
  });
  it('preserves the public settings UI, model and visibility API methods',()=>{
    for(const name of ['ModernAdvancedSettingsUI','ModernAdvancedSettingsModel','UiVisibilityRegistry']){
      const ctx=createContext();
      if(name!=='UiVisibilityRegistry'){
        ctx.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',ctx);
      }
      const newer=loadClass('src/'+name+'.js',name,ctx);
      const expected=baseline.members[name];
      for(const [previous,latest] of [[expected.prototype,newer.prototype],[expected.static,newer]]){
        const missing=previous.filter(x=>!Object.hasOwn(latest,x));
        assert.deepStrictEqual(missing,[],name+' public API member is missing');
      }
    }
  });
});
