'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
const {nativePreview}=require('../helpers/nativeCommentPreviewFixture');

function mountedTwin(){
 let native;
 const h=fixture('02','normal',{beforeAttach({dom,bar,config}){
  native=nativePreview(dom);
  bar._commentPreview._view._view.remove();
  bar._commentPreview=native.preview;
  native.preview.chatList=native.chats;
  native.preview.currentTime=11;
  config.onkey('enableCommentPreview',value=>{
   native.preview.mode=value?'list':'hover';
  });
 }});
 h.config.setValue('enableCommentPreview',true);
 h.move(430);
 const bridge=h.binding.adapter.bridge,handle=native.preview._twinList;
 assert(handle&&handle.element,'real native list was not mounted');
 const mini=native.preview._view._view;
 assert(mini.isConnected&&handle.element.isConnected,'both native views must be live');
 assert.notStrictEqual(mini.parentNode,native.owner,'mini must be temporarily leased');
 return {h,native,bridge,handle,mini,dispose(){
  try{h.close();}finally{native.preview._view.dispose();}}
 };
}
describe('integration: native dispose recovery plus Bridge DOM leases',function(){
 this.timeout(20000);
 it('keeps the native handle retryable while restoring mini and thumbnail DOM',()=>{
  const t=mountedTwin(),{h,native,bridge,handle,mini}=t;
  const model=native.preview._model,off=model.off;
  const initialListenerCount=model.listenerCount('update');
  const thumb=h.d.getElementById('thumb'),thumbOriginal=h.d.getElementById('old');
  let failures=0;
  model.off=function(event,fn){
   if(event==='update'&&failures<2){failures++;throw Error('native-off-transient');}
   return off.call(this,event,fn);
  };
  try{
   assert.strictEqual(initialListenerCount,2,'primary and secondary both subscribed');
   bridge.dispose();
   assert.strictEqual(failures,2,'the Bridge attempts initial cleanup and one retry');
   assert(bridge._cleanup.pendingCount>=1,'failed native release must be retained');
   assert.strictEqual(native.preview._twinList,handle);
   assert.strictEqual(model.listenerCount('update'),2,'failed unsubscribe is still pending');
   assert.strictEqual(mini.parentNode,native.owner,'mini DOM returned independently');
   assert.strictEqual(thumb.parentNode,thumbOriginal,'thumbnail DOM returned independently');
   assert.strictEqual(h.d.querySelector('.zenzaSceneSearchHost'),null);
   const commands=native.commands.length;
   handle.element.dispatchEvent(new h.dom.window.MouseEvent('click',{bubbles:true}));
   model.emit('update');
   assert.strictEqual(native.commands.length,commands,'retired DOM cannot seek');
   bridge.dispose();
   assert.strictEqual(bridge._cleanup.pendingCount,0);
   assert.strictEqual(native.preview._twinList,null);
   assert.strictEqual(model.listenerCount('update'),1);
   assert.strictEqual(handle.element.isConnected,false);
   assert.strictEqual(mini.parentNode,native.owner);
   assert.strictEqual(thumb.parentNode,thumbOriginal);
   bridge.dispose();
   assert.strictEqual(failures,2,'cleanup does not repeat after success');
  }finally{model.off=off;t.dispose();}
 });
 it('retries a blocked mini DOM Lease after native list disposal already completed',()=>{
  const t=mountedTwin(),{h,native,bridge,handle,mini}=t;
  const lease=bridge._commentDock.lease,restore=lease.restore;
  const dispose=handle.dispose;let returns=0,disposals=0;
  lease.restore=function(){
   returns++;
   if(returns<=2)throw Error('mini-lease-return-transient');
   return restore.call(this);
  };
  handle.dispose=function(){disposals++;return dispose.call(this);};
  try{
   bridge.dispose();
   assert.strictEqual(returns,2);
   assert(bridge._cleanup.pendingCount>=1);
   assert.strictEqual(native.preview._twinList,null,'native handle already disposed');
   assert.strictEqual(handle.element.isConnected,false);
   assert.strictEqual(native.preview._model.listenerCount('update'),1);
   assert.strictEqual(disposals,1,'native list disposed once');
   bridge.dispose();
   assert.strictEqual(returns,3);
   assert.strictEqual(bridge._cleanup.pendingCount,0);
   assert.strictEqual(mini.parentNode,native.owner,'original mini must survive DOM lease return');
   assert.strictEqual(h.d.getElementById('thumb').parentNode,h.d.getElementById('old'));
   assert.strictEqual(disposals,1,'native list must not be disposed again');
   assert.strictEqual(h.d.querySelector('.zenzaSceneSearchHost'),null);
  }finally{lease.restore=restore;handle.dispose=dispose;t.dispose();}
 });
 it('loads both geometry and DOM ownership production dependencies in isolated class tests',()=>{
  const {createContext,loadClass}=require('../helpers/extractSource');
  const ctx=createContext({Emitter:require('events').EventEmitter});
  const pointer=loadClass('src/VideoControlBar.js','SmoothSeekBarPointer',ctx);
  assert.strictEqual(typeof pointer,'function');
  assert.strictEqual(typeof ctx.TimelineGeometry,'function','geometry must not be mocked or dropped');
  const legacy=loadClass('packages/zenza/src/sceneSearch/SceneSearchLegacyAdapter.js',
    'SceneSearchLegacyAdapter',ctx);
  assert.strictEqual(typeof legacy,'function');
  const view=loadClass('packages/zenza/src/sceneSearch/SceneSearchPreviewView.js',
    'SceneSearchPreviewView',ctx);
  assert.strictEqual(typeof view,'function');
  const bridge=loadClass('packages/zenza/src/sceneSearch/SceneSearchIntegrationBridge.js',
    'SceneSearchIntegrationBridge',ctx);
  assert.strictEqual(typeof bridge,'function');
  for(const dep of ['SceneSearchDomLease','SceneSearchLayoutResources',
    'SceneSearchPreferenceConnection','SceneSearchObstacleCollector']){
   assert.strictEqual(typeof ctx[dep],'function','required runtime dependency missing: '+dep);
  }
 });
});