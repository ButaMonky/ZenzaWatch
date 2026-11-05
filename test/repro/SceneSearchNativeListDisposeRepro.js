'use strict';
// Explicit native-owner reproduction for Chat 1. It is outside test/**/unit/*.js.
// Expected to fail until both native dispose layers retain unfinished cleanup.
// Run: node test/repro/SceneSearchNativeListDisposeRepro.js
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {nativePreview}=require('../helpers/nativeCommentPreviewFixture');
const dom=new JSDOM('<html><body><div id="host"></div></body></html>');
const native=nativePreview(dom),host=dom.window.document.getElementById('host');
const before=native.preview._model.listenerCount('update');
const handle=native.preview.createListView(host);
const dispose=native.View.prototype.dispose;let calls=0;
native.View.prototype.dispose=function(){
 calls++;
 if(calls===1)throw new Error('view-dispose-transient');
 return dispose.call(this);
};
try{
 assert.throws(()=>handle.dispose(),/view-dispose-transient/);
 handle.dispose();
 const result={disposeCalls:calls,staleHandle:native.preview._twinList===handle,
  elementStillConnected:handle.element.isConnected,beforeListeners:before,
  afterListeners:native.preview._model.listenerCount('update')};
 console.log(JSON.stringify(result,null,2));
 assert.strictEqual(calls,2,'unfinished native view disposal must be retried');
 assert.strictEqual(native.preview._model.listenerCount('update'),before);
 assert.notStrictEqual(native.preview._twinList,handle);
 assert.strictEqual(handle.element.isConnected,false);
}finally{
 native.View.prototype.dispose=dispose;
 dom.window.close();
}
