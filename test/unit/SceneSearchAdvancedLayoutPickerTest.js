'use strict';
const assert=require('assert');
const {uiFixture}=require('../helpers/sceneSearchUIFixture');
describe('scene search three-mode picker',function(){
 this.timeout(20000);
 it('offers three peer choices including the legacy switch presentation',async()=>{
  const h=await uiFixture();try{
   assert.deepStrictEqual(h.all('[data-zw-scene-layout]').map(x=>x.dataset.zwSceneLayout),['follow','fixed','legacy']);
   assert(!h.q('[data-zw-scene-legacy]'));assert(!h.q('details[data-zw-scene-compat]'));
   assert.strictEqual(h.q('[data-zw-scene-layout="follow"]').getAttribute('aria-pressed'),'true');
   assert.strictEqual(h.q('[data-zw-scene-layout="legacy"]').getAttribute('aria-pressed'),'false');
  }finally{h.dispose();}
 });
 it('keeps normal and fullscreen drafts independent until saved and retains linked selection',async()=>{
  const h=await uiFixture();try{
   h.click('[data-zw-scene-layout="fixed"]');
   assert.strictEqual(h.config.resolveSceneSearch().normal,'follow');
   assert.strictEqual(h.model.get('sceneSearch.presentation.normal'),'fixed');
   h.click('[data-zw-scene-layout-mode="fullscreen"]');
   assert.strictEqual(h.q('[data-zw-scene-layout="follow"]').getAttribute('aria-pressed'),'true');
   h.toggle('sceneSearch.layout.linkFullscreen',true);
   assert(h.all('[data-zw-scene-layout]').every(x=>x.disabled));
   h.toggle('sceneSearch.layout.linkFullscreen',false);
   assert.strictEqual(h.model.get('sceneSearch.presentation.fullscreen'),'follow');
   h.click('[data-zw-save]');
   assert.strictEqual(h.config.resolveSceneSearch().normal,'fixed');
   assert.strictEqual(h.config.resolveSceneSearch().fullscreen,'follow');
  }finally{h.dispose();}
 });
 it('selects legacy as a peer and cancels all unsaved choices',async()=>{
  const h=await uiFixture();try{
   h.click('[data-zw-scene-layout="fixed"]');
   h.click('[data-zw-scene-layout="legacy"]');assert.strictEqual(h.model.get('sceneSearch.presentation.normal'),'legacy');
   h.click('[data-zw-scene-layout="fixed"]');assert.strictEqual(h.model.get('sceneSearch.presentation.normal'),'fixed');
   h.click('[data-zw-cancel]');assert.strictEqual(h.model.get('sceneSearch.presentation.normal'),'follow');
  }finally{h.dispose();}
 });
 it('shows migration information until acknowledged and does not rewrite old numbered preferences',async()=>{
  const h=await uiFixture({'sceneSearch.layout.normal':'02'});try{
   const note=h.q('[data-zw-scene-migration]');assert(note);
   assert(note.textContent.includes('02'));assert(note.textContent.includes('位置を固定'));
   h.click('[data-zw-scene-migration-ack]');h.reopen();
   assert.strictEqual(h.q('[data-zw-scene-migration]'),null);
   assert.strictEqual(h.config.getValue('sceneSearch.layout.normal'),'02');
  }finally{h.dispose();}
 });
});
