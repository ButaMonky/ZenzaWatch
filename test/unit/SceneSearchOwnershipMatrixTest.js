'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
const {nativePreview}=require('../helpers/nativeCommentPreviewFixture');

function nativeFixture(){
 let native,original;
 const h=fixture('00','normal',{beforeAttach:({dom,d,bar})=>{
  native=nativePreview(dom);
  native.preview.chatList=native.chats;native.preview.currentTime=11;
  native.preview._view._onUpdate();
  const mini=native.preview._view._view;
  mini.style.fontFamily='monospace';mini.style.setProperty('letter-spacing','0.5px','important');
  d.querySelector('.zenzaCommentPreview').replaceWith(mini);
  bar._commentPreview=native.preview;
  const thumb=d.getElementById('thumb'),canvas=thumb.querySelector('canvas');
  original={mini,thumb,canvas,miniParent:mini.parentNode,miniNext:mini.nextSibling,
   thumbParent:thumb.parentNode,thumbNext:thumb.nextSibling,style:mini.getAttribute('style'),
   rows:[...mini.querySelectorAll('.nicoChat')],texts:[...mini.querySelectorAll('.text')].map(n=>n.textContent),
   listeners:native.preview._model.listenerCount('vpos')};
 }});
 return {...h,native,original,done(){
  h.binding.dispose();native.preview._view.dispose();h.dom.window.close();
 }};
}

describe('scene DOM ownership layout regression matrix',function(){
 this.timeout(60000);
 for(const context of ['normal','small','fullscreen']){
  it('returns native Canvas, comment-art rows and list subscriptions through UI00?10 in '+context,()=>{
   const h=nativeFixture(),b=h.binding.adapter.bridge,o=h.original;
   try{
    const width=context==='small'?420:context==='fullscreen'?1600:900;
    h.host.getBoundingClientRect=()=>({left:0,top:0,x:0,y:0,width,height:520,right:width,bottom:520});
    h.seek.getBoundingClientRect=()=>({left:0,top:500,x:0,y:500,width,height:20,right:width,bottom:520});
    if(context==='fullscreen')h.setMode('fullscreen');
    b.updatePlacementContext({context});
    const key=context==='fullscreen'?'sceneSearch.layout.fullscreen':'sceneSearch.layout.normal';
    for(const id of Array.from({length:11},(_,n)=>String(n).padStart(2,'0'))){
     h.config.setValue(key,id);
     h.config.setValue('enableCommentPreview',true);
     h.move(width/2);
     assert.strictEqual(b.state.layoutId,id,context+' UI'+id);
     assert.strictEqual(h.d.querySelectorAll('#thumb').length,1,id+' wrapper identity');
     assert.strictEqual(o.thumb.querySelector('canvas'),o.canvas,id+' original Canvas');
     assert.deepStrictEqual([o.canvas.width,o.canvas.height],[160,90]);
     assert.deepStrictEqual([...o.mini.querySelectorAll('.nicoChat')],o.rows,id+' original comment-art nodes');
     assert.deepStrictEqual([...o.mini.querySelectorAll('.text')].map(n=>n.textContent),o.texts,id+' native spaces/symbols');
     assert.strictEqual(h.dom.window.getComputedStyle(o.mini).fontFamily,'monospace',id+' native typography');
     b.controller.show(false);
     assert.strictEqual(b.state.shown,false);
     h.move(width/2);
    }
    b.setVideo(null);
    assert.strictEqual(b.state.shown,false);assert.strictEqual(b.state.pinned,false);
    h.player.emit('close');
    assert.strictEqual(h.binding.adapter,null);
    assert.strictEqual(o.thumb.parentNode,o.thumbParent);
    assert.strictEqual(o.thumb.nextSibling,o.thumbNext);
    assert.strictEqual(o.mini.parentNode,o.miniParent);
    assert.strictEqual(o.mini.nextSibling,o.miniNext);
    assert.strictEqual(o.mini.getAttribute('style'),o.style);
    assert.strictEqual(h.native.preview._model.listenerCount('vpos'),o.listeners);
    assert.strictEqual(h.d.querySelector('.zenzaSceneSearchHost,.zenzaScenePreviewPortal'),null);
    assert.strictEqual(h.d.querySelector('[data-scui-bridge-style],[data-scui-shared-style]'),null);
   }finally{h.done();}
  });
 }
 it('accepts a late original Canvas, keeps native focus across redocking and releases on video close',()=>{
  let canvas,parent;
  const h=fixture('01','normal',{beforeAttach:({d})=>{
   canvas=d.querySelector('#thumb canvas');parent=canvas.parentNode;canvas.remove();
  }});
  const b=h.binding.adapter.bridge,thumb=h.d.getElementById('thumb');
  try{
   assert.strictEqual(thumb.parentNode,h.d.getElementById('old'));
   parent.append(canvas);assert.strictEqual(b.refreshSharedThumbnail(),true);
   const mini=h.d.querySelector('.zenzaCommentPreview'),input=h.d.createElement('input');
   input.value='???';mini.append(input);h.config.setValue('enableCommentPreview',true);h.move(400);
   input.focus();assert.strictEqual(h.d.activeElement,input);
   h.config.setValue('enableCommentPreview',false);
   assert.strictEqual(h.d.activeElement,input,'native focus follows its exact DOM owner');
   h.config.setValue('enableCommentPreview',true);
   assert.strictEqual(h.d.activeElement,input);
   h.player.emit('close');
   assert.strictEqual(thumb.parentNode,h.d.getElementById('old'));
   assert.strictEqual(thumb.querySelector('canvas'),canvas);
   assert.strictEqual(h.d.querySelector('.zenzaSceneSearchHost'),null);
   assert.strictEqual(b.refreshSharedThumbnail(),false,'late worker notification cannot reacquire after close');
  }finally{h.close();}
 });
});
