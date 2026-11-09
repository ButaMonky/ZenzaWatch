'use strict';
const assert=require('node:assert/strict');
const {createContext,loadClass}=require('../helpers/extractSource');
const {describe,it}=typeof global.describe==='function'?global:require('node:test');
function fixture(file,autoplay=true){
  const commands=[];let seconds=30,duration=300,now=0;
  const window={YT:{PlayerState:{PLAYING:1,PAUSED:2}}};
  const ctx=createContext({
    Emitter:class {emit(){}emitAsync(){}},
    STATE_PLAYING:1,window,performance:{now:()=>now},
    _:{debounce:f=>Object.assign(f,{cancel(){}})}
  });
  const Wrapper=loadClass(file,'YouTubeWrapper',ctx);
  const wrapper=new Wrapper({parentNode:{},autoplay});
  wrapper._parseVideoId=url=>new URL(url).searchParams.get('v');
  wrapper._parseUrlParams=url=>({t:new URL(url).searchParams.get('t')});
  wrapper._player={
    loadVideoById:x=>commands.push(['load',x.videoId,x.startSeconds]),
    cueVideoById:x=>commands.push(['cue',x.videoId,x.startSeconds]),
    seekTo:(sec,exact)=>commands.push(['seek',sec,exact]),
    getPlayerState:()=>1,getCurrentTime:()=>seconds,getDuration:()=>duration
  };
  return {wrapper,commands,
    setProviderTime:v=>seconds=v,setDuration:v=>duration=v,setClock:v=>now=v};
}
for(const file of ['packages/zenza/src/videoPlayer/YouTubeWrapper.js',
                   'dist/ZenzaWatch-dev.user.js']){
 describe('#222 YouTube absolute media timebase '+file,()=>{
   it('t=30 controls initial seek only, not reported currentTime/duration',async()=>{
     const f=fixture(file);
     await f.wrapper.setSrc('https://www.youtube.com/watch?v=TEST_ONLY_A&t=30',0);
     assert.deepEqual(f.commands,[['load','TEST_ONLY_A',30]]);
     assert.equal(f.wrapper.currentTime,30,'provider clock is already absolute');
     assert.equal(f.wrapper.duration,300,'duration is full original media');
   });
   it('seek(0), seek(30) and seek(end) never add the URL t offset',async()=>{
     const f=fixture(file);
     await f.wrapper.setSrc('https://www.youtube.com/watch?v=TEST_ONLY_A&t=30',0);
     f.commands.length=0;
     f.wrapper.currentTime=0;f.wrapper.currentTime=30;f.wrapper.currentTime=300;
     assert.deepEqual(f.commands,[['seek',0,true],['seek',30,true],['seek',300,true]]);
     // While seeking, the wrapper intentionally reports the requested end (300).
     // After the provider settles the request, it reports provider absolute time.
     assert.equal(f.wrapper.currentTime,300);
     f.wrapper._completeSeek(f.wrapper._seekSequence,f.wrapper._sourceRequest);
     f.setProviderTime(30);assert.equal(f.wrapper.currentTime,30);
   });
   it('t=1h2m and autoplay OFF use absolute seconds with one cue',async()=>{
     const f=fixture(file,false);
     f.setDuration(10000);f.setProviderTime(3720);
     await f.wrapper.setSrc('https://www.youtube.com/watch?v=TEST_ONLY_B&t=1h2m',0);
     assert.deepEqual(f.commands,[['cue','TEST_ONLY_B',3720]]);
     assert.equal(f.wrapper.currentTime,3720);
     assert.equal(f.wrapper.duration,10000);
     f.commands.length=0;f.wrapper.currentTime=3600;
     assert.deepEqual(f.commands,[['seek',3600,true]]);
   });
   it('switching from t=30 to an un-offset URL resets startup offset',async()=>{
     const f=fixture(file);
     await f.wrapper.setSrc('https://www.youtube.com/watch?v=TEST_ONLY_A&t=30',0);
     await f.wrapper.setSrc('https://www.youtube.com/watch?v=TEST_ONLY_B',0);
     f.setProviderTime(5);
     assert.deepEqual(f.commands.slice(0,2),
       [['load','TEST_ONLY_A',30],['load','TEST_ONLY_B',0]]);
     assert.equal(f.wrapper.currentTime,5);
     assert.equal(f.wrapper.duration,300);
   });
   it('currentTime interpolation uses the provider clock without t double counting',async()=>{
     const f=fixture(file);
     await f.wrapper.setSrc('https://www.youtube.com/watch?v=TEST_ONLY_A&t=30',0);
     f.setProviderTime(30);
     assert.equal(f.wrapper.currentTime,30);
     f.setClock(1000);assert.equal(f.wrapper.currentTime,31);
   });
 });
}