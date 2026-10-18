'use strict';
const assert=require('assert'),{EventEmitter}=require('events');
const {fixture:playerFixture}=require('../helpers/scenePlayerFixture');
const {fixture:settingsFixture}=require('../helpers/sceneSearchSettingsFixture');
const {loadClass,createContext}=require('../helpers/extractSource');
const wait=()=>new Promise(resolve=>setTimeout(resolve,25));
async function live(old='02',extra={}){
 const s=settingsFixture({'SC_sceneSearch.layout.normal':JSON.stringify(old),
  'SC_sceneSearch.miniCommentMode':'"hidden"',...extra});await s.config.restore();
 const view=new EventEmitter();
 const h=playerFixture('00','normal',{beforeAttach({bar,binding}){
  bar._playerConfig=s.config;Object.assign(view,{videoControlBar:bar});binding.view=view;
 }});
 return {...h,...s,view,bridge:h.binding.adapter.bridge};
}
describe('Task801 final review integration regressions',function(){
 this.timeout(20000);
 for(const channel of ['saved','storage'])it('restores an inherited hidden panel when an explicit default is saved through '+channel,async()=>{
  const h=await live('02',{'SC_ui.scene.panel':'false'});try{
   h.move(400);assert(h.bridge._active.root.hidden);
   const key='sceneSearch.enabled';h.storage[h.config.getStorageKey(key)]='true';
   h.dom.window.dispatchEvent(channel==='saved'?
    new h.dom.window.CustomEvent('ZenzaWatch-advanced-settings-saved',{detail:{keys:[key]}}):
    new h.dom.window.StorageEvent('storage',{key:h.config.getStorageKey(key)}));
   await wait();assert(!h.bridge._active.root.hidden);assert.notStrictEqual(h.bridge._active.root.style.display,'none');
  }finally{h.close();}
 });
 it('holds placement using separate real View and Dialog event owners and releases listeners',async()=>{
  const h=await live();try{
   h.player.screenMode='small';h.move(400);await wait();
   h.view.emit('sceneSearchGeometryChange',{active:true});await wait();
   assert.strictEqual(h.binding._manipulating,true);
   assert.strictEqual(h.bridge._placementHold,true);
   h.view.emit('sceneSearchGeometryChange',{active:false});await wait();
   assert.strictEqual(h.binding._manipulating,false);
   assert.strictEqual(h.bridge._placementHold,false);
   h.binding.dispose();assert.strictEqual(h.view.listenerCount('sceneSearchGeometryChange'),0);
  }finally{h.close();}
 });
 for(const [old,command] of [['02','prev'],['00','next']])it('persists default follow selected by shortcut over old '+old,async()=>{
  const h=await live(old);try{
   assert.strictEqual(h.config.hasStoredValue('sceneSearch.presentation.normal'),false);
   assert.strictEqual(h.bridge.handleShortcut('sceneSearch-'+command+'Layout'),true);
   assert.strictEqual(h.bridge.state.layoutId,'follow');
   assert.strictEqual(h.config.hasStoredValue('sceneSearch.presentation.normal'),true);
   const restored=settingsFixture(h.storage);await restored.config.restore();
   assert.strictEqual(restored.config.resolveSceneSearch().normal,'follow');
   assert.strictEqual(restored.config.getValue('sceneSearch.layout.normal'),old);
  }finally{h.close();}
 });
 for(const channel of ['saved','storage'])it('reconciles explicit defaults and deletion from '+channel+' notifications',async()=>{
  const h=await live();try{
   const key='sceneSearch.presentation.normal',sk=h.config.getStorageKey(key);
   const notify=k=>h.dom.window.dispatchEvent(channel==='saved'?
    new h.dom.window.CustomEvent('ZenzaWatch-advanced-settings-saved',{detail:{keys:[k]}}):
    new h.dom.window.StorageEvent('storage',{key:h.config.getStorageKey(k)}));
   assert.strictEqual(h.bridge.state.layoutId,'fixed');
   h.storage[sk]='"follow"';notify(key);await wait();
   assert.strictEqual(h.bridge.state.layoutId,'follow');
   delete h.storage[sk];notify(key);await wait();
   assert.strictEqual(h.bridge.state.layoutId,'fixed');
   const mini='sceneSearch.miniCommentVisible';
   h.storage[h.config.getStorageKey(mini)]='true';notify(mini);await wait();
   assert.strictEqual(h.bridge._active.root.querySelector('.zenzaSceneNativeMini').hidden,false);
   delete h.storage[h.config.getStorageKey(mini)];notify(mini);await wait();
   assert.strictEqual(h.bridge._active.root.querySelector('.zenzaSceneNativeMini').hidden,true);
  }finally{h.close();}
 });
 it('disables native legacy comment activation without losing its requested open state',async()=>{
  const h=await live('00');try{
   const button=h.d.querySelector('.toggleCommentPreview');
   button.dataset.command='toggleConfig';button.dataset.param='enableCommentPreview';
   const originalTitle=button.getAttribute('title'),originalAria=button.getAttribute('aria-disabled');
   const ToolTip=loadClass('src/VideoControlBar.js','SeekBarToolTip',createContext({
    util:{dispatchCommand:()=>h.config.setValue('enableCommentPreview',!h.config.getValue('enableCommentPreview'))}
   }));
   const activate=()=>ToolTip.prototype._onMouseDown.call({}, {target:button,stopPropagation(){}});
   h.config.setValue('enableCommentPreview',true);
   for(const key of ['sceneSearch.commentPreviewVisible','sceneSearch.commentListVisible']){
    h.config.persistSceneSearchSelection({[key]:false});h.bridge.controller.onPreferencesChanged(key);
    assert.strictEqual(button.getAttribute('aria-disabled'),'true');
    assert(button.title.includes('OFF'));activate();
    assert.strictEqual(h.config.getValue('enableCommentPreview'),true);
    h.config.persistSceneSearchSelection({[key]:true});h.bridge.controller.onPreferencesChanged(key);
    assert.strictEqual(h.bridge.state.commentListMode,true);
   }
   activate();assert.strictEqual(h.config.getValue('enableCommentPreview'),false);
   h.binding.dispose();
   assert.strictEqual(button.getAttribute('title'),originalTitle);
   assert.strictEqual(button.getAttribute('aria-disabled'),originalAria);
  }finally{h.close();}
 });
});
