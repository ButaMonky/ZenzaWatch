'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const {stripTypeScriptTypes}=require('node:module');
const {JSDOM}=require('jsdom');

// Execute the canonical binding in memory so the regression also works before
// a coordinated generated-runtime refresh. No generated files are modified.
const sourcePath=path.resolve(__dirname,'../../tools/typescript-stage1/nico-src/SceneSearchPlayerBinding.ts');
const source=stripTypeScriptTypes(fs.readFileSync(sourcePath,'utf8'))
 .replace(/^import .*;\r?\n/gm,'').replace('export class SceneSearchPlayerBinding','class SceneSearchPlayerBinding');
const Binding=new vm.Script(source+'\nSceneSearchPlayerBinding;', {filename:sourcePath}).runInNewContext();
function fixture(){
 const dom=new JSDOM('<!doctype html><body><div id="host"></div></body>');
 const document=dom.window.document,container=document.getElementById('host');
 const frames=[],updates=[];
 document.defaultView.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};
 let fullscreen=false;
 const dialog={on(){},off(){},screenMode:'normal'};
 const binding=new Binding({view:{},dialog,document,container,
  isFullscreen:()=>fullscreen,Adapter:class {},Bridge:class {},classes:{},createRegistry:()=>({})});
 binding.adapter={bridge:{updatePlacementContext:value=>updates.push(value)}};
 return {binding,dialog,document,container,updates,
  setFullscreen(value){fullscreen=value;},
  flush(){for(const fn of frames.splice(0))fn();},
  close(){binding.adapter=null;binding.dispose();dom.window.close();}};
}

describe('sideView compact scene placement',()=>{
 it('selects compact geometry from the dialog, fallback state and actual body mode class',()=>{
  const h=fixture();
  try{
   h.dialog.screenMode='sideView';
   assert.equal(h.binding._geometryContext(),'small','direct sideView mode');
   h.dialog.screenMode=undefined;h.dialog._state={screenMode:'sideView'};
   assert.equal(h.binding._geometryContext(),'small','fallback sideView state');
   h.dialog._state={};h.document.body.className='zenzaScreenMode_sideView';
   assert.equal(h.binding._geometryContext(),'small','body sideView class');
  }finally{h.close();}
 });
 it('retains normal and small behavior with fullscreen taking precedence over compact modes',()=>{
  const h=fixture();
  try{
   assert.equal(h.binding._geometryContext(),'normal');
   h.dialog.screenMode='small';assert.equal(h.binding._geometryContext(),'small');
   h.dialog.screenMode=undefined;h.dialog._state={screenMode:'small'};
   assert.equal(h.binding._geometryContext(),'small');
   h.dialog._state={};h.document.body.className='zenzaScreenMode_small';
   assert.equal(h.binding._geometryContext(),'small');
   h.dialog.screenMode='sideView';h.setFullscreen(true);
   assert.equal(h.binding._geometryContext(),'fullscreen');
   h.setFullscreen(false);Object.defineProperty(h.document,'fullscreenElement',{value:h.container,configurable:true});
   assert.equal(h.binding._geometryContext(),'fullscreen');
  }finally{h.close();}
 });
 it('delivers compact placement on the scheduled frame and restores normal placement after leaving sideView',()=>{
  const h=fixture();
  try{
   h.dialog.screenMode='sideView';h.binding._scheduleGeometry();h.flush();
   assert.equal(h.updates.length,1);
   assert.equal(h.updates[0].context,'small');
   assert.equal(h.updates[0].interactionActive,false);
   h.dialog.screenMode='normal';h.binding._scheduleGeometry();h.flush();
   assert.equal(h.updates.length,2);assert.equal(h.updates[1].context,'normal');
  }finally{h.close();}
 });
});
