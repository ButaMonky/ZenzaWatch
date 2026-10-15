'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
function fixture(){
 const dom=new JSDOM('<!doctype html><html><body><section id="panel"></section></body></html>',
   {url:'https://www.nicovideo.jp/my'});
 const ctx=createContext({document:dom.window.document,window:dom.window,URL});
 ctx.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',ctx);
 const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',ctx);
 const UI=loadClass('src/ModernAdvancedSettingsUI.js','ModernAdvancedSettingsUI',ctx);
 const defaults={
   'sceneSearch.layout.normal':'01',
   'sceneSearch.layout.fullscreen':'02',
   'sceneSearch.layout.linkFullscreen':false,
   'sceneSearch.seekStepSeconds':5,
   'sceneSearch.controlsReveal':'hover-focus',
   'sceneSearch.animation':'subtle',
   'sceneSearch.commentPreviewVisible':true,
   'sceneSearch.idleHideSeconds':2,
   enableCommentPreview:false,
   ...ctx.UiVisibilityRegistry.defaults()
 };
 const data={...defaults},writes=[],events=[];
 const cfg={default:defaults,getValue:k=>data[k],setValue:(k,v)=>{data[k]=v;writes.push([k,v]);},
   options:{validateImport:(k,v)=>{const d=defaults[k];return typeof v===typeof d&&
     (!k.startsWith('sceneSearch.layout.')||k==='sceneSearch.layout.linkFullscreen'||
       /^(0[1-9]|10)$/.test(v));}}};
 const model=new Model({config:cfg,actions:[]});
 const panel=dom.window.document.getElementById('panel');
 dom.window.addEventListener('ZenzaWatch-advanced-settings-saved',e=>events.push(e.detail.keys));
 const ui=new UI({panel,model,storage:dom.window.localStorage,
   confirm:()=>true,onClose:()=>{}});
 ui.selected={category:'画面・映像',subcategory:'シーンサーチ'};
 ui._renderCards();
 const q=s=>panel.querySelector(s),all=s=>Array.from(panel.querySelectorAll(s));
 const click=s=>{const el=q(s);assert(el,s);el.click();};
 return {dom,ui,model,cfg,data,writes,events,q,all,click,dispose:()=>{ui.dispose();dom.window.close();}};
}
describe('SCUI-10 advanced scene-search normal/fullscreen visual layout picker',()=>{
 it('shows ten miniature layouts in a regular-mode gallery',()=>{
   const h=fixture();
   try{
     assert.strictEqual(h.all('[data-zw-scene-layout]').length,10);
     assert.strictEqual(h.all('.zw-scui-mini').length,10);
     assert.strictEqual(h.q('[data-zw-scene-layout="01"]').getAttribute('aria-pressed'),'true');
     assert.strictEqual(h.q('[data-zw-scene-layout-mode="normal"]').getAttribute('aria-pressed'),'true');
     assert.strictEqual(h.q('[data-zw-scene-layout="07"] .zw-scui-mini').dataset.layout,'07');
     assert.strictEqual(h.writes.length,0);
   }finally{h.dispose();}
 });
 it('selects normal and fullscreen independently, preserving original values until save',()=>{
   const h=fixture();
   try{
     h.click('[data-zw-scene-layout="06"]');
     assert.strictEqual(h.model.get('sceneSearch.layout.normal'),'06');
     assert.strictEqual(h.data['sceneSearch.layout.normal'],'01');
     h.click('[data-zw-scene-layout-mode="fullscreen"]');
     assert.strictEqual(h.q('[data-zw-scene-layout="02"]').getAttribute('aria-pressed'),'true');
     h.click('[data-zw-scene-layout="09"]');
     assert.strictEqual(h.model.get('sceneSearch.layout.fullscreen'),'09');
     assert.strictEqual(h.data['sceneSearch.layout.fullscreen'],'02');
     h.click('[data-zw-save]');
     assert.strictEqual(h.data['sceneSearch.layout.normal'],'06');
     assert.strictEqual(h.data['sceneSearch.layout.fullscreen'],'09');
     assert.strictEqual(h.events.length,1);
   }finally{h.dispose();}
 });
 it('cancels drafts and resets layouts using the standard advanced settings controls',()=>{
   const h=fixture();
   try{
     h.click('[data-zw-scene-layout="10"]');
     assert.strictEqual(h.model.isDirty(),true);
     h.click('[data-zw-cancel]');
     assert.strictEqual(h.model.get('sceneSearch.layout.normal'),'01');
     assert.strictEqual(h.data['sceneSearch.layout.normal'],'01');
     assert.strictEqual(h.writes.length,0);
     h.click('[data-zw-scene-layout-mode="fullscreen"]');
     h.click('[data-zw-reset-category]');
     assert.strictEqual(h.model.get('sceneSearch.layout.fullscreen'),'02',
       'subsection reset may have custom Config defaults');
     assert.strictEqual(h.data['sceneSearch.layout.fullscreen'],'02');
   }finally{h.dispose();}
 });
 it('disables fullscreen gallery while linked and restores the prior fullscreen value',()=>{
   const h=fixture();
   try{
     const checkbox=h.q('input[data-setting-name="sceneSearch.layout.linkFullscreen"]');
     assert(checkbox);
     checkbox.checked=true;
     checkbox.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));
     h.click('[data-zw-scene-layout-mode="fullscreen"]');
     assert(h.all('[data-zw-scene-layout]').every(x=>x.disabled));
     assert.strictEqual(h.q('[data-zw-scene-layout="02"]').getAttribute('aria-pressed'),'true');
     assert.strictEqual(h.model.get('sceneSearch.layout.fullscreen'),'02');
     checkbox.checked=false;
     // Re-rendered by the link change; find the new checkbox.
     const unlinked=h.q('input[data-setting-name="sceneSearch.layout.linkFullscreen"]');
     unlinked.checked=false;
     unlinked.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));
     assert(h.all('[data-zw-scene-layout]').every(x=>!x.disabled));
   }finally{h.dispose();}
 });
});
