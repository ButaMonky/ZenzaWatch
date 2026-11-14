'use strict';
// Task933: old public Task801 is a floor, not an alternative to private Task926+.
const assert=require('assert');
const {createContext,loadClass,read}=require('../helpers/extractSource');

function descriptors(file,registryFile){
  const c=createContext({});
  c.UiVisibilityRegistry=loadClass(registryFile,'UiVisibilityRegistry',c);
  const M=loadClass(file,'ModernAdvancedSettingsModel',c);
  return {
    settings:new Set(M.visibleExtraSettings().map(x=>x.id)),
    visibility:new Set(c.UiVisibilityRegistry.descriptors().map(x=>x.id))
  };
}
describe('Task933 public Task801 to private setting coverage',function(){
  this.timeout(30000);
  let stable,trial;
  before(function(){
    const previous='review/task801/ZenzaAdvancedSettings.user.js';
    stable=descriptors(previous,previous);
    trial=descriptors('src/ModernAdvancedSettingsModel.js','src/UiVisibilityRegistry.js');
  });
  it('retains all public Task801 setting IDs without importing old UI over new UI',()=>{
    const missing=[...stable.settings].filter(x=>!trial.settings.has(x));
    assert.deepStrictEqual(missing,[],'Missing public setting descriptors');
    assert(trial.settings.has('popup.notifyColor'));
    assert(trial.settings.has('popup.alertColor'));
    assert(trial.settings.has('popup.backgroundTransparency'));
  });
  it('retains public visibility toggles with the extra notification history button',()=>{
    const missing=[...stable.visibility].filter(x=>!trial.visibility.has(x));
    assert.deepStrictEqual(missing,[],'Missing public visibility toggles');
    assert(trial.visibility.has('ui.bar.notificationHistory'));
  });
  it('keeps historical review bundles separate from installable private dist',()=>{
    const src=read('review/task801/ZenzaWatch-dev.user.js');
    const current=read('dist/ZenzaWatch-dev.user.js');
    for(const type of ['SceneSearchPreferences','SceneSearchPreviewView','SceneSearchPlacement']){
      assert(src.includes('class '+type),type+' absent from public Task801');
      assert(current.includes('class '+type),type+' absent from private runtime');
    }
    assert(src.includes('2.7.316-task801'));
    assert(current.includes('popup.backgroundTransparency'));
  });
  it('preserves the public settings UI, model and visibility API methods',()=>{
    for(const name of ['ModernAdvancedSettingsUI','ModernAdvancedSettingsModel','UiVisibilityRegistry']){
      const oldContext=createContext(),newContext=createContext();
      const oldSource='review/task801/ZenzaAdvancedSettings.user.js';
      const currentSource='src/'+name+'.js';
      if(name!=='UiVisibilityRegistry'){
        oldContext.UiVisibilityRegistry=loadClass(oldSource,'UiVisibilityRegistry',oldContext);
        newContext.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',newContext);
      }
      const older=loadClass(oldSource,name,oldContext);
      const newer=loadClass(currentSource,name,newContext);
      for(const [previous,latest] of [[older.prototype,newer.prototype],[older,newer]]){
        const missing=Object.getOwnPropertyNames(previous).filter(x=>!Object.hasOwn(latest,x));
        assert.deepStrictEqual(missing,[],name+' public API member is missing');
      }
    }
  });
});
