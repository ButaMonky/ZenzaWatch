'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,extract,run,loadClass}=require('../helpers/extractSource');
const {ZenzaCommentHistorySettings}=require('../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');
const opacity='sceneSearch.commentListBackgroundOpacity';
const scale='sceneSearch.thumbnailScale';
const parent='sceneSearch.commentPreviewVisible';
const mini='sceneSearch.miniCommentVisible';
const list='sceneSearch.commentListVisible';

const {fixture}=require('../helpers/sceneSearchSettingsFixture');

describe('Task801 shared scene-search preview appearance settings',()=>{
  it('registers numeric shared defaults while preserving preview mode defaults',()=>{
    const {config}=fixture();
    assert.strictEqual(config.default[opacity],90);
    assert.strictEqual(config.default[scale],100);
    assert.strictEqual(config.default.enableCommentPreview,false);
    assert.strictEqual(config.default['sceneSearch.commentPreviewVisible'],true);
  });
  it('exposes one percent slider per setting with the approved range and labels',()=>{
    const {model}=fixture();
    for(const [id,label,min,max] of [
      [opacity,'コメントプレビューの背景濃度',0,100],
      [scale,'サムネイルの大きさ',50,200]]){
      const d=model.descriptor(id);
      assert(d,id);
      assert.strictEqual(d.label,label);
      assert.strictEqual(d.type,'slider');
      assert.deepStrictEqual([d.min,d.max,d.step,d.unit],[min,max,1,'%']);
      assert.strictEqual(d.category,'画面・映像');
      assert.strictEqual(d.subcategory,'シーンサーチ');
      assert.strictEqual(model.descriptors.filter(x=>x.id===id).length,1);
      assert(d.description.includes('通常表示') && d.description.includes('全画面'));
    }
    assert(model.descriptor(opacity).description.includes('文字'));
    assert(model.descriptor(scale).description.includes('ミニコメント'));
    assert(model.descriptor(scale).description.includes('操作ボタン'));
  });
  it('accepts integer endpoints and rejects malformed or out-of-range imports',()=>{
    const {config}=fixture();
    for(const [id,accepted,rejected] of [
      [opacity,[0,1,90,100],[-1,101,0.5]],
      [scale,[50,51,100,200],[49,201,100.5]]]){
      for(const value of accepted)assert.strictEqual(config.options.validateImport(id,value),true,id+':'+value);
      for(const value of [...rejected,'90',null,undefined,NaN,Infinity,-Infinity,true,[],{}]){
        assert.strictEqual(config.options.validateImport(id,value),false,id+':'+String(value));
      }
    }
  });
  it('saves numeric slider drafts and restores the persisted values',async()=>{
    const {model,config,storage}=fixture();
    model.set(opacity,'43').set(scale,'135');
    assert.strictEqual(config.getValue(opacity),90,'draft must not affect live state');
    assert.strictEqual(model.save(),2);
    assert.strictEqual(storage['SC_'+opacity],'43');
    assert.strictEqual(storage['SC_'+scale],'135');
    const restored=fixture(storage);
    await restored.config.restore();
    assert.strictEqual(restored.config.getValue(opacity),43);
    assert.strictEqual(restored.config.getValue(scale),135);
    assert.strictEqual(restored.config.getValue('enableCommentPreview'),false);
  });
  it('round-trips both settings through existing flat JSON backups',()=>{
    const source=fixture();
    source.config.import({[opacity]:0,[scale]:200});
    const backup=source.config.exportJson();
    const target=fixture();
    target.config.importJson(backup);
    assert.strictEqual(target.config.getValue(opacity),0);
    assert.strictEqual(target.config.getValue(scale),200);
    assert.strictEqual(JSON.parse(backup)[opacity],0);
    assert.strictEqual(JSON.parse(backup)[scale],200);
  });
  it('rejects invalid mixed imports before changing either memory or storage',()=>{
    const {config,storage}=fixture();
    config.import({[opacity]:60,[scale]:120});
    const before=JSON.stringify([config._data,storage]);
    for(const invalid of [{[opacity]:40,[scale]:49},{[opacity]:1.5,[scale]:150}]){
      assert.throws(()=>config.import(invalid),/sceneSearch\./);
      assert.strictEqual(JSON.stringify([config._data,storage]),before);
    }
  });
  it('rejects invalid slider drafts atomically without persisting the valid peer',()=>{
    const {model,config,storage}=fixture();
    const before=JSON.stringify(storage);
    model.set(opacity,50).set(scale,100.5);
    assert(model.validate().some(error=>error.id===scale));
    assert.throws(()=>model.save(),/sceneSearch.thumbnailScale/);
    assert.strictEqual(JSON.stringify(storage),before);
    assert.strictEqual(config.getValue(opacity),90);
    assert.strictEqual(config.getValue(scale),100);
  });
  it('supports cancel, individual reset and subsection reset without changing volume',()=>{
    const {model,config}=fixture();
    config.setValue('volume',0.4);
    model.set(opacity,35).set(scale,140);
    model.cancel();
    assert.strictEqual(model.get(opacity),90);
    assert.strictEqual(model.get(scale),100);
    model.set(opacity,35).set(scale,140).save();
    model.resetItem(opacity);
    assert.strictEqual(model.get(opacity),90);
    assert.strictEqual(model.get(scale),140);
    model.resetSubcategory('画面・映像','シーンサーチ');
    assert.strictEqual(model.get(scale),100);
    assert.strictEqual(config.getValue(scale),140,'reset remains a draft until saved');
    model.save();
    assert.strictEqual(config.getValue(opacity),90);
    assert.strictEqual(config.getValue(scale),100);
    assert.strictEqual(config.getValue('volume'),0.4);
  });
  it('describes the existing idle delay as shared by image and list previews',()=>{
    const {model}=fixture();
    const d=model.descriptor('sceneSearch.idleHideSeconds');
    assert.strictEqual(d.label,'プレビューを自動で隠すまでの時間');
    assert(d.description.includes('画像') && d.description.includes('一覧'));
    assert(d.description.includes('0秒'));
    assert.deepStrictEqual([d.min,d.max,d.step],[0,30,0.5]);
  });
});

describe('Task801 parent and child scene-search comment visibility settings',()=>{
  it('registers true boolean child defaults with the existing parent dependency',()=>{
    const {config,model}=fixture();
    assert.strictEqual(model.descriptor(parent).label,'シーンサーチのコメント表示');
    for(const [id,label] of [[mini,'ミニコメントを表示する'],[list,'コメントプレビューを表示する']]){
      assert.strictEqual(config.default[id],true);
      const d=model.descriptor(id);
      assert(d,id);
      assert.strictEqual(d.label,label);
      assert.strictEqual(d.type,'boolean');
      assert.strictEqual(d.dependsOn,parent);
      assert.strictEqual(d.subcategory,'シーンサーチ');
      for(const value of [true,false])assert.strictEqual(config.options.validateImport(id,value),true);
      for(const value of ['true','false',0,1,null,{},[]]){
        assert.strictEqual(config.options.validateImport(id,value),false);
      }
    }
  });
  it('preserves independent saved children across parent off/on without opening the list',()=>{
    const {config,model}=fixture();
    model.set(mini,false).set(list,true).save();
    model.set(parent,false).save();
    assert.strictEqual(model.isEnabled(mini),false);
    assert.strictEqual(model.isEnabled(list),false);
    assert.strictEqual(config.getValue(mini),false);
    assert.strictEqual(config.getValue(list),true);
    model.set(parent,true).save();
    assert.strictEqual(model.isEnabled(mini),true);
    assert.strictEqual(model.isEnabled(list),true);
    assert.strictEqual(model.get(mini),false);
    assert.strictEqual(model.get(list),true);
    model.set(list,false).save();
    model.set(list,true).save();
    assert.strictEqual(config.getValue('enableCommentPreview'),false,
      'allowing the list must not change the legacy open-list mode');
  });
  it('round-trips child values and rejects mixed invalid visibility imports atomically',()=>{
    const {config,storage}=fixture();
    config.import({[parent]:false,[mini]:false,[list]:true});
    const target=fixture();
    target.config.importJson(config.exportJson());
    assert.strictEqual(target.config.getValue(parent),false);
    assert.strictEqual(target.config.getValue(mini),false);
    assert.strictEqual(target.config.getValue(list),true);
    const before=JSON.stringify([config._data,storage]);
    assert.throws(()=>config.import({[mini]:true,[list]:'false'}),/sceneSearch.commentListVisible/);
    assert.strictEqual(JSON.stringify([config._data,storage]),before);
  });
  it('cancels child edits and resets the whole subsection to visible defaults',()=>{
    const {config,model}=fixture();
    model.set(mini,false).set(list,false);
    model.cancel();
    assert.strictEqual(model.get(mini),true);
    assert.strictEqual(model.get(list),true);
    model.set(parent,false).set(mini,false).set(list,false).save();
    model.resetSubcategory('画面・映像','シーンサーチ').save();
    for(const id of [parent,mini,list])assert.strictEqual(config.getValue(id),true);
  });
  it('renders indented children and disables their inputs while keeping checked values',()=>{
    const dom=new JSDOM('<!doctype html><html><body><section id="panel"></section></body></html>',
      {url:'https://www.nicovideo.jp/my'});
    const {config,model,context}=fixture({},dom);
    const UI=loadClass('src/ModernAdvancedSettingsUI.js','ModernAdvancedSettingsUI',context);
    model.set(mini,false).save();
    const panel=dom.window.document.getElementById('panel');
    const ui=new UI({panel,model,storage:dom.window.localStorage,confirm:()=>true,onClose(){}});
    try{
      ui.selected={category:'画面・映像',subcategory:'シーンサーチ'};
      ui._renderCards();
      const card=id=>panel.querySelector('[data-zw-id="'+id+'"]');
      const input=id=>card(id).querySelector('input[type=checkbox]');
      const toggle=value=>{
        input(parent).checked=value;
        input(parent).dispatchEvent(new dom.window.Event('change',{bubbles:true}));
      };
      for(const id of [mini,list])assert(card(id).classList.contains('is-child'));
      toggle(false);
      for(const id of [mini,list]){
        assert.strictEqual(input(id).disabled,true);
        assert(card(id).classList.contains('is-disabled'));
      }
      assert.strictEqual(input(mini).checked,false);
      assert.strictEqual(input(list).checked,true);
      panel.querySelector('[data-zw-save]').click();
      assert.strictEqual(config.getValue(parent),false);
      assert.strictEqual(config.getValue(mini),false);
      assert.strictEqual(config.getValue(list),true);
      toggle(true);
      for(const id of [mini,list])assert.strictEqual(input(id).disabled,false);
      assert.strictEqual(input(mini).checked,false);
      assert.strictEqual(input(list).checked,true);
      panel.querySelector('[data-zw-save]').click();
      assert.strictEqual(config.getValue(parent),true);
      assert.strictEqual(config.getValue('enableCommentPreview'),false);
    }finally{ui.dispose();dom.window.close();}
  });
});
