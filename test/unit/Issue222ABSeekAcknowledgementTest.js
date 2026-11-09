'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {JSDOM}=require('jsdom');
const {loadClass,createContext}=require('../helpers/extractSource');
const {describe,it,before}=typeof global.describe==='function'?global:require('node:test');
let Dock,Session;
before(async()=>{
 const imp=file=>new Function('u','return import(u)')(pathToFileURL(path.resolve(file)).href);
 ({ManualBookmarkDock:Dock}=await imp('packages/zenza/src/resume/ManualBookmarkDock.js'));
 ({ManualBookmarkSession:Session}=await imp('packages/zenza/src/resume/ManualBookmarkSession.js'));
});
async function fixture(){
 const dom=new JSDOM('<main class="zenzaWatchVideoInfoPanel"><div class="tabs videoInfoTab"><div class="zenzaWatchVideoInfoPanelContent"><div class="seriesList"></div></div></div></main>');
 let active='sm999',time=10,clock=100;const seeks=[],events=[];
 const session=new Session({load:async()=>[],close(){}});
 const dock=Dock.mount(dom.window.document.body,session,{
   currentVideoId:()=>active,currentTime:()=>time,timestamp:()=>clock,
   newId:()=>'B1',seek:target=>seeks.push(target),duration:()=>120,repeatEnabled:()=>true});
 await dock.activate(active,120);
 const C=loadClass('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog',createContext({
   Emitter:class{},MediaSessionApi:{updatePositionStateByMedia(){events.push('media');}}}));
 const dialog=Object.create(C.prototype);
 Object.assign(dialog,{_state:{isSeeking:true},_view:{manualBookmarkDock:dock},emit:n=>events.push(n)});
 // Exercise the real Dialog getter: it caches prior positive positions at 0/NaN.
 dialog._lastCurrentTime=10;
 dialog._nicoVideoPlayer={get currentTime(){return time;}};
 const start=(a,b)=>{
  for(const [name,value]of [['a',a],['b',b]])dock.element.querySelector('[data-point-field="'+name+'"]').value=String(value);
  dock.element.querySelector('[data-point-action="repeat"]').click();seeks.length=0;
 };
 return {dock,dialog,seeks,events,start,setClock:n=>clock=n,setTime:n=>time=n,
   switchVideo:()=>{active='sm1000';},dispose:()=>{dock.dispose();dom.window.close();}};
}
describe('Issue #222 AB end deduplication and seek acknowledgement',()=>{
 it('optimistic YouTube seek ticks cannot reset the bounded retry budget',async()=>{
  const h=await fixture();try{h.start(10,20);
   const ctx=createContext({Emitter:class{},STATE_PLAYING:1,performance:{now:()=>0},_:{debounce:f=>Object.assign(f,{cancel(){}})}});
   const Wrapper=loadClass('packages/zenza/src/videoPlayer/YouTubeWrapper.js','YouTubeWrapper',ctx);
   const wrapper=new Wrapper({parentNode:{}});
   wrapper._player={getCurrentTime:()=>20,getDuration:()=>120,getPlaybackRate:()=>1};wrapper._seekTime=10;
   for(const clock of [100,1900]){
    h.setClock(clock);h.dock.tick(20,false,false);wrapper._isSeeking=true;
    assert.equal(wrapper.currentTime,10);h.dock.tick(wrapper.currentTime,false,true);wrapper._isSeeking=false;
   }
   h.setClock(3700);h.dock.tick(20,false,false);
   assert.equal(h.dock.isRepeating,false);assert.deepEqual(h.seeks,[10,10]);
  }finally{h.dispose();}
 });

 it('timeupdate then duplicate ended does not request A twice or stop the loop',async()=>{
  const h=await fixture();try{h.start(10,120);
   assert.equal(h.dock.tick(120,false,false),true);
   assert.equal(h.dock.repeatAtEnd(),true);assert.equal(h.dock.repeatAtEnd(),true);
   assert.deepEqual(h.seeks,[10]);assert.equal(h.dock.isRepeating,true);
  }finally{h.dispose();}
 });
 it('terminal retry waits for its full budget and duplicate ended cannot consume it',async()=>{
  const h=await fixture();try{h.start(10,120);assert.equal(h.dock.repeatAtEnd(),true);
   h.setClock(1899);assert.equal(h.dock.repeatAtEnd(),true);assert.deepEqual(h.seeks,[10]);
   h.setClock(1900);assert.equal(h.dock.repeatAtEnd(),true);assert.deepEqual(h.seeks,[10,10]);
   h.setClock(1901);assert.equal(h.dock.repeatAtEnd(),true);assert.equal(h.dock.isRepeating,true);
   h.setClock(3700);assert.equal(h.dock.repeatAtEnd(),false);assert.equal(h.dock.isRepeating,false);
   assert.deepEqual(h.seeks,[10,10]);
  }finally{h.dispose();}
 });
 for(const rate of [1,2,4])it('seeked landing keeps a 0.25s loop alive at '+rate+'x without A timeupdate',async()=>{
  const h=await fixture();try{h.start(10,10.25);
   for(let i=0;i<12;i++){
    h.setClock(100+(i+1)*250/rate);h.setTime(10.25);
    h.dock.tick(10.25,false,false);
    h.setTime(10.02);h.dialog._onVideoSeeked();
   }
   assert.equal(h.seeks.length,12);assert(h.seeks.every(t=>t===10));
   assert.equal(h.dock.isRepeating,true);
  }finally{h.dispose();}
 });
 for(const position of [0,20,NaN])it('seeked without an in-range landing does not forgive ignored seeks: '+position,async()=>{
  const h=await fixture();try{h.start(10,20);h.dock.tick(20,false,false);
   h.setTime(position);h.dialog._onVideoSeeked();
   h.setClock(1900);h.dock.tick(20,false,false);
   h.setTime(position);h.dialog._onVideoSeeked();
   h.setClock(3700);h.dock.tick(20,false,false);
   assert.equal(h.dock.isRepeating,false);assert.deepEqual(h.seeks,[10,10]);
  }finally{h.dispose();}
 });
 it('an old video seeked cannot revive its AB ownership',async()=>{
  const h=await fixture();try{h.start(10,20);h.dock.tick(20,false,false);
   h.switchVideo();h.setTime(10);h.dialog._onVideoSeeked();
   assert.equal(h.dock.repeatAtEnd(),false);assert.deepEqual(h.seeks,[10]);
  }finally{h.dispose();}
 });
 it('an actual zero-second landing resets AB even while display time is cached',async()=>{
  const h=await fixture();try{h.start(0,0.25);
   for(let i=0;i<5;i++){
    h.setTime(0.25);h.setClock(100+i*250);h.dock.tick(0.25,false,false);
    h.dialog._lastCurrentTime=0.25;h.setTime(0);h.dialog._onVideoSeeked();
   }
   assert.deepEqual(h.seeks,[0,0,0,0,0]);assert.equal(h.dock.isRepeating,true);
  }finally{h.dispose();}
 });
 it('ordinary seeked still clears state and publishes MediaSession and event updates',async()=>{
  const h=await fixture();try{h.dialog._onVideoSeeked();
   assert.equal(h.dialog._state.isSeeking,false);assert.deepEqual(h.events,['media','seeked']);
  }finally{h.dispose();}
 });
});

for(const artifact of ['src/NicoVideoPlayer.js','dist/ZenzaWatch-dev.user.js']){
 for(const state of [0,2,3,5,-1])it('YouTube state '+state+' does not consume AB retries via comment clock: '+artifact,async()=>{
  const h=await fixture();try{
   let providerState=state;const timeupdates=[];
   const ctx=createContext({Emitter:class{},STATE_PLAYING:1,
    window:{YT:{PlayerState:{PLAYING:1}}},performance:{now:()=>0},
    _:{debounce:f=>Object.assign(f,{cancel(){}})}});
   const Wrapper=loadClass('packages/zenza/src/videoPlayer/YouTubeWrapper.js','YouTubeWrapper',ctx);
   const Video=loadClass(artifact,'VideoPlayer',ctx);
   const Nico=loadClass(artifact,'NicoVideoPlayer',ctx);
   const wrapper=new Wrapper({parentNode:{}});
   wrapper.playerState=state;
   wrapper._player={getPlayerState:()=>providerState,getCurrentTime:()=>20,
    getDuration:()=>120,getPlaybackRate:()=>1};
   const video=Object.create(Video.prototype);
   video._currentVideo=wrapper;video._videoYouTube=wrapper;
   const nico=Object.create(Nico.prototype);
   Object.assign(nico,{_videoPlayer:video,_isPlaying:true,_commentPlayer:{},
    _checkSupporterCreditPreload(){},emit(name){if(name==='timeupdate'){
      timeupdates.push(name);h.dialog._onVideoTimeUpdate();}}});
   Object.defineProperty(h.dialog,'isPlaying',{get:()=>nico.isPlaying});
   h.dialog._state.isSeeking=false;h.setTime(20);h.start(10,20);
   for(let i=0;i<5;i++){h.setClock(100+i*2000);nico._onTimer();}
   assert.equal(timeupdates.length,0);assert.deepEqual(h.seeks,[]);
   assert.equal(h.dock.isRepeating,true);
   providerState=1;wrapper.playerState=1;nico._onTimer();
   assert.equal(timeupdates.length,1);assert.deepEqual(h.seeks,[10]);
  }finally{h.dispose();}
 });
}
