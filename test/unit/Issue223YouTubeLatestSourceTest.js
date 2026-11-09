'use strict';
const assert=require('node:assert/strict');
const {createContext,loadClass}=require('../helpers/extractSource');
const {describe,it}=typeof global.describe==='function'?global:require('node:test');
const tick=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};
function setup(file,{autoplay=true}={}){
  const constructed=[],commands=[],events=[];
  const win={console:{info(){},warn(){},error(){}},YT:{Player:class {
    constructor(node,options){this.options=options;constructed.push(this);}
    loadVideoById(v){commands.push(['load',v.videoId,v.startSeconds]);}
    cueVideoById(v){commands.push(['cue',v.videoId,v.startSeconds]);}
    stopVideo(){commands.push(['stop']);}
  }}};
  const ctx=createContext({window:win,console:win.console,Emitter:class {
    emit(){}emitAsync(){events.push('metadata');}
  },_:{debounce:f=>Object.assign(f,{cancel(){}})}});
  const Wrapper=loadClass(file,'YouTubeWrapper',ctx);
  const w=new Wrapper({parentNode:{},autoplay});
  w._parseVideoId=url=>url||'';
  w._parseUrlParams=()=>({});
  w._onPlayerReady=()=>events.push('ready');
  return {w,commands,constructed,events};
}
for(const file of ['packages/zenza/src/videoPlayer/YouTubeWrapper.js',
                   'dist/ZenzaWatch-dev.user.js']){
  describe('#223 latest-source ownership '+file,()=>{
    it('A→B before iframe readiness starts only B after ready',async()=>{
      const h=setup(file),a=h.w.setSrc('A',11),b=h.w.setSrc('B',22);
      await tick();assert.equal(h.constructed.length,1);
      assert.equal(h.constructed[0].options.videoId,'A');
      assert.equal(h.constructed[0].options.playerVars.autoplay,0,
        'initial iframe cannot autoplay a superseded A');
      assert.equal(h.commands.length,0);
      h.constructed[0].options.events.onReady();
      await Promise.all([a,b]);
      assert.deepEqual(h.commands,[['load','B',22]]);
    });
    it('A→B→C retains C and its seek, not A/B',async()=>{
      const h=setup(file);
      const all=[h.w.setSrc('A',2),h.w.setSrc('B',12),h.w.setSrc('C',30)];
      await tick();h.constructed[0].options.events.onReady();
      await Promise.all(all);
      assert.deepEqual(h.commands,[['load','C',30]]);
    });
    it('A→native before ready does not autoplay or load A',async()=>{
      const h=setup(file),a=h.w.setSrc('A',10);
      await tick();h.w.cancelPendingSource();
      h.constructed[0].options.events.onReady();
      await a;
      assert(!h.commands.some(c=>c[0]==='load'||c[0]==='cue'));
      assert(!h.events.includes('ready'));
    });
    it('autoplay OFF cues only the newest video after initialization',async()=>{
      const h=setup(file,{autoplay:false}),a=h.w.setSrc('A',1),b=h.w.setSrc('B',28);
      await tick();h.constructed[0].options.events.onReady();
      await Promise.all([a,b]);
      assert.deepEqual(h.commands,[['cue','B',28]]);
    });
    it('after ready an immediate new source uses only the new request',async()=>{
      const h=setup(file),a=h.w.setSrc('A',0);
      await tick();h.constructed[0].options.events.onReady();await a;
      await h.w.setSrc('B',9);
      assert.deepEqual(h.commands,[['load','A',0],['load','B',9]]);
    });
  });
}
for(const file of ['src/NicoVideoPlayer.js','dist/ZenzaWatch-dev.user.js']){
  describe('#223 native supersedes pending YouTube '+file,()=>{
    it('invalidates a not-yet-active iframe on normal-source assignment',()=>{
      const cls=loadClass(file,'VideoPlayer',createContext({
        Emitter:class{},location:{host:'www.nicovideo.jp'}}));
      const p=Object.create(cls.prototype),calls=[];
      p._reset=()=>{};p.addClass=()=>{};p._changePlayer=type=>calls.push('change:'+type);
      const native={src:'',crossOrigin:null};
      p._video=native;p._videoElement=native;p._currentVideo=native;
      p._videoYouTube={cancelPendingSource:()=>calls.push('cancel')};
      p.src='https://example.invalid/video.mp4';
      assert.deepEqual(calls,['cancel','change:normal']);
      assert.equal(native.src,p.src);
    });
  });
}