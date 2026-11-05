'use strict';
const assert=require('assert');
const {fixture}=require('../helpers/scenePlayerFixture');
const box=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});
const prefs=()=>({
 enabled:true,normal:'follow',fullscreen:'follow',linked:false,
 miniEnabled:true,miniVisible:true,listVisible:true,listAllowed:true,
 listOpen:false,opacity:90,scale:100,listScale:100,miniStyle:'flow'
});
function element(d,parent,cls,rect,css='',tag='div'){
 const node=d.createElement(tag);
 node.className=cls;
 node.style.cssText=css;
 node.getBoundingClientRect=()=>rect;
 parent.append(node);
 return node;
}
function harness(context='normal',build=()=>{}){
 let nodes;
 const h=fixture('01',context==='fullscreen'?'fullscreen':'normal',{
  beforeAttach({d,host,config}){
   config.resolveSceneSearch=prefs;
   nodes=build({d,host,config})||{};
  }
 });
 const bridge=h.binding.adapter.bridge;
 assert(bridge,'modern scene Bridge must be attached');
 const geometry=()=>{
  bridge.updatePlacementContext({context});
  return bridge._placementGeometry;
 };
 const tracked=()=>geometry().obstacles;
 return {...h,bridge,nodes,geometry,tracked};
}
const at=(items,left,top)=>items.some(r=>r.left===left&&r.top===top);
describe('SceneSearchIntegrationBridge visual obstacle audit',function(){
 this.timeout(20000);
 for(const context of ['normal','small','fullscreen']){
  it('excludes descendants hidden by ancestor display or composited opacity in '+context,()=>{
   const h=harness(context,({d,host})=>{
    const invisible=element(d,host,'ancestor-opacity',box(20,20,260,160),'opacity:0;');
    element(d,invisible,'commandPopover',box(40,40,120,50),'pointer-events:auto;');
    const absent=element(d,host,'ancestor-display',box(200,200,280,180),'display:none;');
    element(d,absent,'commandMenu',box(250,220,150,60),'pointer-events:auto;');
    const visible=element(d,host,'commandMenu',box(580,300,100,55),'pointer-events:auto;');
    return {visible};
   });
   try{
    const obstacles=h.tracked();
    assert(!at(obstacles,40,40),'opacity:0 on ancestor hides descendants');
    assert(!at(obstacles,250,220),'display:none ancestor prevents rendering');
    assert(at(obstacles,580,300),'independent visible popup remains an obstacle');
   }finally{h.close();}
  });
 }
 it('protects actual transformed fullscreen buttons, not the large transparent hit-area wrappers',()=>{
  const h=harness('fullscreen',({d,host})=>{
   const bar=element(d,host,'videoControlBar',box(0,0,900,520));
   const row=element(d,bar,'controlItemContainer right',box(400,180,450,220),
    'pointer-events:none;background:transparent;');
   const scaling=element(d,row,'scalingUI',box(480,210,270,150),
    'pointer-events:none;background:transparent;');
   const button=element(d,scaling,'controlButton',box(710,325,44,38),
    'pointer-events:auto;transform:translate(16px,20px);background:rgb(55,55,55);','button');
   return {row,button};
  });
  try{
   const g=h.geometry();
   assert(at(g.obstacles,710,325),'use transformed child bounding rect as measured');
   assert(!at(g.obstacles,400,180),'transparent wrapper is not the hit-area obstacle');
   assert(!at(g.obstacles,480,210),'transparent scaling parent is not interactive');
   assert.strictEqual(g.previewAnchorTop,325,'fullscreen anchor follows the painted button top');
  }finally{h.close();}
 });
 it('finds interactive children of pointer-transparent popups and ignores hidden descendants',()=>{
  const h=harness('normal',({d,host})=>{
   const popup=element(d,host,'commandPopover',box(280,200,430,240),
    'pointer-events:none;background:transparent;');
   element(d,popup,'child-action',box(540,290,70,40),
    'pointer-events:auto;background:rgb(20,30,40);','button');
   element(d,popup,'child-hidden',box(400,260,90,45),
    'pointer-events:auto;display:none;','button');
   return {popup};
  });
  try{
   const obstacles=h.tracked();
   assert(at(obstacles,540,290),'real popup button must be protected');
   assert(!at(obstacles,280,200),'transparent popup container is not a visual obstacle');
   assert(!at(obstacles,400,260),'hidden action is not protected');
  }finally{h.close();}
 });
 it('distinguishes visibility:hidden from an explicitly visible descendant',()=>{
  const h=harness('normal',({d,host})=>{
   const parent=element(d,host,'commandDrawer',box(50,140,350,220),
    'visibility:hidden;pointer-events:none;');
   element(d,parent,'commandMenu',box(110,200,110,70),
    'visibility:visible;pointer-events:auto;background:rgb(5,6,7);');
  });
  try{
   const obstacles=h.tracked();
   assert(at(obstacles,110,200),'visibility:visible child overrides inherited hidden');
   assert(!at(obstacles,50,140),'hidden parent itself is excluded');
  }finally{h.close();}
 });
 it('clips a partially visible popup to its overflow:hidden scrollport',()=>{
  const h=harness('normal',({d,host})=>{
   const clip=element(d,host,'clip-owner',box(100,100,80,50),
    'overflow:hidden;position:relative;');
   element(d,clip,'commandMenu',box(160,120,110,70),
    'pointer-events:auto;background:rgb(5,6,7);');
  });
  try{
   const items=h.tracked(),visible=items.find(r=>r.left===160&&r.top===120);
   assert(visible,'partially displayed popup is an obstacle');
   assert.strictEqual(visible.width,20,'width clipped at the scrollport edge');
   assert.strictEqual(visible.height,30,'height clipped at the scrollport edge');
  }finally{h.close();}
 });
 it('ignores fully clipped children, including clip-path inset on an ancestor',()=>{
  const h=harness('normal',({d,host})=>{
   const clip=element(d,host,'clip-owner',box(100,100,100,90),
    'overflow:clip;clip-path:inset(20% 10% 20% 10%);position:relative;');
   element(d,clip,'commandPopover',box(50,50,40,40),
    'pointer-events:auto;background:rgb(5,6,7);');
   element(d,clip,'commandMenu',box(120,100,40,14),
    'pointer-events:auto;background:rgb(5,6,7);');
   element(d,clip,'commandList',box(125,128,30,25),
    'pointer-events:auto;background:rgb(5,6,7);');
  });
  try{
   const items=h.tracked();
   assert(!at(items,50,50),'child entirely beyond overflow clip is not visible');
   assert(!at(items,120,100),'child cropped by clip-path inset top is not visible');
   assert(at(items,125,128),'popup within clip area is protected');
  }finally{h.close();}
 });
 it('scales clip-path pixel insets with the transformed ancestor box',()=>{
  const h=harness('normal',({d,host})=>{
   const clipped=element(d,host,'clip-owner',box(300,100,200,200),
    'clip-path:inset(10px 0px 0px 0px);transform:scale(2);');
   Object.defineProperty(clipped,'offsetWidth',{configurable:true,value:100});
   Object.defineProperty(clipped,'offsetHeight',{configurable:true,value:100});
   element(d,clipped,'commandMenu',box(320,111,50,8),
    'pointer-events:auto;background:rgb(12,15,18);');
   element(d,clipped,'commandPopover',box(330,135,50,25),
    'pointer-events:auto;background:rgb(12,15,18);');
  });
  try{
   const obstacles=h.tracked();
   assert(!at(obstacles,320,111),'inset 10px scales to 20 client pixels');
   assert(at(obstacles,330,135),'visible popup remains a blocker');
  }finally{h.close();}
 });
 it('lets fixed popups escape overflow-only ancestors but clips transformed containing blocks',()=>{
  const h=harness('normal',({d,host})=>{
   const outer=element(d,host,'clip-owner',box(100,100,80,50),
    'overflow:hidden;position:relative;');
   element(d,outer,'commandPopover',box(650,310,115,44),
    'position:fixed;pointer-events:auto;background:rgb(10,20,30);');
   const transformed=element(d,host,'transform-owner',box(300,100,90,65),
    'overflow:hidden;transform:translateZ(0);');
   element(d,transformed,'commandMenu',box(670,370,115,44),
    'position:fixed;pointer-events:auto;background:rgb(30,40,50);');
  });
  try{
   const obstacles=h.tracked();
   assert(at(obstacles,650,310),'viewport-fixed popup is not clipped by unrelated scrollport');
   assert(!at(obstacles,670,370),'transformed overflow ancestor clips its fixed descendants');
  }finally{h.close();}
 });
 it('ignores idle comment input but protects focus and visibly open popovers',()=>{
  const h=harness('fullscreen',({d,host})=>{
   const panel=element(d,host,'commentInputPanel',box(350,300,230,100),
    'pointer-events:auto;background:transparent;');
   const input=element(d,panel,'',box(360,310,120,34),'','input');
   const popup=element(d,panel,'commandPopover',box(390,230,180,60),
    'pointer-events:none;background:transparent;');
   const action=element(d,popup,'',box(410,245,76,30),
    'pointer-events:auto;background:rgb(40,50,60);','button');
   action.hidden=true;
   return {panel,input,action};
  });
  try{
   const {panel,input,action}=h.nodes;
   assert(!at(h.tracked(),350,300),'idle comment panel should not jump into preview');
   assert(!at(h.tracked(),410,245),'closed popup button should not collide');
   input.focus();
   assert(at(h.tracked(),350,300),'focused native input is protected');
   input.blur();panel.classList.add('is-popoverOpen');action.hidden=false;
   assert(at(h.tracked(),410,245),'visible popup action is protected');
  }finally{h.close();}
 });
 it('keeps native click ownership and pointer-events unchanged after scanning controls',()=>{
  let clicks=0;
  const h=harness('fullscreen',({d,host})=>{
   const row=element(d,host,'controlItemContainer right',box(490,270,260,100),
    'pointer-events:none;background:transparent;');
   const btn=element(d,row,'controlButton',box(690,285,42,36),
    'pointer-events:auto;background:rgb(40,50,60);','button');
   btn.addEventListener('click',()=>clicks++);
   return {btn,row};
  });
  try{
   const before=h.nodes.btn.style.cssText,rootBefore=h.nodes.row.style.cssText;
   assert(at(h.tracked(),690,285));
   h.nodes.btn.click();
   assert.strictEqual(clicks,1,'the original button retains its click listener');
   assert.strictEqual(h.nodes.btn.style.cssText,before);
   assert.strictEqual(h.nodes.row.style.cssText,rootBefore);
  }finally{h.close();}
 });
 it('reuses sampled obstacles on seek movement until placement context invalidates',()=>{
  let reads=0;
  const h=harness('fullscreen',({d,host})=>{
   const menu=element(d,host,'commandMenu',box(440,240,100,55),
    'pointer-events:auto;background:rgb(20,30,40);');
   menu.getBoundingClientRect=()=>{reads++;return box(440,240,100,55);};
   return {menu};
  });
  try{
   h.geometry();
   const sampled=reads;
   for(let i=0;i<35;i++)h.move(300+i);
   assert.strictEqual(reads,sampled,'mousemove should only use the cached obstacle geometry');
   h.geometry();
   assert(reads>sampled,'invalidation must resample moved controls');
  }finally{h.close();}
 });
 it('invalidates cached obstacles after Placement.compute throws and can recover native DOM',()=>{
  const h=harness('fullscreen',({d,host})=>{
   const menu=element(d,host,'commandMenu',box(250,150,120,50),
    'pointer-events:auto;background:rgb(30,40,50);');
   return {menu};
  });
  const original=h.bridge._classes.Placement.compute;
  let first=true;
  try{
   const thumb=h.d.getElementById('thumb'),nativeOwner=h.d.getElementById('old');
   h.bridge._classes.Placement.compute=input=>{
    if(first){first=false;throw new Error('obstacle-layout-transient');}
    return original.call(h.bridge._classes.Placement,input);
   };
   assert.throws(()=>h.geometry(),/obstacle-layout-transient/);
   h.nodes.menu.style.display='none';
   const recovered=h.geometry();
   assert(!at(recovered.obstacles,250,150),
    'failed placement must remeasure visibility instead of using a stale snapshot');
   h.player.emit('close');
   assert.strictEqual(thumb.parentNode,nativeOwner,'native Canvas owner restored');
   assert.strictEqual(h.d.querySelector('.zenzaScenePreviewPortal'),null);
  }finally{h.bridge._classes.Placement.compute=original;h.close();}
 });
 it('does not let a failed obstacle measurement steal native Canvas after layout closure',()=>{
  const h=harness('normal',({d,host})=>{
   const popup=element(d,host,'commandPopover',box(80,80,70,55),'pointer-events:auto;');
   return {popup};
  });
  const {popup}=h.nodes,read=popup.getBoundingClientRect;
  const thumb=h.d.getElementById('thumb'),canvas=thumb.querySelector('canvas');
  try{
   popup.getBoundingClientRect=()=>{throw new Error('obstacle-measurement-transient');};
   assert.throws(()=>h.geometry(),/obstacle-measurement-transient/);
   popup.getBoundingClientRect=read;
   h.config.resolveSceneSearch=()=>({...prefs(),normal:'fixed'});
   h.bridge.controller.onPreferencesChanged('sceneSearch.presentation.normal');
   assert.strictEqual(h.bridge.state.layoutId,'fixed');
   h.player.emit('close');
   assert.strictEqual(thumb.parentNode,h.d.getElementById('old'));
   assert.strictEqual(thumb.querySelector('canvas'),canvas);
  }finally{popup.getBoundingClientRect=read;h.close();}
 });
});
