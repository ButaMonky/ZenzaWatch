'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');

describe('Audit #232: late pause/ended after terminal video-info failure',()=>{
  for(const file of ['src/NicoVideoPlayerDialog.js','dist/ZenzaWatch-dev.user.js']){
    it(file+' ignores null-metadata saves and finalization',()=>{
      const Dialog=loadClass(file,'NicoVideoPlayerDialog',createContext({Emitter:class{}}));
      const player=Object.create(Dialog.prototype),events=[],writes=[];
      player._state={setPausing:()=>events.push('pause-state'),setVideoEnded:()=>events.push('ended-state')};
      player._videoInfo=null;
      player.emit=kind=>events.push(kind);
      player.emitAsync=kind=>events.push(kind);
      player._savePlaybackPosition=(...args)=>writes.push(args);
      player._saveFinalPlaybackPosition=(...args)=>writes.push(args);
      player._clearCompletedAutoResume=()=>events.push('resume-clear');
      player._view={manualBookmarkDock:{repeatAtEnd:()=>{events.push('repeat');return false;}}};
      Object.defineProperty(player,'currentTime',{configurable:true,value:55});
      assert.doesNotThrow(()=>player._onVideoPause());
      assert.doesNotThrow(()=>player._onVideoEnded());
      assert.deepStrictEqual(events,['pause-state','pause']);
      assert.deepStrictEqual(writes,[]);
    });
    it(file+' still saves a valid current pause',()=>{
      const Dialog=loadClass(file,'NicoVideoPlayerDialog',createContext({Emitter:class{}}));
      const player=Object.create(Dialog.prototype),writes=[];
      player._state={setPausing(){}};
      player._videoInfo={contextWatchId:'so7'};
      player._savePlaybackPosition=(...args)=>writes.push(args);
      player.emit=()=>{};
      Object.defineProperty(player,'currentTime',{configurable:true,value:25});
      player._onVideoPause();
      assert.deepStrictEqual(writes,[['so7',25]]);
    });
  }
});
