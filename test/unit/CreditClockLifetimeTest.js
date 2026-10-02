const assert=require('assert');
const {extract,createContext,run}=require('../helpers/extractSource');
function setup(){
 let now=0,id=0,ended=0;const timers=new Map(),rafs=new Map();
 const c=createContext({performance:{now:()=>now},CANVAS_W:1280,CANVAS_H:720,MAX_DURATION:30,DEFAULT_DURATION:15,
  setInterval(fn){const k=++id;timers.set(k,fn);return k;},clearInterval(k){timers.delete(k);},
  requestAnimationFrame(fn){const k=++id;rafs.set(k,fn);return k;},cancelAnimationFrame(k){rafs.delete(k);},setTimeout(){return 1;}});
 run(extract('packages/zenza/src/videoPlayer/SupporterCredit.js','CreditView')+';this.CreditView=CreditView;',c);
 const v=new c.CreditView({parentNode:{}});v.data={};v.page={render(){}};v.view={classList:{add(){},remove(){}}};v.ctx={fillRect(){}};
 v.onEnd=()=>ended++;
 v.audio={currentTime:0,duration:10,pause(){this.pauses=(this.pauses||0)+1;},play:()=>Promise.resolve()};
 return {v,timers,rafs,advance(ms){now+=ms;for(const fn of [...timers.values()])fn();},setNow(ms){now=ms;},get ended(){return ended;}};
}
describe('Supporter credit clock lifetime',()=>{
 it('recovers when successfully started audio stalls',async()=>{const h=setup();h.v.start();await Promise.resolve();h.v.audio.currentTime=1;h.advance(1000);h.advance(3000);assert(h.v.currentTime>1);h.advance(12000);assert.strictEqual(h.ended,1);assert.strictEqual(h.timers.size,0);});
 it('does not expire while explicitly paused, then expires after resuming',async()=>{const h=setup();h.v.start();await Promise.resolve();h.v.audio.currentTime=1;h.advance(1000);h.v.pause();h.advance(60000);assert.strictEqual(h.ended,0);assert.strictEqual(h.v.currentTime,1);h.v.resume();h.advance(2000);h.advance(12000);assert.strictEqual(h.ended,1);});
 it('finishes with no animation frames in a hidden tab',()=>{const h=setup();h.v.audio=null;h.v.start();h.advance(31000);assert.strictEqual(h.ended,1);});
 it('ignores late play completion from a stopped earlier session',async()=>{const h=setup();let resolve;h.v.audio.play=()=>new Promise(r=>resolve=r);h.v.start();const old=resolve;h.v.stop();h.v.start();old();await Promise.resolve();assert.strictEqual(h.v._audioOk,false);h.v.stop();assert.strictEqual(h.timers.size,0);});
 it('does not let failed resume promises change a newer session',async()=>{const h=setup();h.v.start();await Promise.resolve();h.v.pause();let reject;h.v.audio.play=()=>new Promise((r,j)=>reject=j);h.v.resume();h.v.stop();h.v.audio.play=()=>Promise.resolve();h.v.start();await Promise.resolve();reject(new Error('old'));await Promise.resolve();await Promise.resolve();assert.strictEqual(h.v._audioOk,true);h.v.stop();});
 it('keeps elapsed time monotonic when the media clock goes backward',async()=>{const h=setup();h.v.start();await Promise.resolve();h.v.audio.currentTime=3;h.advance(3000);assert.strictEqual(h.v.currentTime,3);h.v.audio.currentTime=1;assert(h.v.currentTime>=3);h.v.stop();});
 it('finishes once on audio ended and removes the watchdog',async()=>{const h=setup();h.v.start();await Promise.resolve();const end=h.v.audio.onended;end();end();h.advance(40000);assert.strictEqual(h.ended,1);assert.strictEqual(h.timers.size,0);});
 it('enforces a real elapsed limit even if audio progresses unusually slowly',async()=>{const h=setup();h.v.start();await Promise.resolve();for(let i=0;i<35;i++){h.v.audio.currentTime+=0.01;h.advance(1000);}assert.strictEqual(h.ended,1);});
 it('aligns delayed play with the elapsed fallback clock before switching clocks',async()=>{const h=setup();let resolve;h.v.audio.play=()=>new Promise(r=>resolve=r);h.v.start();h.advance(4000);assert.equal(h.v.currentTime,4);resolve();await Promise.resolve();assert.equal(h.v.currentTime,4);assert.equal(h.v.audio.currentTime,4);h.v.audio.currentTime=4.2;h.advance(200);assert.equal(h.v.currentTime,4.2);h.v.stop();});
 it('keeps paused elapsed time when delayed play completes',async()=>{const h=setup();let resolve;h.v.audio.play=()=>new Promise(r=>resolve=r);h.v.start();h.advance(2000);h.v.pause();h.advance(60000);resolve();await Promise.resolve();assert.equal(h.v.currentTime,2);assert.equal(h.v.audio.currentTime,2);assert(h.v.audio.pauses>0);h.v.stop();});
 it('continues the fallback clock if delayed audio cannot be aligned',async()=>{const h=setup();let resolve,rejectSeek=false,time=0;Object.defineProperty(h.v.audio,'currentTime',{get:()=>time,set:t=>{if(rejectSeek)throw Error('unseekable');time=t;}});h.v.audio.play=()=>new Promise(r=>resolve=r);h.v.start();h.advance(4000);rejectSeek=true;resolve();await Promise.resolve();await Promise.resolve();assert.equal(h.v._audioOk,false);assert(h.v.audio.pauses>0);h.advance(1000);assert.equal(h.v.currentTime,5);h.v.stop();});

});
