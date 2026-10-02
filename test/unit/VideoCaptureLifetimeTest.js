const assert=require('assert');
const {beginSection,createContext,run}=require('../helpers/extractSource');
const ticks=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function setup(){
 let id=0,tainted=false,draws=0;const timers=new Map(),videos=[];
 const canvas=()=>({getContext:()=>({drawImage(){draws++;},getImageData(){if(tainted)throw Error('SecurityError');return {};}})});
 function video(){const events=new Map();const v={style:{},readyState:0,videoWidth:640,videoHeight:360,currentTime:0,duration:20,seeking:false,removed:false,pauses:0,loads:0,src:'',addEventListener(n,f){if(!events.has(n))events.set(n,new Set());events.get(n).add(f);},removeEventListener(n,f){events.get(n)?.delete(f);},fire(n){for(const f of [...(events.get(n)||[])])f({target:v});},remove(){v.removed=true;},pause(){v.pauses++;},load(){v.loads++;},removeAttribute(n){if(n==='src')v.src='';},get listenerCount(){return [...events.values()].reduce((n,s)=>n+s.size,0);}};videos.push(v);return v;}
 const c=createContext({AbortController,DOMException,setTimeout(f){timers.set(++id,f);return id;},clearTimeout(i){timers.delete(i);},sleep:()=>Promise.resolve(),createVideoElement:video,document:{body:{append(){}},createElement:t=>t==='canvas'?canvas():{}}});
 const source=beginSection('packages/lib/src/dom/VideoCaptureUtil.js').split('VideoCaptureUtil.initCapTube')[0];const util=run(source+';VideoCaptureUtil;',c);
 return {util,videos,timers,setTainted(){tainted=true;},get draws(){return draws;}};
}
describe('Video capture readiness and resource lifetime (Task170)',()=>{
 it('starts capture loading before metadata for the HLS wrapper',async()=>{const h=setup(),p=h.util.capture('blob:start',5);p.catch(()=>{});await ticks();const v=h.videos[0];assert.equal(v.currentTime,5);v.readyState=2;v.fire('loadedmetadata');v.fire('seeked');await p;});
 it('captures origin-clean blob video without a hostname allowlist',async()=>{const h=setup(),{canvas}=await h.util.videoToCanvas({src:'blob:local',readyState:2,videoWidth:640,videoHeight:360});assert(canvas);assert.equal(h.draws,1);});
 it('rejects a tainted canvas even when the URL looks supported',async()=>{const h=setup();h.setTainted();await assert.rejects(Promise.resolve().then(()=>h.util.videoToCanvas({src:'https://delivery.domand.nicovideo.jp/a',readyState:2,videoWidth:640,videoHeight:360})));});
 it('rejects missing decoded video pixels before allocating a capture',async()=>{const h=setup();await assert.rejects(Promise.resolve().then(()=>h.util.videoToCanvas({src:'https://delivery.domand.nicovideo.jp/a',readyState:0,videoWidth:0,videoHeight:0})));assert.equal(h.draws,0);});
 it('captures position zero on loadeddata without needing a seeked event',async()=>{const h=setup(),p=h.util.capture('blob:zero',0);await ticks();const v=h.videos[0];v.fire('loadedmetadata');v.readyState=2;v.fire('loadeddata');const c=await p;assert.equal(c.width,640);assert.equal(v.removed,true);assert.equal(v.listenerCount,0);assert.equal(v.src,'');assert.equal(h.timers.size,0);});
 it('waits for the requested frame and does not capture an earlier loaded frame',async()=>{const h=setup(),p=h.util.capture('blob:seek',5);await ticks();const v=h.videos[0];v.fire('loadedmetadata');v.readyState=2;v.currentTime=0;v.fire('loadeddata');assert.equal(h.draws,0);v.currentTime=5;v.fire('seeked');await p;assert.equal(h.draws,1);assert.equal(v.listenerCount,0);});
 it('rejects media errors instead of returning the error as a successful canvas',async()=>{const h=setup(),p=h.util.capture('blob:bad',2);const rejected=assert.rejects(p);await ticks();const v=h.videos[0];v.fire('error');await rejected;assert(v.removed);assert.equal(v.listenerCount,0);assert.equal(h.timers.size,0);});
 it('abort releases media and rejects promptly',async()=>{const h=setup(),abort=new AbortController(),p=h.util.capture('blob:abort',1,{signal:abort.signal});const rejected=assert.rejects(p);await ticks();const v=h.videos[0];abort.abort();await rejected;assert(v.removed);assert.equal(v.listenerCount,0);assert.equal(h.timers.size,0);});
 it('already-aborted requests never create a video',async()=>{const h=setup(),abort=new AbortController();abort.abort();await assert.rejects(h.util.capture('blob:abort',1,{signal:abort.signal}));assert.equal(h.videos.length,0);});
 it('timeout rejects and releases all media/listeners',async()=>{const h=setup(),p=h.util.capture('blob:timeout',1);const rejected=assert.rejects(p);await ticks();for(const fn of [...h.timers.values()])fn();await rejected;assert(h.videos[0].removed);assert.equal(h.videos[0].listenerCount,0);assert.equal(h.timers.size,0);});
 it('aborting a queued capture does not let its successor overtake the active capture',async()=>{
  const h=setup(),first=h.util.capture('blob:queue',0);await ticks();
  const abort=new AbortController(),second=h.util.capture('blob:queue',0,{signal:abort.signal}),rejected=assert.rejects(second);abort.abort();await rejected;
  const third=h.util.capture('blob:queue',0);await ticks();assert.equal(h.videos.length,1);assert.equal(h.videos[0].removed,false);
  h.videos[0].readyState=2;h.videos[0].fire('loadedmetadata');await first;await ticks();assert.equal(h.videos.length,2);
  h.videos[1].readyState=2;h.videos[1].fire('loadedmetadata');await third;
 });

});
