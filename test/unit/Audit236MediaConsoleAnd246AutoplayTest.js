'use strict';
const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');
describe('Audits #236/#246 media URL privacy and autoplay ownership',()=>{
  for(const file of ['src/NicoVideoPlayer.js','dist/ZenzaWatch-dev.user.js']){
    it(file+' emits canPlay without an invalid second autoplay call',()=>{
      const Player=loadClass(file,'NicoVideoPlayer',createContext({Emitter:class{}}));
      const player=Object.create(Player.prototype),events=[];
      player.emit=kind=>events.push(kind);
      player._video={play:()=>{throw Error('should not call native play');}};
      player._onVideoCanPlay();
      assert.deepStrictEqual(events,['canPlay']);
    });
    it(file+' keeps signed URL and raw event out of all media error logs',()=>{
      const captured=[],safeConsole={log:(...a)=>captured.push(a),error:(...a)=>captured.push(a),warn(){}};
      const context=createContext({Emitter:class{},BaseViewComponent:class{},
        CONSTANT:{BLANK_VIDEO_URL:'about:blank'},window:{console:safeConsole},console:safeConsole});
      const Player=loadClass(file,'VideoPlayer',context);
      const p=Object.create(Player.prototype),events=[];
      const secret='demo1';
      p._video={src:'https://media.invalid/?token='+secret,poster:''};
      p._videoElement={src:p._video.src};
      p._currentVideo=p._video;
      p._videoYouTube=null;
      p._reset=()=>{};p._changePlayer=()=>{};
      p.addClass=()=>{};p.emit=(...a)=>events.push(a);
      p.thumbnail='https://thumb.invalid/?key='+secret;
      p.src='https://media.invalid/?signature='+secret;
      p._onError({target:{error:{code:3},src:secret}});
      p._onYouTubeError({data:101,src:secret});
      assert(!JSON.stringify(captured).includes(secret),'no signed URL or event target in logs');
      assert(events.some(e=>e[0]==='error'&&e[1].type==='normal'));
      assert(events.some(e=>e[0]==='error'&&e[1].type==='youtube'));
    });
  }
});
