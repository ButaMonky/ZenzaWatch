'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass}=require('../helpers/extractSource');

const defaults={
  commentLanguage:'ja-jp',baseFontFamily:'',baseChatScale:1,
  baseFontBolder:true,cssFontWeight:'bold',
  'commentLayer.textShadowType':'',
  'commentLayer.ownerCommentShadowColor':'#008800',
  screenMode:'normal',fullscreenControlBarMode:'auto',
  'videoHeader.position':'auto','screenshot.prefix':'',
  'screenshot.filenameTemplate':'',
  enableFilter:true,wordRegFilter:'',wordRegFilterFlags:'i'
};
function boot(saved={}) {
  const dom=new JSDOM('<!doctype html><html><body><section id="panel">'+
    '<div class="settingPanelInner"><div class="control">'+
    '<label>動画ヘッダー<select data-setting-name="videoHeader.position">'+
    '<option value="auto">自動</option><option value="outside">外</option>'+
    '<option value="overlay">重ねる</option>'+
    '<option value="overlay-visible">常時表示</option></select></label></div></div>'+
    '</section></body></html>',
    {url:'https://www.nicovideo.jp/my'});
  const ctx=createContext({window:dom.window,document:dom.window.document,URL});
  const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',ctx);
  const UI=loadClass('src/ModernAdvancedSettingsUI.js','ModernAdvancedSettingsUI',ctx);
  const ScreenshotFileName=loadClass('src/ScreenshotFileName.js','ScreenshotFileName',ctx);
  const config={
    default:defaults,values:{...defaults,...saved},writes:[],
    getValue(k){return this.values[k];},
    setValue(k,v){this.writes.push([k,v]);this.values[k]=v;},
    options:{validateImport(k,v){return typeof defaults[k]===typeof v;}}
  };
  const panel=dom.window.document.getElementById('panel');
  const legacyRoot=panel.querySelector('.settingPanelInner');
  const model=new Model({config,legacyRoot,actions:[]});
  const storage={getItem(){return null;},setItem(){}};
  const ui=new UI({panel,legacyRoot,model,storage,confirm:()=>true,
    screenshotFileName:ScreenshotFileName});
  const root=ui.root;
  const choose=id=>{
    const d=model.descriptor(id);
    assert(d,'descriptor '+id);
    if(!ui.expanded.has(d.category)){
      const b=[...root.querySelectorAll('[data-zw-major]')]
        .find(x=>x.dataset.zwMajor===d.category);
      assert(b);b.click();
    }
    const b=[...root.querySelectorAll('[data-zw-sub]')]
      .find(x=>x.dataset.zwSub===d.category+'|'+d.subcategory);
    assert(b,'subcategory '+id);b.click();
  };
  const card=id=>root.querySelector('[data-zw-id="'+id+'"]');
  const send=(node,type='change')=>{
    node.dispatchEvent(new dom.window.Event(type,{bubbles:true,cancelable:true}));
  };
  const shutdown=()=>{ui.dispose();dom.window.close();};
  return {dom,root,ui,model,config,choose,card,send,shutdown};
}

describe('Task318 beginner-friendly typography controls',()=>{
  it('offers precisely the languages from the current comment panel',()=>{
    const h=boot();
    const d=h.model.descriptor('commentLanguage');
    assert.strictEqual(d.type,'select');
    assert.deepStrictEqual(Array.from(d.options,o=>o.value),['ja-jp','en-us','zh-tw']);
    h.choose('commentLanguage');
    const control=h.card('commentLanguage');
    const option=control.querySelector('[data-zw-choice][data-zw-value="en-us"]');
    assert(option);
    option.click();
    assert.strictEqual(h.model.get('commentLanguage'),'en-us');
    assert.strictEqual(h.config.values.commentLanguage,'ja-jp');
    h.shutdown();
  });
  it('provides recommended font families and an editable custom choice',()=>{
    const h=boot();
    h.choose('baseFontFamily');
    const row=h.card('baseFontFamily');
    const preset=row.querySelector('[data-zw-font-preset]');
    const custom=row.querySelector('[data-zw-font-custom]');
    assert(preset && custom);
    assert(Array.from(preset.options).some(o=>o.value.includes('Meiryo')));
    preset.value='__custom__';h.send(preset);
    assert.strictEqual(custom.hidden,false);
    custom.value="'My Original Font', sans-serif";h.send(custom,'input');
    assert.strictEqual(h.model.get('baseFontFamily'),"'My Original Font', sans-serif");
    assert.strictEqual(h.config.values.baseFontFamily,'');
    h.shutdown();
  });
  it('retains a previously saved unusual font even before editing',()=>{
    const h=boot({baseFontFamily:"'Existing Rare Font'"});
    h.choose('baseFontFamily');
    const row=h.card('baseFontFamily');
    assert.strictEqual(row.querySelector('[data-zw-font-preset]').value,'__custom__');
    assert.strictEqual(row.querySelector('[data-zw-font-custom]').value,"'Existing Rare Font'");
    assert.strictEqual(h.model.isDirty(),false);
    h.shutdown();
  });
  it('allows comment scaling in 0.1 steps and rejects values between steps',()=>{
    const h=boot();
    const d=h.model.descriptor('baseChatScale');
    assert.strictEqual(d.type,'slider');
    assert.strictEqual(d.min,0.5);
    assert.strictEqual(d.max,2);
    assert.strictEqual(d.step,0.1);
    h.choose('baseChatScale');
    const row=h.card('baseChatScale');
    const slider=row.querySelector('input[type=range]');
    const number=row.querySelector('input[type=number]');
    assert(slider&&number);
    assert.strictEqual(slider.step,'0.1');
    number.value='1.3';h.send(number,'input');
    assert.strictEqual(h.model.get('baseChatScale'),1.3);
    h.model.set('baseChatScale',1.35);
    assert(h.model.validate().some(e=>e.id==='baseChatScale'));
    h.shutdown();
  });
  it('makes text weight and shadow explicit named choices',()=>{
    const h=boot();
    for(const [key,opts] of [
      ['cssFontWeight',['normal','500','600','bold','800','900']],
      ['commentLayer.textShadowType',['','shadow-type2','shadow-type3','shadow-stroke','shadow-dokaben']]
    ]){
      const d=h.model.descriptor(key);
      assert.strictEqual(d.type,'select');
      assert.deepStrictEqual(Array.from(d.options,o=>o.value),opts);
      assert(d.options.every(o=>!/^#[0-9a-f]{3,6}$/i.test(o.label)));
    }
    h.choose('commentLayer.textShadowType');
    const row=h.card('commentLayer.textShadowType');
    assert(row.querySelector('[data-zw-preview-for="commentLayer.textShadowType"]'));
    row.querySelector('[data-zw-choice][data-zw-value="shadow-type3"]').click();
    assert.strictEqual(h.model.get('commentLayer.textShadowType'),'shadow-type3');
    assert.strictEqual(h.card('commentLayer.textShadowType')
      .querySelector('[data-zw-preview-for]').dataset.zwExampleMode,'shadow-type3');
    h.shutdown();
  });
});

describe('Task318 safe colour-code editor and on-card examples',()=>{
  it('lets the native picker and HEX field edit one staged shadow color',()=>{
    const h=boot();
    h.choose('commentLayer.ownerCommentShadowColor');
    const row=h.card('commentLayer.ownerCommentShadowColor');
    const picker=row.querySelector('[data-zw-color-picker]');
    const code=row.querySelector('[data-zw-color-code]');
    const example=row.querySelector('[data-zw-preview-for]');
    assert(picker&&code&&example);
    assert.strictEqual(picker.value,'#008800');
    picker.value='#cc3366';h.send(picker,'input');
    assert.strictEqual(h.model.get('commentLayer.ownerCommentShadowColor'),'#cc3366');
    assert.strictEqual(code.value,'#cc3366');
    assert.strictEqual(h.config.writes.length,0);
    code.value='#09f';h.send(code,'input');
    assert.strictEqual(picker.value,'#0099ff');
    assert.strictEqual(example.dataset.zwExampleMode,'#09f');
    code.value='#GGHHII';h.send(code,'input');
    assert(h.model.validate().some(x=>x.id==='commentLayer.ownerCommentShadowColor'));
    assert.strictEqual(h.root.querySelector('[data-zw-save]').disabled,true);
    assert.strictEqual(h.config.writes.length,0);
    h.shutdown();
  });
  it('does not destroy previously saved valid named CSS colors',()=>{
    const h=boot({'commentLayer.ownerCommentShadowColor':'green'});
    h.choose('commentLayer.ownerCommentShadowColor');
    const row=h.card('commentLayer.ownerCommentShadowColor');
    assert.strictEqual(row.querySelector('[data-zw-color-code]').value,'green');
    assert.strictEqual(h.model.isDirty(),false);
    assert.strictEqual(row.querySelector('[data-zw-color-picker]').disabled,false);
    assert.strictEqual(row.querySelector('[data-zw-color-picker]').value,'#008000');
    h.shutdown();
  });
  it('previews screen modes, header positioning and the actual screenshot naming rule',()=>{
    const h=boot();
    h.choose('screenMode');
    let row=h.card('screenMode');
    assert(row.querySelector('[data-zw-preview-for="screenMode"]'));
    row.querySelector('[data-zw-choice][data-zw-value="small"]').click();
    row=h.card('screenMode');
    assert.strictEqual(row.querySelector('[data-zw-preview-for]').dataset.zwExampleMode,'small');
    h.choose('videoHeader.position');
    assert(h.card('videoHeader.position').querySelector('[data-zw-preview-for="videoHeader.position"]'));
    h.choose('screenshot.prefix');
    row=h.card('screenshot.prefix');
    const preview=row.querySelector('[data-zw-preview-for="screenshot.prefix"]');
    assert(preview);
    const text=row.querySelector('[data-setting-name="screenshot.prefix"]');
    text.value='clip_';h.send(text,'input');
    assert(preview.textContent.includes('clip_'));
    assert(preview.textContent.includes('.png'));
    assert.strictEqual(h.config.values['screenshot.prefix'],'');
    h.shutdown();
  });
});


describe('Task318 screenshot filename guidance',()=>{
  it('shows exactly which filename portion a user can edit',()=>{
    const h=boot();
    h.choose('screenshot.prefix');
    const card=h.card('screenshot.prefix');
    assert(card.querySelector('.zw-modern-prefix-hint').textContent.includes('先頭'));
    assert(card.querySelector('[data-zw-preview-for="screenshot.prefix"]')
      .textContent.includes('sm9@1_23.png'));
    assert.strictEqual(card.querySelectorAll('[data-zw-screenshot-prefix]').length,6);
    const preset=[...card.querySelectorAll('[data-zw-screenshot-prefix]')]
      .find(x=>x.dataset.zwScreenshotPrefix==='スクショ_');
    assert(preset);
    preset.click();
    assert.strictEqual(h.model.get('screenshot.prefix'),'スクショ_');
    assert(h.card('screenshot.prefix').querySelector('.zw-example-filename')
      .textContent.startsWith('スクショ_'));
    assert.strictEqual(h.config.writes.length,0);
    h.shutdown();
  });
  it('keeps custom prefixes editable and restores the original on cancel',()=>{
    const h=boot({'screenshot.prefix':'自分用_'});
    h.choose('screenshot.prefix');
    const card=h.card('screenshot.prefix');
    const input=card.querySelector('[data-setting-name="screenshot.prefix"]');
    assert(input);
    assert.strictEqual(input.value,'自分用_');
    const preset=[...card.querySelectorAll('[data-zw-screenshot-prefix]')]
      .find(x=>x.dataset.zwScreenshotPrefix==='clip_');
    preset.click();
    assert.strictEqual(h.model.get('screenshot.prefix'),'clip_');
    h.root.querySelector('[data-zw-cancel]').click();
    assert.strictEqual(h.model.get('screenshot.prefix'),'自分用_');
    assert.strictEqual(h.config.values['screenshot.prefix'],'自分用_');
    h.shutdown();
  });
});

describe('Task318 user-friendly regex flags',()=>{
  it('offers checked i by default and describes the meaning of each option',()=>{
    const h=boot();
    const d=h.model.descriptor('wordRegFilterFlags');
    assert.strictEqual(d.type,'regex-flags');
    h.choose('wordRegFilterFlags');
    const card=h.card('wordRegFilterFlags');
    const check=card.querySelector('[data-zw-regex-flag="i"]');
    assert(check&&check.checked);
    assert(card.textContent.includes('大文字・小文字を区別しない'));
    assert.strictEqual(card.querySelectorAll('[data-zw-regex-flag]').length,4);
    assert(card.querySelector('[data-zw-regex-advanced-panel]').hidden);
    h.shutdown();
  });
  it('allows optional m without losing i, and rejects duplicate invalid raw flags',()=>{
    const h=boot();
    h.choose('wordRegFilterFlags');
    let card=h.card('wordRegFilterFlags');
    const m=card.querySelector('[data-zw-regex-flag="m"]');
    m.checked=true;h.send(m,'change');
    assert.strictEqual(h.model.get('wordRegFilterFlags'),'im');
    assert.strictEqual(h.config.values.wordRegFilterFlags,'i');
    card.querySelector('[data-zw-regex-advanced-toggle]').click();
    const raw=card.querySelector('[data-zw-regex-raw]');
    assert(!raw.closest('[data-zw-regex-advanced-panel]').hidden);
    raw.value='ii';h.send(raw,'input');
    assert(h.model.validate().some(e=>e.id==='wordRegFilterFlags'));
    assert.strictEqual(h.root.querySelector('[data-zw-save]').disabled,true);
    h.root.querySelector('[data-zw-cancel]').click();
    assert.strictEqual(h.model.get('wordRegFilterFlags'),'i');
    h.shutdown();
  });
  it('preserves a legacy valid flag g in the advanced field',()=>{
    const h=boot({wordRegFilterFlags:'gi'});
    h.choose('wordRegFilterFlags');
    const row=h.card('wordRegFilterFlags');
    assert(row.querySelector('[data-zw-regex-flag="i"]').checked);
    assert.strictEqual(row.querySelector('[data-zw-regex-raw]').value,'gi');
    assert.strictEqual(h.model.isDirty(),false);
    h.shutdown();
  });
});

describe('Task318 filename prefix compatibility',()=>{
  it('prevents invalid Windows filename characters while retaining the existing prefix',()=>{
    const h=boot({'screenshot.prefix':'archive_'});
    h.choose('screenshot.prefix');
    const input=h.card('screenshot.prefix').querySelector('[data-setting-name="screenshot.prefix"]');
    input.value='clip:';h.send(input,'input');
    assert(h.model.validate().some(e=>e.id==='screenshot.prefix'));
    assert.strictEqual(h.root.querySelector('[data-zw-save]').disabled,true);
    assert.strictEqual(h.config.values['screenshot.prefix'],'archive_');
    h.shutdown();
  });
});

describe('Task318 screenshot naming options',()=>{
  it('offers format templates, date/ID-based prefix presets, and live name previews',()=>{
    const h=boot();
    h.choose('screenshot.prefix');
    assert(h.card('screenshot.prefix').querySelector('[data-zw-screenshot-prefix="{date}_"]'));
    h.choose('screenshot.filenameTemplate');
    const card=h.card('screenshot.filenameTemplate');
    assert.strictEqual(card.querySelectorAll('[data-zw-filename-template]').length,5);
    const preset=card.querySelector('[data-zw-filename-template][data-zw-value]');
    assert(card.querySelector('[data-zw-filename-token="uploader"]'));
    const dateButton=[...card.querySelectorAll('[data-zw-filename-template]')]
      .find(el=>el.dataset.zwFilenameTemplate.includes('{date}'));
    dateButton.click();
    assert(h.model.get('screenshot.filenameTemplate').includes('{date}'));
    assert(h.card('screenshot.filenameTemplate').querySelector('.zw-example-filename')
      .textContent.includes('2026-10-10'));
    assert.strictEqual(h.config.writes.length,0);
    h.root.querySelector('[data-zw-cancel]').click();
    assert.strictEqual(h.model.get('screenshot.filenameTemplate'),'');
    h.shutdown();
  });
  it('does not rewrite an existing custom prefix when the format changes',()=>{
    const h=boot({'screenshot.prefix':'重要_'});
    h.choose('screenshot.filenameTemplate');
    h.root.querySelector('[data-zw-filename-template]').click();
    h.root.querySelector('[data-zw-filename-token="watchId"]').click();
    assert.strictEqual(h.model.get('screenshot.prefix'),'重要_');
    assert.strictEqual(h.config.values['screenshot.prefix'],'重要_');
    h.shutdown();
  });
});
