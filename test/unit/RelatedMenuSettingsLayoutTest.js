'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass}=require('../helpers/extractSource');

function setup() {
  const dom=new JSDOM('<!doctype html><html><body><div id="ui"></div></body></html>');
  const context=createContext({document:dom.window.document,URL});
  const RelatedMenuActions=loadClass(
    'packages/zenza/src/menu/RelatedMenuActions.js','RelatedMenuActions',context);
  const RelatedMenuSettings=loadClass('src/RelatedMenuSettings.js','RelatedMenuSettings',context);
  const config={
    saved:['video','user','history'].map(id=>({
      id,label:id+' name',url:'https://example.org/'+id+'/{videoId}',
      enabled:true,openInNewTab:true
    })),
    getValue(){return this.saved;},
    setValue(key,value){assert.strictEqual(key,'relatedMenu.customLinks');this.saved=value;},
    on(){},off(){}
  };
  const root=dom.window.document.getElementById('ui');
  const panel=RelatedMenuSettings.mount(root,{config,actions:RelatedMenuActions});
  const q=sel=>root.querySelector(sel);
  const rows=()=>[...root.querySelectorAll('[data-rl-row]')];
  const click=sel=>{const b=q(sel);assert(b,sel);b.click();};
  const field=(row,key)=>rows()[row].querySelector('[data-rl-field="'+key+'"]');
  return {dom,root,panel,config,q,rows,click,field};
}

describe('Task316 related-link editor layout interactions',()=>{
  it('shows collapsed names, key summary and states without exposing all forms',()=>{
    const a=setup();
    assert.strictEqual(a.rows().length,3);
    assert.strictEqual(a.q('[data-rl-details]').hidden,true);
    assert.ok(a.rows()[0].textContent.includes('video name'));
    assert.ok(a.rows()[0].textContent.includes('有効'));
    a.panel.dispose();a.dom.window.close();
  });
  it('expands more than one card independently and preserves unsaved input',()=>{
    const a=setup();
    a.click('[data-rl-expand="0"]');
    a.click('[data-rl-expand="1"]');
    assert.strictEqual(a.rows()[0].querySelector('[data-rl-details]').hidden,false);
    assert.strictEqual(a.rows()[1].querySelector('[data-rl-details]').hidden,false);
    a.field(0,'label').value='Edited label';
    a.field(0,'label').dispatchEvent(new a.dom.window.Event('input',{bubbles:true}));
    a.click('[data-rl-expand="0"]');
    a.click('[data-rl-expand="0"]');
    assert.strictEqual(a.field(0,'label').value,'Edited label');
    assert.strictEqual(a.rows()[1].querySelector('[data-rl-details]').hidden,false);
    assert.strictEqual(a.config.saved[0].label,'video name');
    a.panel.dispose();a.dom.window.close();
  });
  it('shows a Japanese variable chooser only on demand and inserts at caret',()=>{
    const a=setup();a.click('[data-rl-expand="0"]');
    assert.strictEqual(a.q('[data-rl-variables-panel]').hidden,true);
    a.click('[data-rl-variables-toggle="0"]');
    const menu=a.q('[data-rl-variables-panel]');
    assert.strictEqual(menu.hidden,false);
    assert.ok(menu.textContent.includes('投稿者ID'));
    const input=a.field(0,'url');input.focus();input.setSelectionRange(23,23);
    a.click('[data-rl-insert="uploaderUserId"]');
    assert.strictEqual(a.q('[data-rl-variables-panel]').hidden,true);
    assert.ok(a.field(0,'url').value.includes('{uploaderUserId}'));
    assert.ok(a.q('[data-rl-no-owner]').textContent.includes('無効'));
    a.panel.dispose();a.dom.window.close();
  });
  it('reorders by drag handles with same data order used by up/down controls',()=>{
    const a=setup();
    const grip=a.q('[data-rl-drag="0"]');
    assert.strictEqual(grip.draggable,true);
    const src=new a.dom.window.Event('dragstart',{bubbles:true,cancelable:true});
    src.dataTransfer={setData(){},effectAllowed:''};
    grip.dispatchEvent(src);
    const target=a.rows()[2];
    const over=new a.dom.window.Event('dragover',{bubbles:true,cancelable:true});
    target.dispatchEvent(over);
    assert.strictEqual(over.defaultPrevented,true);
    const drop=new a.dom.window.Event('drop',{bubbles:true,cancelable:true});
    drop.dataTransfer={getData(){return '0'}};
    target.dispatchEvent(drop);
    assert.deepStrictEqual(a.rows().map(x=>x.querySelector('[data-rl-field="id"]').value),
      ['user','history','video']);
    assert.deepStrictEqual(Array.from(a.config.saved,x=>x.id),['video','user','history']);
    a.click('[data-rl-save]');
    assert.deepStrictEqual(Array.from(a.config.saved,x=>x.id),['user','history','video']);
    a.panel.dispose();a.dom.window.close();
  });
  it('keeps expanded cards after adding, duplicating and moving by buttons',()=>{
    const a=setup();
    a.click('[data-rl-expand="0"]');
    a.click('[data-rl-duplicate="0"]');
    assert.strictEqual(a.rows().length,4);
    assert.strictEqual(a.rows()[0].querySelector('[data-rl-details]').hidden,false);
    a.click('[data-rl-down="0"]');
    assert.strictEqual(a.rows()[1].querySelector('[data-rl-details]').hidden,false);
    a.panel.dispose();a.dom.window.close();
  });
});