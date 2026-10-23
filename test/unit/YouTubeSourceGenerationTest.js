'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');
const ytA='https://www.youtube.com/watch?v=videoA';
const ytB='https://www.youtube.com/watch?v=videoB';
const normal='https://cdn.example.invalid/normal.mp4';
function deferred() {
  let resolve,reject;
  const promise = new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
function fixture(source) {
  const ctx=createContext({Emitter:class {},
    console:{log(){}},location:{host:'www.nicovideo.jp'}});
  const Player=loadClass(source,'VideoPlayer',ctx);
  const player=Object.create(Player.prototype);
  const changes=[],loads=[];
  player._reset=()=>{};
  player.addClass=()=>{};
  player._changePlayer=type=>changes.push(type);
  player._video={src:'',crossOrigin:null};
  player._currentVideo={currentTime:18.5};
  player._videoYouTube={setSrc:(url,time)=>{
    const d=deferred();
    loads.push({url,time,d});
    return d.promise;
  }};
  player._initYouTube=async()=>player._videoYouTube;
  const tick=async()=>{
    await new Promise(resolve=>setImmediate(resolve));
    await new Promise(resolve=>setImmediate(resolve));
  };
  return {player,changes,loads,tick};
}
for(const source of ['src/NicoVideoPlayer.js','dist/ZenzaWatch-dev.user.js']) {
  describe('Task381 AUD-36 VideoPlayer source-generation ownership ('+source+')',()=>{
    it('does not switch back to stale YouTube after a newer normal source',async()=>{
      const h=fixture(source);
      h.player.src=ytA;
      await h.tick();
      assert.strictEqual(h.loads.length,1);
      h.player.src=normal;
      h.loads[0].d.resolve();
      await h.tick();
      assert.deepStrictEqual(h.changes,['normal']);
      assert.strictEqual(h.player.src,normal);
      assert.strictEqual(h.player._video.src,normal);
    });
    it('never starts stale YouTube setSrc when initialization finishes late',async()=>{
      const h=fixture(source),init=deferred();
      h.player._initYouTube=()=>init.promise;
      h.player.src=ytA;
      h.player.src=normal;
      init.resolve(h.player._videoYouTube);
      await h.tick();
      assert.strictEqual(h.loads.length,0);
      assert.deepStrictEqual(h.changes,['normal']);
    });
    it('ignores A completion after a newer YouTube B has settled',async()=>{
      const h=fixture(source);
      h.player.src=ytA;
      await h.tick();
      h.player.src=ytB;
      await h.tick();
      assert.strictEqual(h.loads.length,2);
      h.loads[1].d.resolve();
      await h.tick();
      h.loads[0].d.resolve();
      await h.tick();
      assert.deepStrictEqual(h.changes,['YouTube']);
      assert.strictEqual(h.player.src,ytB);
    });
    it('preserves normal to YouTube startup and start-time parameters',async()=>{
      const h=fixture(source);
      h.player.src=normal;
      h.player.src=ytA;
      await h.tick();
      assert.strictEqual(h.loads.length,1);
      assert.strictEqual(h.loads[0].url,ytA);
      assert.strictEqual(h.loads[0].time,18.5);
      h.loads[0].d.resolve();
      await h.tick();
      assert.deepStrictEqual(h.changes,['normal','YouTube']);
    });
    it('does not let two same-URL requests both take player ownership',async()=>{
      const h=fixture(source);
      h.player.src=ytA;
      await h.tick();
      h.player.src=ytA;
      await h.tick();
      assert.strictEqual(h.loads.length,2);
      h.loads[0].d.resolve();
      await h.tick();
      assert.deepStrictEqual(h.changes,[]);
      h.loads[1].d.resolve();
      await h.tick();
      assert.deepStrictEqual(h.changes,['YouTube']);
    });
    it('keeps the newest YouTube request after an intermediate normal source',async()=>{
      const h=fixture(source);
      h.player.src=ytA;
      await h.tick();
      h.player.src=normal;
      h.player.src=ytB;
      await h.tick();
      h.loads[0].d.resolve();
      await h.tick();
      assert.deepStrictEqual(h.changes,['normal']);
      h.loads[1].d.resolve();
      await h.tick();
      assert.deepStrictEqual(h.changes,['normal','YouTube']);
    });
  });
}
