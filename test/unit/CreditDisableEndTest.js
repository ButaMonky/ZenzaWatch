const assert=require('assert');
const {createContext,loadClass}=require('../helpers/extractSource');

function subject(){
 let change;const events=[],timers=[];
 class CreditView{constructor(){this.isActive=false;this.stops=0;}stop(){this.isActive=false;this.stops++;}}
 const c=createContext({SupporterCredit:{CreditView},setTimeout(fn){timers.push(fn);}});
 c.Emitter=loadClass('packages/lib/src/Emitter.js','Emitter',c);
 const Player=loadClass('src/NicoVideoPlayer.js','NicoVideoPlayer',c);
 const player=Object.create(Player.prototype);
 player._videoPlayer={_body:{},currentTime:100,_isYouTube:false};
 player._playerConfig={props:{'supporterCredit.enable':true},onkey(key,fn){assert.strictEqual(key,'supporterCredit.enable');change=fn;}};
 player._state={};player.emit=name=>events.push(name);player._initializeSupporterCredit();
 return {player,events,timers,off(){player._playerConfig.props['supporterCredit.enable']=false;change(false);}};
}
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
describe('Disabling supporter credits at video end',()=>{
 it('finishes once when disabled during active credits',()=>{
  const h=subject();h.player._supporterCredit.isActive=true;h.player._isPlaying=true;h.off();
  assert.deepStrictEqual(h.events,['ended']);assert.strictEqual(h.player._isEnded,true);
  assert.strictEqual(h.player._isPlaying,false);assert.strictEqual(h.player._supporterCredit.stops,1);
  h.off();assert.deepStrictEqual(h.events,['ended']);
 });
 it('finishes a pending end wait and ignores late load/timer completion',async()=>{
  const h=subject();let resolve;const loading=new Promise(r=>resolve=r);h.player._kickSupporterCreditLoad=()=>loading;
  h.player._onEnded();assert(h.player._creditWaiting);h.off();assert.deepStrictEqual(h.events,['ended']);
  resolve();h.timers.forEach(fn=>fn());await flush();assert.deepStrictEqual(h.events,['ended']);assert.strictEqual(h.player._creditWaiting,null);
 });
 it('does not end a normally playing video when disabled',()=>{
  const h=subject();h.player._isPlaying=true;h.off();assert.deepStrictEqual(h.events,[]);assert.strictEqual(h.player._isPlaying,true);
 });
 it('ordinary cancellation for seek or replacement never emits ended',()=>{
  const h=subject();h.player._supporterCredit.isActive=true;h.player._creditWaiting={};
  assert.strictEqual(h.player._cancelSupporterCredit(),true);assert.deepStrictEqual(h.events,[]);
  assert.strictEqual(h.player._creditWaiting,null);h.off();assert.deepStrictEqual(h.events,[]);
 });
});
