"use strict";
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {stripTypeScriptTypes}=require('module');
const source=fs.readFileSync('tools/typescript-stage1/advanced-src/ModernAdvancedSettingsModel.ts','utf8');
const body=source.slice(source.indexOf('//===BEGIN===')+14,source.indexOf('//===END==='));
const Model=vm.runInNewContext(stripTypeScriptTypes(body)+'\nModernAdvancedSettingsModel');
describe('Task998 saved library settings',()=>{
 it('provides independent thumbnail switches and bounded appearance controls',()=>{
  const defaults={'bookmark.showVideoThumbnails':true,'bookmark.showScenePreviews':true,
   'bookmark.thumbnailWidth':80,'bookmark.titleFontSize':13,'bookmark.titleLines':1};
  const model=new Model({config:{default:defaults,getValue:k=>defaults[k]}});
  for(const key of Object.keys(defaults)){
   assert.equal(model.descriptor(key).subcategory,'ここまで見た・しおり・ABリピート');
   assert.equal(model.get(key),defaults[key]);
  }
  model.set('bookmark.showVideoThumbnails',false);
  assert.equal(model.get('bookmark.showScenePreviews'),true);
  for(const [key,value] of [['bookmark.thumbnailWidth',161],['bookmark.titleFontSize',10],['bookmark.titleLines',4]]){
   model.set(key,value);assert(model.validate().some(e=>e.id===key));model.set(key,defaults[key]);
  }
 });
});
