'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass,beginSection,run}=require('../helpers/extractSource');
const markup='<!doctype html><html><body><section id="panel"><div class="settingPanelInner"><div id="legacy">' +
'<div class="control"><label><input type="checkbox" data-setting-name="supporterCredit.enable"> 提供画面を表示</label>' +
'<div class="settingNote">動画の最後に提供画面を表示します。</div></div>' +
'<div class="control"><label><input type="checkbox" data-setting-name="supporterCredit.voice"> 読み上げ音声</label></div>' +
'<div class="control"><label><input type="checkbox" data-setting-name="commentLayer.protectCA"> コメントアートを保護</label></div>' +
'<div class="control"><label>コメント数<select data-setting-name="commentLayer.maxDisplayComment">' +
'<option value="40">40件</option><option value="200">200件</option></select></label></div>' +
'<div class="control"><label><input type="checkbox" data-setting-name="touch.enable"> タッチ</label></div>' +
'</div></div></section></body></html>';
function boot(saved={},storageValues={}) {
  const dom=new JSDOM(markup,{url:'https://www.nicovideo.jp/my'});
  const ctx=createContext({window:dom.window,document:dom.window.document,URL});
  run(beginSection('src/NgCompositeRules.js')+'\nglobalThis.Engine=NgCompositeRules;',ctx);
  run(beginSection('src/NgCompositeRuleEditor.js'),ctx);
  ctx.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',ctx);
  const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',ctx);
  const UI=loadClass('src/ModernAdvancedSettingsUI.js','ModernAdvancedSettingsUI',ctx);
  const ScreenshotFileName=loadClass('src/ScreenshotFileName.js','ScreenshotFileName',ctx);
  const RelatedMenuActions=loadClass('packages/zenza/src/menu/RelatedMenuActions.js','RelatedMenuActions',ctx);
  const RelatedMenuSettings=loadClass('src/RelatedMenuSettings.js','RelatedMenuSettings',ctx);
  const RelatedMenuOrder=loadClass('src/RelatedMenuOrder.js','RelatedMenuOrder',ctx);
  const defaults={'supporterCredit.enable':true,'supporterCredit.voice':true,
    'commentLayer.protectCA':true,'commentLayer.maxDisplayComment':200,
    'touch.enable':false,'commentHistory.enabled':false,
    'commentHistory.maxAdditionalComments':5000,'screenFilter.gamma':1,
    enableFilter:true,wordFilter:'',wordRegFilter:'',wordRegFilterFlags:'i',
    userIdFilter:'',commandFilter:'','ngComposite.rules':[],
    sharedNgLevel:'MID','filter.fork0':true,screenMode:'normal',
    showComment:true,backComment:false,enableCommentPanel:true,enableCommentPreview:false,
    enableHeatMap:true,enableStoryboard:true,enableStoryboardBar:false,
    'sceneSearch.layout.normal':'01','sceneSearch.layout.fullscreen':'01',
    'sceneSearch.layout.linkFullscreen':false,
    enableAdDecoration:true,
    KEY_TOGGLE_PLAY:32, KEY_OPEN_GINZA:0, KEY_OPEN_NICOAD:0,
    KEY_OPEN_TWITTER_HASH:0, KEY_OPEN_ORIGINAL_VIDEO:0, KEY_OPEN_PARENT_VIDEO:0,
    KEY_PLAYLIST_SET_COMMONS_TREE:0, KEY_COPY_WATCH_URL:0,
    'relatedMenu.builtinOptions':{},
    'videoSearch.wordCountMode':'on-demand','videoSearch.videoIdSuggestMode':'merged',
    'search.limit':1000,'relatedMenu.order':[],'relatedMenu.hiddenItems':[],
    'ui.hover.like':true,'ui.hover.tweet':true,'ui.hover.mylist':true,
    'ui.hover.watchLater':true,'ui.hover.comments':true,'ui.hover.ngFilter':true,
    'ui.relatedMenu':true,'ui.commentInput':true,
    KEY_CUSTOM_SEEK_1:0,PARAM_CUSTOM_SEEK_1:0,'relatedMenu.customLinks':[],
    ...ctx.UiVisibilityRegistry.defaults()};
  const config={default:defaults,values:{...defaults,...saved},writes:[],listeners:new Map(),
    getValue(k){return this.values[k]},
    onkey(k,fn){if(!this.listeners.has(k)){this.listeners.set(k,new Set());}this.listeners.get(k).add(fn);},
    offkey(k,fn){this.listeners.get(k)?.delete(fn);},
    setValue(k,v){
      this.values[k]=v;this.writes.push([k,v]);
      this.listeners.get(k)?.forEach(fn=>fn(v));
    },
    options:{validateImport(k,v){return k==='ngComposite.rules'?
      ctx.Engine.validate(v):typeof v===typeof defaults[k]}}};
  const actions=[{id:'TOGGLE_PLAY',label:'再生・停止',category:'再生操作',defaultKey:32},
    {id:'CUSTOM_SEEK_1',label:'カスタムシーク 1',category:'シーク',defaultKey:0,customSeekSlot:true},
    ...['OPEN_GINZA','OPEN_NICOAD','OPEN_TWITTER_HASH','OPEN_ORIGINAL_VIDEO',
      'OPEN_PARENT_VIDEO','PLAYLIST_SET_COMMONS_TREE','COPY_WATCH_URL']
      .map(id=>({id,label:id,category:'その他',defaultKey:0}))];
  const panel=dom.window.document.getElementById('panel');
  const legacy=dom.window.document.getElementById('legacy');
  const oldCheckbox=legacy.querySelector('[data-setting-name="supporterCredit.enable"]');
  let oldListenerFired=0;oldCheckbox.addEventListener('change',()=>oldListenerFired++);
  const relatedContainer=dom.window.document.createElement('div');
  relatedContainer.className='relatedMenuCustomLinksContainer';
  legacy.append(relatedContainer);
  const relatedEditor=RelatedMenuSettings.mount(relatedContainer,{config,actions:RelatedMenuActions});
  const model=new Model({config,legacyRoot:legacy,actions,
    screenFilterParams:[{key:'gamma',label:'ガンマ',min:0.3,max:3,step:0.01,desc:'明るさ'}],
    historySchema:[{key:'commentHistory.maxAdditionalComments',label:'追加コメント上限',type:'integer',min:1,max:20000}]});
  const stored={...storageValues};
  const storage={getItem(k){return stored[k]??null},setItem(k,v){stored[k]=v}};
  let closed=0;let confirmCalls=0;let confirms=true;
  const ui=new UI({panel,legacyRoot:legacy,model,storage,relatedEditor,
    relatedOrder:RelatedMenuOrder,relatedActions:RelatedMenuActions,
    screenshotFileName:ScreenshotFileName,
    onClose(){closed++},confirm(message){confirmCalls++;return confirms},
    formatKeyCombo(code){return code===32?'Space':code?'key '+code:'(未設定)'},
    encodeKeyCombo(e){return (e.keyCode||0)+(e.ctrlKey?0x10000:0)+(e.shiftKey?0x1000:0)}
  });
  const q=sel=>panel.querySelector(sel);
  const all=sel=>[...panel.querySelectorAll(sel)];
  const click=sel=>{const el=q(sel);assert(el,sel);el.click()};
  const dispatch=(el,event='change')=>el.dispatchEvent(new dom.window.Event(event,{bubbles:true,cancelable:true}));
  return {dom,panel,model,ui,config,storage,stored,q,all,click,dispatch,
    oldListenerCount(){return oldListenerFired},
    closes(){return closed},confirms(){return confirmCalls},allowConfirm(v){confirms=v},
    destroy(){ui.dispose();relatedEditor.dispose();dom.window.close()}};
}
describe('Task402 B2 global settings lifecycle',()=>{
  const openNg=h=>{
    h.click('[data-zw-major="NG・表示対象"]');
    h.click('[data-zw-sub="NG・表示対象|複合NGルール（上級者向け）"]');
    const host=h.q('[data-zw-id="ngComposite.rules"] .zw-composite-ng-host');
    assert(host?.shadowRoot,'B2 shadow editor should mount inside advanced settings');
    return host.shadowRoot;
  };
  it('mounts B2 with collapsed help and nicoru initial threshold 1, without writing config',()=>{
    const h=boot();
    try{
      const shadow=openNg(h);
      assert.strictEqual(shadow.querySelector('.ng-help').open,false);
      assert(!shadow.innerHTML.includes('コメントアートを保護する'));
      shadow.querySelector('[data-ng-act="add"]').click();
      assert.strictEqual(h.model.get('ngComposite.rules').length,1);
      assert.strictEqual(h.model.get('ngComposite.rules')[0].nicoruMin,1);
      assert.strictEqual(h.config.writes.length,0);
      assert.strictEqual(h.q('[data-zw-save]').disabled,true,'incomplete rule must not save');
    }finally{h.destroy();}
  });
  it('commits only the finished B2 draft; cancellation restores and keeps other settings',()=>{
    const h=boot({'supporterCredit.enable':false,backComment:true});
    try{
      let shadow=openNg(h);
      shadow.querySelector('[data-ng-act="add"]').click();
      shadow=h.q('[data-zw-id="ngComposite.rules"] .zw-composite-ng-host').shadowRoot;
      const text=shadow.querySelector('[data-node-value]');
      text.value='中国';h.dispatch(text,'input');
      assert.strictEqual(h.q('[data-zw-save]').disabled,false);
      assert.strictEqual(h.config.writes.length,0);
      h.click('[data-zw-cancel]');
      assert.deepStrictEqual(h.model.get('ngComposite.rules'),[]);
      assert.strictEqual(h.config.writes.length,0);
      shadow=openNgIfPresent(h);
      shadow.querySelector('[data-ng-act="add"]').click();
      const input=shadow.querySelector('[data-node-value]');
      input.value='中国';h.dispatch(input,'input');
      h.click('[data-zw-save]');
      assert.strictEqual(h.config.values['ngComposite.rules'].length,1);
      assert.strictEqual(h.config.values['ngComposite.rules'][0].enabled,false);
      assert.strictEqual(h.config.values.backComment,true);
      assert.strictEqual(h.config.values['supporterCredit.enable'],false);
      assert.deepStrictEqual(h.config.writes.map(([key])=>key),['ngComposite.rules']);
    }finally{h.destroy();}
  });
  function openNgIfPresent(h){
    return h.q('[data-zw-id="ngComposite.rules"] .zw-composite-ng-host').shadowRoot;
  }
});

describe('Task400 regex flag checkbox and NG command assistance',()=>{
  const openNg=h=>{
    h.click('[data-zw-major="NG・表示対象"]');
    h.click('[data-zw-sub="NG・表示対象|NG条件"]');
  };
  it('renders native regex flag checkboxes without switch thumbs',()=>{
    const h=boot();
    try{
      openNg(h);
      const flags=h.all('[data-zw-regex-flag]');
      assert.strictEqual(flags.length,4);
      assert(flags.every(el=>el.type==='checkbox' && !el.classList.contains('zw-switch')));
      const css=h.dom.window.document.querySelector('style[data-zw-modern-ui]').textContent;
      assert(css.includes('.zw-modern-regex-editor input[type=checkbox]::after'));
      assert(css.includes('appearance:checkbox'), 'native square checkbox appearance');
      flags[1].checked=true;h.dispatch(flags[1]);
      assert(h.model.get('wordRegFilterFlags').includes('m'));
      assert.strictEqual(h.config.writes.length,0);
    }finally{h.destroy();}
  });
  it('explains the current OR matching and inserts beginner presets as a draft',()=>{
    const h=boot({commandFilter:'red'});
    try{
      openNg(h);
      const helper=h.q('[data-zw-command-guide]');
      assert(helper);
      assert(helper.textContent.includes('1つでも'));
      assert(helper.textContent.includes('組み合わせ'));
      const red=h.q('[data-zw-command-preset="red"]');
      const big=h.q('[data-zw-command-preset="big"]');
      const top=h.q('[data-zw-command-preset="ue"]');
      assert(red && big && top);
      assert(red.textContent.includes('赤'));
      assert(big.textContent.includes('大'));
      assert(top.textContent.includes('上'));
      assert(red.disabled,'existing command must not be duplicated');
      big.click();
      assert.strictEqual(h.model.get('commandFilter'),'red\nbig');
      assert.strictEqual(h.config.writes.length,0);
      assert(h.q('[data-zw-command-preset="big"]').disabled);
      h.click('[data-zw-save]');
      assert.strictEqual(h.config.values.commandFilter,'red\nbig');
      assert.deepStrictEqual(h.config.writes.map(([key])=>key),['commandFilter']);
    }finally{h.destroy();}
  });
  it('keeps external command strings and permits cancelling added commands',()=>{
    const h=boot({commandFilter:'my-custom\nred'});
    try{
      openNg(h);
      h.click('[data-zw-command-preset="blue"]');
      assert.strictEqual(h.model.get('commandFilter'),'my-custom\nred\nblue');
      h.click('[data-zw-cancel]');
      assert.strictEqual(h.model.get('commandFilter'),'my-custom\nred');
      assert.strictEqual(h.config.writes.length,0);
      assert.strictEqual(h.q('[data-zw-command-preset="red"]').disabled,true);
    }finally{h.destroy();}
  });
});

describe('Task399 NG user ID list editor',()=>{
  const openUserIds=h=>{
    h.click('[data-zw-major="NG・表示対象"]');
    h.click('[data-zw-sub="NG・表示対象|NG条件"]');
    const field=h.q('[data-zw-id="userIdFilter"] textarea');
    assert(field,'NG user ID editor must be a textarea');
    return field;
  };
  it('shows existing array entries on separate lines without modifying saved settings',()=>{
    const ids=['nvc:alpha','nvc:beta','13579'];
    const h=boot({userIdFilter:ids,commandFilter:'red'});
    try{
      assert.strictEqual(openUserIds(h).value,ids.join('\n'));
      assert.deepStrictEqual(h.model.get('userIdFilter'),ids);
      assert.strictEqual(h.model.isDirty(),false);
      h.click('[data-zw-save]');
      assert.strictEqual(h.config.writes.length,0);
      assert.deepStrictEqual(h.config.values.userIdFilter,ids);
    }finally{h.destroy();}
  });
  it('accepts legacy comma values and saves newlines without changing NG commands',()=>{
    const h=boot({userIdFilter:'nvc:alpha, nvc:beta',commandFilter:'red'});
    try{
      const field=openUserIds(h);
      assert.strictEqual(field.value,'nvc:alpha\nnvc:beta');
      field.value='nvc:alpha,\nnvc:beta\nnvc:gamma';
      h.dispatch(field,'input');
      assert.strictEqual(h.model.get('userIdFilter'),'nvc:alpha\nnvc:beta\nnvc:gamma');
      assert.strictEqual(h.config.writes.length,0,'editing is only a draft');
      h.click('[data-zw-save]');
      assert.strictEqual(h.config.values.userIdFilter,'nvc:alpha\nnvc:beta\nnvc:gamma');
      assert.deepStrictEqual(h.config.writes.map(([key])=>key),['userIdFilter']);
      assert.strictEqual(h.config.values.commandFilter,'red');
      assert.strictEqual(h.q('[data-zw-id="userIdFilter"] textarea').value,
        'nvc:alpha\nnvc:beta\nnvc:gamma');
    }finally{h.destroy();}
  });
});

describe('Task318 full-viewport advanced-settings shell',()=>{
  it('notifies the current document only after a successfully saved change',()=>{
    const h=boot();
    const announced=[];
    h.dom.window.addEventListener('ZenzaWatch-advanced-settings-saved',
      e=>announced.push([...e.detail.keys]));
    h.model.set('relatedMenu.hiddenItems',['builtin:ad']);
    h.click('[data-zw-cancel]');
    assert.strictEqual(announced.length,0,'Cancel must not broadcast');
    h.model.set('relatedMenu.hiddenItems',['builtin:ad']);
    h.ui._refreshFooter();
    h.click('[data-zw-save]');
    assert.strictEqual(announced.length,1);
    assert(announced[0].includes('relatedMenu.hiddenItems'));
    assert.deepStrictEqual(h.config.values['relatedMenu.hiddenItems'],['builtin:ad']);
    h.click('[data-zw-save]');
    assert.strictEqual(announced.length,1,'Saving an unchanged draft must be silent');
    h.destroy();
  });
  it('resets only the visible subcategory, preserving other display and playback settings',()=>{
    const h=boot({'ui.bar.fullscreen':false,'ui.header.search':false,
      'ui.bar.loop':false,screenMode:'small','supporterCredit.enable':false});
    try{
      h.click('[data-zw-major="画面・映像"]');
      h.click('[data-zw-sub="画面・映像|表示・非表示"]');
      const reset=h.q('[data-zw-reset-category]');
      assert(reset);
      assert(reset.textContent.includes('この画面'));
      reset.click();
      assert.strictEqual(h.model.get('ui.bar.fullscreen'),true);
      assert.strictEqual(h.model.get('ui.header.search'),true);
      assert.strictEqual(h.model.get('ui.bar.loop'),true);
      assert.strictEqual(h.model.get('screenMode'),'small','other sections in the same major group preserved');
      assert.strictEqual(h.model.get('supporterCredit.enable'),false);
      assert.strictEqual(h.config.writes.length,0,'reset must be draft-only');
      h.click('[data-zw-cancel]');
      assert.strictEqual(h.model.get('ui.bar.fullscreen'),false,'Cancel restores original values');
      h.click('[data-zw-reset-category]');
      h.click('[data-zw-save]');
      assert.strictEqual(h.config.values['ui.bar.fullscreen'],true);
      assert.strictEqual(h.config.values.screenMode,'small');
      assert.strictEqual(h.config.values['supporterCredit.enable'],false);
      assert(h.confirms()>=1);
    }finally{h.destroy();}
  });
  it('renders seven major groups, sidebar width and persistent bottom actions',()=>{
    const h=boot();assert(h.q('.zw-modern-root'));
    assert.strictEqual(h.all('[data-zw-major]').length,7);
    assert(h.q('.zw-modern-root').getAttribute('style').includes('290px'));
    assert(h.q('[data-zw-save]'));assert(h.q('[data-zw-cancel]'));
    assert(h.panel.classList.contains('zw-modern-active'));
    h.destroy();
  });
  it('covers the original Nico header without leaking the legacy settings layout',()=>{
    const h=boot();
    const doc=h.dom.window.document;
    const legacyCss=doc.createElement('style');
    legacyCss.textContent=[
      '.zenzaAdvancedSettingPanel { top:-100vh;left:50%;width:90vw;height:90vh;transform:translate(-50%,-50%);z-index:200000;transition:top .4s ease }',
      '.zenzaAdvancedSettingPanel.show { top:50% }',
      '.zenzaAdvancedSettingPanel label {display:inline-block;width:100%;height:100%;padding:4px 8px}',
      '.zenzaAdvancedSettingPanel input[type=checkbox] {transform:scale(2);margin-left:8px;margin-right:16px}',
      '.zenzaAdvancedSettingPanel input[type=text] {font-size:24px;margin:0 5%;width:90%}'
    ].join('\n');
    doc.head.insertBefore(legacyCss,doc.querySelector('style[data-zw-modern-ui]'));
    h.panel.classList.add('zenzaAdvancedSettingPanel','show');
    const style=h.dom.window.getComputedStyle(h.panel);
    assert.strictEqual(style.zIndex,'2147483647');
    assert.strictEqual(style.width,'auto');
    assert.strictEqual(style.height,'auto');
    assert.strictEqual(style.transform,'none');
    assert.strictEqual(style.transition,'none');
    h.click('[data-zw-sub="再生・音声|提供画面"]');
    const check=h.q('[data-zw-id="supporterCredit.enable"] input[type=checkbox]');
    assert.strictEqual(h.dom.window.getComputedStyle(check).transform,'none');
    assert.strictEqual(h.dom.window.getComputedStyle(check).marginLeft,'0px');
    assert.strictEqual(h.dom.window.getComputedStyle(check).marginRight,'0px');
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
    const label=h.q('.zw-modern-order-row .zw-order-visible');
    assert(label,'Related menu row has a visibility label');
    const orderStyle=h.dom.window.getComputedStyle(label);
    assert.strictEqual(orderStyle.width,'auto');
    assert.strictEqual(orderStyle.display,'inline-flex');
    assert.strictEqual(h.dom.window.getComputedStyle(h.q('.zw-order-name')).width,'auto');
    h.destroy();
  });
  it('restores original document and body scrolling when the dialog closes',()=>{
    const h=boot();
    const html=h.dom.window.document.documentElement;
    const body=h.dom.window.document.body;
    html.style.overflow='auto';
    body.style.overflow='scroll';
    h.ui.setModalVisible(true);
    assert.strictEqual(html.style.overflow,'hidden');
    assert.strictEqual(body.style.overflow,'hidden');
    h.ui.setModalVisible(true);
    h.ui.setModalVisible(false);
    assert.strictEqual(html.style.overflow,'auto');
    assert.strictEqual(body.style.overflow,'scroll');
    h.ui.setModalVisible(true);
    h.destroy();
    assert.strictEqual(html.style.overflow,'auto');
    assert.strictEqual(body.style.overflow,'scroll');
  });
  it('retains multiple expanded categories and restores the last subcategory',()=>{
    const h=boot();
    h.click('[data-zw-major="ショートカット"]');
    h.click('[data-zw-major="コメント表示"]');
    assert(h.ui.expanded.has('ショートカット'));
    assert(h.ui.expanded.has('コメント表示'));
    h.click('[data-zw-sub="ショートカット|シーク"]');
    assert.strictEqual(h.ui.selected.subcategory,'シーク');
    assert.strictEqual(h.stored['zw-advanced-modern-selection']!==undefined,true);
    h.destroy();
  });
  it('intercepts old instant-save listeners; saves only after bottom Save',()=>{
    const h=boot();
    h.click('[data-zw-sub="再生・音声|提供画面"]');
    const input=h.q('[data-zw-id="supporterCredit.enable"] input[type=checkbox]');
    assert(input);
    input.checked=false;h.dispatch(input);
    assert.strictEqual(h.oldListenerCount(),0);
    assert.strictEqual(h.config.writes.length,0);
    assert.strictEqual(h.model.get('supporterCredit.enable'),false);
    assert(h.q('[data-zw-id="supporterCredit.enable"]').classList.contains('is-modified'));
    h.click('[data-zw-save]');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(h.config.writes)),[
      ['supporterCredit.enable',false]]);
    h.destroy();
  });
  it('cancels draft without affecting a saved non-default value',()=>{
    const h=boot({'supporterCredit.enable':false});
    h.click('[data-zw-sub="再生・音声|提供画面"]');
    let box=h.q('[data-zw-id="supporterCredit.enable"] input');
    assert.strictEqual(box.checked,false);
    box.checked=true;h.dispatch(box);
    h.click('[data-zw-cancel]');
    box=h.q('[data-zw-id="supporterCredit.enable"] input');
    assert.strictEqual(box.checked,false);
    assert.strictEqual(h.config.writes.length,0);
    assert(h.q('[data-zw-id="supporterCredit.enable"]').classList.contains('is-modified'));
    h.destroy();
  });
  it('does not repeat the old label inside a modern setting card',()=>{
    const h=boot();h.click('[data-zw-sub="再生・音声|提供画面"]');
    const card=h.q('[data-zw-id="supporterCredit.enable"]');
    assert(card.querySelector('.zw-modern-cardhead strong').textContent.includes('提供画面'));
    assert(!card.querySelector('.zw-modern-cardcontrols').textContent.includes('提供画面'));
    h.destroy();
  });
  it('renders standalone boolean feature settings as toggles and stages changes',()=>{
    const h=boot();h.click('[data-zw-major="コメント表示"]');
    h.click('[data-zw-sub="コメント表示|追加取得"]');
    const card=h.q('[data-zw-id="commentHistory.enabled"]');
    assert(card);
    const input=card.querySelector('input[type=checkbox]');
    assert(input && input.checked===false);
    input.checked=true;h.dispatch(input);
    assert.strictEqual(h.model.get('commentHistory.enabled'),true);
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
  it('shows help on demand while preserving a compact card',()=>{
    const h=boot();h.click('[data-zw-sub="再生・音声|提供画面"]');
    const note=h.q('[data-zw-id="supporterCredit.enable"] .zw-modern-note');
    assert.strictEqual(note.hidden,true);
    h.click('[data-zw-help="supporterCredit.enable"]');
    assert.strictEqual(note.hidden,false);
    h.destroy();
  });
  it('resets the entire selected category only as a draft after confirmation',()=>{
    const h=boot({'supporterCredit.enable':false,'supporterCredit.voice':false});
    h.click('[data-zw-sub="再生・音声|提供画面"]');
    h.click('[data-zw-reset-category]');
    assert.strictEqual(h.model.get('supporterCredit.enable'),true);
    assert.strictEqual(h.model.get('supporterCredit.voice'),true);
    assert.strictEqual(h.config.writes.length,0);
    assert.strictEqual(h.confirms(),1);
    h.destroy();
  });
  it('searches all categories and directly edits search result cards',()=>{
    const h=boot();
    const search=h.q('[data-zw-search]');
    search.value='コメントアート';h.dispatch(search,'input');
    assert(h.q('[data-zw-id="commentLayer.protectCA"]'));
    assert.strictEqual(h.q('[data-zw-id="supporterCredit.enable"]'),null);
    const input=h.q('[data-zw-id="commentLayer.protectCA"] input');
    input.checked=false;h.dispatch(input);
    assert.strictEqual(h.model.get('commentLayer.protectCA'),false);
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
  it('records shortcut by actual key and keeps overlapping actions enabled',()=>{
    const h=boot();h.click('[data-zw-major="ショートカット"]');
    h.click('[data-zw-sub="ショートカット|再生操作"]');
    h.click('[data-zw-record="KEY_TOGGLE_PLAY"]');
    const event=new h.dom.window.KeyboardEvent('keydown',{
      keyCode:65,ctrlKey:true,cancelable:true,bubbles:true});
    h.dom.window.document.dispatchEvent(event);
    assert.strictEqual(event.defaultPrevented,true);
    assert.strictEqual(h.model.get('KEY_TOGGLE_PLAY'),0x10041);
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
  it('stages related-link editing until the global Save and hides the local Save',()=>{
    const h=boot();h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
    const card=h.q('[data-zw-order-detail-pane] .relatedMenuCustomLinksContainer');
    assert(card);
    assert(card.querySelector('[data-rl-add]'));
    assert.strictEqual(card.querySelector('[data-rl-save]').hidden,true);
    h.click('[data-rl-add]');
    const label=card.querySelector('[data-rl-field="label"]');
    label.value='統計リンク';h.dispatch(label,'input');
    const url=card.querySelector('[data-rl-field="url"]');
    url.value='https://example.com/{videoId}';h.dispatch(url,'input');
    assert.strictEqual(h.config.values['relatedMenu.customLinks'].length,0);
    assert.strictEqual(h.config.writes.length,0);
    h.click('[data-zw-save]');
    assert.strictEqual(h.config.values['relatedMenu.customLinks'].length,1);
    assert.strictEqual(h.config.values['relatedMenu.customLinks'][0].label,'統計リンク');
    h.destroy();
  });
  it('rejects invalid related-link drafts without partial settings writes',()=>{
    const h=boot();h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
    h.click('[data-rl-add]');
    const label=h.q('[data-rl-field="label"]');label.value='無効リンク';h.dispatch(label,'input');
    const url=h.q('[data-rl-field="url"]');url.value='javascript:alert(1)';h.dispatch(url,'input');
    assert.strictEqual(h.q('[data-zw-save]').disabled,true);
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
  it('uses escape to close an overlay drawer and confirms pending close',()=>{
    const h=boot();
    h.ui.openDrawer();
    assert(h.q('.zw-modern-root').classList.contains('is-drawer-open'));
    h.dom.window.document.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{
      key:'Escape',keyCode:27,bubbles:true,cancelable:true}));
    assert(!h.q('.zw-modern-root').classList.contains('is-drawer-open'));
    h.click('[data-zw-sub="再生・音声|提供画面"]');
    const input=h.q('[data-zw-id="supporterCredit.enable"] input');
    input.checked=false;h.dispatch(input);
    h.allowConfirm(false);h.click('[data-zw-close]');
    assert.strictEqual(h.closes(),0);
    h.allowConfirm(true);h.click('[data-zw-close]');
    assert.strictEqual(h.closes(),1);
    h.destroy();
  });
});

describe('Task318 embedded related-menu draft operations', () => {
  it('stages newly added and duplicated links immediately, including after list re-render', () => {
    const h=boot();
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
    h.click('[data-rl-add]');
    assert.strictEqual(h.model.get('relatedMenu.customLinks').length,1);
    assert.strictEqual(h.q('[data-rl-save]').hidden,true);
    let label=h.q('[data-rl-field="label"]');
    label.value='作品を検索';h.dispatch(label,'input');
    let url=h.q('[data-rl-field="url"]');
    url.value='https://example.org/watch/{videoId}';h.dispatch(url,'input');
    h.click('[data-rl-duplicate="0"]');
    assert.strictEqual(h.model.get('relatedMenu.customLinks').length,2);
    assert.strictEqual(h.q('[data-rl-save]').hidden,true);
    h.click('[data-rl-up="1"]');
    assert.strictEqual(h.model.get('relatedMenu.customLinks')[0].id.includes('copy'),true);
    h.click('[data-rl-delete="1"]');
    assert.strictEqual(h.model.get('relatedMenu.customLinks').length,1);
    assert.strictEqual(h.config.writes.length,0);
    h.click('[data-zw-save]');
    assert.strictEqual(h.config.values['relatedMenu.customLinks'].length,1);
    h.destroy();
  });
  it('preserves the related editor draft across category switching, and cancel restores original',()=>{
    const h=boot();
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
    h.click('[data-rl-add]');
    h.click('[data-zw-sub="再生・音声|提供画面"]');
    assert.strictEqual(h.model.get('relatedMenu.customLinks').length,1);
    h.click('[data-zw-cancel]');
    assert.strictEqual(h.model.get('relatedMenu.customLinks').length,0);
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
    assert.strictEqual(h.all('[data-rl-row]').length,0);
    h.destroy();
  });
});

describe('Task318 integration wiring contract',()=>{
  it('mounts the new UI after existing specialized editors and keeps source legacy paths',()=>{
    const path=require('path'),fs=require('fs');
    const src=fs.readFileSync(path.resolve(__dirname,'../../src/_setting.js'),'utf8');
    const related=src.indexOf('this._relatedMenuLinks = RelatedMenuSettings.mount(');
    const modern=src.indexOf('new ModernAdvancedSettingsUI(');
    assert(related>=0 && modern>related,
      'Modern UI must mount after specialized editors');
    assert(src.includes('new ModernAdvancedSettingsModel('));
    assert(src.includes('//@require ModernAdvancedSettingsUI'));
    assert(src.includes('//@require ModernAdvancedSettingsModel'));
    assert(src.includes('this._modernUI.hasPendingEdits()'));
    assert(src.includes('this._modernUI.discardChanges()'),
      'Reopen and close paths must restore the UI-only seek slots as well as the model draft');
  });
});

describe('Task318 numeric slider control',()=>{
  it('renders gamma as a bounded slider with a numerical value',()=>{
    const h=boot();
    h.click('[data-zw-major="画面・映像"]');
    h.click('[data-zw-sub="画面・映像|画面フィルター"]');
    const card=h.q('[data-zw-id="screenFilter.gamma"]');
    const slider=card.querySelector('input[type=range]');
    const number=card.querySelector('input[type=number]');
    assert(slider && number);
    assert.strictEqual(Number(slider.min),0.3);
    assert.strictEqual(Number(slider.max),3);
    slider.value='1.35';h.dispatch(slider,'input');
    assert.strictEqual(h.model.get('screenFilter.gamma'),1.35);
    assert.strictEqual(Number(number.value),1.35);
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
});

describe('Task318 custom seek direction and magnitude',()=>{
  it('keeps direction, positive magnitude and shortcut together in one card',()=>{
    const h=boot();
    h.click('[data-zw-major="ショートカット"]');
    h.click('[data-zw-sub="ショートカット|シーク"]');
    h.click('[data-zw-add-seek]');
    const card=h.q('[data-zw-id="KEY_CUSTOM_SEEK_1"]');
    assert(card,'Custom seek row must exist');
    const direction=card.querySelector('[data-zw-seek-direction="PARAM_CUSTOM_SEEK_1"]');
    const amount=card.querySelector('[data-zw-seek-magnitude="PARAM_CUSTOM_SEEK_1"]');
    assert(direction && amount);
    assert.strictEqual(direction.value,'-1');
    direction.value='-1';h.dispatch(direction);
    amount.value='12.5';h.dispatch(amount,'input');
    assert.strictEqual(h.model.get('PARAM_CUSTOM_SEEK_1'),-12.5);
    assert.strictEqual(h.config.writes.length,0);
    h.click('[data-zw-save]');
    assert.strictEqual(h.config.values['PARAM_CUSTOM_SEEK_1'],-12.5);
    h.destroy();
  });
  it('retains selected direction even when magnitude is still zero',()=>{
    const h=boot();
    h.click('[data-zw-major="ショートカット"]');
    h.click('[data-zw-sub="ショートカット|シーク"]');
    h.click('[data-zw-add-seek]');
    const card=h.q('[data-zw-id="KEY_CUSTOM_SEEK_1"]');
    const direction=card.querySelector('[data-zw-seek-direction]');
    direction.value='1';h.dispatch(direction);
    const amount=card.querySelector('[data-zw-seek-magnitude]');
    amount.value='3';h.dispatch(amount,'input');
    assert.strictEqual(h.model.get('PARAM_CUSTOM_SEEK_1'),3);
    h.destroy();
  });
});

describe('Task318 comment-history persistence notification',()=>{
  it('publishes feature-pref changes only after the global save, not during draft editing',()=>{
    const h=boot();
    const received=[];
    h.dom.window.addEventListener('ZenzaWatch-comment-history-settings',
      e=>received.push(e.detail.keys));
    h.click('[data-zw-major="コメント表示"]');
    h.click('[data-zw-sub="コメント表示|追加取得"]');
    const checkbox=h.q('[data-zw-id="commentHistory.enabled"] input');
    assert(checkbox);
    checkbox.checked=true;h.dispatch(checkbox);
    assert.strictEqual(received.length,0);
    assert.strictEqual(h.config.writes.length,0);
    h.click('[data-zw-save]');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(received)),[['commentHistory.enabled']]);
    h.destroy();
  });
});

describe('Task318 preserved settings backup and import',()=>{
  it('keeps export data out of the DOM until requested and imports only after confirmation',()=>{
    const h=boot();
    let importCount=0,reloads=0;
    h.config.exportJson=()=>JSON.stringify({'supporterCredit.enable':false});
    h.config.import=data=>{importCount++;h.config.values={...h.config.values,...data};};
    h.ui.reload=()=>{reloads++};
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|データ管理"]');
    const area=h.q('[data-zw-backup-json]');
    assert(area);
    assert.strictEqual(area.value,'');
    h.click('[data-zw-backup-export]');
    assert.strictEqual(JSON.parse(area.value)['supporterCredit.enable'],false);
    area.value='{INVALID';
    h.click('[data-zw-backup-import]');
    assert.strictEqual(importCount,0);
    area.value='{"supporterCredit.enable":false}';
    h.click('[data-zw-backup-import]');
    assert.strictEqual(importCount,1);
    assert.strictEqual(reloads,1);
    assert.strictEqual(h.config.values['supporterCredit.enable'],false);
    assert(h.confirms()>=1);
    h.destroy();
  });
});

describe('Task318 narrow-screen drawer interactions',()=>{
  it('closes a temporary sidebar when the backdrop is clicked',()=>{
    const h=boot();
    h.ui.openDrawer();
    assert(h.q('.zw-modern-root').classList.contains('is-drawer-open'));
    h.q('[data-zw-drawer-dismiss]').click();
    assert.strictEqual(h.q('.zw-modern-root').classList.contains('is-drawer-open'),false);
    h.destroy();
  });
});

describe('Task318 custom seek default-difference indicator',()=>{
  it('highlights a saved non-default seek magnitude even if its shortcut key is still default',()=>{
    const h=boot({'PARAM_CUSTOM_SEEK_1':-15});
    h.click('[data-zw-major="ショートカット"]');
    h.click('[data-zw-sub="ショートカット|シーク"]');
    const card=h.q('[data-zw-id="KEY_CUSTOM_SEEK_1"]');
    assert(card,'custom seek card should exist');
    assert.strictEqual(h.model.isDifferentFromDefault('KEY_CUSTOM_SEEK_1'),false);
    assert.strictEqual(h.model.isDifferentFromDefault('PARAM_CUSTOM_SEEK_1'),true);
    assert.strictEqual(card.classList.contains('is-modified'),true);
    h.destroy();
  });
});

describe('Task318 lifecycle and navigation restoration',()=>{
  it('restores moved legacy controls after the modern overlay is disposed',()=>{
    const h=boot();
    h.click('[data-zw-sub="再生・音声|提供画面"]');
    const input=h.q('[data-zw-id="supporterCredit.enable"] input[type=checkbox]');
    assert(input);
    assert(h.panel.contains(input));
    h.ui.dispose();
    assert.strictEqual(h.q('.zw-modern-root'),null);
    const original=h.dom.window.document.getElementById('legacy');
    assert(original.contains(input),'original input must not be destroyed');
    assert.strictEqual(input.dataset.settingName,'supporterCredit.enable');
    input.checked=false;h.dispatch(input,'change');
    assert.strictEqual(h.oldListenerCount(),1,'legacy event handlers should still be attached');
    h.dom.window.close();
  });
  it('restores the last selected subcategory and expanded sidebar groups',()=>{
    const saved={
      'zw-advanced-modern-selection':JSON.stringify({
        category:'ショートカット',subcategory:'シーク'}),
      'zw-advanced-modern-expanded':JSON.stringify([
        '再生・音声','コメント表示','ショートカット'])
    };
    const h=boot({},saved);
    assert.strictEqual(h.ui.selected.category,'ショートカット');
    assert.strictEqual(h.ui.selected.subcategory,'シーク');
    assert.strictEqual(h.ui.expanded.has('再生・音声'),true);
    assert.strictEqual(h.ui.expanded.has('コメント表示'),true);
    assert.strictEqual(h.ui.expanded.has('ショートカット'),true);
    assert(h.q('[data-zw-sub="ショートカット|シーク"]').classList.contains('is-active'));
    h.destroy();
  });
});

describe('Task318 comprehensive preference editor controls',()=>{
  it('edits shared NG strength and supports multiline NG words',()=>{
    const h=boot();
    h.click('[data-zw-major="NG・表示対象"]');
    h.click('[data-zw-sub="NG・表示対象|NG条件"]');
    const rule=h.q('[data-zw-id="wordFilter"]');
    const textarea=rule?.querySelector('textarea[data-setting-name="wordFilter"]');
    assert(textarea,'NG word list must use a multiline editor');
    textarea.value='word-one\nword-two';
    h.dispatch(textarea,'input');
    h.click('[data-zw-choice="sharedNgLevel"][data-zw-value="HIGH"]');
    assert.strictEqual(h.model.get('sharedNgLevel'),'HIGH');
    assert.strictEqual(h.model.get('wordFilter'),'word-one\nword-two');
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
  it('disables child NG controls on master OFF but preserves their draft',()=>{
    const h=boot();
    h.click('[data-zw-major="NG・表示対象"]');
    h.click('[data-zw-sub="NG・表示対象|NG条件"]');
    const parent=h.q('[data-zw-id="enableFilter"] input[type=checkbox]');
    assert(parent);
    parent.checked=false;h.dispatch(parent);
    const child=h.q('[data-zw-id="wordFilter"]');
    assert(child.classList.contains('is-disabled'));
    assert.strictEqual(child.querySelector('textarea').disabled,true);
    const strength=h.q('[data-zw-id="sharedNgLevel"]');
    const strengthChoice=strength.querySelector('[data-zw-value="HIGH"]');
    assert.strictEqual(strengthChoice.disabled,true);
    strengthChoice.click();
    assert.strictEqual(h.model.get('sharedNgLevel'),'MID');
    h.click('[data-zw-sub="NG・表示対象|コメント種別"]');
    const fork=h.q('[data-zw-id="filter.fork0"]');
    assert(fork.classList.contains('is-disabled'));
    assert.strictEqual(h.model.get('filter.fork0'),true);
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
  it('offers actual validated screen mode choices without immediate write',()=>{
    const h=boot();
    h.click('[data-zw-major="画面・映像"]');
    h.click('[data-zw-sub="画面・映像|表示モード"]');
    const mode=h.q('[data-zw-id="screenMode"]');
    assert(mode);
    const choices=[...mode.querySelectorAll('[data-zw-choice]')];
    assert.strictEqual(choices.length,6);
    h.click('[data-zw-choice="screenMode"][data-zw-value="sideView"]');
    assert.strictEqual(h.model.get('screenMode'),'sideView');
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
});

describe('Task318 history controls use validated schema',()=>{
  it('disables history-limit slider while fetching is off and retains the limit',()=>{
    const h=boot();
    h.click('[data-zw-major="コメント表示"]');
    h.click('[data-zw-sub="コメント表示|追加取得"]');
    const row=h.q('[data-zw-id="commentHistory.maxAdditionalComments"]');
    assert(row);
    const slider=row.querySelector('input[type=range]');
    assert(slider);
    assert.strictEqual(Number(slider.min),1);
    assert.strictEqual(Number(slider.max),20000);
    assert.strictEqual(slider.disabled,true);
    const enabled=h.q('[data-zw-id="commentHistory.enabled"] input[type=checkbox]');
    enabled.checked=true;h.dispatch(enabled);
    assert.strictEqual(row.querySelector('input[type=range]').disabled,false);
    row.querySelector('input[type=range]').value='7500';
    h.dispatch(row.querySelector('input[type=range]'),'input');
    assert.strictEqual(h.model.get('commentHistory.maxAdditionalComments'),7500);
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
});

describe('Task318 custom link reset and global draft consistency',()=>{
  const savedLink={id:'before',label:'Old Link',
    url:'https://example.com/video/{videoId}',enabled:true,openInNewTab:true};
  it('resets saved custom links only in the global draft and commits the reset once',()=>{
    const h=boot({'relatedMenu.customLinks':[savedLink]});
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
    assert.strictEqual(h.all('[data-rl-row]').length,1);
    h.click('[data-zw-reset-item="relatedMenu.customLinks"]');
    assert.strictEqual(h.model.get('relatedMenu.customLinks').length,0);
    assert.strictEqual(h.all('[data-rl-row]').length,0);
    assert.strictEqual(h.config.values['relatedMenu.customLinks'].length,1);
    h.click('[data-zw-save]');
    assert.strictEqual(h.config.values['relatedMenu.customLinks'].length,0);
    h.destroy();
  });
  it('includes the related editor in a category reset without silently reverting it',()=>{
    const h=boot({'relatedMenu.customLinks':[savedLink]});
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
    h.click('[data-zw-reset-category]');
    assert.strictEqual(h.model.get('relatedMenu.customLinks').length,0);
    assert.strictEqual(h.all('[data-rl-row]').length,0);
    assert.strictEqual(h.config.writes.length,0);
    h.click('[data-zw-save]');
    assert.strictEqual(h.config.values['relatedMenu.customLinks'].length,0);
    h.destroy();
  });
});

describe('Task318 compact inline card geometry',()=>{
  it('places simple toggles inline without making numeric controls cramped',()=>{
    const h=boot();
    h.click('[data-zw-sub="再生・音声|提供画面"]');
    const toggle=h.q('[data-zw-id="supporterCredit.enable"]');
    assert(toggle.classList.contains('is-inline'));
    assert.strictEqual(toggle.querySelector('input[type=checkbox]')!==null,true);
    h.click('[data-zw-major="画面・映像"]');
    h.click('[data-zw-sub="画面・映像|画面フィルター"]');
    assert(!h.q('[data-zw-id="screenFilter.gamma"]').classList.contains('is-inline'));
    h.destroy();
  });
  it('keeps compact keyboard-only shortcuts inline and custom seek composite cards stacked',()=>{
    const h=boot();
    h.click('[data-zw-major="ショートカット"]');
    h.click('[data-zw-sub="ショートカット|再生操作"]');
    assert(h.q('[data-zw-id="KEY_TOGGLE_PLAY"]').classList.contains('is-inline'));
    h.click('[data-zw-sub="ショートカット|シーク"]');
    h.click('[data-zw-add-seek]');
    assert(!h.q('[data-zw-id="KEY_CUSTOM_SEEK_1"]').classList.contains('is-inline'));
    h.destroy();
  });
});

describe('Task318 comment history navigation migration',()=>{
  it('moves a saved comment-increase selection under comment display',()=>{
    const h=boot({},{
      'zw-advanced-modern-selection':JSON.stringify({
        category:'コメント増量',subcategory:'追加取得'}),
      'zw-advanced-modern-expanded':JSON.stringify(['コメント増量'])
    });
    assert.strictEqual(h.ui.selected.category,'コメント表示');
    assert.strictEqual(h.ui.selected.subcategory,'追加取得');
    assert(h.ui.expanded.has('コメント表示'));
    assert.strictEqual(h.all('[data-zw-major]').length,7);
    assert(h.q('[data-zw-id="commentHistory.enabled"]'));
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
});

describe('Task318 beginner-friendly search preferences',()=>{
  it('distinguishes suggestions, hit-count traffic and playlist load limits',()=>{
    const h=boot();
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|検索"]');
    const guide=h.q('.zw-modern-search-guide');
    assert(guide);
    for(const part of ['タグ候補・動画の予測','ヒット件数','プレイリストの読み込み']){
      assert(guide.textContent.includes(part));
    }
    assert(h.q('[data-zw-id="videoSearch.wordCountMode"]'));
    assert(h.q('[data-zw-id="videoSearch.videoIdSuggestMode"]'));
    assert(h.q('[data-zw-id="search.limit"]'));
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
  it('offers three explained modes without writing until the global save',()=>{
    const h=boot();
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|検索"]');
    const card=h.q('[data-zw-id="videoSearch.wordCountMode"]');
    assert(card.textContent.includes('必要なときだけ'));
    assert(card.textContent.includes('自動で表示'));
    assert(card.textContent.includes('件数を表示しない'));
    h.click('[data-zw-choice="videoSearch.wordCountMode"][data-zw-value="auto"]');
    assert.strictEqual(h.model.get('videoSearch.wordCountMode'),'auto');
    assert.strictEqual(h.config.writes.length,0);
    h.click('[data-zw-cancel]');
    assert.strictEqual(h.model.get('videoSearch.wordCountMode'),'on-demand');
    h.click('[data-zw-choice="videoSearch.wordCountMode"][data-zw-value="off"]');
    h.click('[data-zw-save]');
    assert.strictEqual(h.config.values['videoSearch.wordCountMode'],'off');
    h.destroy();
  });
});
describe('Task318 unified related menu order editor',()=>{
  const open=h=>{
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
  };
  const keys=h=>h.all('[data-zw-order-key]').map(el=>el.dataset.zwOrderKey);
  it('shows all seven built-in actions with drag grips and up/down buttons',()=>{
    const h=boot();open(h);
    assert.deepStrictEqual(keys(h),[
      'builtin:official','builtin:ad','builtin:twitter','builtin:original',
      'builtin:tree','builtin:tree-playlist','builtin:copy-url']);
    assert.strictEqual(h.all('[data-zw-order-grip]').length,7);
    assert.strictEqual(h.q('[data-zw-order-up="builtin:official"]').disabled,true);
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
  it('reorders built-ins as a draft and supports global cancel/save/reset',()=>{
    const h=boot();open(h);
    h.click('[data-zw-order-down="builtin:official"]');
    assert.deepStrictEqual(keys(h).slice(0,2),['builtin:ad','builtin:official']);
    assert.strictEqual(h.config.writes.length,0);
    h.click('[data-zw-cancel]');
    assert.deepStrictEqual(keys(h).slice(0,2),['builtin:official','builtin:ad']);
    h.click('[data-zw-order-down="builtin:official"]');
    h.click('[data-zw-save]');
    assert.deepStrictEqual(Array.from(h.config.values['relatedMenu.order']).slice(0,2),
      ['builtin:ad','builtin:official']);
    h.click('[data-zw-reset-item="relatedMenu.order"]');
    assert.deepStrictEqual(keys(h).slice(0,2),['builtin:official','builtin:ad']);
    assert.strictEqual(h.config.values['relatedMenu.order'][0],'builtin:ad');
    h.destroy();
  });
  it('moves mixed entries by drag and keeps registered action positions on unsubscribe',()=>{
    const h=boot();open(h);
    const unregister=h.ui.relatedActions.register({id:'test-action',label:'登録アクション',action(){}});
    assert(keys(h).includes('action:test-action'));
    const grip=h.q('[data-zw-order-grip="action:test-action"]');
    const drag=new h.dom.window.Event('dragstart',{bubbles:true,cancelable:true});
    drag.dataTransfer={effectAllowed:'',setData(){}};
    grip.dispatchEvent(drag);
    assert(grip.closest('li').classList.contains('is-dragging'));
    const first=h.q('[data-zw-order-key="builtin:official"]');
    const over=new h.dom.window.Event('dragover',{bubbles:true,cancelable:true});
    first.dispatchEvent(over);
    assert(over.defaultPrevented);
    assert(first.classList.contains('is-drop-before'));
    first.dispatchEvent(new h.dom.window.Event('drop',{bubbles:true,cancelable:true}));
    assert.strictEqual(keys(h)[0],'action:test-action');
    unregister();
    assert(keys(h).includes('action:test-action'));
    assert(h.q('[data-zw-order-key="action:test-action"]').classList.contains('is-missing'));
    h.destroy();
  });
  it('supports keyboard move with Alt+ArrowUp and retains order without saving',()=>{
    const h=boot();open(h);
    const grip=h.q('[data-zw-order-grip="builtin:ad"]');
    grip.focus();
    grip.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{
      key:'ArrowUp',altKey:true,bubbles:true,cancelable:true}));
    assert.strictEqual(keys(h)[0],'builtin:ad');
    assert.strictEqual(h.config.writes.length,0);
    assert(h.q('[data-zw-order-status]').textContent.includes('移動'));
    h.destroy();
  });
});

describe('Task318 related-menu row visibility switches',()=>{
  const open=h=>{
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
  };
  it('stages a hidden standard item, cancels, then saves without deleting it',()=>{
    const h=boot();open(h);
    let checkbox=h.q('[data-zw-order-visible="builtin:ad"]');
    assert(checkbox.checked);
    checkbox.checked=false;h.dispatch(checkbox);
    assert(h.q('[data-zw-id="relatedMenu.order"]').classList.contains('is-modified'));
    assert.deepStrictEqual(Array.from(h.model.get('relatedMenu.hiddenItems')),['builtin:ad']);
    assert.strictEqual(h.config.writes.length,0);
    h.click('[data-zw-cancel]');
    checkbox=h.q('[data-zw-order-visible="builtin:ad"]');
    assert(checkbox.checked);
    checkbox.checked=false;h.dispatch(checkbox);
    h.click('[data-zw-save]');
    assert.deepStrictEqual(Array.from(h.config.values['relatedMenu.hiddenItems']),['builtin:ad']);
    h.destroy();
  });
  it('restores row visibility together with category reset',()=>{
    const h=boot({'relatedMenu.hiddenItems':['builtin:copy-url']});open(h);
    assert(!h.q('[data-zw-order-visible="builtin:copy-url"]').checked);
    h.click('[data-zw-reset-item="relatedMenu.order"]');
    assert(!h.q('[data-zw-order-visible="builtin:copy-url"]').checked);
    h.click('[data-zw-reset-category]');
    assert(h.q('[data-zw-order-visible="builtin:copy-url"]').checked);
    h.destroy();
  });
});

describe('Task318 video overlay display settings',()=>{
  it('organizes six optional icons in 画面・映像 / 表示・非表示',()=>{
    const h=boot();
    h.click('[data-zw-major="画面・映像"]');
    h.click('[data-zw-sub="画面・映像|表示・非表示"]');
    const fields=h.all('[data-zw-id^="ui.hover."]');
    assert.strictEqual(fields.length,6);
    assert(h.q('.zw-modern-search-guide').textContent.includes('閉じる'));
    assert(!h.q('[data-zw-id="ui.hover.close"]'));
    assert.strictEqual(h.config.writes.length,0);
    h.destroy();
  });
  it('stages toggle changes and restores them with cancel',()=>{
    const h=boot();h.click('[data-zw-major="画面・映像"]');
    h.click('[data-zw-sub="画面・映像|表示・非表示"]');
    let input=h.q('[data-zw-id="ui.hover.like"] input[type=checkbox]');
    assert(input.checked);
    input.checked=false;h.dispatch(input);
    assert.strictEqual(h.model.get('ui.hover.like'),false);
    assert.strictEqual(h.config.values['ui.hover.like'],true);
    h.click('[data-zw-cancel]');
    input=h.q('[data-zw-id="ui.hover.like"] input[type=checkbox]');
    assert(input.checked);
    input.checked=false;h.dispatch(input);
    h.click('[data-zw-save]');
    assert.strictEqual(h.config.values['ui.hover.like'],false);
    h.destroy();
  });
});
describe('Task318 clear icon previews and safe container visibility',()=>{
  const open=h=>{
    h.click('[data-zw-major="画面・映像"]');
    h.click('[data-zw-sub="画面・映像|表示・非表示"]');
  };
  it('keeps long legacy icons on one line without replacing their glyphs',()=>{
    const h=boot();open(h);
    try{
      const cases=[
        ['ui.bar.speed','1.0×','is-compact-glyph'],
        ['ui.bar.time','1:23','is-compact-glyph'],
        ['ui.bar.volume','━●','is-pair-glyph'],
        ['ui.info.credits','広告','is-pair-glyph']
      ];
      for(const [id,glyph,cssClass] of cases){
        const icon=h.q('[data-zw-id="'+id+'"] [data-zw-visibility-icon]');
        assert(icon,id);
        assert.strictEqual(icon.textContent,glyph);
        assert(icon.classList.contains(cssClass),id);
        assert.strictEqual(icon.querySelector('svg'),null);
        assert.strictEqual(h.dom.window.getComputedStyle(icon).whiteSpace,'nowrap',id);
      }
      const style=h.dom.window.document.querySelector('style[data-zw-modern-ui]');
      assert(style.textContent.includes('white-space:nowrap; overflow:hidden'));
      assert(style.textContent.includes('.zw-modern-visibility-icon.is-compact-glyph'));
      assert(style.textContent.includes('.zw-modern-visibility-icon.is-pair-glyph'));
    }finally{h.destroy();}
  });
  it('renders exactly seven Task391 SVG additions without replacing the three Task390 glyphs',()=>{
    const h=boot();open(h);
    try{
      const originals=[
        ['ui.bar.fullscreen','⛶'],['ui.bar.settings','⚙'],['ui.header.search','⌕']
      ];
      for(const [id,glyph] of originals){
        const icon=h.q('[data-zw-id="'+id+'"] [data-zw-visibility-icon]');
        assert(icon,id);
        assert.strictEqual(icon.textContent,glyph,id);
        assert.strictEqual(icon.querySelector('svg'),null,id);
      }
      for(const id of ['showComment','enableCommentPanel','enableCommentPreview',
        'enableHeatMap','enableStoryboard','enableStoryboardBar','enableAdDecoration']){
        const icon=h.q('[data-zw-id="'+id+'"] [data-zw-visibility-icon] svg');
        assert(icon&&icon.querySelector('path'),'new shared SVG must remain: '+id);
      }
    }finally{h.destroy();}
  });
  it('shows faithful, decorative icons alongside all eight setting labels',()=>{
    const h=boot();open(h);
    const expected=[
      ['ui.hover.like','♡'],['ui.hover.tweet','t'],
      ['ui.hover.mylist','My'],['ui.hover.watchLater','✚'],
      ['ui.hover.comments','💬'],['ui.relatedMenu','関連メニュー'],
      ['ui.commentInput','コメント入力(C)']
    ];
    for(const [id,glyph] of expected){
      const icon=h.q('[data-zw-id="'+id+'"] [data-zw-visibility-icon]');
      assert(icon,id);
      assert(icon.textContent.includes(glyph),id);
      assert.strictEqual(icon.dataset.zwVisibilityIcon,id);
      assert.strictEqual(icon.getAttribute('aria-hidden'),'true');
    }
    const shield=h.q('[data-zw-id="ui.hover.ngFilter"] .zw-modern-visibility-icon svg');
    assert(shield && shield.querySelectorAll('path').length===2);
    assert.strictEqual(h.all('[data-zw-visibility-icon]').length,
      h.ui.model.sectionDescriptors('画面・映像','表示・非表示').length);
    assert(h.all('[data-zw-visibility-icon]').length>=30);
    h.destroy();
  });
  it('stages both container controls and restores them with Cancel',()=>{
    const h=boot();open(h);
    for(const key of ['ui.relatedMenu','ui.commentInput']){
      const checkbox=h.q('[data-zw-id="'+key+'"] input[type=checkbox]');
      assert(checkbox.checked,key);
      checkbox.checked=false;h.dispatch(checkbox);
      assert.strictEqual(h.model.get(key),false);
      assert.strictEqual(h.config.values[key],true);
    }
    assert.strictEqual(h.config.writes.length,0);
    h.click('[data-zw-cancel]');
    assert.strictEqual(h.model.get('ui.relatedMenu'),true);
    assert.strictEqual(h.model.get('ui.commentInput'),true);
    for(const key of ['ui.relatedMenu','ui.commentInput']){
      const checkbox=h.q('[data-zw-id="'+key+'"] input[type=checkbox]');
      assert(checkbox.checked,key);
      checkbox.checked=false;h.dispatch(checkbox);
    }
    h.click('[data-zw-save]');
    assert.strictEqual(h.config.values['ui.relatedMenu'],false);
    assert.strictEqual(h.config.values['ui.commentInput'],false);
    h.destroy();
  });
});

describe('Task318 centralized visibility groups',()=>{
  const open=h=>{
    h.click('[data-zw-major="画面・映像"]');
    h.click('[data-zw-sub="画面・映像|表示・非表示"]');
  };
  it('presents every manifest entry with an icon and stable groups',()=>{
    const h=boot();open(h);
    const registry=h.ui.model.descriptors.filter(item=>item.visibilityScope);
    assert(registry.length>=30);
    assert.strictEqual(h.all('[data-zw-visibility-icon]').length,registry.length+7);
    assert.deepStrictEqual(h.all('[data-zw-visibility-group]').map(x=>x.dataset.zwVisibilityGroup),
      ['hover','related','comment','bar','scene','info','header','shared']);
    for(const d of registry){
      assert(h.q('[data-zw-id="'+d.id+'"] [data-zw-visibility-icon]'),d.id);
      assert.strictEqual(h.model.get(d.id),true);
    }
    h.destroy();
  });

});


describe('Task391 shared visibility placements',()=>{
  const ids=['showComment','enableCommentPanel','enableCommentPreview',
    'enableHeatMap','enableStoryboard','enableStoryboardBar','enableAdDecoration'];
  const select=(h,category,subcategory)=>{
    h.ui.selected={category,subcategory};h.ui.searchTerm='';
    h.ui._renderCards();h.ui._refreshFooter();
  };
  const check=(h,id)=>h.q('[data-zw-id="'+id+'"] input[type=checkbox]');
  for(const id of ids){
    it('shares '+id+' across original and display placements without duplicate storage',()=>{
      const h=boot();try{
        const descriptor=h.model.descriptor(id),initial=h.model.get(id);
        const original={category:descriptor.category,subcategory:descriptor.subcategory};
        select(h,'画面・映像','表示・非表示');
        const alias=check(h,id);assert(alias,'visibility alias is rendered');
        assert(h.q('[data-zw-visibility-icon="'+id+'"] svg'),'device-independent SVG');
        assert(h.q('[data-zw-id="'+id+'"] [data-zw-shared-setting]'),'shared-value annotation');
        alias.checked=!initial;h.dispatch(alias);
        assert.strictEqual(h.model.changes().length,1);
        select(h,original.category,original.subcategory);
        assert.strictEqual(check(h,id).checked,!initial);
        assert.strictEqual(h.config.writes.length,0);
        h.click('[data-zw-save]');
        assert.deepStrictEqual(h.config.writes,[[id,!initial]]);
        select(h,'画面・映像','表示・非表示');
        assert.strictEqual(check(h,id).checked,!initial);
        check(h,id).checked=initial;h.dispatch(check(h,id));
        h.click('[data-zw-cancel]');
        select(h,original.category,original.subcategory);
        assert.strictEqual(check(h,id).checked,!initial);
        assert.strictEqual(h.model.descriptors.filter(d=>d.id===id).length,1);
        assert.strictEqual(h.model.search(id).filter(d=>d.id===id).length,1);
      }finally{h.destroy();}
    });
  }
  it('resets shared controls only with the visible section and preserves unrelated drafts',()=>{
    const h=boot({showComment:false,enableHeatMap:false,screenMode:'small',
      'supporterCredit.enable':false});try{
      select(h,'画面・映像','表示・非表示');
      h.click('[data-zw-reset-category]');
      assert.strictEqual(h.model.get('showComment'),true);
      assert.strictEqual(h.model.get('enableHeatMap'),true);
      assert.strictEqual(h.model.get('screenMode'),'small');
      assert.strictEqual(h.model.get('supporterCredit.enable'),false);
      h.click('[data-zw-cancel]');
      assert.strictEqual(h.model.get('showComment'),false);
      const original=h.model.descriptor('enableHeatMap');
      select(h,original.category,original.subcategory);
      h.click('[data-zw-reset-category]');
      assert.strictEqual(h.model.get('enableHeatMap'),true);
      assert.strictEqual(h.model.get('showComment'),false);
    }finally{h.destroy();}
  });
});

describe('Task391 native checkbox presentation',()=>{
  it('suppresses the toggle thumb on compact native related-menu checkboxes',()=>{
    const h=boot();try{
      const rules=[...h.dom.window.document.styleSheets].flatMap(s=>[...s.cssRules]);
      const nativeThumb=rules.find(r=>r.selectorText===
        '.zw-modern-order-row .zw-order-visible input[type=checkbox]::after');
      assert(nativeThumb,'native checkbox must explicitly opt out of toggle thumb');
      assert.strictEqual(nativeThumb.style.getPropertyValue('content'),'none');
    }finally{h.destroy();}
  });
});

describe('Task396 C-style compact related-menu editor',()=>{
  const open=h=>{
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
  };
  it('uses one compact icon-free list with drag grips, editable builtins and draft save',()=>{
    const h=boot();open(h);
    try{
      assert.strictEqual(h.all('.zw-modern-order-row').length,7);
      assert(h.q('.zw-modern-order-compact'));
      assert.strictEqual(h.all('.zw-modern-order-row svg').length,0);
      assert.strictEqual(h.all('[data-zw-order-grip]').length,7);
      h.click('[data-zw-order-edit="builtin:official"]');
      const input=h.q('[data-zw-builtin-field="label"][data-zw-builtin-id="official"]');
      assert(input);
      input.value='公式で観る';h.dispatch(input,'input');
      assert.strictEqual(h.q('[data-zw-order-key="builtin:official"] .zw-order-name').textContent,
        '公式で観る');
      assert.strictEqual(h.config.writes.length,0);
      assert.strictEqual(h.model.get('relatedMenu.builtinOptions').official.label,'公式で観る');
      h.click('[data-zw-cancel]');
      assert.strictEqual(Object.keys(h.model.get('relatedMenu.builtinOptions')).length,0);
      if(!h.q('[data-zw-builtin-field="label"][data-zw-builtin-id="official"]')){
        h.click('[data-zw-order-edit="builtin:official"]');
      }
      const text=h.q('[data-zw-builtin-field="label"][data-zw-builtin-id="official"]');
      text.value='公式で観る';h.dispatch(text,'input');
      h.click('[data-zw-save]');
      assert.strictEqual(h.config.values['relatedMenu.builtinOptions'].official.label,
        '公式で観る');
    }finally{h.destroy();}
  });
  it('supports new-window dimensions and the video-ID-only copy choice',()=>{
    const h=boot();open(h);
    try{
      h.click('[data-zw-order-edit="builtin:ad"]');
      const mode=h.q('[data-zw-builtin-field="openMode"][data-zw-builtin-id="ad"]');
      mode.value='new-window';h.dispatch(mode,'change');
      const width=h.q('[data-zw-builtin-field="popupWidth"][data-zw-builtin-id="ad"]');
      assert(width);
      width.value='650';h.dispatch(width,'input');
      h.click('[data-zw-order-edit="builtin:copy-url"]');
      const copy=h.q('[data-zw-builtin-field="copyFormat"][data-zw-builtin-id="copy-url"]');
      assert([...copy.options].some(option=>option.value==='id'));
      copy.value='id';h.dispatch(copy,'change');
      assert.strictEqual(h.model.get('relatedMenu.builtinOptions').ad.popupWidth,650);
      assert.strictEqual(h.model.get('relatedMenu.builtinOptions')['copy-url'].copyFormat,'id');
      h.click('[data-zw-save]');
      assert.strictEqual(h.config.values['relatedMenu.builtinOptions']['copy-url'].copyFormat,'id');
      assert.strictEqual(h.config.values['relatedMenu.builtinOptions'].ad.openMode,'new-window');
    }finally{h.destroy();}
  });
  it('keeps all eight URL variables with descriptions and inserts at caret',()=>{
    const h=boot();open(h);
    try{
      h.click('[data-zw-order-edit="builtin:twitter"]');
      const field=h.q('[data-zw-builtin-field="urlTemplate"][data-zw-builtin-id="twitter"]');
      field.value='https://example.org/search?q=';
      h.dispatch(field,'input');
      const buttons=h.all('[data-zw-builtin-insert][data-zw-builtin-id="twitter"]');
      assert.strictEqual(buttons.length,8);
      assert(h.q('.zw-order-variable-palette').textContent.includes('投稿者'));
      h.click('[data-zw-builtin-insert="videoId"][data-zw-builtin-id="twitter"]');
      assert.strictEqual(h.model.get('relatedMenu.builtinOptions').twitter.urlTemplate,
        'https://example.org/search?q={videoId}');
      assert.strictEqual(h.config.writes.length,0);
      const customHelp=h.q('.zenzaRelatedLinksEditor .rl-help');
      assert(customHelp.textContent.includes('8種類'));
      h.click('[data-zw-cancel]');
      assert.strictEqual(h.model.get('relatedMenu.builtinOptions').twitter,undefined);
    }finally{h.destroy();}
  });
  it('shares canonical shortcut keys across both editors and warns on duplicate drafts',()=>{
    const h=boot();open(h);
    try{
      h.click('[data-zw-order-edit="builtin:official"]');
      const record=h.q('[data-zw-record="KEY_OPEN_GINZA"]');
      assert(record);
      record.click();
      h.dom.window.document.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{
        keyCode:32,key:' ',bubbles:true,cancelable:true}));
      assert.strictEqual(h.model.get('KEY_OPEN_GINZA'),32);
      assert.strictEqual(h.config.values.KEY_OPEN_GINZA,0);
      assert(h.q('[data-zw-order-key="builtin:official"] .zw-order-key-preview')
        .textContent.includes('重複'));
      h.click('[data-zw-major="ショートカット"]');
      h.click('[data-zw-sub="ショートカット|その他"]');
      assert(h.q('[data-zw-id="KEY_OPEN_GINZA"]'));
      assert.strictEqual(h.model.get('KEY_OPEN_GINZA'),32);
      h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
      assert(h.q('[data-zw-order-key="builtin:official"] .zw-order-key-preview')
        .textContent.includes('重複'));
      h.click('[data-zw-cancel]');
      assert.strictEqual(h.model.get('KEY_OPEN_GINZA'),0);
      assert.strictEqual(h.config.values.KEY_OPEN_GINZA,0);
    }finally{h.destroy();}
  });
  it('warns custom links about a canonical shortcut changed only in the draft',()=>{
    const h=boot();open(h);
    try{
      h.model.set('KEY_OPEN_GINZA',86);
      const editor=h.ui.relatedEditor;
      editor.draft=[{id:'dup',label:'重複リンク',url:'https://example.org/{videoId}',
        enabled:true,openInNewTab:true,shortcutKey:86}];
      editor._render();
      const warning=h.q('[data-rl-shortcut-warning]');
      assert(warning.textContent.includes('重複'),warning.textContent);
      assert(warning.textContent.includes('OPEN_GINZA'),warning.textContent);
      assert.strictEqual(h.config.values.KEY_OPEN_GINZA,0);
      assert.strictEqual(h.config.writes.length,0);
      h.click('[data-zw-cancel]');
      assert.strictEqual(h.model.get('KEY_OPEN_GINZA'),0);
    }finally{h.destroy();}
  });
  it('clears pending touch ownership when cancel replaces the list',()=>{
    const h=boot();open(h);
    try{
      h.model.set('relatedMenu.hiddenItems',['builtin:ad']);
      h.ui._refreshFooter();
      assert.strictEqual(h.q('[data-zw-cancel]').disabled,false);
      const grip=h.q('[data-zw-order-grip="builtin:ad"]');
      h.ui._onTouchOrderDown({pointerType:'touch',pointerId:7,target:grip});
      assert(h.ui._touchOrder);
      h.click('[data-zw-cancel]');
      assert.strictEqual(h.ui._touchOrder,null);
    }finally{h.destroy();}
  });
  it('recovers cleanly when the browser has already released pointer capture',()=>{
    const h=boot();open(h);
    try{
      const grip=h.q('[data-zw-order-grip="builtin:ad"]');
      h.ui._onTouchOrderDown({pointerType:'touch',pointerId:9,target:grip});
      grip.releasePointerCapture=()=>{throw new h.dom.window.DOMException('released','NotFoundError');};
      assert.doesNotThrow(()=>h.ui._clearTouchOrder());
      assert.strictEqual(h.ui._touchOrder,null);
    }finally{h.destroy();}
  });
  it('retains keyboard drag and long-press touch reorder without immediate saving',async()=>{
    const h=boot();open(h);
    try{
      const grip=h.q('[data-zw-order-grip="builtin:ad"]');
      h.ui._onTouchOrderDown({pointerType:'touch',pointerId:7,target:grip});
      await new Promise(resolve=>setTimeout(resolve,300));
      assert(h.ui._touchOrder?.active);
      const first=h.q('[data-zw-order-key="builtin:official"]');
      h.ui.doc.elementFromPoint=()=>first;
      h.ui._onTouchOrderMove({pointerId:7,target:grip,clientX:20,clientY:15,
        preventDefault(){}});
      h.ui._onTouchOrderUp({pointerId:7});
      assert.strictEqual(h.q('[data-zw-order-key]').dataset.zwOrderKey,'builtin:ad');
      assert.strictEqual(h.config.writes.length,0);
      h.click('[data-zw-cancel]');
      assert.strictEqual(h.q('[data-zw-order-key]').dataset.zwOrderKey,'builtin:official');
    }finally{h.destroy();}
  });
});


describe('Task398 right-hand related menu detail panel',()=>{
  const open=h=>{
    h.click('[data-zw-major="プレイリスト・検索"]');
    h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
  };
  it('keeps exactly one selected detail outside the sortable list',()=>{
    const h=boot();open(h);
    try{
      const split=h.q('.zw-order-workspace');assert(split);
      const pane=h.q('[data-zw-order-detail-pane]');assert(pane);
      assert.strictEqual(h.all('.zw-modern-order-list .zw-order-details').length,0);
      assert.strictEqual(h.all('[data-zw-order-details]').length,1);
      h.click('[data-zw-order-edit="builtin:copy-url"]');
      assert(pane.parentNode || h.q('[data-zw-order-detail-pane]'));
      assert(h.q('[data-zw-order-detail-pane] [data-zw-builtin-field="copyFormat"]'));
      assert.strictEqual(h.all('[data-zw-order-details]').length,1);
      assert.strictEqual(h.all('.zw-modern-order-row svg').length,0);
      h.click('[data-zw-order-up="builtin:copy-url"]');
      assert(h.q('[data-zw-order-detail-pane] [data-zw-builtin-field="copyFormat"]'));
    }finally{h.destroy();}
  });
  it('adds and edits a copy item in the right pane while keeping the draft until save',()=>{
    const h=boot();open(h);
    try{
      h.click('[data-zw-order-add-copy]');
      const pane=h.q('[data-zw-order-detail-pane]');
      const input=pane.querySelector('[data-rl-field="copyTemplate"]');assert(input);
      input.value='{videoTitle}\n{videoId}';h.dispatch(input,'input');
      const label=pane.querySelector('[data-rl-field="label"]');
      label.value='IDとタイトル';h.dispatch(label,'input');
      const item=h.model.get('relatedMenu.customLinks')[0];
      assert.strictEqual(item.kind,'copy');
      assert.strictEqual(item.copyTemplate,'{videoTitle}\n{videoId}');
      assert.strictEqual(h.config.writes.length,0);
      h.click('[data-zw-order-edit="builtin:official"]');
      h.click('[data-zw-order-edit="link:'+item.id+'"]');
      assert.strictEqual(h.q('[data-zw-order-detail-pane] [data-rl-field="copyTemplate"]').value,
        '{videoTitle}\n{videoId}');
      h.click('[data-zw-save]');
      assert.strictEqual(h.config.values['relatedMenu.customLinks'][0].kind,'copy');
      assert.strictEqual(h.config.values['relatedMenu.customLinks'][0].label,'IDとタイトル');
      h.click('[data-zw-order-add-copy]');h.click('[data-zw-cancel]');
      assert.strictEqual(h.model.get('relatedMenu.customLinks').length,1);
    }finally{h.destroy();}
  });
});

describe('Task398 custom editor search recovery',()=>{
  it('leaves the custom editor visible when global search shows it outside the split pane',()=>{
    const h=boot();
    try{
      h.click('[data-zw-major="プレイリスト・検索"]');
      h.click('[data-zw-sub="プレイリスト・検索|関連メニュー › カスタムリンク"]');
      assert.strictEqual(h.ui.relatedEditor.container.hidden,true);
      const input=h.q('[data-zw-search]');input.value='カスタム関連メニューのリンク';
      h.dispatch(input,'input');
      assert(h.q('[data-zw-id="relatedMenu.customLinks"]'));
      assert.strictEqual(h.ui.relatedEditor.container.hidden,false);
      assert.strictEqual(h.ui.relatedEditor.container.classList.contains('is-detail-only'),false);
    }finally{h.destroy();}
  });
});


describe('Task401 full-viewport comment setting synchronization',()=>{
  const openComments=h=>{
    h.ui.selected={category:'コメント表示',subcategory:'表示・配置'};
    h.ui.searchTerm='';
    h.ui._renderCards();
    h.ui._refreshFooter();
    return h.q('[data-zw-id="backComment"] input[type=checkbox]');
  };
  it('reflects player/shortcut changes live without losing other drafts',()=>{
    const h=boot({backComment:false});
    try{
      const input=openComments(h);
      assert(input);
      assert(input.closest('[data-zw-id]').textContent.includes('画面全体に流す'));
      assert.strictEqual(input.checked,false);
      h.model.set('supporterCredit.voice',false);
      h.config.setValue('backComment',true);
      assert.strictEqual(input.checked,true);
      assert.strictEqual(h.model.get('backComment'),true);
      assert.strictEqual(h.model.get('supporterCredit.voice'),false);
      assert.deepStrictEqual(Array.from(h.model.changes(),c=>c.id),['supporterCredit.voice']);
      h.ui._refreshFooter();h.click('[data-zw-save]');
      assert.strictEqual(h.config.values.backComment,true);
    }finally{h.destroy();}
  });
  it('saves the advanced toggle through the original Config key, and removes listeners',()=>{
    const h=boot({backComment:true});
    try{
      const input=openComments(h);
      assert.strictEqual(input.checked,true);
      input.checked=false;h.dispatch(input);
      assert.strictEqual(h.config.values.backComment,true,'unsaved advanced changes stay in draft');
      assert.deepStrictEqual(Array.from(h.model.changes(),c=>c.id),['backComment']);
      h.click('[data-zw-save]');
      assert.strictEqual(h.config.values.backComment,false);
      assert.deepStrictEqual(h.config.writes,[['backComment',false]]);
      assert.strictEqual(h.model.get('backComment'),false);
    }finally{
      h.destroy();
      assert.strictEqual(h.config.listeners.get('backComment').size,0);
    }
  });
});


describe('Task710 SCUI00 gallery click regression',function(){
  this.timeout(20000); // Cold JSDOM/advanced-settings initialization can exceed Mocha's 2s default.
  const open=h=>{
    h.click('[data-zw-major="画面・映像"]');
    h.click('[data-zw-sub="画面・映像|シーンサーチ"]');
  };
  const option=(mode,id)=>'[data-zw-scene-layout="'+id+'"]'+
    '[data-zw-scene-layout-mode="'+mode+'"]';
  const tab=mode=>'button[data-zw-scene-layout-mode="'+mode+'"]'+
    ':not([data-zw-scene-layout])';
  it('allows 00 from 01, stages a single edit and persists only on Save',()=>{
    const h=boot({'sceneSearch.layout.normal':'01'});open(h);
    try{
      assert.strictEqual(h.q(option('normal','00')).disabled,false);
      assert.strictEqual(h.q(option('normal','00')).getAttribute('aria-pressed'),'false');
      h.click(option('normal','00'));
      assert.strictEqual(h.model.get('sceneSearch.layout.normal'),'00');
      assert.strictEqual(h.config.getValue('sceneSearch.layout.normal'),'01');
      assert.strictEqual(h.q(option('normal','00')).getAttribute('aria-pressed'),'true');
      assert.strictEqual(h.model.changes().map(change=>change.id).join(','),
        'sceneSearch.layout.normal');
      assert(h.q('[data-zw-dirty]').textContent.includes('1件'));
      h.click('[data-zw-save]');
      assert.deepStrictEqual(h.config.writes,[['sceneSearch.layout.normal','00']]);
    }finally{h.destroy();}
  });
  it('accepts fullscreen 00 independently and honors linked fullscreen lock',()=>{
    const h=boot({'sceneSearch.layout.normal':'01',
      'sceneSearch.layout.fullscreen':'02'});open(h);
    try{
      h.click(tab('fullscreen'));
      h.click(option('fullscreen','00'));
      assert.strictEqual(h.model.get('sceneSearch.layout.fullscreen'),'00');
      assert.strictEqual(h.model.get('sceneSearch.layout.normal'),'01');
      h.model.set('sceneSearch.layout.linkFullscreen',true);
      h.ui._renderCards();
      assert.strictEqual(h.q(option('fullscreen','00')).disabled,true);
      h.click(option('fullscreen','01'));
      assert.strictEqual(h.model.get('sceneSearch.layout.fullscreen'),'00');
      h.model.set('sceneSearch.layout.linkFullscreen',false);
      h.ui._renderCards();
      h.click(tab('normal'));
      h.click(option('normal','00'));
      assert.strictEqual(h.model.get('sceneSearch.layout.normal'),'00');
      h.click('[data-zw-cancel]');
      assert.strictEqual(h.model.get('sceneSearch.layout.normal'),'01');
      assert.strictEqual(h.model.get('sceneSearch.layout.fullscreen'),'02');
      assert.strictEqual(h.config.writes.length,0);
    }finally{h.destroy();}
  });
  it('retains 01 to 10 options and rejects malformed layout ids',()=>{
    const h=boot();open(h);
    try{
      assert.strictEqual(h.all('[data-zw-scene-layout]').length,11);
      h.click(option('normal','10'));
      assert.strictEqual(h.model.get('sceneSearch.layout.normal'),'10');
      h.click(option('normal','01'));
      assert.strictEqual(h.model.get('sceneSearch.layout.normal'),'01');
      const fake=h.q(option('normal','00'));
      fake.dataset.zwSceneLayout='xx';
      fake.click();
      assert.strictEqual(h.model.get('sceneSearch.layout.normal'),'01');
      assert.strictEqual(h.config.writes.length,0);
    }finally{h.destroy();}
  });
});
