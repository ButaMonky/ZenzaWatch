'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
const visible=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',createContext());
const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',
  createContext({UiVisibilityRegistry:visible}));
const prefs={
 'sceneSearch.layout.normal':'01',
 'sceneSearch.layout.fullscreen':'02',
 'sceneSearch.layout.linkFullscreen':false,
 'sceneSearch.seekStepSeconds':5,
 'sceneSearch.controlsReveal':'hover-focus',
 'sceneSearch.animation':'subtle',
 'sceneSearch.commentPreviewVisible':true,
 'sceneSearch.idleHideSeconds':2,
 'enableCommentPreview':false,'enableStoryboard':true,
 'volume':0.4
};
function fixture(){
 const defaults={...prefs,...visible.defaults()};
 const saved={...defaults},writes=[];
 const valid=(k,v)=>{
   if(k.startsWith('sceneSearch.layout.')&&k!=='sceneSearch.layout.linkFullscreen'){
     return typeof v==='string'&&/^(0[1-9]|10)$/.test(v);
   }
   if(k==='sceneSearch.seekStepSeconds')return Number.isSafeInteger(v)&&v>=0&&v<=600;
   if(k==='sceneSearch.idleHideSeconds')return typeof v==='number'&&Number.isFinite(v)&&
     v>=0&&v<=30&&Number.isInteger(v*2);
   if(k==='sceneSearch.controlsReveal')return ['hover-focus','click','always'].includes(v);
   if(k==='sceneSearch.animation')return ['off','subtle','full'].includes(v);
   return typeof v===typeof defaults[k];
 };
 const cfg={
   default:defaults,
   getValue:k=>saved[k],
   setValue:(k,v)=>{writes.push([k,v]);saved[k]=v;},
   options:{validateImport:valid}
 };
 const model=new Model({config:cfg,actions:[]});
 return {model,saved,writes};
}
describe('SCUI-09 advanced scene-search descriptors and shared settings',()=>{
 it('has eight canonical keys under 画面・映像 > シーンサーチ',()=>{
   const {model}=fixture();
   const entries=model.sectionDescriptors('画面・映像','シーンサーチ');
   assert.strictEqual(entries.length,9);
   assert.strictEqual(new Set(entries.map(x=>x.id)).size,9);
   for(const k of Object.keys(prefs).filter(x=>x.startsWith('sceneSearch.'))){
     const d=model.descriptor(k);
     assert(d,k);
     assert.strictEqual(d.category,'画面・映像');
     assert.strictEqual(d.subcategory,'シーンサーチ');
   }
 });
 it('supplies all ten labeled choices for both normal and fullscreen',()=>{
   const {model}=fixture();
   for(const mode of ['normal','fullscreen']){
     const d=model.descriptor('sceneSearch.layout.'+mode);
     assert.strictEqual(d.type,'select');
     assert.deepStrictEqual(Array.from(d.options,x=>x.value),
       Array.from({length:11},(_,i)=>String(i).padStart(2,'0')));
   }
 });
 it('links fullscreen without deleting its saved choice',()=>{
   const {model,saved,writes}=fixture();
   model.set('sceneSearch.layout.normal','06');
   model.set('sceneSearch.layout.linkFullscreen',true);
   assert.strictEqual(model.isEnabled('sceneSearch.layout.fullscreen'),false);
   assert.strictEqual(model.get('sceneSearch.layout.fullscreen'),'02');
   model.save();
   assert.strictEqual(saved['sceneSearch.layout.fullscreen'],'02');
   assert(!writes.some(x=>x[0]==='sceneSearch.layout.fullscreen'));
   model.set('sceneSearch.layout.linkFullscreen',false);
   assert.strictEqual(model.isEnabled('sceneSearch.layout.fullscreen'),true);
 });
 it('does not confuse the new comment visibility with legacy hover/list mode',()=>{
   const {model,saved}=fixture();
   model.set('sceneSearch.commentPreviewVisible',false);
   assert.strictEqual(model.get('enableCommentPreview'),false);
   model.save();
   assert.strictEqual(saved.enableCommentPreview,false);
   assert.strictEqual(saved['sceneSearch.commentPreviewVisible'],false);
 });
 it('cancel, subsection reset and validation are independent',()=>{
   const {model,saved,writes}=fixture();
   model.set('sceneSearch.idleHideSeconds',4.5);
   model.set('sceneSearch.layout.fullscreen','10');
   model.cancel();
   assert.strictEqual(model.get('sceneSearch.idleHideSeconds'),2);
   assert.strictEqual(model.get('sceneSearch.layout.fullscreen'),'02');
   model.set('sceneSearch.seekStepSeconds',1000);
   assert(model.validate().some(e=>e.id==='sceneSearch.seekStepSeconds'));
   model.resetSubcategory('画面・映像','シーンサーチ');
   assert.strictEqual(model.get('sceneSearch.seekStepSeconds'),5);
   assert.strictEqual(model.get('volume'),0.4);
   assert.strictEqual(model.isDirty(),false);
   assert.strictEqual(writes.length,0);
   assert.strictEqual(saved.volume,0.4);
 });
 it('preserves single data owner for each visibility key',()=>{
   const {model}=fixture();
   const descriptions=model.sectionDescriptors('画面・映像','表示・非表示');
   assert.strictEqual(descriptions.filter(x=>x.id==='ui.scene.pin').length,1);
   assert(model.descriptor('ui.scene.commentSearch'));
   assert(model.descriptor('sceneSearch.idleHideSeconds').description.includes('0秒'));
   assert.strictEqual(model.categories.length,7);
 });
});
