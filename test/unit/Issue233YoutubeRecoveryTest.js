'use strict';
const assert=require('node:assert/strict');
const {createContext,loadClass}=require('../helpers/extractSource');
const {describe,it}=typeof global.describe==='function'?global:require('node:test');
const ytA='https://www.youtube.com/watch?v=TEST_ONLY_A',normal='https://safe.example.invalid/movie.mp4';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});
  return {promise,resolve,reject};};
const tick=async()=>{await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));};

function youtube(file){
  const scripts=[],emitted=[],timers=new Map(),cleared=[];
  let seq=0;
  const prior=()=>emitted.push('prior');
  const window={console:{info(){},warn(){},error(){}},onYouTubeIframeAPIReady:prior};
  const document={createElement:()=>({addEventListener(n,f){this['on'+n]=f;},
    remove(){this.removed=true;}}),
    head:{append(tag){scripts.push(tag);}}};
  const schedule=(fn,ms)=>{const id=++seq;timers.set(id,{fn,ms});return id;};
  const clear=id=>{timers.delete(id);cleared.push(id);};
  const ctx=createContext({window,document,console:window.console,
    Emitter:class {emit(name,...a){emitted.push(name);return a;}emitAsync(name){emitted.push(name);}},
    _:{debounce:f=>Object.assign(f,{cancel(){}})},setTimeout:schedule,clearTimeout:clear});
  const W=loadClass(file,'YouTubeWrapper',ctx);
  const make=()=>{const w=new W({parentNode:{},autoplay:false});
    w._onPlayerReady=()=>emitted.push('ready');
    return w;};
  const fire=(ms)=>{const item=[...timers].find(([,t])=>t.ms===ms);
    assert(item,'missing timer '+ms);
    timers.delete(item[0]);item[1].fn();};
  return {W,window,document,scripts,timers,cleared,emitted,prior,make,fire};
}
for(const file of ['packages/zenza/src/videoPlayer/YouTubeWrapper.js','dist/ZenzaWatch-dev.user.js']){
  describe('#233 YouTube IFrame recovery '+file,()=>{
    it('times out stalled API, restores previous callback, and allows retry',async()=>{
      const h=youtube(file),a=h.make(),b=h.make();
      const pa=a._initYT(),pb=b._initYT();
      assert.equal(h.scripts.length,1);
      h.fire(15000);
      await assert.rejects(pa,/unavailable/);await assert.rejects(pb,/unavailable/);
      assert.strictEqual(h.window.onYouTubeIframeAPIReady,h.prior);
      assert.equal(h.scripts[0].removed,true);
      const retry=a._initYT();
      assert.equal(h.scripts.length,2);
      h.window.YT={Player:class{}};
      h.window.onYouTubeIframeAPIReady();
      assert.strictEqual(await retry,h.window.YT);
    });
    it('rejects ready callback with missing Player, then retries cleanly',async()=>{
      const h=youtube(file),w=h.make(),pa=w._initYT();
      h.window.onYouTubeIframeAPIReady();
      await assert.rejects(pa,/unavailable/);
      assert.strictEqual(h.window.onYouTubeIframeAPIReady,h.prior);
      assert.equal(h.emitted.filter(x=>x==='prior').length,1);
      const again=w._initYT();
      h.window.YT={Player:class{}};
      h.window.onYouTubeIframeAPIReady();
      assert.strictEqual(await again,h.window.YT);
    });
    it('fails bounded player readiness, destroys iframe, and releases init owner',async()=>{
      const h=youtube(file),w=h.make(),instances=[];
      h.window.YT={Player:class{constructor(){instances.push(this);}
        stopVideo(){this.stopped=true;}destroy(){this.destroyed=true;}}};
      const pending=w._initPlayer('TEST_ONLY_A',0);
      await tick();h.fire(20000);
      await assert.rejects(pending,/timed out/);
      assert.equal(instances[0].stopped,true);
      assert.equal(instances[0].destroyed,true);
      assert.equal(w._player,null);
      assert.equal(w._playerInitPromise,null);
    });
    it('constructor failure rejects promptly without leaking its raw exception',async()=>{
      const h=youtube(file),w=h.make();
      h.window.YT={Player:class{constructor(){throw Error('TEST_ONLY_PRIVATE');}}};
      await assert.rejects(w._initPlayer('A',0),/TEST_ONLY_PRIVATE/);
      assert.equal(w._playerInitPromise,null);
      assert.equal(h.timers.size,0);
    });
  });
}
for(const file of ['src/NicoVideoPlayer.js','dist/ZenzaWatch-dev.user.js']){
  describe('#233 VideoPlayer current-only error handling '+file,()=>{
    function fixture(){
      const ctx=createContext({location:{host:'www.nicovideo.jp'},Emitter:class{},
        console:{log(){},warn(){},error(){}}});
      const C=loadClass(file,'VideoPlayer',ctx),p=Object.create(C.prototype);
      const init=deferred(),actions=[],errors=[];
      p._reset=()=>{};p.addClass=n=>actions.push('add:'+n);
      p.removeClass=n=>actions.push('remove:'+n);
      p._currentVideo={currentTime:7};p._video={src:'',crossOrigin:null};
      p._videoYouTube={setSrc:()=>Promise.resolve()};
      p._changePlayer=t=>actions.push('change:'+t);
      p._initYouTube=()=>init.promise;
      p._onYouTubeError=e=>errors.push(e.data);
      return {p,init,actions,errors};
    }
    it('clears current failed loading and sends one bounded error',async()=>{
      const h=fixture();h.p.src=ytA;h.init.reject(Error('TEST_ONLY_SECRET'));await tick();
      assert(h.actions.includes('remove:is-loading'));
      assert.deepEqual(h.errors,[0]);
      assert(!h.actions.some(x=>x==='change:YouTube'));
    });
    it('ignores old failure after switching to native source',async()=>{
      const h=fixture();h.p.src=ytA;h.p.src=normal;
      h.init.reject(Error('TEST_ONLY_SECRET'));await tick();
      assert.deepEqual(h.errors,[]);
      assert(!h.actions.includes('remove:is-loading'));
      assert(h.actions.includes('change:normal'));
    });
  });
}