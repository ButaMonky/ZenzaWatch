'use strict';
const assert=require('assert');
const {uiFixture}=require('../helpers/sceneSearchUIFixture');
const parent='sceneSearch.commentPreviewVisible',mini='sceneSearch.miniCommentVisible',list='sceneSearch.commentListVisible';
describe('scene search shared visibility editor',function(){
 this.timeout(20000);
 it('synchronizes drafts, disabled children, cancel, saved glow and reset across both sections',async()=>{
  const h=await uiFixture();try{
   h.toggle(mini,false);h.openSection('表示・非表示');
   assert(h.input(mini),'same child must be accessible from visibility settings');
   assert.strictEqual(h.input(mini).checked,false);assert.strictEqual(h.modified(mini),true);
   h.toggle(parent,false);
   assert.strictEqual(h.input(mini).disabled,true);assert.strictEqual(h.input(list).disabled,true);
   assert.strictEqual(h.input(list).checked,true);
   h.openSection('シーンサーチ');assert.strictEqual(h.input(mini).checked,false);
   h.click('[data-zw-cancel]');assert.strictEqual(h.input(mini).checked,true);
   h.toggle(mini,false);h.click('[data-zw-save]');h.reopen();
   assert.strictEqual(h.modified(mini),true);
   h.openSection('表示・非表示');
   h.click('[data-zw-reset-item="'+mini+'"]');
   assert.strictEqual(h.modified(mini),false);
   h.openSection('シーンサーチ');assert.strictEqual(h.input(mini).checked,true);
  }finally{h.dispose();}
 });
 it('registers all three visibility preferences once in parent/child order',async()=>{
  const h=await uiFixture();try{
   const rows=h.model.sectionDescriptors('画面・映像','表示・非表示');
   assert.deepStrictEqual(Array.from(rows.filter(x=>[parent,mini,list].includes(x.id)),x=>x.id),[parent,mini,list]);
   assert.strictEqual(h.model.descriptors.filter(x=>x.id===mini).length,1);
   h.openSection('表示・非表示');
   assert(h.q('[data-zw-visibility-group="scene-comments"]'));
   assert.strictEqual(h.all('[data-setting-name="'+mini+'"]').length,1);
  }finally{h.dispose();}
 });
});
