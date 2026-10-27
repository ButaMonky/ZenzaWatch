'use strict';
const assert = require('assert');
const {JSDOM} = require('jsdom');
const {createContext,loadClass} = require('../helpers/extractSource');

const body = '<!doctype html><html><body><section id="old">' +
'<div class="control"><label><input type="checkbox" data-setting-name="supporterCredit.enable"> 動画の最後に提供画面を表示</label></div>' +
'<div class="control"><label><input type="checkbox" data-setting-name="supporterCredit.voice"> 提供読み上げを再生</label></div>' +
'<div class="control"><label>同時表示するコメント数<select data-setting-name="commentLayer.maxDisplayComment">' +
'<option value="40">40件</option><option value="100">100件</option><option value="200">200件</option></select></label>' +
'<div class="settingNote">動画に同時に表示する数。取得数とは違います。</div></div>' +
'<div class="control"><label><input type="checkbox" data-setting-name="commentLayer.protectCA"> コメントアートを保護</label></div>' +
'<div class="control"><label><input type="checkbox" data-setting-name="touch.enable"> タッチを有効にする</label></div>' +
'<div class="control"><label>3本指タッチ<select data-setting-name="touch.tap3command"><option value="">なし</option>' +
'<option value="toggle-mute">ミュート</option></select></label></div>' +
'<div class="control"><label><input type="checkbox" data-setting-name="debug"> デバッグモード</label></div>' +
'<p class="caption sub">NGワード正規表現</p><input type="text" data-setting-name="wordRegFilter">' +
'</section></body></html>';
function setup(initial={}) {
  const dom=new JSDOM(body);
  const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',
    createContext({document:dom.window.document,URL}));
  const defaults={
    'supporterCredit.enable':true,
    'supporterCredit.voice':true,
    'commentLayer.maxDisplayComment':200,
    'commentLayer.protectCA':true,
    'touch.enable':false,
    'touch.tap3command':'toggle-mute',
    speakLark:false,speakLarkVolume:1,
    debug:false,
    pipPageThumbnail:true,
    pipPageThumbnailSource:'smart',
    wordRegFilter:'',
    KEY_TOGGLE_PLAY:32,
    KEY_CUSTOM_SEEK_1:0,
    PARAM_CUSTOM_SEEK_1:0,
    'relatedMenu.customLinks':[],
    'commentHistory.enabled':false,
    'commentHistory.maxAdditionalComments':5000,
    'screenFilter.gamma':1
  };
  const config={default:defaults,
    values:{...defaults,...initial},calls:[],
    getValue(key){return this.values[key];},
    setValue(key,value){
      this.calls.push([key,value]);
      this.values[key]=value;
    },
    options:{validateImport(key,value){
      if(key==='commentLayer.maxDisplayComment')return [40,100,200,400,800].includes(value);
      if(key==='relatedMenu.customLinks')return Array.isArray(value)&&value.length<=40;
      const d=defaults[key];
      return typeof value===typeof d&&(!Number.isNaN(value));
    }}
  };
  const actions=[
    {id:'TOGGLE_PLAY',label:'再生・停止',category:'再生操作',defaultKey:32},
    {id:'CUSTOM_SEEK_1',label:'カスタムシーク1',category:'シーク',customSeekSlot:true,defaultKey:0}
  ];
  const model=new Model({config,legacyRoot:dom.window.document.getElementById('old'),actions,
    screenFilterParams:[{key:'gamma',label:'ガンマ',min:0.3,max:3,step:0.01,desc:'明るさ'}],
    historySchema:[{key:'commentHistory.maxAdditionalComments',label:'追加コメント上限',type:'integer',min:1,max:20000}]});
  return {dom,model,config};
}
describe('Task318 advanced settings descriptor and draft model',()=>{
  it('explains the legacy comment speech toggles are currently non-functional',()=>{
    const {model,dom}=setup();
    const enabled=model.descriptor('speakLark');
    const volume=model.descriptor('speakLarkVolume');
    assert(enabled && enabled.label.includes('現在は未対応'));
    assert(enabled.description.includes('読み上げません'));
    assert(volume && volume.label.includes('現在は未対応'));
    assert(volume.description.includes('作用しません'));
    dom.window.close();
  });
  it('has exactly seven stable major categories, unique IDs, and documented related-menu entry',()=>{
    const {model,dom}=setup();
    assert.strictEqual(model.categories.length,7);
    assert.strictEqual(new Set(model.descriptors.map(x=>x.id)).size,model.descriptors.length);
    assert(model.descriptors.some(x=>x.id==='relatedMenu.customLinks' &&
      x.category==='プレイリスト・検索' && x.subcategory.includes('カスタムリンク')));
    assert(model.descriptors.some(x=>x.id==='KEY_CUSTOM_SEEK_1'&&x.subcategory==='シーク'));
    assert(model.descriptors.some(x=>x.id==='PARAM_CUSTOM_SEEK_1'&&x.subcategory==='シーク'));
    dom.window.close();
  });
  it('places PiP settings in their own screen category and saves the source choice only on Apply',()=>{
    const {model,config,dom}=setup();
    const visible=model.descriptor('pipPageThumbnail');
    const source=model.descriptor('pipPageThumbnailSource');
    assert(visible && source);
    assert.strictEqual(visible.category,'画面・映像');
    assert.strictEqual(source.category,'画面・映像');
    assert.strictEqual(visible.subcategory,'PiP（小窓再生）');
    assert.strictEqual(source.subcategory,visible.subcategory);
    assert.strictEqual(source.dependsOn,'pipPageThumbnail');
    assert.strictEqual(source.type,'select');
    assert.deepStrictEqual(Array.from(source.options.map(x=>x.value)),['smart','legacy']);
    assert.strictEqual(model.isEnabled(source.id),true);
    model.set('pipPageThumbnailSource','legacy');
    assert.strictEqual(config.values.pipPageThumbnailSource,'smart');
    model.save();
    assert.strictEqual(config.values.pipPageThumbnailSource,'legacy');
    assert.deepStrictEqual(config.calls,[['pipPageThumbnailSource','legacy']]);
    dom.window.close();
  });
  it('includes generated history and screen-filter keys even when legacy controls are mounted elsewhere',()=>{
    const {model,dom}=setup();
    const history=model.descriptor('commentHistory.maxAdditionalComments');
    const filter=model.descriptor('screenFilter.gamma');
    assert(history && history.category==='コメント表示');
    assert(filter && filter.category==='画面・映像');
    assert(model.descriptor('commentHistory.enabled'));
    dom.window.close();
  });
  it('reads legacy labels and enum choices without changing the live settings',()=>{
    const {model,config,dom}=setup();
    const row=model.descriptor('commentLayer.maxDisplayComment');
    assert.strictEqual(row.label,'同時表示するコメント数');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(row.options.map(o=>o.value))),[40,100,200]);
    assert.strictEqual(row.category,'コメント表示');
    assert.strictEqual(row.subcategory,'表示・配置');
    assert.strictEqual(config.calls.length,0);
    dom.window.close();
  });
  it('keeps draft edits separate from saved settings and persists only changed keys',()=>{
    const {model,config,dom}=setup();
    model.set('supporterCredit.enable',false);
    model.set('commentLayer.maxDisplayComment','100');
    assert.strictEqual(config.values['supporterCredit.enable'],true);
    assert.strictEqual(model.get('commentLayer.maxDisplayComment'),100);
    assert.strictEqual(model.isDirty(),true);
    assert.strictEqual(model.isDifferentFromDefault('supporterCredit.enable'),true);
    assert.strictEqual(model.isDifferentFromDefault('commentLayer.maxDisplayComment'),true);
    model.save();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(config.calls)),[
      ['supporterCredit.enable',false],['commentLayer.maxDisplayComment',100]
    ]);
    assert.strictEqual(model.isDirty(),false);
    dom.window.close();
  });
  it('cancels modifications and retains a saved non-default glow',()=>{
    const {model,config,dom}=setup({'commentLayer.maxDisplayComment':100});
    assert.strictEqual(model.isDifferentFromDefault('commentLayer.maxDisplayComment'),true);
    model.set('commentLayer.maxDisplayComment',200);
    assert.strictEqual(model.isDifferentFromDefault('commentLayer.maxDisplayComment'),false);
    model.cancel();
    assert.strictEqual(model.get('commentLayer.maxDisplayComment'),100);
    assert.strictEqual(model.isDifferentFromDefault('commentLayer.maxDisplayComment'),true);
    assert.strictEqual(config.calls.length,0);
    dom.window.close();
  });
  it('stages a single-item and subcategory reset; only bottom save writes',()=>{
    const {model,config,dom}=setup({
      'supporterCredit.enable':false,
      'supporterCredit.voice':false,
      'commentLayer.protectCA':false
    });
    model.resetItem('supporterCredit.enable');
    assert.strictEqual(model.get('supporterCredit.enable'),true);
    model.resetSubcategory('再生・音声','提供画面');
    assert.strictEqual(model.get('supporterCredit.voice'),true);
    assert.strictEqual(model.get('commentLayer.protectCA'),false);
    assert.strictEqual(config.calls.length,0);
    model.save();
    assert.strictEqual(config.values['supporterCredit.voice'],true);
    dom.window.close();
  });
  it('records dependencies without mutating child values when a parent turns off',()=>{
    const {model,dom}=setup();
    const child=model.descriptor('supporterCredit.voice');
    assert.strictEqual(child.dependsOn,'supporterCredit.enable');
    assert.strictEqual(model.isEnabled('supporterCredit.voice'),true);
    model.set('supporterCredit.enable',false);
    assert.strictEqual(model.isEnabled('supporterCredit.voice'),false);
    assert.strictEqual(model.get('supporterCredit.voice'),true);
    dom.window.close();
  });
  it('searches across labels, aliases, keys, category and subgroup',()=>{
    const {model,dom}=setup();
    assert(model.search('コメントアート').some(x=>x.id==='commentLayer.protectCA'));
    assert(model.search('シーク').some(x=>x.id==='KEY_CUSTOM_SEEK_1'));
    assert(model.search('関連メニュー').some(x=>x.id==='relatedMenu.customLinks'));
    assert(model.search('audio').length===0);
    dom.window.close();
  });
  it('warns on overlapping shortcuts without blocking both actions',()=>{
    const {model,dom}=setup({'relatedMenu.customLinks':[
      {id:'a',label:'統計',url:'https://example.org/{videoId}',enabled:true,shortcutKey:32},
      {id:'b',label:'投稿者',url:'https://example.org/{uploaderUserId}',enabled:true,shortcutKey:32}
    ]});
    const conflicts=model.keyConflicts(32);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(conflicts)),[
      '再生・停止','統計','投稿者'
    ]);
    assert.strictEqual(model.validate().length,0);
    dom.window.close();
  });
  it('detects concurrent saves before writing and preserves a fresh-array contract',()=>{
    const {model,config,dom}=setup();
    model.set('relatedMenu.customLinks',[{id:'one',label:'一つ',url:'https://example.org'}]);
    const array=model.get('relatedMenu.customLinks');
    assert.notStrictEqual(array,config.values['relatedMenu.customLinks']);
    model.set('supporterCredit.enable',false);
    config.values['supporterCredit.enable']=false;
    assert.throws(()=>model.save(),/更新|競合/);
    assert.strictEqual(config.calls.length,0);
    model.cancel();
    model.set('relatedMenu.customLinks',[{id:'two',label:'二つ',url:'https://example.org/2'}]);
    model.save();
    assert.notStrictEqual(config.values['relatedMenu.customLinks'],array);
    dom.window.close();
  });
  it('rejects invalid enum values and duplicate generated setting IDs',()=>{
    const {model,config,dom}=setup();
    model.set('commentLayer.maxDisplayComment',150);
    assert(model.validate().some(x=>x.id==='commentLayer.maxDisplayComment'));
    assert.throws(()=>model.save(),/無効|不正/);
    assert.strictEqual(config.calls.length,0);
    dom.window.close();
  });
});

describe('Task318 screen-filter slider metadata',()=>{
  it('reads real filter bounds and rejects out-of-range values before saving',()=>{
    const {model,config,dom}=setup();
    const gamma=model.descriptor('screenFilter.gamma');
    assert.strictEqual(gamma.label,'ガンマ');
    assert.strictEqual(gamma.type,'slider');
    assert.strictEqual(gamma.min,0.3);
    assert.strictEqual(gamma.max,3);
    model.set('screenFilter.gamma',1.35);
    assert.strictEqual(model.validate().length,0);
    model.set('screenFilter.gamma',3.5);
    assert(model.validate().some(x=>x.id==='screenFilter.gamma'));
    assert.strictEqual(config.calls.length,0);
    dom.window.close();
  });
});

describe('Task318 settings storage failure safety',()=>{
  it('refuses to declare success when DataStorage suppresses a storage write failure',()=>{
    const {model,config,dom}=setup();
    const data={'ZenzaWatch_supporterCredit.enable':'true'};
    config.readonly=false;
    config.storage=Object.defineProperty({},'ZenzaWatch_supporterCredit.enable',{
      get(){return data['ZenzaWatch_supporterCredit.enable'];},
      set(){throw new Error('QuotaExceededError');}
    });
    config.getStorageKey=k=>'ZenzaWatch_'+k;
    config.setValue=(k,v)=>{
      config.values[k]=v;
      try {config.storage[config.getStorageKey(k)]=JSON.stringify(v);}
      catch(_) { /* DataStorage's existing suppressed storage failure */ }
    };
    model.set('supporterCredit.enable',false);
    assert.throws(()=>model.save(),/保存|書き込み/);
    assert.strictEqual(model.isDirty(),true,'unsaved draft must be retained');
    assert.strictEqual(config.values['supporterCredit.enable'],true,
      'best-effort rollback should restore the original in-memory value');
    assert.strictEqual(data['ZenzaWatch_supporterCredit.enable'],'true');
    dom.window.close();
  });
  it('rolls back already-written keys if a later settings key fails storage verification',()=>{
    const {model,config,dom}=setup();
    const data={
      'ZenzaWatch_supporterCredit.enable':'true',
      'ZenzaWatch_supporterCredit.voice':'true'
    };
    config.readonly=false;
    config.storage=new Proxy(data,{
      set(target,key,value){
        if(key==='ZenzaWatch_supporterCredit.voice' && value==='false'){
          throw new Error('QuotaExceededError');
        }
        target[key]=value;return true;
      }
    });
    config.getStorageKey=k=>'ZenzaWatch_'+k;
    config.setValue=(k,v)=>{
      config.values[k]=v;
      try {config.storage[config.getStorageKey(k)]=JSON.stringify(v);}
      catch(_) { /* suppressed like existing DataStorage */ }
    };
    model.set('supporterCredit.enable',false);
    model.set('supporterCredit.voice',false);
    assert.throws(()=>model.save(),/保存|書き込み/);
    assert.strictEqual(data['ZenzaWatch_supporterCredit.enable'],'true');
    assert.strictEqual(data['ZenzaWatch_supporterCredit.voice'],'true');
    assert.strictEqual(config.values['supporterCredit.enable'],true);
    assert.strictEqual(config.values['supporterCredit.voice'],true);
    assert.strictEqual(model.changes().length,2);
    dom.window.close();
  });
});

describe('Task318 history schema and live dependency metadata',()=>{
  it('takes Japanese labels, bounds and numeric controls from the real history schema',()=>{
    const {model,config,dom}=setup();
    const d=model.descriptor('commentHistory.maxAdditionalComments');
    assert.strictEqual(d.label,'追加コメント上限');
    assert.strictEqual(d.type,'slider');
    assert.strictEqual(d.min,1);
    assert.strictEqual(d.max,20000);
    assert.strictEqual(d.step,1);
    assert.strictEqual(d.dependsOn,'commentHistory.enabled');
    model.set('commentHistory.enabled',false);
    assert.strictEqual(model.isEnabled(d.id),false);
    model.set('commentHistory.maxAdditionalComments',20001);
    assert(model.validate().some(x=>x.id===d.id));
    assert.strictEqual(config.calls.length,0);
    dom.window.close();
  });
  it('uses existing Config keys for comment auto-scroll and read-aloud dependency',()=>{
    const {dom}=setup();
    const Model=loadClass('src/ModernAdvancedSettingsModel.js',
      'ModernAdvancedSettingsModel',createContext({document:dom.window.document,URL}));
    const defaults={
      enableCommentPanel:true,enableCommentPanelAutoScroll:true,
      speakLark:false,speakLarkVolume:0.8
    };
    const config={default:defaults,getValue:key=>defaults[key]};
    const model=new Model({config,legacyRoot:null,actions:[]});
    const scroll=model.descriptor('enableCommentPanelAutoScroll');
    const volume=model.descriptor('speakLarkVolume');
    assert(scroll && volume);
    assert.strictEqual(scroll.category,'コメント表示');
    assert.strictEqual(scroll.subcategory,'コメント一覧');
    assert.strictEqual(scroll.dependsOn,'enableCommentPanel');
    assert.strictEqual(volume.category,'再生・音声');
    assert.strictEqual(volume.dependsOn,'speakLark');
    assert.strictEqual(model.isEnabled(volume.id),false);
    assert.strictEqual(model.get(volume.id),0.8);
    dom.window.close();
  });
});

describe('Task318 comprehensive public preferences catalog',()=>{
  it('exposes user-facing playback, comment and NG preferences without session secrets',()=>{
    const {dom}=setup();
    const Model=loadClass('src/ModernAdvancedSettingsModel.js',
      'ModernAdvancedSettingsModel',createContext({document:dom.window.document,URL}));
    const defaults={
      autoPlay:true,volume:0.3,mute:false,overrideGinza:false,
      screenMode:'normal',fullscreenControlBarMode:'auto',
      showComment:true,commentLayerOpacity:1,
      enableCommentPanel:true,enableCommentPanelAutoScroll:true,
      enableFilter:true,wordFilter:'',userIdFilter:'',commandFilter:'',
      sharedNgLevel:'MID','filter.fork0':true,
      enablePushState:true,playlistLoop:false,
      lastPlayerId:'private',message:'private',lastWatchId:'sm9',
      'videoSearch.word':'private keyword','relatedMenu.customLinks':[]
    };
    const model=new Model({config:{
      default:defaults,getValue:key=>defaults[key],
      options:{validateImport(){return true}}
    },actions:[]});
    const find=id=>model.descriptor(id);
    assert(find('autoPlay') && find('volume') && find('mute'));
    assert.strictEqual(find('volume').type,'slider');
    assert.strictEqual(find('volume').max,1);
    assert.strictEqual(find('overrideGinza').category,'再生・音声');
    assert.strictEqual(find('screenMode').category,'画面・映像');
    assert.strictEqual(find('showComment').category,'コメント表示');
    assert.strictEqual(find('commentLayerOpacity').category,'コメント表示');
    assert.strictEqual(find('enableCommentPanelAutoScroll').dependsOn,'enableCommentPanel');
    for(const id of ['enableFilter','wordFilter','userIdFilter',
      'commandFilter','sharedNgLevel','filter.fork0']){
      assert(find(id),id+' must be present');
      assert.strictEqual(find(id).category,'NG・表示対象');
    }
    assert.strictEqual(find('wordFilter').type,'textarea');
    assert.strictEqual(find('sharedNgLevel').type,'select');
    assert.strictEqual(find('sharedNgLevel').options.length,5);
    assert.strictEqual(find('filter.fork0').dependsOn,'enableFilter');
    assert.strictEqual(find('lastPlayerId'),null);
    assert.strictEqual(find('lastWatchId'),null);
    assert.strictEqual(find('message'),null);
    assert.strictEqual(find('videoSearch.word'),null);
    assert.strictEqual(new Set(model.descriptors.map(d=>d.id)).size,model.descriptors.length);
    dom.window.close();
  });
  it('preserves values in disabled child filters and rejects out-of-range volume',()=>{
    const {dom}=setup();
    const Model=loadClass('src/ModernAdvancedSettingsModel.js',
      'ModernAdvancedSettingsModel',createContext({document:dom.window.document,URL}));
    const defaults={enableFilter:true,'filter.fork0':true,volume:0.3};
    const config={default:defaults,values:{...defaults},calls:[],
      getValue(id){return this.values[id];},
      setValue(id,value){this.values[id]=value;this.calls.push([id,value]);},
      options:{validateImport(){return true}}};
    const model=new Model({config});
    model.set('enableFilter',false);
    assert.strictEqual(model.isEnabled('filter.fork0'),false);
    assert.strictEqual(model.get('filter.fork0'),true);
    model.set('volume',1.1);
    assert(model.validate().some(e=>e.id==='volume'));
    assert.throws(()=>model.save(),/不正|無効/);
    assert.strictEqual(config.calls.length,0);
    dom.window.close();
  });
});

describe('Task318 screen-filter internal preferences',()=>{
  it('keeps deprecated/internal filter storage keys in Config but not the editor',()=>{
    const {dom}=setup();
    const Model=loadClass('src/ModernAdvancedSettingsModel.js',
      'ModernAdvancedSettingsModel',createContext({document:dom.window.document,URL}));
    const defaults={
      'screenFilter.enable':true,'screenFilter.saved':'',
      'screenFilter.flipH':false,'screenFilter.flipV':false,
      'screenFilter.applyToScreenshot':true,'screenFilter.applyToCommentPip':true
    };
    const model=new Model({config:{
      default:defaults,getValue:id=>defaults[id]
    },actions:[]});
    assert.strictEqual(model.descriptor('screenFilter.enable'),null);
    assert.strictEqual(model.descriptor('screenFilter.saved'),null);
    assert.strictEqual(model.descriptor('screenFilter.flipH').label,'左右反転');
    assert.strictEqual(model.descriptor('screenFilter.applyToScreenshot').label,
      'スクリーンショットにも映像フィルターを適用');
    assert.strictEqual(model.get('screenFilter.saved'),undefined);
    assert.strictEqual(defaults['screenFilter.enable'],true);
    dom.window.close();
  });
});

describe('Task318 deterministic navigation and parent-first ordering',()=>{
  it('orders defined categories and subcategories independently of legacy DOM traversal',()=>{
    const {dom}=setup();
    const Model=loadClass('src/ModernAdvancedSettingsModel.js',
      'ModernAdvancedSettingsModel',createContext({document:dom.window.document,URL}));
    const defaults={
      'touch.tap3command':'toggle-mute','touch.enable':true,
      wordRegFilter:'',wordFilter:'',enableFilter:true,userIdFilter:'',
      'commentHistory.maxAdditionalComments':5000,'commentHistory.enabled':false,
      showComment:true,commentLayerOpacity:1,
      'relatedMenu.customLinks':[],KEY_TOGGLE_PLAY:32
    };
    const config={default:defaults,getValue:id=>defaults[id]};
    const model=new Model({config,
      legacyRoot:dom.window.document.getElementById('old'),
      actions:[{id:'TOGGLE_PLAY',category:'再生',label:'再生・停止'}],
      historySchema:[{key:'commentHistory.maxAdditionalComments',
        label:'追加コメント上限',type:'integer',min:1,max:20000}]
    });
    const key=category=>model.descriptors.filter(d=>d.category===category).map(d=>d.id);
    const touch=key('マウス・タッチ');
    const ng=key('NG・表示対象');
    const history=key('コメント表示');
    assert(touch.indexOf('touch.enable')<touch.indexOf('touch.tap3command'));
    assert(ng.indexOf('enableFilter')<ng.indexOf('wordFilter'));
    assert(ng.indexOf('wordFilter')<ng.indexOf('wordRegFilter'));
    assert(history.indexOf('commentHistory.enabled')<history.indexOf('commentHistory.maxAdditionalComments'));
    const nav=model.descriptors.map(d=>d.category);
    assert.deepStrictEqual([...new Set(nav)],
      Array.from(Model.CATEGORIES).filter(c=>nav.includes(c)));
    dom.window.close();
  });
});

describe('Task938 stable fullscreen and small-mode classification with legacy inputs',()=>{
  it('places old and new preferences exactly once in the correct video categories',()=>{
    const dom=new JSDOM('<!doctype html><div id="legacy"><label><input type="checkbox" data-setting-name="smallModeAspectLock">縦横比を固定</label></div>');
    try{
      const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',
        createContext({document:dom.window.document,URL}));
      const defaults={
        screenMode:'normal','screenMode:ginza':'normal','screenMode:others':'normal',
        autoFullScreen:false,smallModeAspectLock:false,
        fullscreenControlBarMode:'auto',
        'controlBar.showOnPause.small':false,'controlBar.showOnPause.fullscreen':false,
        'controlBar.hideAfterSeconds.small':3,'controlBar.hideAfterSeconds.fullscreen':0.4,
        enableHeatMap:true,enableStoryboard:true,enableStoryboardBar:false,menuScale:1
      };
      const config={default:defaults,values:{...defaults,
        'controlBar.showOnPause.small':true,
        'controlBar.showOnPause.fullscreen':true},
        getValue(k){return this.values[k]},
        setValue(k,v){this.values[k]=v}};
      const model=new Model({config,legacyRoot:dom.window.document.getElementById('legacy')});
      const wanted={
        screenMode:'表示モード',
        'screenMode:ginza':'表示モード','screenMode:others':'表示モード',
        autoFullScreen:'全画面モード',
        smallModeAspectLock:'小画面モード',
        fullscreenControlBarMode:'全画面モード',
        'controlBar.showOnPause.small':'小画面モード',
        'controlBar.hideAfterSeconds.small':'小画面モード',
        'controlBar.showOnPause.fullscreen':'全画面モード',
        'controlBar.hideAfterSeconds.fullscreen':'全画面モード',
        enableHeatMap:'プレイヤーの操作表示',
        enableStoryboard:'プレイヤーの操作表示',
        enableStoryboardBar:'プレイヤーの操作表示',
        menuScale:'プレイヤーの操作表示'
      };
      for(const [id,group] of Object.entries(wanted)){
        assert.strictEqual(model.descriptor(id).category,'画面・映像',id);
        assert.strictEqual(model.descriptor(id).subcategory,group,id);
        assert.strictEqual(model.descriptors.filter(d=>d.id===id).length,1,id);
      }
      assert.deepStrictEqual(
        [...new Set(model.descriptors.filter(d=>d.category==='画面・映像').map(d=>d.subcategory))],
        ['表示モード','小画面モード','全画面モード','プレイヤーの操作表示']);
      model.resetSubcategory('画面・映像','小画面モード');
      assert.strictEqual(model.get('controlBar.showOnPause.small'),false);
      assert.strictEqual(model.get('controlBar.showOnPause.fullscreen'),true);
      assert.strictEqual(config.values['controlBar.showOnPause.small'],true,
        'reset is draft-only until saved');
    }finally{dom.window.close()}
  });
});
