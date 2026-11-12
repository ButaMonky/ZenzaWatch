'use strict';
const assert=require('assert'),fs=require('fs');
const {stripTypeScriptTypes}=require('node:module');
const {JSDOM}=require('jsdom');
const {createContext,run,beginSection}=require('../helpers/extractSource');
function fixture(horizontal=false){
 const w=new JSDOM('<div id="card" data-group="true" data-anchor-href="/watch/sm9"><div id="content"><div id="picture"><a id="image" href="/watch/sm9"><img id="img"><button id="overlay">later</button></a></div><div id="details"><a id="title" href="/watch/sm9"><span id="text">video</span></a><div id="stats"><time id="date" datetime="2026-11-11">date</time><p id="counts"><svg id="icon"></svg><span id="count">12</span></p></div><div id="ownerRow"><a id="owner" href="/user/12"><img id="avatar">owner</a></div></div></div><div id="actions"><span id="ng">action</span></div><span id="toggle">▼</span></div>',{url:'https://www.nicovideo.jp/tag/test'}).window;
 const context=createContext({window:w,document:w.document,location:w.location,ZenzaWatch:{emitter:{emit(){}}}});
 run(beginSection('packages/lib/src/nico/nicoUtil.js'),context);
 const src=stripTypeScriptTypes(fs.readFileSync('tools/typescript-stage1/nico-src/HoverMenu.ts','utf8')).replace(/^export\s*\{[^}]*\};?$/mg,'');
 run(src+';globalThis.Subject=HoverMenu;',context);
 const menu=Object.create(context.Subject.prototype);
 const rects=horizontal?{image:[0,0,200,120],title:[220,0,420,40],stats:[220,50,420,70]}:{image:[0,0,200,120],title:[0,130,200,170],stats:[0,180,200,200]};
 for(const [id,r]of Object.entries(rects))w.document.getElementById(id).getBoundingClientRect=()=>({left:r[0],top:r[1],right:r[2],bottom:r[3],width:r[2]-r[0],height:r[3]-r[1]});
 function intent(id,x=1,y=1){let result;const node=w.document.getElementById(id);node.addEventListener('click',e=>{result=menu._resolveWatchClick(e);e.preventDefault();},{once:true});node.dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,composed:true,button:0,clientX:x,clientY:y}));return !!result;}
 return {w,intent};
}
for(const horizontal of [false,true])describe('card area '+(horizontal?'horizontal reconstructed':'tile captured structure'),()=>{
 for(const id of ['img','text','date','count','icon'])it('opens '+id,()=>{const f=fixture(horizontal);try{assert(f.intent(id));}finally{f.w.close();}});
 for(const id of ['toggle','ng','actions','owner','avatar','ownerRow','overlay'])it('excludes '+id+' even at a video coordinate',()=>{const f=fixture(horizontal);try{assert.equal(f.intent(id,10,10),false);}finally{f.w.close();}});
 it('opens structural whitespace between content regions',()=>{const f=fixture(horizontal);try{assert(f.intent('content',horizontal?210:100,horizontal?20:125));assert(f.intent('details',horizontal?300:100,horizontal?45:175));}finally{f.w.close();}});
 it('does not open whitespace next to or below owner',()=>{const f=fixture(horizontal);try{assert.equal(f.intent('details',horizontal?300:100,horizontal?95:225),false);assert.equal(f.intent('card',100,400),false);}finally{f.w.close();}});
});

describe('supplied tile direct-child content structure (anonymized)',()=>{
 it('retains content gaps while excluding appended controls and owner-adjacent blank',()=>{
  const f=fixture(false);
  try{
   const doc=f.w.document;
   for(const id of ['details','ownerRow']){const node=doc.getElementById(id);node.replaceWith(...node.childNodes);}
   for(const id of ['img','text','date','count'])assert(f.intent(id),id);
   assert(f.intent('content',100,125));
   assert(f.intent('content',100,175));
   for(const id of ['toggle','ng','actions','owner','avatar'])assert.equal(f.intent(id,100,175),false,id);
   assert.equal(f.intent('content',100,225),false);
  }finally{f.w.close();}
 });
});
