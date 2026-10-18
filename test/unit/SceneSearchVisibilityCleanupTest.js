'use strict';
const assert=require('assert');
const {uiFixture}=require('../helpers/sceneSearchUIFixture');
const {fixture}=require('../helpers/sceneSearchSettingsFixture');
describe('scene visibility settings reflect the current controls',function(){
 this.timeout(20000);
 it('removes obsolete controls from both navigation and search and keeps the two scene groups adjacent',async()=>{
  const h=await uiFixture();try{
   for(const id of ['ui.scene.pin','ui.scene.seekSeconds','ui.scene.more','ui.scene.panel','sceneSearch.controlsReveal']){
    assert(!h.model.search('').some(d=>d.id===id),id);
   }
   h.openSection('表示・非表示');
   const headings=h.all('[data-zw-visibility-group]').map(n=>n.dataset.zwVisibilityGroup),i=headings.indexOf('scene-comments');
   assert(i>=0);assert.strictEqual(headings[i+1],'scene');
   for(const id of ['ui.scene.pin','ui.scene.seekSeconds','ui.scene.more','ui.scene.panel'])assert(!h.input(id));
   h.toggle('sceneSearch.enabled',false);
   for(const id of ['ui.scene.seekArrows','ui.scene.commentToggle','ui.scene.commentSearch','sceneSearch.commentPreviewVisible','sceneSearch.miniCommentVisible','sceneSearch.commentListVisible'])assert(h.input(id).disabled,id);
   h.toggle('sceneSearch.enabled',true);assert(!h.input('ui.scene.seekArrows').disabled);
   h.toggle('sceneSearch.commentListVisible',false);assert(h.input('ui.scene.commentSearch').disabled);
  }finally{h.dispose();}
 });
 it('migrates the old panel switch without preventing the new parent from restoring display',async()=>{
  const h=await uiFixture({'ui.scene.panel':false});try{
   assert.strictEqual(h.model.get('sceneSearch.enabled'),false);
   const node=h.dom.window.document.createElement('div');node.className='zenzaSceneSearchHost';
   h.context.UiVisibilityRegistry.apply(h.config,node,'ui.scene.panel');assert(node.hidden);
   h.toggle('sceneSearch.enabled',true);h.click('[data-zw-save]');
   assert.strictEqual(h.config.resolveSceneSearch().enabled,true);
   h.context.UiVisibilityRegistry.apply(h.config,node,'ui.scene.panel');assert(!node.hidden);
   h.reopen();assert(h.input('sceneSearch.enabled').checked);
  }finally{h.dispose();}
 });
 it('preserves inherited OFF and explicit ON through backup export/import',async()=>{
  const old=fixture({'SC_ui.scene.panel':'false'});await old.config.restore();
  const imported=fixture();imported.config.import(old.config.export());
  assert.strictEqual(imported.config.resolveSceneSearch().enabled,false);
  old.config.persistSceneSearchSelection({'sceneSearch.enabled':true});
  const backup=old.config.export();assert.strictEqual(backup['sceneSearch.enabled'],true);
  const restored=fixture();restored.config.import(backup);assert.strictEqual(restored.config.resolveSceneSearch().enabled,true);
 });
});
