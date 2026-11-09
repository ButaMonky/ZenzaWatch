'use strict';
// #222: compiled YouTubeWrapper + synthetic IFrame state/timer sequence.
// No real network, login data, browser profile or user history.
const assert=require('node:assert/strict');
const {createContext,loadClass}=require('../helpers/extractSource');
const {describe,it}=typeof global.describe==='function'?global:require('node:test');

function harness(file){
  let clock=0,timerId=0,providerTime=8,seekThrows=false;
  const timers=new Map(),events=[],seeks=[],loads=[];
  const schedule=(fn,ms)=>{
    const id=++timerId;timers.set(id,{fn,ms});return id;
  };
  const cancel=id=>timers.delete(id);
  const debounce=(fn,ms)=>{
    let handle=null;
    const invoke=()=>{
      if(handle!==null)cancel(handle);
      handle=schedule(()=>{handle=null;fn();},ms);
    };
    invoke.cancel=()=>{if(handle!==null)cancel(handle);handle=null;};
    return invoke;
  };
  const window={console:{info(){},warn(){},error(){}},YT:{
    PlayerState:{ENDED:0,PLAYING:1,PAUSED:2,BUFFERING:3,CUED:5}}};
  class Emitter {
    emit(name){events.push(name);}
    emitAsync(){}
  }
  const ctx=createContext({Emitter,window,STATE_PLAYING:1,
    _:{debounce},setTimeout:schedule,clearTimeout:cancel,
    performance:{now:()=>clock}});
  const Wrapper=loadClass(file,'YouTubeWrapper',ctx);
  const w=new Wrapper({parentNode:{},autoplay:true});
  const player={
    seekTo:(time,allow)=>{if(seekThrows)throw Error('PRIVATE_SYNTHETIC');
      seeks.push([time,allow]);},
    stopVideo:()=>loads.push('stop'),
    getCurrentTime:()=>providerTime,getDuration:()=>300,
    getPlayerState:()=>1
  };
  w._player=player;w._src='TEST_ONLY_SOURCE_A';
  w._sourceRequest=1;w._canPlay=true;w._restorePlaybackRate=()=>{};
  const fire=(ms)=>{
    const entry=[...timers].find(([,value])=>value.ms===ms);
    assert(entry,'missing timer '+ms);
    timers.delete(entry[0]);entry[1].fn();
  };
  const state=name=>w._onPlayerStateChange({data:window.YT.PlayerState[name]});
  return {w,player,seeks,loads,events,timers,fire,state,
    providerTime:n=>providerTime=n,failSeek:v=>seekThrows=v};
}
for(const file of ['packages/zenza/src/videoPlayer/YouTubeWrapper.js',
                   'dist/ZenzaWatch-dev.user.js']){
  describe('#222 IFrame seeking/seeked contract '+file,()=>{
    it('does not signal completion before the 500ms debounce fires',()=>{
      const h=harness(file);h.w.currentTime=66;
      assert.deepEqual(h.events,['seeking']);
      h.state('PLAYING');h.state('PAUSED');
      assert(!h.events.includes('seeked'));
      assert.equal(h.seeks.length,0);
      h.fire(500);assert.deepEqual(h.seeks,[[66,true]]);
      assert.equal(h.w._isSeeking,true);
    });
    it('after dispatched seek completes exactly once on target PLAYING',()=>{
      const h=harness(file);h.w.currentTime=40;h.fire(500);
      h.state('BUFFERING');h.state('PLAYING');
      assert(!h.events.includes('seeked'),'old-position state is not completion');
      h.providerTime(40.05);h.state('PLAYING');h.state('PLAYING');
      assert.equal(h.events.filter(x=>x==='seeked').length,1);
      assert.equal(h.w._isSeeking,false);
      assert(![...h.timers.values()].some(x=>x.ms===1500));
    });
    it('PAUSED and CUED can settle a dispatched seek without autoplay',()=>{
      for(const state of ['PAUSED','CUED']){
        const h=harness(file);h.w.currentTime=70;h.fire(500);
        h.providerTime(70);h.state(state);
        assert.equal(h.events.filter(x=>x==='seeked').length,1);
        assert.equal(h.w._isSeeking,false);
      }
    });
    it('bounded fallback clears seeking when IFrame never reports completion',()=>{
      const h=harness(file);h.w.currentTime=12;h.fire(500);
      h.fire(1500);
      assert.equal(h.events.filter(x=>x==='seeked').length,1);
      assert.equal(h.w._isSeeking,false);
      h.state('PLAYING');
      assert.equal(h.events.filter(x=>x==='seeked').length,1);
    });
    it('superseding an in-flight request invalidates its old timer',()=>{
      const h=harness(file);h.w.currentTime=22;h.fire(500);
      const prior=[...h.timers.values()].find(t=>t.ms===1500);
      assert(prior);
      h.w.currentTime=88;
      prior.fn();
      assert(!h.events.includes('seeked'));
      h.fire(500);h.providerTime(88);h.state('PAUSED');
      assert.deepEqual(h.seeks,[[22,true],[88,true]]);
      assert.equal(h.events.filter(x=>x==='seeked').length,1);
    });
    it('source cancellation/stop never sends a stale seeked',()=>{
      const h=harness(file);h.w.currentTime=53;h.fire(500);
      const old=[...h.timers.values()].find(t=>t.ms===1500);
      h.w.cancelPendingSource();
      old.fn();
      h.state('PLAYING');
      assert.equal(h.events.filter(x=>x==='seeked').length,0);
      assert.equal(h.w._isSeeking,false);
      assert.equal(h.w._src,'');
    });
    it('failed seekTo settles the UI without exposing opaque errors',()=>{
      const h=harness(file);h.failSeek(true);
      h.w.currentTime=17;h.fire(500);
      assert.equal(h.w._isSeeking,false);
      assert.deepEqual(h.events,['seeking','seeked']);
      assert(![...h.timers.values()].some(t=>t.ms===1500));
    });
  });
}