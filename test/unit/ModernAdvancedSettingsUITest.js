'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass}=require('../helpers/extractSource');
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
    enableFilter:true,wordFilter:'',userIdFilter:'',commandFilter:'',
    sharedNgLevel:'MID','filter.fork0':true,screenMode:'normal',
    showComment:true,enableCommentPanel:true,enableCommentPreview:false,
    enableHeatMap:true,enableStoryboard:true,enableStoryboardBar:false,
    enableAdDecoration:true,
    KEY_TOGGLE_PLAY:32,
    'videoSearch.wordCountMode':'on-demand','videoSearch.videoIdSuggestMode':'merged',
    'search.limit':1000,'relatedMenu.order':[],'relatedMenu.hiddenItems':[],
    'ui.hover.like':true,'ui.hover.tweet':true,'ui.hover.mylist':true,
    'ui.hover.watchLater':true,'ui.hover.comments':true,'ui.hover.ngFilter':true,
    'ui.relatedMenu':true,'ui.commentInput':true,
    KEY_CUSTOM_SEEK_1:0,PARAM_CUSTOM_SEEK_1:0,'relatedMenu.customLinks':[],
    ...ctx.UiVisibilityRegistry.defaults()};
  const config={default:defaults,values:{...defaults,...saved},writes:[],getValue(k){return this.values[k]},
    setValue(k,v){this.values[k]=v;this.writes.push([k,v])},
    options:{validateImport(k,v){return typeof v===typeof defaults[k]}}};
  const actions=[{id:'TOGGLE_PLAY',label:'再生・停止',category:'再生操作',defaultKey:32},
    {id:'CUSTOM_SEEK_1',label:'カスタムシーク 1',category:'シーク',defaultKey:0,customSeekSlot:true}];
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
    const card=h.q('[data-zw-id="relatedMenu.customLinks"]');
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
      ['hover','related','comment','bar','info','header','shared']);
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
