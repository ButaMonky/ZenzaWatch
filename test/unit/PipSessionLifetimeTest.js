const assert=require('assert');
const {extract,createContext,run}=require('../helpers/extractSource');
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function target(extra={}){const listeners=new Map();return Object.assign({listeners,addEventListener(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},removeEventListener(n,f){listeners.get(n)?.delete(f);},fire(n){for(const f of [...listeners.get(n)||[]])f();},count(n){return listeners.get(n)?.size||0;}},extra);}
function setup({pendingPlay=false,metadata=true,pendingRequest=false}={}){
 const play=deferred(),request=deferred(),timers=new Map();let id=0,ended=0,requests=0,exits=0,trackStops=0,tickerStops=0;
 const original=target({paused:false,currentTime:1,videoWidth:1280,videoHeight:720,readyState:3});let video=original;
 const pip=target({readyState:metadata?1:0,style:{},paused:false,play:()=>pendingPlay?play.promise:Promise.resolve(),pause(){},remove(){this.removed=true;},requestPictureInPicture(){requests++;return pendingRequest?request.promise:Promise.resolve(pipWindow);}});
 const pipWindow=target({height:360});const canvas={width:1,height:1,getContext:()=>({fillRect(){}}),captureStream:()=>({getTracks:()=>[{stop(){trackStops++;}}]})};
 const document={createElement:n=>n==='canvas'?canvas:pip,body:{append(){}},pictureInPictureElement:null,exitPictureInPicture(){exits++;document.pictureInPictureElement=null;return Promise.resolve();}};
 const c=createContext({AbortController,document,performance:{now:()=>0},FPS:60,CommentRenderer:class{clearCache(){}},ScreenFilter:{buildFilter:()=>'',drawVideo(){}},
 createTicker:()=>({stop(){tickerStops++;}}),setTimeout(fn){const k=++id;timers.set(k,fn);return k;},clearTimeout(k){timers.delete(k);}});
 run('const waitEvent='+extract('packages/zenza/src/commentLayer/CommentPictureInPicture.js','waitEvent','var')+';'+extract('packages/zenza/src/commentLayer/CommentPictureInPicture.js','Session')+';this.Session=Session;this.waitEvent=waitEvent;',c);
 const s=new c.Session({getVideo:()=>video,getViewModel:()=>null,config:{props:{}},onEnd(){ended++;}});
 return {s,c,pip,original,pipWindow,document,play,request,timers,removeVideo(){video=null;},timeout(){for(const fn of [...timers.values()])fn();},get counts(){return {ended,requests,exits,trackStops,tickerStops};}};
}
describe('PiP session start/stop lifetime',()=>{
 it('cancels a pending play without waiting for its promise',async()=>{const h=setup({pendingPlay:true});let settled=false;const p=h.s.start().then(()=>settled=true);await flush();h.s.stop();await flush();assert(settled);assert.strictEqual(h.counts.requests,0);assert.strictEqual(h.pip.srcObject,null);h.play.resolve();await p;assert.strictEqual(h.counts.ended,1);});
 it('does not request PiP after stopping during metadata wait',async()=>{const h=setup({metadata:false});const p=h.s.start();await flush();h.s.stop();h.pip.fire('loadedmetadata');await p;assert.strictEqual(h.counts.requests,0);assert.strictEqual(h.pip.count('loadedmetadata'),0);assert.strictEqual(h.timers.size,0);});
 it('closes only its own window when a stopped request resolves late',async()=>{const h=setup({pendingRequest:true});const p=h.s.start();await flush();h.s.stop();h.document.pictureInPictureElement=h.pip;h.request.resolve(h.pipWindow);await p;await flush();assert.strictEqual(h.counts.exits,1);assert.strictEqual(h.pipWindow.count('resize'),0);assert.strictEqual(h.counts.trackStops,1);});
 it('leaves a newer PiP window alone when an old request completes',async()=>{const h=setup({pendingRequest:true});const p=h.s.start();await flush();h.s.stop();h.document.pictureInPictureElement={newer:true};h.request.resolve(h.pipWindow);await p;await flush();assert.strictEqual(h.counts.exits,0);assert.strictEqual(h.pipWindow.count('resize'),0);});
 it('detaches timeout event listeners',async()=>{const h=setup();const p=h.c.waitEvent(h.pip,'loadedmetadata',1);h.timeout();assert.strictEqual(await p,false);assert.strictEqual(h.pip.count('loadedmetadata'),0);});
 it('detaches PiP and source listeners and frees tracks once',async()=>{const h=setup();await h.s.start();h.s.stop();h.s.stop();for(const n of ['play','pause','leavepictureinpicture'])assert.strictEqual(h.pip.count(n),0,n);assert.strictEqual(h.original.count('play'),0);assert.strictEqual(h.counts.trackStops,1);assert.strictEqual(h.counts.tickerStops,1);assert.strictEqual(h.counts.ended,1);});
 it('stops when the original video disappears and ignores subsequent draws',async()=>{const h=setup();await h.s.start();h.removeVideo();h.s.draw();assert.strictEqual(h.counts.ended,1);h.s.draw();assert.strictEqual(h.s.video,null);});
 it('does not allocate another stream on repeated start of one session',async()=>{const h=setup();await h.s.start();await h.s.start();assert.strictEqual(h.counts.requests,1);h.s.stop();});
});

