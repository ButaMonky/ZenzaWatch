'use strict';
const assert=require('assert');
const {uiFixture}=require('../helpers/sceneSearchUIFixture');
const {fixture}=require('../helpers/sceneSearchSettingsFixture');
const {loadClass,createContext}=require('../helpers/extractSource');
describe('approved scene settings live preview',function(){
 this.timeout(20000);
 it('validates viewport size and retains children under scene visibility',()=>{
  const h=fixture();
  assert.strictEqual(h.config.default['sceneSearch.enabled'],true);
  assert.strictEqual(h.config.default['sceneSearch.commentListScale'],100);
  h.model.set('sceneSearch.enabled',false);
  assert.strictEqual(h.model.isEnabled('sceneSearch.miniCommentVisible'),false);
  assert.strictEqual(h.model.get('sceneSearch.miniCommentVisible'),true);
  h.model.set('sceneSearch.commentListScale',201);assert(h.model.validate().length);
 });
 it('suppresses a visible scene and allows showing again without losing child choices',()=>{
  const values={'sceneSearch.enabled':true};let last;
  const C=loadClass('packages/zenza/src/sceneSearch/SceneSearchController.js','SceneSearchController',createContext());
  const c=new C({getPreference:k=>values[k],createLayout:()=>({render:s=>last=s,dispose(){}})});
  c.start();c.show();assert(last.shown);
  values['sceneSearch.enabled']=false;c.onPreferencesChanged('sceneSearch.enabled');assert.strictEqual(last.shown,false);
  c.show();assert.strictEqual(c.snapshot.shown,false);
  values['sceneSearch.enabled']=true;c.onPreferencesChanged('sceneSearch.enabled');c.show();assert(c.snapshot.shown);c.dispose();
 });
 it('renders three peer choices and an editable local preview without saving',async()=>{
  const h=await uiFixture();try{
   assert.deepStrictEqual(h.all('[data-zw-scene-layout]').map(x=>x.dataset.zwSceneLayout),['follow','fixed','legacy']);
   assert(!h.q('[data-zw-scene-compat]'));assert(h.q('[data-zw-scene-demo]'));
   assert(h.input('sceneSearch.enabled'));assert(h.input('sceneSearch.commentListScale'));
   h.toggle('sceneSearch.enabled',false);assert(h.q('[data-zw-demo-panels]').hidden);
   h.openSection('表示・非表示');assert.strictEqual(h.input('sceneSearch.enabled').checked,false);
   h.toggle('sceneSearch.enabled',true);h.openSection('シーンサーチ');assert(!h.q('[data-zw-demo-panels]').hidden);
   assert.strictEqual(h.config.getValue('sceneSearch.commentListScale'),100);
  }finally{h.dispose();}
 });
 it('keeps preview typography constant, swaps legacy content, and cancels shared visibility edits',async()=>{
  const h=await uiFixture();try{
   const set=(key,value)=>{const e=h.input('sceneSearch.'+key);e.value=String(value);e.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));e.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));};
   const list=()=>h.q('.zw-scene-demo-list');
   const before=list().style.height,font=h.dom.window.getComputedStyle(list()).fontSize;
   set('commentListScale',200);assert(parseFloat(list().style.height)>parseFloat(before));
   assert.strictEqual(h.dom.window.getComputedStyle(list()).fontSize,font);
   set('commentListBackgroundOpacity',0);assert(list().style.backgroundColor.includes('0)'));
   set('commentListBackgroundOpacity',100);assert(!list().style.backgroundColor.includes(', 0)'));
   h.click('[data-zw-scene-layout="legacy"]');assert(h.q('.zw-scene-demo-image').hidden);
   assert.strictEqual(list().parentElement,h.q('.zw-scene-demo-thumb'));
   h.click('[data-demo-comments]');assert(!h.q('.zw-scene-demo-image').hidden);assert(list().hidden);
   h.openSection('表示・非表示');h.toggle('sceneSearch.enabled',false);
   assert(h.input('sceneSearch.miniCommentVisible').disabled);assert(h.input('sceneSearch.miniCommentVisible').checked);
   h.click('[data-zw-cancel]');h.reopen();assert(h.input('sceneSearch.enabled').checked);
   assert.strictEqual(h.model.get('sceneSearch.commentListScale'),100);
  }finally{h.dispose();}
 });
});
