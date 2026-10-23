'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass}=require('../helpers/extractSource');

const legacySeekInputs=Array.from({length:10},(_,i)=>
  '<div class="shortcutRow customSeekSlotRow"><input type="text" data-setting-name="PARAM_CUSTOM_SEEK_'+(i+1)+'"></div>').join('');
const MARKUP='<!doctype html><html><body><div id="root"><div class="settingPanelInner">'+
  legacySeekInputs+'</div></div></body></html>';
function fixture(configured={}) {
  const dom=new JSDOM(MARKUP,{url:'https://www.nicovideo.jp/my'});
  const context=createContext({document:dom.window.document,window:dom.window,URL});
  const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',context);
  const UI=loadClass('src/ModernAdvancedSettingsUI.js','ModernAdvancedSettingsUI',context);
  const defaults={};
  const actions=[];
  for(let n=1;n<=10;n++){
    defaults['KEY_CUSTOM_SEEK_'+n]=0;
    defaults['PARAM_CUSTOM_SEEK_'+n]=0;
    actions.push({id:'CUSTOM_SEEK_'+n,label:'カスタムシーク'+n,category:'シーク',customSeekSlot:true,defaultKey:0});
  }
  const config={default:defaults,values:{...defaults,...configured},writes:[],
    getValue(id){return this.values[id]},setValue(id,value){this.writes.push([id,value]);this.values[id]=value;},
    options:{validateImport(){return true;}}};
  const root=dom.window.document.getElementById('root');
  const model=new Model({config,legacyRoot:root.querySelector('.settingPanelInner'),actions});
  const ui=new UI({panel:root,legacyRoot:root.querySelector('.settingPanelInner'),model,
    storage:{getItem(){return null},setItem(){}},confirm:()=>true,
    formatKeyCombo:code=>String(code||'未設定'),encodeKeyCombo:evt=>evt.keyCode});
  const pick=()=>{
    const group=[...ui.root.querySelectorAll('[data-zw-major]')]
      .find(el=>el.dataset.zwMajor==='ショートカット');
    if(!ui.expanded.has('ショートカット'))group.click();
    [...ui.root.querySelectorAll('[data-zw-sub]')]
      .find(el=>el.dataset.zwSub==='ショートカット|シーク').click();
  };
  pick();
  const rows=()=>[...ui.root.querySelectorAll('[data-zw-id^="KEY_CUSTOM_SEEK_"]')];
  const click=selector=>{const el=ui.root.querySelector(selector);assert(el,selector);el.click();};
  return {dom,ui,config,model,rows,click,
    dispose(){ui.dispose();dom.window.close();}};
}

describe('Task318 additive custom seek configuration',function(){
  // Task790 (TEST-FLAKY-318): each case builds the settings view in JSDOM and runs close
  // to mocha's 2 s default even alone; give it headroom instead of failing at random.
  this.timeout(10000);
  it('merges legacy PARAM fields into only the explicitly configured composite cards',()=>{
    const h=fixture({PARAM_CUSTOM_SEEK_1:3,PARAM_CUSTOM_SEEK_2:-3});
    try{
      assert.deepStrictEqual(h.rows().map(x=>x.dataset.zwId),
        ['KEY_CUSTOM_SEEK_1','KEY_CUSTOM_SEEK_2']);
      assert.strictEqual(h.ui.root.querySelector('[data-zw-seek-count]').textContent,
        'カスタムシーク 2 / 10 枠');
      assert.strictEqual(h.ui.root.querySelectorAll('[data-zw-id^="PARAM_CUSTOM_SEEK_"]').length,0,
        'legacy seconds inputs must not be rendered as ten separate cards');
      assert.strictEqual(h.model.descriptor('PARAM_CUSTOM_SEEK_1').type,'seconds');
      assert.strictEqual(h.model.descriptor('PARAM_CUSTOM_SEEK_1').actionId,'CUSTOM_SEEK_1');
      const first=h.rows()[0],second=h.rows()[1];
      assert.strictEqual(first.querySelector('[data-zw-seek-magnitude="PARAM_CUSTOM_SEEK_1"]').value,'3');
      assert.strictEqual(second.querySelector('[data-zw-seek-magnitude="PARAM_CUSTOM_SEEK_2"]').value,'3');
      assert.strictEqual(second.querySelector('[data-zw-seek-direction="PARAM_CUSTOM_SEEK_2"]').value,'-1');
      assert.strictEqual(h.config.writes.length,0);
      h.click('[data-zw-add-seek]');
      assert.deepStrictEqual(h.rows().map(x=>x.dataset.zwId),
        ['KEY_CUSTOM_SEEK_1','KEY_CUSTOM_SEEK_2','KEY_CUSTOM_SEEK_3']);
      h.click('[data-zw-cancel]');
      assert.deepStrictEqual(h.rows().map(x=>x.dataset.zwId),
        ['KEY_CUSTOM_SEEK_1','KEY_CUSTOM_SEEK_2']);
      assert.strictEqual(h.config.values.PARAM_CUSTOM_SEEK_1,3);
      assert.strictEqual(h.config.values.PARAM_CUSTOM_SEEK_2,-3);
    }finally{h.dispose();}
  });
  it('shows no unused slots and reveals one slot when adding',()=>{
    const h=fixture();
    assert.strictEqual(h.rows().length,0);
    assert(h.ui.root.querySelector('[data-zw-add-seek]'));
    assert(h.ui.root.textContent.includes('0 / 10'));
    h.click('[data-zw-add-seek]');
    assert.deepStrictEqual(h.rows().map(x=>x.dataset.zwId),['KEY_CUSTOM_SEEK_1']);
    assert.strictEqual(h.config.writes.length,0);
    assert(h.ui.root.querySelector('[data-zw-remove-seek="1"]'));
    h.dispose();
  });
  it('preserves legacy sparse or partial configuration without moving IDs',()=>{
    const h=fixture({
      KEY_CUSTOM_SEEK_2:76,PARAM_CUSTOM_SEEK_7:-3.5,
      KEY_CUSTOM_SEEK_9:82
    });
    assert.deepStrictEqual(h.rows().map(x=>x.dataset.zwId),[
      'KEY_CUSTOM_SEEK_2','KEY_CUSTOM_SEEK_7','KEY_CUSTOM_SEEK_9'
    ]);
    h.click('[data-zw-add-seek]');
    assert.deepStrictEqual(h.rows().map(x=>x.dataset.zwId),[
      'KEY_CUSTOM_SEEK_1','KEY_CUSTOM_SEEK_2','KEY_CUSTOM_SEEK_7','KEY_CUSTOM_SEEK_9'
    ]);
    assert.strictEqual(h.model.get('PARAM_CUSTOM_SEEK_7'),-3.5);
    h.dispose();
  });
  it('adds up to 10 without changing a saved value until global Save',()=>{
    const h=fixture();
    for(let n=1;n<=10;n++){h.click('[data-zw-add-seek]');}
    assert.strictEqual(h.rows().length,10);
    assert.strictEqual(h.ui.root.querySelector('[data-zw-add-seek]').disabled,true);
    assert.strictEqual(h.config.writes.length,0);
    h.click('[data-zw-remove-seek="3"]');
    assert.strictEqual(h.rows().length,9);
    h.click('[data-zw-add-seek]');
    assert.strictEqual(h.rows().length,10);
    h.dispose();
  });
  it('removes a configured slot by staging both original key and signed parameter resets',()=>{
    const h=fixture({KEY_CUSTOM_SEEK_4:78,PARAM_CUSTOM_SEEK_4:-11});
    h.click('[data-zw-remove-seek="4"]');
    assert.strictEqual(h.model.get('KEY_CUSTOM_SEEK_4'),0);
    assert.strictEqual(h.model.get('PARAM_CUSTOM_SEEK_4'),0);
    assert.strictEqual(h.rows().length,0);
    assert.strictEqual(h.config.values['KEY_CUSTOM_SEEK_4'],78);
    assert.strictEqual(h.config.values['PARAM_CUSTOM_SEEK_4'],-11);
    h.click('[data-zw-save]');
    assert.strictEqual(h.config.values['KEY_CUSTOM_SEEK_4'],0);
    assert.strictEqual(h.config.values['PARAM_CUSTOM_SEEK_4'],0);
    h.dispose();
  });
  it('reopens configured slots after cancel and never hides unsaved key changes',()=>{
    const h=fixture({KEY_CUSTOM_SEEK_5:65});
    h.click('[data-zw-add-seek]');
    assert(h.rows().some(el=>el.dataset.zwId==='KEY_CUSTOM_SEEK_1'));
    assert.strictEqual(h.ui.root.querySelector('[data-zw-cancel]').disabled,false);
    assert.strictEqual(h.ui.root.querySelector('[data-zw-save]').disabled,true);
    assert(h.ui.hasPendingEdits());
    h.click('[data-zw-cancel]');
    assert(!h.ui.hasPendingEdits());
    assert.deepStrictEqual(h.rows().map(x=>x.dataset.zwId),['KEY_CUSTOM_SEEK_5']);
    h.dispose();
  });
  it('discards a new empty slot on close instead of silently keeping it',()=>{
    const h=fixture({KEY_CUSTOM_SEEK_5:65});
    h.click('[data-zw-add-seek]');
    h.click('[data-zw-close]');
    assert(!h.ui.hasPendingEdits());
    assert.deepStrictEqual(h.rows().map(x=>x.dataset.zwId),['KEY_CUSTOM_SEEK_5']);
    assert.strictEqual(h.config.writes.length,0);
    h.dispose();
  });
  it('clears temporary added-slot state after saving a real assignment',()=>{
    const h=fixture();
    h.click('[data-zw-add-seek]');
    h.model.set('KEY_CUSTOM_SEEK_1',77);
    h.ui._refreshFooter();
    h.click('[data-zw-save]');
    assert.strictEqual(h.config.values.KEY_CUSTOM_SEEK_1,77);
    assert.strictEqual(h.ui.hasPendingEdits(),false);
    assert.deepStrictEqual(h.rows().map(x=>x.dataset.zwId),['KEY_CUSTOM_SEEK_1']);
    h.dispose();
  });
});
