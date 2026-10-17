'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {createContext,loadClass}=require('../helpers/extractSource');
class Emitter{
 constructor(){this.handlers=new Map();}
 on(key,handler){let arr=this.handlers.get(key)||[];arr.push(handler);this.handlers.set(key,arr);return this;}
 emit(key,...args){for(const fn of this.handlers.get(key)||[])fn(...args);return this;}
}
function harness(){
 const dom=new JSDOM('<!DOCTYPE html><html><body><div id="preview" class="zenzaCommentPreview">'+
 '<div class="listContainer"></div></div></body></html>');
 const document=dom.window.document;
 const source='src/VideoControlBar.js';
 const c=createContext({
   Emitter,document,window:dom.window,
   _: {isNumber:Number.isFinite},
   util:{StyleSwitcher:{update(){}}},
   CommentPreviewChatItem:{
     create(chat,index){
       const li=document.createElement('li');
       li.className='nicoChat';li.textContent=chat.text;li.dataset.vpos=chat.vpos;
       li.dataset.nicochatUniqNo=chat.uniqNo;
       return li;
     }
   }
 });
 const Model=loadClass(source,'CommentPreviewModel',c);
 const View=loadClass(source,'CommentPreviewView',c);
 View.ITEM_HEIGHT=20;View.MAX_HEIGHT=200;
 const model=new Model();
 const view=Object.create(View.prototype);
 view._model=model;
 view._mode='list';
 view._view=document.getElementById('preview');
 view._list=view._view.querySelector('.listContainer');
 view._inviewTable=new Map();
 view._chatList=[];
 view._newListElements=null;
 view._currentTime=0;
 view._scrollTop=0;
 view.applyView=()=>{
   if(view._newListElements) view._list.append(view._newListElements);
 };
 model.on('reset',()=>view._onReset());
 model.on('update',()=>view._onUpdate());
 model.on('vpos',vpos=>view._onVpos(vpos));
 model.reset();
 function chats(count,at=100){
   const naka=Array.from({length:count},(_,i)=>({
    vpos:i*at,uniqNo:'c'+i, text:'user comment #'+i,no:i+1,date:1600000000,
    duration:4, color:'#fff', userId:'tester',fork:0
   }));
   return {top:[],naka,bottom:[]};
 }
 return {dom,document,model,view,chats};
}
describe('Task623 real native preview data-flow audit',()=>{
 it('renders rows when commentParsed arrives after hover even without another pointer move',()=>{
  const h=harness();
  try{
   h.model.vpos=1100; // common: user begins hovering before parser finishes
   assert.strictEqual(h.view._list.children.length,0);
   h.model.chatList=h.chats(35);
   assert(h.view._list.style.height.endsWith('px'),'native update knows total rows');
   assert(h.view._list.children.length>0,
     'a new commentParsed batch should show actual rows without requiring another mousemove');
  }finally{h.dom.window.close();}
 });
 it('passes real VideoControlBar commentParsed through to rendered native preview rows',()=>{
  const h=harness();
  try{
   const Bar=loadClass('src/VideoControlBar.js','VideoControlBar',
     createContext({Emitter}));
   const bar=Object.create(Bar.prototype);
   const watchId='sm-preview-test';
   bar._heatMapWatchId=watchId;
   bar.player={watchId,duration:239,chatList:h.chats(35)};
   bar._commentPreview={set chatList(value){h.model.chatList=value;}};
   bar.heatMap=null;
   h.model.vpos=1100;
   assert.equal(h.view._list.children.length,0);
   bar._onCommentParsed(); // exact production event callback
   assert(h.view._list.children.length>0,'parsed comments must become preview rows');
   assert.equal(h.model.chatList.length,35);
   bar.player.watchId='sm-other-video';
   bar.player.chatList=h.chats(5);
   bar._onCommentChange();
   assert.equal(h.model.chatList.length,35,'obsolete video event must be ignored');
  }finally{h.dom.window.close();}
 });
 it('uses logarithmic reads to map hovered seek time into a large sorted chat list',()=>{
  const h=harness();
  try{
   const entries=h.chats(50000,10).naka;
   let readCount=0;
   const proxied=new Proxy(entries,{
     get(target,prop,receiver){
      if(typeof prop==='string'&&/^\d+$/.test(prop))readCount++;
      return Reflect.get(target,prop,receiver);
     }
   });
   h.model._chatList=proxied;h.model._chatReady=true;
   const index=h.model.getVposIndex(5100);
   assert.strictEqual(index,471);
   assert(readCount<=35,'preview vpos lookup uses '+readCount+' row reads for a single hover; expected O(log n)');
  }finally{h.dom.window.close();}
 });
 it('redraws real comment rows immediately when the button switches hover to list',()=>{
  const h=harness();
  try{
   h.view._mode='hover';
   h.model.chatList=h.chats(35);
   h.model.vpos=1100;
   const hoverRows=h.view._inviewTable.size;
   assert(hoverRows>0,'should have native hover rows before click');
   h.view.mode='list'; // exact native VideoControlBar mode setter called on button
   assert(h.view._inviewTable.size>hoverRows,
     'native list mode must immediately populate its wider virtual row window');
  }finally{h.dom.window.close();}
 });
 it('matches original inclusive vpos threshold for duplicates and boundaries',()=>{
  const h=harness();
  try{
   const a=[0,0,100,399,400,400,401,900,901,1200];
   h.model._chatList=a.map((vpos,i)=>({vpos,no:i}));
   for(const position of [-100,0,399,400,401,499,799,800,801,1200,1600,9999,NaN]){
     let expected=-1;
     for(let i=a.length-1;i>=0;i--){
       if(a[i]<=position-400){expected=i+1;break;}
     }
     assert.equal(h.model.getVposIndex(position),expected,
       'vpos '+position+' must match legacy inclusive reverse scan');
   }
  }finally{h.dom.window.close();}
 });
 it('removes old virtual rows when the range shrinks even without any new row to append',()=>{
  const h=harness();
  try{
   h.view._chatList=h.chats(20).naka;
   h.view._mode='list';
   for(let i=0;i<17;i++){
     const li=h.document.createElement('li');li.textContent='item '+i;
     h.view._inviewTable.set(i,li);h.view._list.append(li);
   }
   h.view._refreshInviewElements(0);
   assert(!h.view._inviewTable.has(16),
     'stale out-of-range row remains because newItems.length===0 shortcuts cleanup');
   assert.equal(h.view._list.children.length,15);
  }finally{h.dom.window.close();}
 });
 it('updates current comment mode at runtime without losing original row handlers',()=>{
  const h=harness();
  try{
   h.model.chatList=h.chats(35);
   h.model.vpos=1100;
   assert(h.view._list.querySelector('.nicoChat'),'native list must contain a row');
   h.view._mode='hover';
   h.model.vpos=1125;
   assert(h.view._list.querySelector('.nicoChat'),'hover must not destroy the native row DOM');
  }finally{h.dom.window.close();}
 });
});
