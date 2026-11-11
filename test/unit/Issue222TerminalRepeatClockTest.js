'use strict';
const assert=require('assert');
const {loadClass,createContext}=require('../helpers/extractSource');
function fixture(){
 let now=0,handled=0,credits=0,ended=0,timeout=0;
 const C=loadClass('src/NicoVideoPlayer.js','NicoVideoPlayer',createContext({Emitter:class{},performance:{now:()=>now}}));
 const player=Object.create(C.prototype);
 const media={currentTime:120,duration:120,seeking:false,paused:true};
 Object.assign(player,{_videoPlayer:{_video:media,currentTime:120,duration:120,pause(){},close(){}},
  _commentPlayer:{close(){}},_playerConfig:{props:{}},_state:{},emit(){},
  _checkSupporterCreditPreload(){},_cancelSupporterCredit(){},
  _tryStartSupporterCredit(){credits++;return false;},
  _emitEnded(){ended++;},
  beforeSupporterCreditEnd:()=>++handled<=2,
  onRepeatEndTimeout:()=>{timeout++;}});
 return {player,media,setTime:t=>now=t,counts:()=>({handled,credits,ended,timeout})};
}
describe('Issue #222 terminal AB recovery on the existing comment clock',()=>{
 it('acknowledges a real landing even when the range ends again before the next clock',()=>{
  const f=fixture();f.player.beforeSupporterCreditEnd=()=>true;
  f.player._onEnded();f.setTime(29950);f.media.currentTime=119.75;f.player._onSeeked();
  f.media.currentTime=120;f.player._onEnded();f.setTime(30000);f.player._onTimer();
  assert.equal(f.counts().timeout,0);
 });
 it('does not acknowledge a bare seeked at the same terminal position',()=>{
  const f=fixture();f.player.beforeSupporterCreditEnd=()=>true;
  f.player._onEnded();f.player._onSeeked();f.setTime(30000);f.player._onTimer();
  assert.equal(f.counts().timeout,1);
 });
 it('cancels on provider pause but tolerates the native ended pause',()=>{
  const f=fixture();f.player._onEnded();f.media.ended=true;f.player._onPause();
  assert(f.player._terminalRepeat);
  f.media.ended=false;f.player._onPause();f.setTime(1800);f.player._onTimer();
  assert.equal(f.counts().handled,1);
 });
 it('releases a swallowed native end after the bounded AB retry budget without new media events',()=>{
  const f=fixture();f.player._onEnded();
  for(const time of [100,1000,1799,1800,1900,3599,3600,4000]){f.setTime(time);f.player._onTimer();}
  assert.deepStrictEqual(f.counts(),{handled:3,credits:1,ended:1,timeout:0});
 });
 it('does not retry or end a successfully returned video without seeked/timeupdate',()=>{
  const f=fixture();f.player._onEnded();f.media.currentTime=10;f.setTime(1800);f.player._onTimer();
  f.setTime(5000);f.player._onTimer();
  assert.equal(f.counts().handled,1);assert.equal(f.counts().ended,0);
 });
 for(const action of ['pause','close','setVideo'])it('cancels recovery on '+action,()=>{
  const f=fixture();f.player._onEnded();
  if(action==='setVideo'){
   // setVideo invalidates the same generation checked by the pending owner.
   f.player._setVideoGeneration=(f.player._setVideoGeneration||0)+1;
  }else f.player[action]();
  f.setTime(1800);f.player._onTimer();assert.equal(f.counts().handled,1);assert.equal(f.counts().ended,0);
 });
 it('does not spend retries on a buffering/seeking provider, but exits AB after a finite wait',()=>{
  const f=fixture();f.player._onEnded();f.media.seeking=true;
  f.setTime(1800);f.player._onTimer();assert.equal(f.counts().handled,1);
  f.setTime(30000);f.player._onTimer();
  assert.equal(f.counts().timeout,1);assert.equal(f.counts().ended,0,'never force playlist advance while media is seeking');
  f.setTime(40000);f.player._onTimer();assert.equal(f.counts().timeout,1);
 });
 it('duplicate native ends do not extend the recovery deadline',()=>{
  const f=fixture();f.player.beforeSupporterCreditEnd=()=>true;
  f.player._onEnded();f.media.seeking=true;
  f.setTime(29000);f.player._onEnded();f.setTime(30000);f.player._onTimer();
  assert.equal(f.counts().timeout,1);
 });
});
