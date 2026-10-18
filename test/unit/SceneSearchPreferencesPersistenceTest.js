'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/sceneSearchSettingsFixture');
const mini='sceneSearch.miniCommentVisible';
describe('scene search explicit settings persistence',()=>{
  it('distinguishes defaults, valid saved JSON, malformed JSON and inaccessible storage',()=>{
    const {config,storage}=fixture();
    assert.strictEqual(typeof config.hasStoredValue,'function');
    assert.strictEqual(config.hasStoredValue(mini),false);
    storage['SC_'+mini]='true';assert.strictEqual(config.hasStoredValue(mini),true);
    storage['SC_'+mini]='"bad"';assert.strictEqual(config.hasStoredValue(mini),false);
    storage['SC_'+mini]='{';assert.strictEqual(config.hasStoredValue(mini),false);
    config.storage=new Proxy({},{get(){throw Error('denied');}});
    assert.strictEqual(config.hasStoredValue(mini),false);
  });
  it('persists explicit default true over old hidden and survives a real restore',async()=>{
    const {config,storage}=fixture({'SC_sceneSearch.miniCommentMode':'"hidden"'});
    await config.restore();
    assert.strictEqual(typeof config.resolveSceneSearch,'function');
    assert.strictEqual(config.resolveSceneSearch().miniEnabled,false);
    config.persistSceneSearchSelection({[mini]:true});
    assert.strictEqual(storage['SC_'+mini],'true');
    const other=fixture(storage);await other.config.restore();
    assert.strictEqual(other.config.resolveSceneSearch().miniEnabled,true);
    assert.strictEqual(other.config.resolveSceneSearch().miniStyle,'flow');
    assert.strictEqual(other.config.getValue('sceneSearch.miniCommentMode'),'hidden');
  });
  it('imports old backups using old choices and exports explicit default overrides',()=>{
    const {config}=fixture();
    config.import({'sceneSearch.layout.normal':'02','sceneSearch.miniCommentMode':'hidden'});
    assert.strictEqual(typeof config.resolveSceneSearch,'function');
    assert.strictEqual(config.resolveSceneSearch().normal,'fixed');
    assert.strictEqual(config.resolveSceneSearch().miniEnabled,false);
    config.persistSceneSearchSelection({[mini]:true,'sceneSearch.presentation.normal':'follow'});
    const backup=config.export();
    assert.strictEqual(backup[mini],true);
    assert.strictEqual(backup['sceneSearch.presentation.normal'],'follow');
    const restored=fixture().config;restored.import(backup);
    assert.strictEqual(restored.resolveSceneSearch().miniEnabled,true);
    assert.strictEqual(restored.resolveSceneSearch().normal,'follow');
  });
  it('validates an explicit batch before writing any key and refuses readonly',()=>{
    const {config,storage}=fixture();
    assert.strictEqual(typeof config.persistSceneSearchSelection,'function');
    assert.throws(()=>config.persistSceneSearchSelection({[mini]:false,'sceneSearch.thumbnailScale':201}));
    assert.strictEqual(storage['SC_'+mini],undefined);assert.strictEqual(config.getValue(mini),true);
    config.readonly=true;assert.throws(()=>config.persistSceneSearchSelection({[mini]:false}));
    assert.strictEqual(config.getValue(mini),true);
  });
  it('rolls back memory and prior storage presence if a later write fails',()=>{
    let writes=0;const values={};
    const storage=new Proxy(values,{set(target,key,value){
      if(++writes===2)throw Error('quota');target[key]=value;return true;
    }});
    const {config}=fixture(storage);
    assert.strictEqual(typeof config.persistSceneSearchSelection,'function');
    assert.throws(()=>config.persistSceneSearchSelection({[mini]:false,'sceneSearch.commentListVisible':false}),/quota/);
    assert.deepStrictEqual(values,{});assert.strictEqual(config.getValue(mini),true);
  });
  it('migrates old hidden into a draft without changing live values and preserves it when parent is saved',async()=>{
    const {config,model,storage}=fixture({'SC_sceneSearch.miniCommentMode':'"hidden"'});
    await config.restore();model.cancel();
    assert.strictEqual(model.get(mini),false);
    assert.strictEqual(model.isDifferentFromDefault(mini),true);
    model.set('sceneSearch.commentPreviewVisible',false);model.save();
    model.set('sceneSearch.commentPreviewVisible',true);model.save();
    assert.strictEqual(config.resolveSceneSearch().miniEnabled,false);
    model.set(mini,true);model.save();await config.restore();model.cancel();
    assert.strictEqual(model.get(mini),true);assert.strictEqual(storage['SC_'+mini],'true');
  });
});
