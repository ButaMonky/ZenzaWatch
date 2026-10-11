'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

const urlA='https://www.youtube.com/watch?v=videoA';
const urlB='https://www.youtube.com/watch?v=videoB';
function fixture(path) {
  const timers=[],commands=[],recommendations=[];
  const sleep=()=>{
    let resolve; const promise=new Promise(r=>{resolve=r;});
    timers.push(resolve);return promise;
  };
  sleep.idle=()=>Promise.resolve();
  const ctx=createContext({Emitter:class {},sleep,
    window:{console:{info(){}}}});
  const Panel=loadClass(path,'VideoInfoPanel',ctx);
  const panel=Object.create(Panel.prototype);
  const A={videoId:'smA'}, B={videoId:'smB'};
  panel._videoInfo=A;
  panel._descriptionGeneration=1;
  panel._zenTubeUrl=urlA;
  panel._config={props:{autoZenTube:true}};
  panel._relatedVideoList={fetchRecommend:(...args)=>recommendations.push(args)};
  panel.emit=(...args)=>commands.push(args);
  const can=(watchId,info,options={})=>
    panel._onVideoCanPlay(watchId,info,options);
  const tick=async()=>{
    await new Promise(resolve=>setImmediate(resolve));
    await new Promise(resolve=>setImmediate(resolve));
  };
  const switchTo=(info,url)=>{
    panel._videoInfo=info;
    panel._descriptionGeneration++;
    panel._zenTubeUrl=url;
  };
  const finish=async(index)=>{
    timers[index]();
    await tick();
  };
  return {panel,A,B,timers,commands,recommendations,can,switchTo,finish,tick};
}
for(const path of ['src/VideoInfoPanel.js','dist/ZenzaWatch-dev.user.js']){
  describe('Task380 AUD-36 AutoZenTube stale-timer ownership ('+path+')',()=>{
    it('never emits B from stale A callback when B has a YouTube URL',async()=>{
      const f=fixture(path);
      await f.can('smA',f.A);
      f.switchTo(f.B,urlB);
      await f.can('smB',f.B);
      assert.strictEqual(f.timers.length,2);
      await f.finish(0);
      assert.deepStrictEqual(f.commands,[]);
      await f.finish(1);
      assert.deepStrictEqual(f.commands,[['command','setVideo',urlB]]);
    });
    it('does not issue setVideo(null) when new video has no YouTube',async()=>{
      const f=fixture(path);
      await f.can('smA',f.A);
      f.switchTo(f.B,null);
      await f.can('smB',f.B);
      await f.finish(0);
      assert.deepStrictEqual(f.commands,[]);
    });
    it('does not emit an obsolete callback after description reset',async()=>{
      const f=fixture(path);
      await f.can('smA',f.A);
      f.panel._descriptionGeneration++;
      f.panel._zenTubeUrl=null;
      await f.finish(0);
      assert.deepStrictEqual(f.commands,[]);
    });
    it('coalesces successive same-video canplay timers to one switch',async()=>{
      const f=fixture(path);
      await f.can('smA',f.A);
      await f.can('smA',f.A);
      assert.strictEqual(f.timers.length,2);
      await f.finish(0);
      await f.finish(1);
      assert.deepStrictEqual(f.commands,[['command','setVideo',urlA]]);
    });
    it('keeps correct single callback for an unchanged video',async()=>{
      const f=fixture(path);
      await f.can('smA',f.A);
      await f.finish(0);
      assert.deepStrictEqual(f.commands,[['command','setVideo',urlA]]);
    });
    it('preserves the manual-only / disabled auto setting behavior',async()=>{
      const f=fixture(path);
      await f.can('smA',f.A,{isAutoZenTubeDisabled:true});
      assert.strictEqual(f.timers.length,0);
      f.panel._config.props.autoZenTube=false;
      await f.can('smA',f.A);
      assert.strictEqual(f.timers.length,0);
      assert.deepStrictEqual(f.commands,[]);
    });
    it('keeps current-video recommendations but discards stale recommendations',async()=>{
      const f=fixture(path);
      await f.can('smA',f.A);
      assert.strictEqual(f.recommendations.length,1);
      f.switchTo(f.B,urlB);
      await f.can('smA',f.A);
      assert.strictEqual(f.recommendations.length,1);
      await f.can('smB',f.B);
      assert.strictEqual(f.recommendations.length,2);
    });
  });
}
