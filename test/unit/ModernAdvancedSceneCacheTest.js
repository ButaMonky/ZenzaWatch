'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const {JSDOM}=require('jsdom');
const {stripTypeScriptTypes}=require('module');
function load(name){
  const source=fs.readFileSync('tools/typescript-stage1/advanced-src/'+name+'.ts','utf8');
  const body=source.slice(source.indexOf('//===BEGIN===')+14,source.indexOf('//===END==='));
  return vm.runInNewContext(stripTypeScriptTypes(body)+'\n'+name);
}
describe('Task996 scene cache advanced settings',()=>{
  const Model=load('ModernAdvancedSettingsModel');
  const UI=load('ModernAdvancedSettingsUI');
  const defaults={storyboardCacheMaxMB:128,storyboardCacheDays:7,savedSceneFetch:true};
  it('has bounded capacity and retention descriptors and safe defaults',()=>{
    const config={default:defaults,getValue:k=>defaults[k]};
    const model=new Model({config});
    for(const [key,values] of [['storyboardCacheMaxMB',[0,32,64,128,256,512]],['storyboardCacheDays',[1,3,7,14,30]]]){
      const d=model.descriptor(key);
      assert.strictEqual(d.subcategory,'シーンサムネイルのキャッシュ');
      assert.deepStrictEqual(Array.from(d.options,o=>o.value),values);
      model.set(key,999);
      assert(model.validate().some(e=>e.id===key));
      model.set(key,defaults[key]);
    }
    assert.strictEqual(model.get('savedSceneFetch'),true);
    const configSource=fs.readFileSync('tools/typescript-stage1/advanced-src/Config.ts','utf8');
    for(const [k,v] of Object.entries(defaults))assert(configSource.includes(k+': '+v));
  });
  it('clears only the injected image cache and refreshes usage',async()=>{
    const dom=new JSDOM();let clears=0;
    const ui=Object.create(UI.prototype);ui.doc=dom.window.document;
    ui.sceneCache={async clear(){clears++},async stats(){return {bytes:1048576,entries:2}}};
    const panel=ui._createSceneCacheActions();
    await new Promise(resolve=>setTimeout(resolve,0));
    assert(panel.textContent.includes('1.0 MB'));
    panel.querySelector('button').click();
    await new Promise(resolve=>setTimeout(resolve,0));
    assert.strictEqual(clears,1);
    assert(panel.textContent.includes('削除しました'));
    assert.strictEqual(panel.querySelector('button').disabled,false);
    dom.window.close();
  });
  it('reports clear failure without a success message',async()=>{
    const dom=new JSDOM();const ui=Object.create(UI.prototype);ui.doc=dom.window.document;
    ui.sceneCache={async clear(){throw new Error('denied')},async stats(){return {bytes:0,entries:0}}};
    const panel=ui._createSceneCacheActions();panel.querySelector('button').click();
    await new Promise(resolve=>setTimeout(resolve,0));
    assert(panel.textContent.includes('削除できませんでした'));
    assert(!panel.textContent.includes('削除しました'));
    assert.strictEqual(panel.querySelector('button').disabled,false);
    dom.window.close();
  });
});
