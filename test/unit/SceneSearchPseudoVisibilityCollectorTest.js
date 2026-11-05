'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const Collector=loadClass('packages/zenza/src/sceneSearch/SceneSearchObstacleCollector.js',
  'SceneSearchObstacleCollector',createContext());
const rect=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
function make(){
 const dom=new JSDOM('<!doctype html><html><head></head><body>'+
  '<div id="player" style="position:relative">'+
  '<div id="owner" class="playbackRateMenu controlButton">'+
  '<div id="menu" class="zenzaPopupMenu" style="opacity:0;pointer-events:none;'+
  'background:rgb(50,65,77)"><button type="button">playback speed</button></div>'+
  '</div><div id="pseudo" class="commandPopover" style="opacity:0;'+
  'background:rgb(20,40,60);pointer-events:none"></div></div>'+
  '</body></html>',{pretendToBeVisual:true});
 const d=dom.window.document,container=d.getElementById('player');
 const menu=d.getElementById('menu'),pseudo=d.getElementById('pseudo');
 menu.getBoundingClientRect=()=>rect(390,240,175,125);
 pseudo.getBoundingClientRect=()=>rect(600,200,110,65);
 d.getElementById('owner').getBoundingClientRect=()=>rect(390,330,45,32);
 container.getBoundingClientRect=()=>rect(0,0,900,520);
 const collect=()=>Collector.collect({document:d,container,fullscreen:false}).obstacles;
 const includes=(items,needle)=>items.some(x=>x.left===needle.left&&x.top===needle.top);
 return {dom,menu,pseudo,collect,includes};
}
describe('P4-02 native and CSS pseudo-state obstacle visibility',()=>{
 it('protects actual native playback rate popup only when computed visibility turns on',()=>{
  const h=make();
  try{
   assert(!h.includes(h.collect(),{left:390,top:240}));
   h.menu.style.opacity='0.99';h.menu.style.pointerEvents='auto';
   assert(h.includes(h.collect(),{left:390,top:240}),
    'native .zenzaPopupMenu becomes a scene obstacle when shown');
   h.menu.style.opacity='0';h.menu.style.pointerEvents='none';
   assert(!h.includes(h.collect(),{left:390,top:240}));
  }finally{h.dom.window.close();}
 });
 it('keeps the ordinary command popup visibility contract',()=>{
  const h=make();
  try{
   assert(!h.includes(h.collect(),{left:600,top:200}));
   h.pseudo.style.opacity='1';h.pseudo.style.pointerEvents='auto';
   assert(h.includes(h.collect(),{left:600,top:200}));
  }finally{h.dom.window.close();}
 });
});
