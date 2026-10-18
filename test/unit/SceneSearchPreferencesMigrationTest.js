'use strict';
const assert=require('assert'),fs=require('fs');
const {loadClass,createContext}=require('../helpers/extractSource');
const runtime='packages/zenza/src/sceneSearch/SceneSearchPreferences.js';
function resolve(values={},saved=Object.keys(values)){
  assert(fs.existsSync(runtime),'scene preferences must have a generated runtime');
  const P=loadClass(runtime,'SceneSearchPreferences',createContext());
  return P.resolve(k=>values[k],k=>saved.includes(k));
}
describe('scene search preference migration',()=>{
  it('migrates every saved old layout without changing stored values',()=>{
    for(const [id,want] of [['00','legacy'],['01','follow'],['02','fixed'],['03','fixed'],
      ['04','fixed'],['05','fixed'],['06','follow'],['07','fixed'],['08','fixed'],['09','fixed'],['10','fixed']]){
      const v={'sceneSearch.layout.normal':id,'sceneSearch.layout.fullscreen':id};
      const p=resolve(v);assert.strictEqual(p.normal,want);assert.strictEqual(p.fullscreen,want);
      assert.strictEqual(v['sceneSearch.layout.normal'],id);
      assert.strictEqual(p.migration.length,2);
    }
  });
  it('defaults to follow and prioritizes only valid explicitly saved new choices',()=>{
    assert.strictEqual(resolve().normal,'follow');
    assert.strictEqual(resolve({'sceneSearch.layout.normal':'02','sceneSearch.presentation.normal':'follow'},
      ['sceneSearch.layout.normal']).normal,'fixed');
    assert.strictEqual(resolve({'sceneSearch.layout.normal':'02','sceneSearch.presentation.normal':'follow'}).normal,'follow');
    assert.strictEqual(resolve({'sceneSearch.layout.normal':'02','sceneSearch.presentation.normal':'bad'}).normal,'fixed');
    assert.strictEqual(resolve({'sceneSearch.layout.fullscreen':'00','sceneSearch.layout.linkFullscreen':true}).fullscreen,'legacy');
  });
  it('retains hidden before child is saved, but explicit true restores flow',()=>{
    const v={'sceneSearch.miniCommentMode':'hidden','sceneSearch.miniCommentVisible':true};
    assert.strictEqual(resolve(v,['sceneSearch.miniCommentMode']).miniEnabled,false);
    assert.strictEqual(resolve(v).miniEnabled,true);
    assert.strictEqual(resolve(v).miniStyle,'flow');
  });
  it('retains static across parent and child off/on without clearing the list request',()=>{
    const v={'sceneSearch.miniCommentMode':'static',enableCommentPreview:true};
    for(const parent of [true,false,true]){
      v['sceneSearch.commentPreviewVisible']=parent;
      const p=resolve(v);assert.strictEqual(p.miniStyle,'static');assert.strictEqual(p.miniEnabled,parent);
      assert.strictEqual(p.listOpen,parent);assert.strictEqual(v.enableCommentPreview,true);
    }
    v['sceneSearch.commentListVisible']=false;assert.strictEqual(resolve(v).listOpen,false);
    v['sceneSearch.commentListVisible']=true;assert.strictEqual(resolve(v).listOpen,true);
    assert.strictEqual(resolve({'sceneSearch.commentListVisible':true}).listOpen,false);
  });
  it('uses valid bounded appearance values without changing preferences',()=>{
    assert.strictEqual(resolve({'sceneSearch.thumbnailScale':200}).scale,200);
    assert.strictEqual(resolve({'sceneSearch.thumbnailScale':201}).scale,100);
    assert.strictEqual(resolve({'sceneSearch.commentListBackgroundOpacity':0}).opacity,0);
    assert.strictEqual(resolve({'sceneSearch.commentListBackgroundOpacity':2.5}).opacity,90);
  });
});
