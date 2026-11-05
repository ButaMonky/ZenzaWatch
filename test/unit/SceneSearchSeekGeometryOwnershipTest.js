'use strict';
// P13-09b: one read-only typed geometry owner; no seek or DOM mutation.
const assert=require('assert'),fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const root=path.resolve(__dirname,'../..');
const Collector=loadClass(
 'packages/zenza/src/sceneSearch/SceneSearchVisibleRectCollector.js',
 'SceneSearchVisibleRectCollector',createContext());
const Bridge=loadClass(
 'packages/zenza/src/sceneSearch/SceneSearchIntegrationBridge.js',
 'SceneSearchIntegrationBridge',createContext({SceneSearchVisibleRectCollector:Collector}));
function harness({
  viewport=1200,frameLeft=200,frameWidth=500,containerWidth=250,
  seekLeft=100,seekWidth=900,pointerClientX=500
}={}){
 const dom=new JSDOM('<!doctype html><body><div id="player"><div id="seek"></div></div>');
 const doc=dom.window.document,container=doc.querySelector('#player');
 const seekElement=doc.querySelector('#seek');
 Object.defineProperty(dom.window,'innerWidth',{configurable:true,value:viewport});
 Object.defineProperty(container,'offsetWidth',{configurable:true,value:containerWidth});
 container.getBoundingClientRect=()=>({
  left:frameLeft,width:frameWidth,top:20,bottom:120,
  right:frameLeft+frameWidth,height:100
 });
 seekElement.getBoundingClientRect=()=>({
  left:seekLeft,width:seekWidth,top:85,bottom:95,
  right:seekLeft+seekWidth,height:10
 });
 const input={seekElement,container,document:doc,pointerClientX};
 // VM-extracted runtime classes return cross-realm records; normalize only test data.
 const geometry=unclipped=>JSON.parse(JSON.stringify(Collector.seekGeometry({...input,unclipped})));
 const delegated=unclipped=>JSON.parse(JSON.stringify(Bridge.prototype._getSeekGeometry.call({
  seekElement,container,document:doc,_seekClientX:pointerClientX
 },unclipped)));
 return {dom,geometry,delegated};
}
describe('P13-09b typed seek geometry owner',()=>{
 it('retains clipped video box and unclipped UI01 coordinate contracts',()=>{
  const h=harness();
  const clipped={seekLeft:-50,seekWidth:450,pointerX:150,
   visibleLeft:0,visibleRight:250};
  const full={seekLeft:-50,seekWidth:450,pointerX:150,
   visibleLeft:-100,visibleRight:500};
  assert.deepStrictEqual(h.geometry(false),clipped);
  assert.deepStrictEqual(h.geometry(true),full);
  assert.deepStrictEqual(h.delegated(false),clipped);
  assert.deepStrictEqual(h.delegated(true),full);
  h.dom.window.close();
 });
 it('retains null or invalid geometry without fabricating a seek time',()=>{
  for(const config of [{seekWidth:0},{frameWidth:0},{seekLeft:NaN},
    {seekWidth:Infinity}]){
   const h=harness(config);
   assert.strictEqual(h.geometry(false),null);
   assert.strictEqual(h.delegated(false),null);
   h.dom.window.close();
  }
 });
 it('retains null pointer, negative viewport offset and real client scaling',()=>{
  const h=harness({viewport:320,frameLeft:-60,frameWidth:1000,
    containerWidth:1000,seekLeft:-40,seekWidth:900,pointerClientX:null});
  const expected={seekLeft:20,seekWidth:900,pointerX:null,visibleLeft:60,visibleRight:380};
  assert.deepStrictEqual(h.geometry(false),expected);
  assert.deepStrictEqual(h.delegated(false),expected);
  h.dom.window.close();
 });
 it('delegation does not add another seek listener, owner or click interception',()=>{
  const b=fs.readFileSync(path.join(root,
   'packages/zenza/src/sceneSearch/SceneSearchIntegrationBridge.js'),'utf8');
  assert(b.includes('SceneSearchVisibleRectCollector.seekGeometry({'));
  const method=b.match(/\s+_getSeekGeometry\(unclipped\s*=\s*false\)\s*\{([\s\S]*?)\n\s*\}/);
  assert(method);
  assert(!method[1].includes('getBoundingClientRect'));
  assert(!method[1].includes('addEventListener'));
  assert(!method[1].includes('onSeek'));
 });
});
