'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function harness(path) {
  const scripts=[], players=[], emits=[];
  const prior = () => { emits.push('prior-ready'); };
  const window = {console, onYouTubeIframeAPIReady:prior};
  const document = {head:{append(script){scripts.push(script);}},
    createElement(){ return {
      addEventListener(name, callback){this['on'+name]=callback;}
    }; },
    querySelector(){return null;}
  };
  const c = createContext({Emitter:class {}, _: {debounce:fn=>fn},
    window, document});
  const Wrapper = loadClass(path, 'YouTubeWrapper', c);
  const make = () => {
    const w = new Wrapper({parentNode:{}, autoplay:false});
    w._onPlayerReady = () => {emits.push('ready');};
    return w;
  };
  function setApi() {
    window.YT={Player:class {
      constructor(node,options){ this.node=node;this.options=options;players.push(this); }
      stopVideo(){}
    }};
  }
  const tick=async()=> {
    await new Promise(resolve=>setImmediate(resolve));
    await new Promise(resolve=>setImmediate(resolve));
  };
  return {window,document,scripts,players,emits,make,setApi,tick,prior};
}
for(const file of ['packages/zenza/src/videoPlayer/YouTubeWrapper.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Task373 YouTube IFrame initialization ownership '+file,()=>{
    it('shares one API load among 12 wrappers and retains prior ready hook',async()=>{
      const h=harness(file);
      const clients=Array.from({length:12},()=>h.make());
      const pending=clients.map(w=>w._initYT());
      await h.tick();
      assert.strictEqual(h.scripts.length,1);
      const callback=h.window.onYouTubeIframeAPIReady;
      assert.notStrictEqual(callback,h.prior);
      h.setApi(); callback();
      const results=await Promise.all(pending);
      results.forEach(result=>assert.strictEqual(result,h.window.YT));
      assert.deepStrictEqual(h.emits,['prior-ready']);
      assert.strictEqual(h.window.onYouTubeIframeAPIReady,h.prior);
    });
    it('releases failed script setup and allows a later retry',async()=>{
      const h=harness(file), w=h.make();
      const failed=w._initYT();
      await h.tick();
      assert.strictEqual(h.scripts.length,1);
      assert.strictEqual(typeof h.scripts[0].onerror,'function');
      h.scripts[0].onerror(new Error('script blocked'));
      await assert.rejects(failed);
      assert.strictEqual(h.window.onYouTubeIframeAPIReady,h.prior);
      const retry=w._initYT();
      await h.tick();
      assert.strictEqual(h.scripts.length,2);
      h.setApi();h.window.onYouTubeIframeAPIReady();
      assert.strictEqual(await retry,h.window.YT);
    });
    it('skips injection if YouTube API already provides Player',async()=>{
      const h=harness(file);
      h.setApi();
      assert.strictEqual(await h.make()._initYT(),h.window.YT);
      assert.strictEqual(h.scripts.length,0);
    });
    it('shares the initial player rather than creating competing instances',async()=>{
      const h=harness(file);h.setApi();
      const w=h.make();
      const pending=Array.from({length:10},(_,i)=>
        w._initPlayer('video-'+i,i));
      await h.tick();
      assert.strictEqual(h.players.length,1);
      const p=h.players[0];
      assert.strictEqual(p.options.videoId,'video-0');
      p.options.events.onReady();
      const results=await Promise.all(pending);
      results.forEach(result=>assert.strictEqual(result.player,p));
      assert.strictEqual(h.emits.filter(e=>e==='ready').length,1);
    });
    it('allows a new initialization after a constructor failure',async()=>{
      const h=harness(file);h.setApi();
      let fails=0;
      const Base=h.window.YT.Player;
      h.window.YT.Player=class extends Base {
        constructor(...args){if(!fails++){throw new Error('broken Player');}super(...args);}
      };
      const w=h.make();
      await assert.rejects(w._initPlayer('a',0),/broken Player/);
      const second=w._initPlayer('b',3);
      await h.tick();
      assert.strictEqual(h.players.length,1);
      h.players[0].options.events.onReady();
      assert.strictEqual((await second).player,h.players[0]);
    });
  });
}
