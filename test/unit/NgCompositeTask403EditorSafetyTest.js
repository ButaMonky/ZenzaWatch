'use strict';
const assert=require('assert'),{JSDOM}=require('jsdom');
const {beginSection,extract,createContext,run}=require('../helpers/extractSource');
const {rule}=require('../helpers/compositeTask403');
for(const kind of (process.env.TASK403_DIST==='1'?['source','dist']:['source']))describe('Task403 editor safe drafts '+kind,()=>{
 function boot(saved=[],fixed=false){
  const dom=new JSDOM('<div id="root"></div>',{url:'https://example.invalid'});
  const maths=Object.create(Math);if(fixed)maths.random=()=>0.5;
  const c=createContext({document:dom.window.document,window:dom.window,Math:maths,
    Date:fixed?class extends Date{static now(){return 123;}}:Date});
  if(kind==='source'){
   run(beginSection('src/NgCompositeRules.js'),c);run(beginSection('src/NgCompositeRuleEditor.js'),c);
  }else{
   const d='dist/ZenzaAdvancedSettings.user.js';
   run('const NG_COLOR_HEX='+extract(d,'NG_COLOR_HEX','var')+';',c);
   run(extract(d,'NgCompositeRules'),c);run(extract(d,'NgCompositeRuleEditor'),c);
  }
  run('globalThis.Editor=NgCompositeRuleEditor;',c);const changes=[];
  const host=dom.window.document.querySelector('#root');
  const editor=new c.Editor(host,saved,value=>changes.push(value));
  return {editor,changes,q:s=>host.shadowRoot.querySelector(s),close(){editor.dispose();dom.window.close();}};
 }
 it('keeps rule and node identities unique even with identical clock and randomness',()=>{
  const h=boot([],true);
  try{
   h.q('[data-ng-act="add"]').click();h.q('[data-ng-act="add-node"]').click();
   h.q('[data-ng-act="duplicate"]').click();h.q('[data-ng-act="add"]').click();
   const ids=[];for(const r of h.editor.getDraft()){
    ids.push(r.id);const walk=n=>{ids.push(n.id);n.nodes?.forEach(walk);};walk(r.conditions);
   }
   assert.strictEqual(new Set(ids).size,ids.length,'distinct editor controls need distinct IDs');
  }finally{h.close();}
 });
 it('rejects a structurally malformed replacement without losing the current draft',()=>{
  const saved=[rule()],h=boot(saved);
  try{
   const prior=h.editor.getDraft();
   assert.throws(()=>h.editor.replaceDraft([null]));
   assert.deepStrictEqual(h.editor.getDraft(),prior);
   assert.throws(()=>h.editor.replaceDraft([saved[0],{...saved[0]}]));
   assert.deepStrictEqual(h.editor.getDraft(),prior);
   assert.strictEqual(h.changes.length,0);
  }finally{h.close();}
 });
 it('preserves safely renderable incomplete edits through cancellation/category remount',()=>{
  const h=boot();
  try{
   h.q('[data-ng-act="add"]').click();const draft=h.editor.getDraft();
   const clone=boot(draft);try{assert.deepStrictEqual(clone.editor.getDraft(),draft);}finally{clone.close();}
   h.editor.replaceDraft(draft);assert.deepStrictEqual(h.editor.getDraft(),draft);
  }finally{h.close();}
 });
 it('shows an invalid-data warning without emitting a replacement for malformed saved settings',()=>{
  const h=boot({bad:'value'});
  try{
   assert(h.q('[data-ng-invalid-saved]'));
   assert.strictEqual(h.changes.length,0);
   assert(h.q('[data-ng-act="add"]').disabled);
  }finally{h.close();}
 });
});
