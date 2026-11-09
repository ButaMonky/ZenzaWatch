'use strict';
// P10: real VideoControlBar method, without constructing the player or fake seek owner.
const assert=require('assert');
const fs=require('fs');
const {createContext,loadClass}=require('../helpers/extractSource');

function setup(){
 const changes=[],loads=[];
 const ctx=createContext({
  Emitter:class {},
  cssUtil:{setProps(...items){changes.push(items);}}
 });
 ctx.TimelineGeometry=loadClass('packages/zenza/src/sceneSearch/TimelineGeometry.js','TimelineGeometry',ctx);
 const Presenter=loadClass('packages/zenza/src/sceneSearch/SceneResumeMarkerPresenter.js',
  'SceneResumeMarkerPresenter',ctx);
 const renderCalls=[];
 const nativeRender=Presenter.render;
 Presenter.render=(...args)=>{renderCalls.push(args);return nativeRender.apply(Presenter,args);};
 ctx.SceneResumeMarkerPresenter=Presenter;
 const VCB=loadClass('src/VideoControlBar.js','VideoControlBar',ctx);
 const pointer=()=>({
  hidden:false, attributes:{},
  setAttribute(name,value){this.attributes[name]=String(value);},
  removeAttribute(name){delete this.attributes[name];}
 });
 const pointers=Array.from({length:5},pointer);
 const owner={
  duration:0,_$view:[{}],$resumePointers:pointers,
  refreshAutoResumePointers:VCB.prototype.refreshAutoResumePointers,
  _clearTimelinePresentation:VCB.prototype._clearTimelinePresentation,
  _clearManualBookmarkMarkers:VCB.prototype._clearManualBookmarkMarkers,
  _clearABRepeatRange:VCB.prototype._clearABRepeatRange,
  storyboard:{load(...args){loads.push(args);}}
 };
 const apply=info=>VCB.prototype._onLoadVideoInfo.call(owner,info);
 return {apply,pointers,changes,loads,owner,renderCalls};
}

describe('P10 resume marker: existing native presentation contract',()=>{
 it('keeps source times, labels, and all five original native marker owners',()=>{
  const h=setup();
  const template=fs.readFileSync('src/VideoControlBar.js','utf8');
  assert.equal((template.match(/<zenza-seekbar-label class="resumePointer"/g)||[]).length,5);
  assert.equal(h.pointers.length,5);
  h.apply({watchId:'sm-a',duration:600,resumePoints:[
   {now:'前回',time:140.25},{now:'2026/10/30',time:350}
  ]});
  assert.equal(h.owner.duration,600);
  assert.equal(h.loads.length,1);
  assert.equal(h.loads[0][0],'sm-a');
  assert.equal(h.pointers[0].attributes.duration,'600');
  assert.equal(h.pointers[0].attributes.time,'140.25');
  assert.equal(h.pointers[0].attributes.text,'前回 ここまで見た');
  assert.equal(h.pointers[1].attributes.time,'350');
  assert.equal(h.pointers[1].attributes.text,'2026/10/30 ここまで見た');
  assert(h.pointers.slice(2).every(p=>p.hidden===true));
  assert.equal(h.changes.length,2);
  assert(h.changes[0].some(x=>x[1]==='--scale-pp'&&x[2]===1.7));
  assert(h.changes[1].some(x=>x[1]==='--pointer-color'));
 });
 it('hides obsolete marker slots when a new video has no resume data',()=>{
  const h=setup();
  h.apply({watchId:'sm-a',duration:120,resumePoints:[{now:'前回',time:50}]});
  h.apply({watchId:'sm-b',duration:100,resumePoints:[]});
  assert.equal(h.loads.length,2);
  assert.equal(h.loads[1][0],'sm-b');
  assert(h.pointers.every(p=>p.hidden===true));
  for(const key of ['time','duration','text']){
   assert.equal(h.pointers[0].attributes[key],undefined,
    'native video-change path leaked the previous video '+key);
  }
 });
 it('restores the same native marker when a later video contains a valid resume point',()=>{
  const h=setup();
  const original=h.pointers[0];
  h.apply({watchId:'sm-empty',duration:90,resumePoints:[]});
  assert(h.pointers.every(p=>p.hidden===true));
  h.apply({watchId:'sm-valid',duration:240,resumePoints:[{now:'前回',time:70}]});
  assert.strictEqual(h.pointers[0],original);
  assert.strictEqual(h.pointers[0].hidden,false,'resume marker must become visible again');
  assert.equal(h.pointers[0].attributes.time,'70');
  assert.equal(h.pointers[0].attributes.duration,'240');
  assert.equal(h.pointers[0].attributes.text,'前回 ここまで見た');
  assert.equal(h.pointers[1].hidden,true);
 });
 it('delegates presentation exactly once while retaining all native DOM owners',()=>{
  const h=setup(),nodes=h.pointers.slice();
  const input={watchId:'sm-owner',duration:360,resumePoints:[{now:'前回',time:50}]};
  h.apply(input);
  assert.equal(h.renderCalls.length,1);
  assert.strictEqual(h.renderCalls[0][0],h.pointers);
  assert.strictEqual(h.renderCalls[0][1],input.resumePoints);
  assert.equal(h.renderCalls[0][2],360);
  assert.deepEqual(h.pointers,nodes);
  assert.equal(h.loads.length,1);
  assert.equal(h.loads[0][0],'sm-owner');
 });
});
