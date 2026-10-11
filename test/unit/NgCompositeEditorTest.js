'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,beginSection,run}=require('../helpers/extractSource');
function boot(saved=[]){
 const dom=new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>',{url:'https://www.nicovideo.jp/my'});
 const ctx=createContext({window:dom.window,document:dom.window.document});
 run(beginSection('src/NgCompositeRules.js'),ctx);
 run(beginSection('src/NgCompositeRuleEditor.js')+'\nthis.NgCompositeRuleEditor=NgCompositeRuleEditor;',ctx);
 const Model=ctx.NgCompositeRuleEditor, changes=[];
 const host=dom.window.document.getElementById('host');
 const editor=new Model(host,saved,value=>changes.push(value));
 const q=selector=>host.shadowRoot.querySelector(selector);
 const act=(sel,ev='change')=>{const el=q(sel);assert(el,sel);
  el.dispatchEvent(new dom.window.Event(ev,{bubbles:true,cancelable:true}));return el;};
 const click=sel=>{const el=q(sel);assert(el,sel);el.click();};
 const cleanup=()=>{editor.dispose();dom.window.close();};
 return {dom,host,editor,changes,q,act,click,cleanup};
}
describe('Task402 composite NG UI editor',()=>{
 it('has collapsed beginner help, full description, no CA protection and nicoru default 1',()=>{
  const h=boot();
  try{
   assert(h.q('details.ng-help'));
   assert.strictEqual(h.q('details.ng-help').open,false);
   assert(h.q('details.ng-help').textContent.includes('AND'));
   assert(h.q('details.ng-help').textContent.includes('投稿者一括'));
   assert.strictEqual(h.q('input[id="skip-ca"]'),null);
   h.click('[data-ng-act="add"]');
   assert.strictEqual(h.editor.getDraft()[0].nicoruMin,1);
   assert(h.q('[data-rule="nicoruMin"]'));
  }finally{h.cleanup();}
 });
 it('creates a disabled rule and edits a text condition using the saved draft',()=>{
  const h=boot();
  try{
   h.click('[data-ng-act="add"]');
   const value=h.editor.getDraft();
   assert.strictEqual(value.length,1);
   assert.strictEqual(value[0].enabled,false);
   const input=h.q('[data-node-value]');
   assert(input);input.value='中国';h.act('[data-node-value]','input');
   assert.strictEqual(h.editor.getDraft()[0].conditions.nodes[0].value,'中国');
   assert(h.changes.length>=2);
   assert.strictEqual(h.editor.getDraft()[0].nicoruMin,1);
  }finally{h.cleanup();}
 });
 it('can edit a condition color and preserve nicknames from the source colors',()=>{
  const h=boot();
  try{
   h.click('[data-ng-act="add"]');
   const field=h.q('[data-node-field]');field.value='color';h.act('[data-node-field]');
   const opt=h.q('[data-node-value] option[value="red2"]');
   assert(opt);
   assert(h.q('.ng-color .ng-dot'));
   const color=h.q('[data-node-value]');color.value='red2';h.act('[data-node-value]');
   assert.strictEqual(h.editor.getDraft()[0].conditions.nodes[0].value,'red2');
  }finally{h.cleanup();}
 });
 it('keeps its instance draft separate and allows discard and restoration',()=>{
  const h=boot();
  try{
   h.click('[data-ng-act="add"]');
   const initial=h.editor.getDraft();
   initial[0].name='copied';
   assert.strictEqual(h.editor.getDraft()[0].name,'新しい複合ルール');
   h.editor.replaceDraft([]);
   assert.deepStrictEqual(h.editor.getDraft(),[]);
   h.editor.replaceDraft(initial);
   assert.strictEqual(h.editor.getDraft()[0].name,'copied');
   assert.strictEqual(h.q('details.ng-help').open,false);
  }finally{h.cleanup();}
 });
});
