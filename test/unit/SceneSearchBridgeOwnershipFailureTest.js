'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');

describe('scene bridge ownership and cleanup failures',function(){
 this.timeout(20000);
 it('continues disposal after one native DOM return fails and allows retry',()=>{
  let native;
  const h=fixture('01','normal',{beforeAttach:({d})=>{
   const mini=d.querySelector('.zenzaCommentPreview'),thumb=d.getElementById('thumb'),tooltip=d.getElementById('old');
   native={mini,thumb,tooltip,miniOwner:mini.parentNode,thumbOwner:thumb.parentNode,display:tooltip.style.display,hidden:tooltip.hidden};
  }});
  const bridge=h.binding.adapter.bridge,insert=native.miniOwner.insertBefore;
  let blocked=true;
  native.miniOwner.insertBefore=function(node,next){if(node===native.mini&&blocked){blocked=false;throw new Error('mini-return-failed');}return insert.call(this,node,next);};
  try{
   assert.doesNotThrow(()=>bridge.dispose(),'one return failure must not prevent other cleanup');
   assert.strictEqual(native.thumb.parentNode,native.thumbOwner);
   assert.strictEqual(native.tooltip.style.display,native.display);
   assert.strictEqual(native.tooltip.hidden,native.hidden);
   assert.strictEqual(h.d.querySelector('style[data-scui-bridge-style]'),null);
   assert.doesNotThrow(()=>bridge.dispose());
   assert.strictEqual(native.mini.parentNode,native.miniOwner);
   assert.strictEqual(h.d.querySelector('.zenzaSceneSearchHost'),null);
   assert.doesNotThrow(()=>h.config.setValue('sceneSearch.layout.normal','02'));
  }finally{native.miniOwner.insertBefore=insert;h.close();}
 });
 it('finishes subscriptions and styles when a layout disposer fails after removing its shell',()=>{
  const h=fixture('01'),bridge=h.binding.adapter.bridge,card=bridge._active;
  const dispose=card.dispose.bind(card);let attempts=0;
  card.dispose=()=>{attempts++;dispose();if(attempts===1)throw new Error('card-dispose-failed');};
  const off=h.config.offkey.bind(h.config),removed=[];
  h.config.offkey=(key,fn)=>{removed.push(key);off(key,fn);};
  try{
   assert.doesNotThrow(()=>bridge.dispose());
   assert.strictEqual(h.d.querySelector('style[data-scui-bridge-style]'),null);
   assert(removed.includes('sceneSearch.layout.normal'));
   assert.strictEqual(h.d.getElementById('thumb').parentNode,h.d.getElementById('old'));
   bridge.dispose();assert.strictEqual(attempts,2,'failed layout cleanup must be retried once');
   bridge.dispose();assert.strictEqual(attempts,2,'successful cleanup is not repeated');
  }finally{h.close();}
 });
 it('removes the modern portal when the layout factory throws before producing a card',()=>{
  const h=fixture('01'),bridge=h.binding.adapter.bridge,create=bridge.registry.create;
  bridge.registry.create=()=>{throw new Error('layout-factory-failed');};
  try{
   assert.throws(()=>bridge._createModernLayout({id:'follow',mode:'normal'}),/layout-factory-failed/);
   assert.strictEqual(h.d.querySelector('.zenzaScenePreviewPortal'),null);
  }finally{bridge.registry.create=create;h.close();}
 });
 it('cleans up bridge style when inserting it throws after completing the insertion',()=>{
  let head,append;
  const h=fixture('01','normal',{beforeAttach:({d})=>{
   head=d.head;append=head.appendChild;
   head.appendChild=function(node){const result=append.call(this,node);if(node.dataset?.scuiBridgeStyle){this.appendChild=append;throw new Error('style-attach-failed');}return result;};
  }});
  try{
   assert.strictEqual(h.binding.adapter,null);
   assert.strictEqual(h.d.querySelector('style[data-scui-bridge-style]'),null);
   assert.strictEqual(h.d.getElementById('thumb').parentNode,h.d.getElementById('old'));
  }finally{head.appendChild=append;h.close();}
 });
 it('restores a Canvas whose move throws after the original node was appended',()=>{
  const h=fixture('01'),bridge=h.binding.adapter.bridge,thumb=h.d.getElementById('thumb');
  bridge._restoreSharedThumbnail();
  const original=thumb.parentNode,slot=bridge._active.root.querySelector('.zenzaSceneImageBox');
  const append=slot.appendChild,insert=slot.insertBefore;
  slot.appendChild=function(node){const value=append.call(this,node);if(node===thumb)throw new Error('canvas-move-failed');return value;};
  slot.insertBefore=function(node,next){const value=insert.call(this,node,next);if(node===thumb)throw new Error('canvas-move-failed');return value;};
  try{
   try{bridge.refreshSharedThumbnail();}catch(error){assert(/canvas-move-failed/.test(error.message));}
   assert.strictEqual(thumb.parentNode,original,'a failed move must roll back immediately');
   slot.appendChild=append;slot.insertBefore=insert;
   bridge.dispose();
   assert.strictEqual(thumb.parentNode,original);
   assert.strictEqual(h.d.querySelectorAll('#thumb canvas').length,1);
  }finally{slot.appendChild=append;slot.insertBefore=insert;h.close();}
 });
 it('restores UI00 tooltip state after a transient return failure across layout changes',()=>{
  const h=fixture('00'),tooltip=h.d.getElementById('old');
  const initial={display:tooltip.style.display,hidden:tooltip.hidden};
  const remove=tooltip.style.removeProperty;let failed=false;
  try{
   h.config.setValue('sceneSearch.layout.normal','01');
   tooltip.style.removeProperty=function(name){
    if(name==='display'&&!failed){failed=true;throw new Error('transient-tooltip-return');}
    return remove.call(this,name);
   };
   h.config.setValue('sceneSearch.layout.normal','02');
   h.config.setValue('sceneSearch.layout.normal','00');
   assert(failed,'the first native display return must be exercised');
   assert.deepStrictEqual({display:tooltip.style.display,hidden:tooltip.hidden},initial);
  }finally{tooltip.style.removeProperty=remove;h.close();}
 });
 it('refuses a new tooltip lease while an older display return is still blocked',()=>{
  let initial;
  const h=fixture('01','normal',{beforeAttach:({d})=>{
   const tooltip=d.getElementById('old');initial={display:tooltip.style.display,hidden:tooltip.hidden};
  }});
  const bridge=h.binding.adapter.bridge,tooltip=h.d.getElementById('old');
  const remove=tooltip.style.removeProperty;let blocked=true;
  tooltip.style.removeProperty=function(name){
   if(name==='display'&&blocked)throw new Error('blocked-tooltip-return');
   return remove.call(this,name);
  };
  try{
   bridge._restoreLegacyTooltip();
   assert.throws(()=>bridge._hideLegacyTooltip(),/pending/);
   blocked=false;
   bridge._hideLegacyTooltip();
   bridge.dispose();
   assert.deepStrictEqual({display:tooltip.style.display,hidden:tooltip.hidden},initial);
  }finally{tooltip.style.removeProperty=remove;h.close();}
 });
 it('does not capture an unfinished mini-comment visibility override as native state',()=>{
  const h=fixture('01'),bridge=h.binding.adapter.bridge,mini=h.d.querySelector('.zenzaCommentPreview');
  const initial={display:mini.style.display,hidden:mini.hidden};
  const remove=mini.style.removeProperty;let failed=false;
  try{
   h.config.setValue('sceneSearch.commentPreviewVisible',false);
   mini.style.removeProperty=function(name){
    if(name==='display'&&!failed){failed=true;throw new Error('transient-comment-visibility-return');}
    return remove.call(this,name);
   };
   h.config.setValue('sceneSearch.commentPreviewVisible',true);
   h.config.setValue('sceneSearch.commentPreviewVisible',false);
   bridge.refreshSharedThumbnail();
   h.config.setValue('sceneSearch.commentPreviewVisible',true);
   assert(failed);
   assert.deepStrictEqual({display:mini.style.display,hidden:mini.hidden},initial);
  }finally{mini.style.removeProperty=remove;h.close();}
 });
 it('leaves container placement styles alone when UI00 never borrowed the comment DOM',()=>{
  const h=fixture('00'),bridge=h.binding.adapter.bridge;
  try{
   h.host.style.setProperty('--scui-list-x','17px');
   bridge.dispose();
   assert.strictEqual(h.host.style.getPropertyValue('--scui-list-x'),'17px');
  }finally{h.close();}
 });
 it('ignores events from a retired mini surface even if listener removal fails',()=>{
  const h=fixture('01'),bridge=h.binding.adapter.bridge,mini=h.d.querySelector('.zenzaCommentPreview');
  const remove=mini.removeEventListener;
  mini.removeEventListener=function(type,...args){
   if(type==='mouseenter')throw new Error('surface-listener-remove-failed');
   return remove.call(this,type,...args);
  };
  try{
   bridge.controller.show(false);
   bridge._restoreCommentPreviewDock();
   mini.dispatchEvent(new h.dom.window.MouseEvent('mouseenter'));
   assert.strictEqual(bridge.interaction.holdingPreview,false);
   assert.strictEqual(bridge.state.shown,false);
  }finally{mini.removeEventListener=remove;h.close();}
 });
 it('ignores events from retired UI00 controls even if listener removal fails',()=>{
  const h=fixture('00'),bridge=h.binding.adapter.bridge,tooltip=h.d.getElementById('old');
  const remove=tooltip.removeEventListener;
  tooltip.removeEventListener=function(type,...args){
   if(type==='mouseenter')throw new Error('legacy-listener-remove-failed');
   return remove.call(this,type,...args);
  };
  try{
   bridge.controller.show(false);
   bridge._cardCleanup();
   tooltip.dispatchEvent(new h.dom.window.MouseEvent('mouseenter'));
   assert.strictEqual(bridge.interaction.holdingPreview,false);
   assert.strictEqual(bridge.state.shown,false);
  }finally{tooltip.removeEventListener=remove;h.close();}
 });
 it('keeps stopped seek callbacks inert while failed listener removals await retry',()=>{
  const callbacks=new Map();
  const h=fixture('01','normal',{beforeAttach:({seek})=>{
   const add=seek.addEventListener;
   seek.addEventListener=function(type,listener,...args){
    callbacks.set(type,listener);return add.call(this,type,listener,...args);
   };
  }});
  const bridge=h.binding.adapter.bridge,remove=h.seek.removeEventListener;
  h.seek.removeEventListener=()=>{throw new Error('seek-listener-remove-failed');};
  try{
   bridge.dispose();
   for(const [type,listener]of callbacks){
    assert.doesNotThrow(()=>listener(new h.dom.window.MouseEvent(type,{clientX:15})),type);
   }
   assert.strictEqual(bridge.state.shown,false);
   assert.strictEqual(h.d.querySelector('.zenzaSceneSearchHost'),null);
  }finally{h.seek.removeEventListener=remove;bridge.dispose();h.close();}
 });
});
