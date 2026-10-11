'use strict';
const assert=require('assert');
const {read}=require('../helpers/extractSource');
const {JSDOM}=require('jsdom');
const {createContext,loadClass}=require('../helpers/extractSource');

describe('Task318 browser bootstrap integration',()=>{
  it('loads both modern UI and draft model from the advanced userscript',()=>{
    const source=read('src/_setting.js');
    assert.match(source,/import \{ModernAdvancedSettingsModel\}/);
    assert.match(source,/import \{ModernAdvancedSettingsUI\}/);
    assert.match(source,/\/\/@require ModernAdvancedSettingsModel/);
    assert.match(source,/\/\/@require ModernAdvancedSettingsUI/);
    assert.match(source,/new ModernAdvancedSettingsModel\(/);
    assert.match(source,/new ModernAdvancedSettingsUI\(/);
  });
  it('mounts after existing comment history and custom links adapters',()=>{
    const source=read('src/_setting.js');
    const history=source.indexOf('this._historySettings =');
    const links=source.indexOf('this._relatedMenuLinks =');
    const model=source.indexOf('this._modernModel=');
    const ui=source.indexOf('this._modernUI=');
    assert(history>0&&history<model);
    assert(links>0&&links<model);
    assert(model<ui);
  });
  it('supports metadata and controls on actual advanced settings without duplicates',()=>{
    const html=[
      '<section id="legacy">',
      '<div class="control"><label><input data-setting-name="enableFilter" type="checkbox"> NGフィルターを有効化する</label></div>',
      '<p class="caption sub">NGワード正規表現</p><input data-setting-name="wordRegFilter">',
      '<div class="control"><label><input data-setting-name="supporterCredit.enable" type="checkbox">提供画面</label></div>',
      '<div class="control"><label><input data-setting-name="supporterCredit.voice" type="checkbox">提供音声</label></div>',
      '<div class="control"><label><input data-setting-name="videoHeader.position"><option>auto</option>ヘッダー位置</label></div>',
      '</section>'
    ].join('');
    const dom=new JSDOM(html);
    const ctx=createContext({URL,document:dom.window.document});
    const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',ctx);
    const defaults={'enableFilter':true,'wordRegFilter':'','supporterCredit.enable':true,
      'supporterCredit.voice':true,'videoHeader.position':'auto',
      'relatedMenu.customLinks':[],KEY_TOGGLE_PLAY:32};
    const config={default:defaults,getValue(k){return defaults[k]}};
    const model=new Model({config,legacyRoot:dom.window.document.getElementById('legacy'),
      actions:[{id:'TOGGLE_PLAY',label:'再生・停止',category:'再生操作',defaultKey:32}]});
    const ids=model.descriptors.map(x=>x.id);
    assert.strictEqual(new Set(ids).size,ids.length);
    assert.strictEqual(model.descriptor('wordRegFilter').label,'NGワード（正規表現）');
    assert(model.descriptor('enableFilter'));
    assert(model.descriptor('supporterCredit.voice').dependsOn==='supporterCredit.enable');
    assert(model.descriptor('relatedMenu.customLinks'));
    dom.window.close();
  });
});
