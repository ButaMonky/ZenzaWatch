import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {ManualBookmarkRepository} from '../../../packages/zenza/src/resume/ManualBookmarkStore.js';
import {ManualBookmarkSession} from '../../../packages/zenza/src/resume/ManualBookmarkSession.js';
import {ManualBookmarkDock} from '../../../packages/zenza/src/resume/ManualBookmarkDock.js';
const require=createRequire(import.meta.url);
const {JSDOM}=require('jsdom');
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
test('generated five-module graph performs actual separate bookmark writes and seeks',async()=>{
 const dom=new JSDOM('<!doctype html><html><body>'+
  '<input class="nativeSeek" type="range"/>'+
  '<zenza-seekbar-label class="resumePointer"></zenza-seekbar-label>'+
  '<div class="zenzaWatchVideoInfoPanel"><div class="tabs videoInfoTab">'+
  '<div class="zenzaWatchVideoInfoPanelContent"><div class="seriesList"></div>'+
  '</div></div></div></body></html>');
 const doc=dom.window.document,range=doc.querySelector('.nativeSeek');
 const native=doc.querySelector('.resumePointer');
 const backend={data:new Map(),closed:0,
  async read(id){return this.data.get(id)||[];},
  async update(id,fn){const rows=fn(this.data.get(id)||[]);this.data.set(id,rows);},
  close(){this.closed++;}};
 const session=new ManualBookmarkSession(new ManualBookmarkRepository(backend));
 let active='sm1',time=85,now=100;const seeks=[];
 const dock=ManualBookmarkDock.mount(doc.body,session,{
  currentVideoId:()=>active,currentTime:()=>time,timestamp:()=>now,
  newId:()=> 'B1',seek:sec=>seeks.push(sec)
 });
 const btn=name=>dock.element.querySelector('[data-bookmark-action="'+name+'"]');
 await dock.activate(active,300);
 // The actual generated runtime must isolate all dock keydown/keyup actions
 // from player-wide shortcuts without preventing native seek keyboard input.
 let globalKeydown=0,globalKeyup=0;
 doc.body.addEventListener('keydown',()=>globalKeydown++);
 doc.body.addEventListener('keyup',()=>globalKeyup++);
 for(const target of [dock.element.querySelector('.zw-points-heading'),btn('add')]){
  for(const name of ['keydown','keyup']){
   const event=new dom.window.KeyboardEvent(name,{
    bubbles:true,cancelable:true,key:' '
   });
   target.dispatchEvent(event);
   assert.equal(event.defaultPrevented,false,'native button keyboard remains usable');
  }
 }
 assert.equal(globalKeydown,0);
 assert.equal(globalKeyup,0);
 range.dispatchEvent(new dom.window.KeyboardEvent('keydown',{
  bubbles:true,cancelable:true,key:'ArrowRight'
 }));
 range.dispatchEvent(new dom.window.KeyboardEvent('keyup',{
  bubbles:true,cancelable:true,key:'ArrowRight'
 }));
 assert.equal(globalKeydown,1);
 assert.equal(globalKeyup,1);
 dock.element.querySelector('[data-bookmark-label]').value='重要場面';
 btn('add').click();await settle();
 assert.equal(backend.data.get('sm1')[0].label,'重要場面');
 assert.equal(backend.data.get('sm1')[0].time,85);
 assert.equal(doc.querySelector('.nativeSeek'),range);
 assert.equal(doc.querySelector('.resumePointer'),native);
 dock.element.querySelector('input[data-bookmark-rename-id="B1"]').value='保存した場面';
 now=120;btn('rename').click();await settle();
 assert.equal(backend.data.get('sm1')[0].label,'保存した場面');
 btn('seek').click();assert.deepEqual(seeks,[85]);
 btn('remove').click();await settle();
 assert.equal(backend.data.get('sm1').length,0);
 assert.equal(doc.querySelector('.resumePointer'),native);
 dock.dispose();assert.equal(backend.closed,1);
 assert.equal(doc.querySelector('.zenzaManualBookmarkDock'),null);
 dom.window.close();
});
test('generated runtime preserves manual data while another video becomes active',async()=>{
 const dom=new JSDOM('<!doctype html><html><body>'+
  '<div class="zenzaWatchVideoInfoPanel"><div class="tabs videoInfoTab">'+
  '<div class="zenzaWatchVideoInfoPanelContent"></div></div></div></body></html>');
 const doc=dom.window.document;
 const backend={data:new Map(),close(){},
  async read(id){return this.data.get(id)||[];},
  async update(id,fn){this.data.set(id,fn(this.data.get(id)||[]));}};
 const repo=new ManualBookmarkRepository(backend);
 const session=new ManualBookmarkSession(repo);
 let active='sm1';
 const dock=ManualBookmarkDock.mount(doc.body,session,{
  currentVideoId:()=>active,currentTime:()=>65,timestamp:()=>101,
  newId:()=> 'B1',seek:()=>{}
 });
 await dock.activate('sm1',200);
 dock.element.querySelector('[data-bookmark-action="add"]').click();await settle();
 active='sm2';
 dock.element.querySelector('[data-bookmark-action="remove"]').click();await settle();
 await dock.activate('sm2',300);
 assert.equal(backend.data.get('sm1').length,1);
 assert.equal(dock.element.querySelectorAll('li').length,0);
 dock.dispose();dom.window.close();
});
