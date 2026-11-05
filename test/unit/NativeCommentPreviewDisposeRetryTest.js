'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {nativePreview}=require('../helpers/nativeCommentPreviewFixture');

function make() {
 const dom=new JSDOM('<!doctype html><html><body><main id="host"></main></body></html>');
 const n=nativePreview(dom),host=dom.window.document.getElementById('host');
 const before=n.preview._model.listenerCount('update');
 n.preview.chatList=n.chats;n.preview.currentTime=11;
 n.preview.mode='list';
 const handle=n.preview.createListView(host);
 const cleanup=()=>{n.preview._view.dispose();dom.window.close();};
 return {dom,n,handle,host,before,cleanup};
}

describe('native comment preview disposal is exception-safe and retryable',function(){
 it('retries a transient failure before the underlying view disposal starts',function(){
  const h=make(),original=h.n.View.prototype.dispose;
  let calls=0;
  h.n.View.prototype.dispose=function(){
   calls++;if(calls===1)throw Error('view-dispose-transient');
   return original.call(this);
  };
  try{
   assert.throws(()=>h.handle.dispose(),/view-dispose-transient/);
   assert.strictEqual(h.n.preview._twinList,h.handle,'failed handle stays retrievable');
   assert.strictEqual(h.n.preview.createListView(h.host),h.handle);
   assert.strictEqual(h.handle.element.isConnected,true);
   assert.strictEqual(h.n.preview._model.listenerCount('update'),h.before+1);
   h.handle.dispose();h.handle.dispose();
   assert.strictEqual(calls,2,'the real view disposal is retried exactly once');
   assert.strictEqual(h.n.preview._twinList,null);
   assert.strictEqual(h.handle.element.isConnected,false);
   assert.strictEqual(h.n.preview._model.listenerCount('update'),h.before);
   assert.strictEqual(h.n.preview._view._mode,'list');
   assert.strictEqual(h.handle.disposeFailures.length,0);
  }finally{h.n.View.prototype.dispose=original;h.cleanup();}
 });
 it('completes unrelated cleanup after five independent teardown failures, retrying only unfinished steps',function(){
  const h=make(),viewProto=h.n.View.prototype,model=h.n.preview._model;
  const oldDispose=viewProto.dispose,oldReset=viewProto._onReset;
  const oldOff=model.off,element=h.handle.element,oldRemoveListener=element.removeEventListener;
  const oldRemove=element.remove,oldClear=h.dom.window.clearTimeout;
  let view,offUpdate=0,offReset=0,removeScroll=0,removeClick=0,removeDom=0,clearCalls=0,resetCalls=0;
  const once=(name,n)=>{if(n===1)throw Error(name)};
  viewProto.dispose=function(){view=this;this._updatingTimer=4242;return oldDispose.call(this);};
  model.off=function(event,handler){
   if(event==='update'){once('model-off-update',++offUpdate);}
   if(event==='reset')offReset++;
   return oldOff.call(this,event,handler);
  };
  element.removeEventListener=function(event,...rest){
   if(event==='scroll'){once('dom-off-scroll',++removeScroll);}
   if(event==='click')removeClick++;
   return oldRemoveListener.call(this,event,...rest);
  };
  element.remove=function(){once('dom-remove',++removeDom);return oldRemove.call(this);};
  h.dom.window.clearTimeout=function(id){
   if(id===4242){once('clear-timeout',++clearCalls);}
   return oldClear.call(this,id);
  };
  viewProto._onReset=function(){once('reset-list',++resetCalls);return oldReset.call(this);};
  try{
   let thrown;
   try{h.handle.dispose();}catch(error){thrown=error;}
   assert(thrown && thrown.name==='AggregateError','multiple failures must be surfaced together');
   assert.strictEqual(thrown.errors.length,5);
   assert.strictEqual(view._disposeFailures.length,5);
   assert.strictEqual(view._disposePending.size,5);
   assert.strictEqual(h.handle.disposeFailures.length,1);
   assert.strictEqual(h.n.preview._twinList,h.handle,'do not orphan an unfinished handle');
   assert.strictEqual(offReset,1,'other model listener released immediately');
   assert.strictEqual(removeClick,1,'other DOM listener released immediately');
   assert.strictEqual(view._disposed,true,'late handlers must not mutate during cleanup');
   assert.strictEqual(view._disposeComplete,false);
   h.handle.dispose();h.handle.dispose();
   assert.strictEqual(view._disposeComplete,true);
   assert.strictEqual(view._disposePending,null);
   assert.strictEqual(view._disposeFailures.length,0);
   assert.strictEqual(h.handle.disposeFailures.length,0);
   assert.strictEqual(h.handle.element.isConnected,false);
   assert.strictEqual(h.n.preview._model.listenerCount('update'),h.before);
   assert.strictEqual(offReset,1,'successfully completed tasks are never repeated');
   assert.strictEqual(removeClick,1);
   assert.strictEqual(offUpdate,2);
   assert.strictEqual(removeScroll,2);
   assert.strictEqual(removeDom,2);
   assert.strictEqual(clearCalls,2);
   assert.strictEqual(resetCalls,2);
   assert.strictEqual(h.n.preview._twinList,null);
  }finally{
   viewProto.dispose=oldDispose;viewProto._onReset=oldReset;model.off=oldOff;
   element.removeEventListener=oldRemoveListener;element.remove=oldRemove;
   h.dom.window.clearTimeout=oldClear;h.cleanup();
  }
 });
 it('retries only pending cancellation steps without repeating successful cancellations',function(){
  const h=make(),proto=h.n.View.prototype,oldDispose=proto.dispose;
  let view,first=true,modelCancelCalls=0,updateCancelCalls=0,rafCancelCalls=0;
  proto.dispose=function(){
   view=this;
   if(first){
    first=false;
    const debounced=this._subscriptions.find(([event])=>event==='update')[1];
    const oldModelCancel=debounced.cancel;
    debounced.cancel=()=>{
     modelCancelCalls++;if(modelCancelCalls===1)throw Error('model-debounce');
     return oldModelCancel.call(debounced);
    };
    const oldUpdateCancel=this.update.cancel;
    this.update.cancel=()=>{
     updateCancelCalls++;if(updateCancelCalls===1)throw Error('update-throttle');
     return oldUpdateCancel.call(this.update);
    };
    const oldApplyCancel=this.applyView.cancel;
    this.applyView.cancel=()=>{
     rafCancelCalls++;if(rafCancelCalls===1)throw Error('render-raf');
     return oldApplyCancel.call(this.applyView);
    };
   }
   return oldDispose.call(this);
  };
  try{
   assert.throws(()=>h.handle.dispose(),error=>error?.name==='AggregateError');
   assert.strictEqual(view._disposePending.size,3);
   assert.deepStrictEqual(Array.from(view._disposeFailures,x=>x.step).sort(),
    ['model.cancel:update:1','update.cancel','applyView.cancel'].sort());
   assert.strictEqual(h.handle.element.isConnected,false);
   h.handle.dispose();
   assert.strictEqual(h.n.preview._twinList,null);
   assert.strictEqual(h.n.preview._model.listenerCount('update'),h.before);
   assert.strictEqual(modelCancelCalls,2);
   assert.strictEqual(updateCancelCalls,2);
   assert.strictEqual(rafCancelCalls,2);
  }finally{proto.dispose=oldDispose;h.cleanup();}
 });
 it('retains handle across a failed primary mode restoration without repeating child disposal',function(){
  const h=make(),primary=h.n.preview._view,proto=h.n.View.prototype;
  const descriptor=Object.getOwnPropertyDescriptor(proto,'mode');
  const originalDispose=proto.dispose;let disposeCalls=0,modeCalls=0;
  proto.dispose=function(){
   if(this._view===h.handle.element)disposeCalls++;
   return originalDispose.call(this);
  };
  Object.defineProperty(primary,'mode',{configurable:true,set(v){
   modeCalls++;if(modeCalls===1)throw Error('restore-mode-transient');
   descriptor.set.call(this,v);
  }});
  try{
   assert.throws(()=>h.handle.dispose(),/restore-mode-transient/);
   assert.strictEqual(disposeCalls,1);
   assert.strictEqual(h.n.preview._twinList,h.handle);
   assert.strictEqual(h.n.preview.createListView(h.host),h.handle);
   assert.strictEqual(h.n.preview._model.listenerCount('update'),h.before);
   assert.strictEqual(h.handle.element.isConnected,false);
   h.handle.dispose();h.handle.dispose();
   assert.strictEqual(modeCalls,2);
   assert.strictEqual(disposeCalls,1,'already successful child disposal cannot repeat');
   assert.strictEqual(h.n.preview._view._mode,'list');
   assert.strictEqual(h.n.preview._twinList,null);
  }finally{delete primary.mode;proto.dispose=originalDispose;h.cleanup();}
 });
 it('guards a still-attached click handler during partial disposal',function(){
  const h=make(),proto=h.n.View.prototype,oldDispose=proto.dispose,oldReset=proto._onReset;
  const element=h.handle.element,oldOff=element.removeEventListener,oldRemove=element.remove;
  let firstClick=true,firstRemove=true,firstReset=true,view;
  proto.dispose=function(){view=this;return oldDispose.call(this);};
  element.removeEventListener=function(type,...args){
   if(type==='click'&&firstClick){firstClick=false;throw Error('click-off-once');}
   return oldOff.call(this,type,...args);
  };
  element.remove=function(){
   if(firstRemove){firstRemove=false;throw Error('dom-remove-once');}
   return oldRemove.call(this);
  };
  proto._onReset=function(){
   if(this._view===element && firstReset){firstReset=false;throw Error('reset-once');}
   return oldReset.call(this);
  };
  try{
   assert.throws(()=>h.handle.dispose(),error=>error?.name==='AggregateError');
   assert.strictEqual(element.isConnected,true);
   const row=element.querySelector('.nicoChat');
   assert(row,'the comment list is still connected until the failed DOM task retries');
   row.dispatchEvent(new h.dom.window.MouseEvent('click',{bubbles:true}));
   assert.deepStrictEqual(h.n.commands,[],'a pending disposal cannot issue a seek command');
   assert.strictEqual(view._disposePending.size,3);
   h.handle.dispose();
   assert.strictEqual(element.isConnected,false);
   assert.strictEqual(h.n.preview._model.listenerCount('update'),h.before);
  }finally{
   proto.dispose=oldDispose;proto._onReset=oldReset;
   element.removeEventListener=oldOff;element.remove=oldRemove;
   h.cleanup();
  }
 });
 it('retries a failed handle release and restores the latest requested owner mode',function(){
  const h=make(),preview=h.n.preview,proto=h.n.View.prototype;
  const originalDispose=proto.dispose;let viewDisposes=0,first=true;
  proto.dispose=function(){
   if(this._view===h.handle.element)viewDisposes++;
   return originalDispose.call(this);
  };
  let stored=preview._twinList;
  Object.defineProperty(preview,'_twinList',{configurable:true,get(){return stored;},set(value){
   if(value===null&&first){first=false;throw Error('release-handle-once');}
   stored=value;
  }});
  try{
   assert.throws(()=>h.handle.dispose(),/release-handle-once/);
   assert.strictEqual(viewDisposes,1);
   assert.strictEqual(preview._twinList,h.handle);
   assert.strictEqual(preview._model.listenerCount('update'),h.before);
   preview.mode='hover';
   assert.strictEqual(preview._view._mode,'hover');
   preview.mode='list';
   assert.strictEqual(preview._view._mode,'hover','pending twin forces primary hover');
   h.handle.dispose();
   assert.strictEqual(preview._twinList,null);
   assert.strictEqual(preview._view._mode,'list','restore the latest configured mode');
   assert.strictEqual(viewDisposes,1);
   assert.strictEqual(h.handle.disposeFailures.length,0);
  }finally{
   delete preview._twinList;preview._twinList=stored;
   proto.dispose=originalDispose;h.cleanup();
  }
 }); it('coalesces reentrant handle and view disposal triggered by an emitter unsubscribe',function(){
  const h=make(),model=h.n.preview._model,proto=h.n.View.prototype;
  const oldOff=model.off,oldDispose=proto.dispose;
  let activeView,entered=false,resetOff=0;
  proto.dispose=function(){activeView=this;return oldDispose.call(this);};
  model.off=function(event,handler){
   if(event==='reset'){
    resetOff++;
    if(!entered){
     entered=true;
     activeView.dispose();
     h.handle.dispose();
    }
   }
   return oldOff.call(this,event,handler);
  };
  try{
   h.handle.dispose();
   assert.strictEqual(resetOff,1,'nested disposal cannot repeat successful cleanup');
   assert.strictEqual(h.n.preview._twinList,null);
   assert.strictEqual(model.listenerCount('update'),h.before);
   assert.strictEqual(h.handle.element.isConnected,false);
  }finally{
   model.off=oldOff;proto.dispose=oldDispose;h.cleanup();
  }
 }); it('does not claim success when child disposal is already running elsewhere',function(){
  const h=make(),proto=h.n.View.prototype,real=proto.dispose;
  let child,inside=false,updateFails=true;
  proto.dispose=function(){child=this;throw Error('capture-native-child');};
  assert.throws(()=>h.handle.dispose(),/capture-native-child/);
  proto.dispose=real;
  const model=h.n.preview._model,oldOff=model.off;
  model.off=function(event,handler){
   if(event==='reset'&&!inside){
    inside=true;
    assert.throws(()=>h.handle.dispose(),/still in progress/);
   }
   if(event==='update'&&updateFails){
    updateFails=false;throw Error('update-retry-required');
   }
   return oldOff.call(this,event,handler);
  };
  try{
   assert.throws(()=>child.dispose(),/update-retry-required/);
   assert.strictEqual(h.n.preview._twinList,h.handle,'an unfinished view cannot lose the retry handle');
   assert.strictEqual(child._disposeComplete,false);
   h.handle.dispose();
   assert.strictEqual(child._disposeComplete,true);
   assert.strictEqual(h.n.preview._twinList,null);
   assert.strictEqual(model.listenerCount('update'),h.before);
  }finally{model.off=oldOff;proto.dispose=real;h.cleanup();}
 });});