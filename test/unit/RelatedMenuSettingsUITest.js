'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {JSDOM} = require('jsdom');
const {createContext, loadClass, read} = require('../helpers/extractSource');

const sample = (id='video-link') => ({
  id, label: '動画を見る', url: 'https://example.com/watch/{videoId}',
  enabled: true, openInNewTab: true
});
const boot = (items=[sample()]) => {
  const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>');
  const ctx = createContext({URL, document:dom.window.document});
  const actions = loadClass('packages/zenza/src/menu/RelatedMenuActions.js', 'RelatedMenuActions', ctx);
  const Panel = loadClass('src/RelatedMenuSettings.js','RelatedMenuSettings',ctx);
  const listeners=new Set();
  const config={
    value:items.map(x=>x && typeof x==='object'?{...x}:x),calls:[],
    getValue(key){ assert.strictEqual(key,'relatedMenu.customLinks'); return this.value; },
    setValue(key,next){
      assert.strictEqual(key,'relatedMenu.customLinks');
      assert.notStrictEqual(next,this.value,'saving must replace the array');
      this.value=next;this.calls.push(next);
      for(const cb of listeners)cb(key,next);
    },
    on(type,cb){assert.strictEqual(type,'update');listeners.add(cb);},
    off(type,cb){listeners.delete(cb);}
  };
  const root=dom.window.document.getElementById('host');
  const panel=Panel.mount(root,{config,actions});
  const q=s=>root.querySelector(s);
  const all=s=>[...root.querySelectorAll(s)];
  const click=s=>{const el=q(s);assert(el,s);el.click();};
  const field=(row,key,value)=>{
    const el=all('[data-rl-row]')[row].querySelector('[data-rl-field="'+key+'"]');
    assert(el,'field '+key);if(el.type==='checkbox')el.checked=Boolean(value);else el.value=String(value);
    el.dispatchEvent(new dom.window.Event(el.type==='checkbox'?'change':'input',{bubbles:true}));
    return el;
  };
  return {dom,root,panel,config,actions,q,all,click,field,cleanup(){panel.dispose();dom.window.close();}};
};

describe('Task314 related-menu custom links settings UI', function(){
  it('provides a dedicated, testable UI module and integrates after legacy handlers',()=>{
    assert.ok(fs.existsSync(path.join(__dirname,'../../src/RelatedMenuSettings.js')),
      'Task314 editor module must exist');
    const text=read('src/_setting.js');
    assert.ok(text.includes('relatedMenuCustomLinksContainer'));
    assert.ok(text.includes('RelatedMenuSettings.mount('));
  });
  it('starts with ordered persisted links and does not save until commit',()=>{
    const h=boot([sample('one'),sample('two')]);
    assert.strictEqual(h.all('[data-rl-row]').length,2);
    assert.strictEqual(h.all('[data-rl-field="id"]')[0].value,'one');
    h.field(0,'label','ラベル変更');
    assert.strictEqual(h.config.calls.length,0);
    assert.strictEqual(h.q('[data-rl-save]').disabled,false);
    h.click('[data-rl-cancel]');
    assert.strictEqual(h.all('[data-rl-field="label"]')[0].value,'動画を見る');
    assert.strictEqual(h.config.calls.length,0);
    h.cleanup();
  });
  it('adds, edits, enables, changes target, and persists normalized fresh list',()=>{
    const h=boot([]);
    h.click('[data-rl-add]');
    h.field(0,'label','新しいリンク');
    h.field(0,'url','https://example.com/{watchId}');
    h.field(0,'enabled',false);
    h.field(0,'openInNewTab',false);
    assert.strictEqual(h.config.calls.length,0);
    h.click('[data-rl-save]');
    assert.strictEqual(h.config.calls.length,1);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(h.config.value)), [{
      id:'link-1',label:'新しいリンク',url:'https://example.com/{watchId}',
      enabled:false,openInNewTab:false
    }]);
    h.cleanup();
  });
  it('duplicates unique IDs, reorders by explicit buttons and deletes',()=>{
    const h=boot([sample('one'),sample('two')]);
    h.click('[data-rl-duplicate="0"]');
    assert.strictEqual(h.all('[data-rl-row]').length,3);
    assert.notStrictEqual(h.all('[data-rl-field="id"]')[1].value,'one');
    h.click('[data-rl-up="2"]');
    h.click('[data-rl-delete="0"]');
    h.click('[data-rl-save]');
    assert.strictEqual(h.config.value.length,2);
    assert.strictEqual(h.config.value[0].id,'two');
    h.cleanup();
  });
  it('inserts a selected variable at URL caret and shows text-only preview',()=>{
    const h=boot([sample()]);
    const url=h.all('[data-rl-field="url"]')[0];
    url.focus();url.setSelectionRange(20,20);
    h.click('[data-rl-insert="videoTitle"]');
    assert.ok(h.all('[data-rl-field="url"]')[0].value.includes('{videoTitle}'));
    assert.ok(h.q('[data-rl-preview]').textContent.includes('https://'));
    assert.strictEqual(h.q('[data-rl-preview]').querySelector('a'),null);
    h.cleanup();
  });
  it('reports missing author data without fabricating an ID',()=>{
    const h=boot([sample()]);
    h.field(0,'url','https://example.com/user/{uploaderUserId}');
    const noOwner=h.q('[data-rl-no-owner]');
    assert.ok(noOwner.textContent.includes('無効'),noOwner.textContent);
    assert.strictEqual(h.q('[data-rl-save]').disabled,false);
    h.cleanup();
  });
  it('rejects bad scheme, unknown token and duplicate IDs before commit',()=>{
    const h=boot([sample('one'),sample('two')]);
    h.field(0,'url','javascript:alert(1)');
    assert.strictEqual(h.q('[data-rl-save]').disabled,true);
    assert.match(h.q('[data-rl-status]').textContent,/URL|不正/);
    h.field(0,'url','https://example.com/{unknown}');
    assert.strictEqual(h.q('[data-rl-save]').disabled,true);
    h.field(0,'url','https://example.com/{videoId}');
    h.field(1,'id','one');
    assert.strictEqual(h.q('[data-rl-save]').disabled,true);
    assert.match(h.all('[data-rl-error]')[1].textContent,/ID|重複/);
    assert.strictEqual(h.config.calls.length,0);
    h.cleanup();
  });
  it('blocks the 41st entry and retains all 40 existing items',()=>{
    const h=boot(Array.from({length:40},(_,i)=>sample('item'+i)));
    assert.strictEqual(h.q('[data-rl-add]').disabled,true);
    h.click('[data-rl-duplicate="0"]');
    assert.strictEqual(h.all('[data-rl-row]').length,40);
    assert.strictEqual(h.config.calls.length,0);
    h.cleanup();
  });
  it('renders hostile labels and URLs as inert text, never HTML markup',()=>{
    const h=boot([{
      id:'x',label:'<img src=x onerror=alert(1)>',
      url:'https://example.com?q={videoId}',enabled:true,openInNewTab:true
    }]);
    assert.strictEqual(h.root.querySelector('img'),null);
    assert.ok(h.all('[data-rl-field="label"]')[0].value.includes('<img'));
    assert.strictEqual(h.root.querySelector('script'),null);
    h.cleanup();
  });
  it('prevents overwriting a newer update while an old draft is open',()=>{
    const h=boot([sample()]);
    h.field(0,'label','ローカル変更');
    h.config.value=[sample('other')];
    h.click('[data-rl-save]');
    assert.strictEqual(h.config.calls.length,0);
    assert.match(h.q('[data-rl-status]').textContent,/別|更新|変更/);
    h.click('[data-rl-cancel]');
    assert.strictEqual(h.all('[data-rl-field="id"]')[0].value,'other');
    h.cleanup();
  });
  it('displays corrupt stored rows safely without silently deleting valid neighbors',()=>{
    const h=boot([sample('one'),null]);
    assert.strictEqual(h.all('[data-rl-row]').length,2);
    assert.strictEqual(h.q('[data-rl-save]').disabled,true);
    assert.match(h.all('[data-rl-error]')[1].textContent,/不正/);
    assert.strictEqual(h.config.calls.length,0);
    h.cleanup();
  });
  it('remounts from exported/imported array without mutating saved data',()=>{
    const initial=[sample('one'),{...sample('two'),enabled:false}];
    const h=boot(JSON.parse(JSON.stringify(initial)));
    assert.deepStrictEqual(JSON.parse(JSON.stringify(h.config.value)),initial);
    const v=h.actions.validateLinks(JSON.parse(JSON.stringify(h.config.value)));
    assert.strictEqual(v.valid,true);
    h.field(0,'label','編集済み');
    h.click('[data-rl-save]');
    const backup=JSON.parse(JSON.stringify(h.config.value));
    const restored=boot(backup);
    assert.strictEqual(restored.all('[data-rl-field="label"]')[0].value,'編集済み');
    restored.cleanup();h.cleanup();
  });
});
