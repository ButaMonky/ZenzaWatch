'use strict';
// QA regression: recalculated dense heatmaps must restore normal playback speed.
const assert=require('assert');
const {extract,createContext,run}=require('../helpers/extractSource');
const sources=['src/_heatsync.js','dist/HeatSync.user.js'];
function harness(source){
 const options={'turbo.enabled':true,'turbo.red':1,'turbo.smile-blue':1.7,
  'turbo.dmc-blue':1.7,'turbo.minDuration':30,'turbo.ignoreTags':''};
 const changed=[];
 const video={duration:320,currentTime:50,paused:false,playbackRate:1,src:'https://media.invalid/sample.mp4'};
 class FakeEmitter {on(){return this;}emit(){return this;}}
 const config={getValue:k=>options[k],namespace:()=>({getValue:k=>options['turbo.'+k]})};
 const emitter=new FakeEmitter();
 const context=createContext({Emitter:FakeEmitter,config,util:{emitter},
  console:{info(){},log(){}},
  window:{ZenzaWatch:{config:{setValue(key,value){
    changed.push({key,value});if(key==='playbackRate')video.playbackRate=value;
  }},external:{getVideoElement:()=>video}}},
  setInterval:()=>1,clearInterval(){}});
 run(extract(source,'Syncer','class')+';globalThis.Syncer=Syncer;',context);
 const sync=new context.Syncer();
 return {sync,video,changed,options};
}
for(const source of sources){
 describe('HeatSync recalculated-map speed transition '+source,()=>{
  it('slow/dense replacement returns accelerated playback to normal',()=>{
   const f=harness(source);
   f.sync._onHeatMapUpdate({map:Array(300).fill(0),duration:320});
   f.sync._onTimer();f.sync._onTimer();
   assert(f.video.playbackRate>1.1,'sparse map must accelerate playback');
   f.sync._onHeatMapUpdate({map:Array(300).fill(255),duration:320});
   f.sync._onTimer();
   assert.strictEqual(f.video.playbackRate,1,'dense map must reset actual media playback rate');
   f.sync.disable();
  });
  it('disabling turbo always restores configured baseline',()=>{
   const f=harness(source);
   f.sync._onHeatMapUpdate({map:Array(300).fill(0),duration:320});
   f.sync._onTimer();assert(f.video.playbackRate>1);
   f.sync.disable();assert.strictEqual(f.video.playbackRate,1);
  });
 });
}
