'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,run,beginSection}=require('../helpers/extractSource');
function boot(saved=[]){
 const dom=new JSDOM('<!DOCTYPE html><div id="host"></div>',{url:'https://www.nicovideo.jp/my'});
 const c=createContext({window:dom.window,document:dom.window.document,URL});
 run(beginSection('src/NgCompositeRules.js'),c);
 run(beginSection('src/NgCompositeRuleEditor.js'),c);
 run('globalThis.Editor=NgCompositeRuleEditor;globalThis.Engine=NgCompositeRules;',c);
 const changes=[];
 const host=dom.window.document.querySelector('#host');
 const ed=new c.Editor(host,saved,value=>changes.push(JSON.parse(JSON.stringify(value))));
 const query=selector=>host.shadowRoot.querySelector(selector);
 const all=selector=>[...host.shadowRoot.querySelectorAll(selector)];
 const fire=(el,type='change')=>el.dispatchEvent(new dom.window.Event(type,{bubbles:true}));
 const click=selector=>{const el=query(selector);assert(el,selector);el.click();return el};
 return {dom,host,ed,query,all,fire,click,changes,Engine:c.Engine,
  cleanup(){ed.dispose();dom.window.close();}};
}
describe('Task402 composite editor B2',()=>{
 it('has collapsed beginner guide with expanded beginner details and no CA protection',()=>{
  const h=boot();
  try{
    const help=h.query('.ng-help');
    assert(help&&!help.open);
    const prose=help.textContent;
    for(const name of ['AND','OR','NOT','ニコる','投稿者一括NG','既存NG'])assert(prose.includes(name));
    assert(!h.host.shadowRoot.innerHTML.includes('コメントアートを保護する'));
    assert(!h.host.shadowRoot.innerHTML.includes('skipCA'));
    assert.strictEqual(h.ed.getDraft().length,0,'default has no saved rules');
    assert.strictEqual(h.changes.length,0,'constructing preview does not save');
  }finally{h.cleanup();}
 });
 it('creates disabled rule, with nicoru default=1, then edits an AND condition',()=>{
  const h=boot();
  try{
    h.click('[data-ng-act="add"]');
    const draft=h.ed.getDraft();
    assert.strictEqual(draft.length,1);
    assert.strictEqual(draft[0].enabled,false);
    assert.strictEqual(draft[0].nicoruMin,1);
    assert.strictEqual(h.query('[data-rule="nicoruMin"]').value,'1');
    assert(!h.query('.ng-help').open,'form refresh must not expand help by itself');
    const field=h.query('[data-node-field]');field.value='nicoru';h.fire(field);
    assert.strictEqual(h.query('[data-node-field]').value,'nicoru');
    assert.strictEqual(h.ed.getDraft()[0].conditions.nodes[0].value,'1');
    assert(h.changes.length>0);
  }finally{h.cleanup();}
 });
 it('uses real ZenzaWatch colors and color markers and places nicoru after user ID',()=>{
  const h=boot();
  try{
    h.click('[data-ng-act="add"]');
    h.click('[data-ng-act="add-node"]');
    const selections=h.all('[data-node-field]');
    assert(selections.length>=2);
    const field=selections[1];field.value='color';h.fire(field);
    const select=h.query('select[data-node-value]');
    assert(select);
    const options=[...select.options].map(x=>x.textContent);
    assert(options.some(x=>x.includes('赤')&&x.includes('#FF0000')));
    assert(options.some(x=>x.includes('truered')&&x.includes('#CC0033')));
    assert(h.query('.ng-dot'));
    const fields=h.ed.constructor.fields.map(x=>x[0]);
    assert(fields.indexOf('user')<fields.indexOf('nicoru'));
    assert(fields.indexOf('nicoru')<fields.indexOf('position'));
  }finally{h.cleanup();}
 });
 it('supports copy, order, deletion and restoring cancel snapshots',()=>{
  const h=boot();
  try{
    h.click('[data-ng-act="add"]');const original=h.ed.getDraft();
    h.click('[data-ng-act="duplicate"]');
    assert.strictEqual(h.ed.getDraft().length,2);
    assert(h.ed.getDraft()[1].name.includes('コピー'));
    const duplicatedId=h.ed.getDraft()[1].id;
    h.click('[data-ng-act="up"]:not([disabled])');
    const moved=h.ed.getDraft();
    assert.strictEqual(moved[0].id,duplicatedId);
    h.ed.replaceDraft(original);
    assert.strictEqual(h.ed.getDraft().length,1);
    h.click('[data-ng-act="delete"]');
    assert.strictEqual(h.ed.getDraft().length,0);
  }finally{h.cleanup();}
 });
 it('allows choosing hide-author and prioritizing nicoru protected comments',()=>{
  const h=boot();
  try{
    h.click('[data-ng-act="add"]');
    const action=h.query('[data-rule="action"]');action.value='hideAuthor';h.fire(action);
    const state=h.ed.getDraft()[0];
    assert.strictEqual(state.action,'hideAuthor');
    assert(h.query('[data-rule="keepProtectedOnAuthorHide"]'));
    const protect=h.query('[data-rule="exemptNicoru"]');protect.checked=true;h.fire(protect);
    assert.strictEqual(h.ed.getDraft()[0].exemptNicoru,true);
    const threshold=h.query('[data-rule="nicoruMin"]');
    assert.strictEqual(threshold.value,'1');
    assert(h.query('[data-ng-result]'));
  }finally{h.cleanup();}
 });
});
