'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
const {loadClass,createContext}=require('../helpers/extractSource');
const DataStorage=loadClass('packages/lib/src/infra/DataStorage.js','DataStorage',createContext());
const wait=()=>new Promise(resolve=>setTimeout(resolve,20));
function live(initialLayout='01'){
 const h=fixture(initialLayout),Binding=h.binding.constructor;
 h.binding.dispose();
 const baseGet=h.config.getValue,baseSet=h.config.setValue;
 const memory={},reads=[],errors=[],writes=[];
 const defaults={enableCommentPreview:false,'sceneSearch.layout.normal':initialLayout,'sceneSearch.layout.fullscreen':initialLayout,
  'sceneSearch.layout.linkFullscreen':false,'sceneSearch.seekStepSeconds':5,
  'sceneSearch.commentPreviewVisible':true,
  'sceneSearch.miniCommentMode':'flow','sceneSearch.idleHideSeconds':2,
  'sceneSearch.controlsReveal':'hover-focus','sceneSearch.animation':'off'};
 Object.assign(memory,defaults);
 const storage=h.dom.window.localStorage;
 h.config.default=defaults;h.config.storage=storage;
 h.config.getStorageKey=key=>'live_'+key;
 h.config.getValue=key=>Object.hasOwn(memory,key)?memory[key]:baseGet(key);
 h.config.setValue=(key,value)=>{writes.push(key);memory[key]=value;baseSet(key,value);};
 h.config.refresh=async(key,snapshot=storage)=>{
  reads.push(key);
  return DataStorage.prototype.refresh.call({_data:memory,storage,
   getNativeKey:k=>k,getStorageKey:h.config.getStorageKey},key,snapshot);
 };
 h.config.emit=(name,...args)=>{
  if(name.startsWith('update-'))baseSet(name.slice(7),args[0]);
 };
 const binding=new Binding({view:{videoControlBar:h.bar},dialog:h.player,
  document:h.d,container:h.host,events:h.events,isFullscreen:()=>false,
  onError:code=>errors.push(code)});
 binding.attach();
 return {...h,binding,reads,errors,writes,defaults,storage,memory,
  save(values){const keys=Object.keys(values);
   keys.forEach(k=>storage[h.config.getStorageKey(k)]=JSON.stringify(values[k]));
   this.notify(keys);},
  notify(keys){h.dom.window.dispatchEvent(new h.dom.window.CustomEvent(
   'ZenzaWatch-advanced-settings-saved',{detail:{keys}}));},
  storageEvent(key,newValue=null,area=storage){h.dom.window.dispatchEvent(
   new h.dom.window.StorageEvent('storage',{key,newValue,storageArea:area}));},
  close(){binding.dispose();h.dom.window.close();}};
}
describe('SCUI saved settings apply without page reload',()=>{
 it('applies a saved batch from a separate same-tab settings owner',async()=>{
  const h=live();try{
   h.binding.adapter.bridge.setTime(123);h.binding.adapter.bridge.controller.pin(true);
   h.save({'sceneSearch.layout.normal':'02','sceneSearch.seekStepSeconds':15,
    'sceneSearch.animation':'full'});await wait();
   const b=h.binding.adapter.bridge;
   assert.equal(b.state.layoutId,'02');assert.equal(b.state.time,123);
   assert.equal(b.state.pinned,true);assert.equal(b.state.seekStepSeconds,15);
   assert.equal(h.host.querySelector('.zenzaSceneSearchHost').dataset.sceneAnimation,'full');
   assert.equal(h.host.querySelectorAll('.zenzaSceneSearchHost').length,1);
   assert.deepStrictEqual(h.writes,[],'sync must not persist or re-save values');
  }finally{h.close();}
 });
 it('applies the saved legacy list mode independently of master visibility',async()=>{
  const h=live();try{
   h.save({enableCommentPreview:true});await wait();
   assert.equal(h.binding.adapter.bridge.state.commentListMode,true);
   assert.equal(h.host.querySelector('.scene-comment-toggle').getAttribute('aria-pressed'),'true');
   assert.equal(h.config.getValue('sceneSearch.commentPreviewVisible'),true);
   assert.deepStrictEqual(h.writes,[]);
  }finally{h.close();}
 });
 it('applies saved mini-comment mode without a page reload or resetting layout',async()=>{
  const h=live('00');try{
   assert.equal(h.binding.adapter.bridge.state.layoutId,'00');
   const native=h.d.querySelector('.zenzaCommentPreview');
   h.save({'sceneSearch.miniCommentMode':'hidden'});await wait();
   assert(h.host.classList.contains('is-scui00-mini-hidden'));
   assert(native&&native.parentElement===h.seek);
   h.save({'sceneSearch.miniCommentMode':'static'});await wait();
   assert(h.host.classList.contains('is-scui00-mini-static'));
   assert(!h.host.classList.contains('is-scui00-mini-hidden'));
   h.save({'sceneSearch.miniCommentMode':'flow'});await wait();
   assert(!h.host.classList.contains('is-scui00-mini-static'));
   assert.deepStrictEqual(h.writes,[],'saved-settings event must not resave');
  }finally{h.close();}
 });
 it('does not read unsaved edits or unrelated settings',async()=>{
  const h=live();try{
   h.storage['live_sceneSearch.layout.normal']='"02"';
   h.notify(['videoServerType','__proto__']);await wait();
   assert.equal(h.binding.adapter.bridge.state.layoutId,'01');
   assert.deepStrictEqual(h.reads,[]);
  }finally{h.close();}
 });
 it('handles another tab save and deleted keys using documented defaults',async()=>{
  const h=live();try{
   const k='live_sceneSearch.layout.normal';h.storage[k]='"03"';
   h.storageEvent(k,'"03"');await wait();
   assert.equal(h.binding.adapter.bridge.state.layoutId,'03');
   h.storage.removeItem(k);h.storageEvent(k,null);await wait();
   assert.equal(h.binding.adapter.bridge.state.layoutId,'01');
   assert.equal(h.storage.getItem(k),null,'default restoration must not write');
  }finally{h.close();}
 });
 it('rejects invalid saved values before any part of the batch is applied',async()=>{
  const h=live();try{
   h.save({'sceneSearch.layout.normal':'02','sceneSearch.seekStepSeconds':-1});
   await wait();assert.equal(h.binding.adapter.bridge.state.layoutId,'01');
   assert.equal(h.binding.adapter.bridge.state.seekStepSeconds,5);
   assert.deepStrictEqual(h.reads,[]);assert(h.errors.length>0);
  }finally{h.close();}
 });
 it('contains malformed storage and reads no untrusted event values',async()=>{
  const h=live();try{
   h.storage['live_sceneSearch.layout.normal']='{broken';
   h.notify(['sceneSearch.layout.normal']);await wait();
   assert.equal(h.binding.adapter.bridge.state.layoutId,'01');
   assert(h.errors.length>0);assert.deepStrictEqual(h.reads,[]);
   h.storage['live_sceneSearch.layout.normal']='"04"';
   h.notify(['sceneSearch.layout.normal']);await wait();
   assert.equal(h.binding.adapter.bridge.state.layoutId,'04');
  }finally{h.close();}
 });
 it('ignores different storage areas and stops applying after disposal',async()=>{
  const h=live();try{
   h.storage['live_sceneSearch.layout.normal']='"02"';
   h.storageEvent('live_sceneSearch.layout.normal','"02"',h.dom.window.sessionStorage);
   await wait();assert.deepStrictEqual(h.reads,[]);
   h.notify(['sceneSearch.layout.normal']);h.binding.dispose();await wait();
   assert.deepStrictEqual(h.reads,[]);
   h.notify(['sceneSearch.layout.normal']);await wait();assert.deepStrictEqual(h.reads,[]);
   assert.equal(h.host.querySelectorAll('.zenzaSceneSearchHost').length,0);
  }finally{h.close();}
 });
 it('does not replay duplicate notifications and keeps the latest rapid save',async()=>{
  const h=live();try{
   h.save({'sceneSearch.layout.normal':'02'});h.save({'sceneSearch.layout.normal':'03'});
   h.notify(['sceneSearch.layout.normal','sceneSearch.layout.normal']);await wait();
   assert.equal(h.binding.adapter.bridge.state.layoutId,'03');
   assert.equal(h.reads.length,1);assert.deepStrictEqual(h.writes,[]);
  }finally{h.close();}
 });
 it('refreshes hide duration, visibility and controls without replacing the layout',async()=>{
  const h=live();try{
   const root=h.host.querySelector('.zenzaSceneSearchHost');
   h.save({'sceneSearch.idleHideSeconds':3.5,'sceneSearch.commentPreviewVisible':false,
    'sceneSearch.controlsReveal':'always'});await wait();
   assert.equal(h.host.querySelector('.zenzaSceneSearchHost'),root);
   assert.equal(root.dataset.sceneReveal,'always');
   assert.equal(h.d.querySelector('.zenzaCommentPreview').hidden,true);
  }finally{h.close();}
 });
});
