'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {stripTypeScriptTypes}=require('node:module'),parser=require('@babel/parser');
const {JSDOM}=require('jsdom');
const base='tools/typescript-stage1/nico-src/';
function klass(file,name){
 const source=stripTypeScriptTypes(fs.readFileSync(base+file+'.ts','utf8'));
 const ast=parser.parse(source,{sourceType:'module',allowUndeclaredExports:true});
 let found;
 function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='ClassDeclaration'&&node.id.name===name){found=node;return;}
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else visit(value);
 }
 visit(ast);
 assert(found,name);return source.slice(found.start,found.end);
}
function fixture(){
 const dom=new JSDOM('<div class="seekBarContainer"><div class="seekBar"><input class="seekRange"></div></div>');
 const ctx=vm.createContext({Emitter:class{},HTMLElement:dom.window.HTMLElement,
  _: {debounce:fn=>fn},cssUtil:{setProps(){}}});
 vm.runInContext(klass('TimelineGeometry','TimelineGeometry')+';'+
  klass('SceneResumeMarkerPresenter','SceneResumeMarkerPresenter')+';'+
  klass('VideoControlBar','VideoControlBar')+';'+
  klass('CustomElements','SeekbarLabel')+
  ';globalThis.P=SceneResumeMarkerPresenter;globalThis.Bar=VideoControlBar;globalThis.Label=SeekbarLabel;',ctx);
 dom.window.customElements.define('zenza-seekbar-label',ctx.Label);
 const bar=Object.create(ctx.Bar.prototype),seek=dom.window.document.querySelector('.seekBar');
 const native=dom.window.document.createElement('zenza-seekbar-label');native.className='resumePointer';
 seek.parentElement.append(native);
 Object.assign(bar,{_seekBar:seek,_$seekBarContainer:[seek.parentElement],
  $resumePointers:[native],_playerState:{videoInfo:{watchId:'sm1'}},emit(){},
  _startTimer(){},_stopTimer(){},_cancelStoryboardLongPress(){},resetBufferedRange(){},
  storyboard:{reset(){},load(){}},_$view:[seek.parentElement]});
 Object.defineProperty(bar,'duration',{value:100,writable:true});
 Object.defineProperty(bar,'currentTime',{value:0,writable:true});
 return {dom,bar,seek,native,P:ctx.P};
}
describe('Shared timeline point and interval presentation',()=>{
 it('projects all features through the same endpoint policy and geometry',()=>{
  const {P,dom}=fixture();
  assert.equal(P.projectPoint(25,100).left,'25%');
  assert.equal(P.projectPoint(-1,100),null);
  assert.equal(P.projectPoint(100,100,{includeEnd:false}),null);
  assert.equal(P.projectPoint(0,100,{includeStart:false}),null);
  assert.equal(P.projectPoint(Infinity,100,{clamp:true}),null);
  assert.equal(P.projectPoint(120,100,{clamp:true}).left,'100%');
  const range=P.projectInterval(25,100,100,{clamp:true});
  assert.equal(range.band.left,'25%');assert.equal(range.band.width,'75%');
  assert.equal(P.projectInterval(70,20,100).band,null);
  assert.equal(P.projectInterval(null,20,100).start,null);
  dom.window.close();
 });
 it('shares one containing track for automatic, manual and range nodes and one lifecycle clear',()=>{
  const {bar,seek,native,dom}=fixture();
  bar.refreshAutoResumePointers({duration:100,resumePoints:[{now:'前回',time:25}]});
  bar.setManualBookmarkMarkers([{id:'m',label:'Point',time:25,endTime:75}],100,'sm1');
  bar.setABRepeatRange({a:25,b:75,active:true},100,'sm1');
  assert.equal(native.parentElement,seek,'reuse the native node in the actual track');
  assert.equal(native.style.left,'25%');
  assert.equal(seek.querySelector('.manualBookmarkMarker').style.left,'25%');
  assert.equal(seek.querySelector('.abRepeatMarkerA').style.left,'25%');
  assert.equal(seek.querySelector('.manualBookmarkRangeBand').style.width,'50%');
  assert.equal(seek.querySelectorAll('.timelineMarkerLayer').length,2);
  let drags=0;bar._beginMouseDrag=()=>drags++;
  bar._scheduleStoryboardLongPress=()=>{};
  bar._onSeekBarMouseDown({button:0,target:native,stopPropagation(){}});
  assert.equal(drags,0,'native point presses retain command semantics instead of starting a track drag');
  bar._onPlayerClose();
  assert(native.hidden);assert.equal(native.hasAttribute('time'),false);
  assert.equal(native.hasAttribute('timeline-ratio'),false);
  assert.equal(seek.querySelectorAll('.manualBookmarkMarker,.abRepeatMarker,.timelineInterval').length,0);
  bar.setManualBookmarkMarkers([{id:'late',label:'Late',time:10}],100,'sm1');
  assert.equal(seek.querySelectorAll('.manualBookmarkMarker').length,0);
  dom.window.close();
 });
 it('native labels use container percentage in managed mode and retain legacy fallback',()=>{
  const {native,dom}=fixture();
  native.setAttribute('duration','100');native.setAttribute('time','25');
  assert(native._root.style.transform.includes('25vw'),'unmanaged consumers keep their legacy placement');
  native.setAttribute('timeline-ratio','0.25');
  assert.equal(native.style.left,'25%');
  assert(!native._root.style.transform.includes('vw'));
  // The same ratio remains local across narrow/wide tracks and ancestor scales.
  for(const [localWidth,scale] of [[80,1],[320,1.5],[1920,1]]){
   const projected=parseFloat(native.style.left)/100*localWidth*scale;
   assert.equal(projected,localWidth*scale*0.25);
  }
  assert.equal(native.getAttribute('data-param'),'25');
  native.removeAttribute('timeline-ratio');
  assert.equal(native.style.left,'');
  assert(native._root.style.transform.includes('25vw'));
  dom.window.close();
 });
});
