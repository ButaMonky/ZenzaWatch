// Task788: parity of TextLabel and VideoCaptureUtil moved to TypeScript (legacy fixture
// vs generated runtime, identical fakes, results and side effects compared).
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const pair=name=>{const s=NICO_API_BY_NAME[name];return [read(s.fixture),read(s.runtime)];};
const flush=async(n=20)=>{for(let i=0;i<n;i++)await Promise.resolve();};

async function compare(name,symbol,makeWorld,run,label){
  const out=[];
  for(const code of pair(name)){
    const w=makeWorld();
    const subject=loadLegacy(code,symbol,w.globals);
    const r=await settle(()=>run(subject,w));
    await flush();
    out.push({r:snapshot(r),log:snapshot(w.log)});
  }
  assert.equal(out[0].r.ok,true,label+' legacy run failed: '+JSON.stringify(out[0].r.error));
  assert.deepEqual(out[1].r,out[0].r,label+' result');
  assert.deepEqual(out[1].log,out[0].log,label+' side effects');
}

function ctx2d(log,name){
  return {set font(v){log.push([name,'font',v]);},set fillStyle(v){log.push([name,'fill',v]);},
    set textAlign(v){log.push([name,'align',v]);},set textBaseline(v){log.push([name,'baseline',v]);},
    beginPath(){},clearRect(...a){log.push([name,'clear',...a]);},measureText:t=>({width:t.length*7}),
    fillText(...a){log.push([name,'fillText',...a]);}};
}
function labelWorld({offscreen=false}={}){
  const log=[];
  const canvas=(name)=>{const c={width:300,height:150,style:{},dataset:{},getContext:()=>ctx2d(log,name),
    transferControlToOffscreen(){log.push(['transfer',name]);return c;}};return c;};
  const container={offsetWidth:44,offsetHeight:20,append:c=>log.push(['container.append',c.style])};
  const computed={font:'12px x',fontFamily:'sans',fontWeight:'400',fontSize:'12px',color:'rgb(1, 2, 3)',
    backgroundColor:'transparent',textAlign:'start'};
  let made=0;
  const workerUtil={createCrossMessageWorker:(func,opt)=>{log.push(['worker',opt.name]);
    const self={};func(self);return {name:opt.name,post:async m=>self.onmessage(m)};}};
  const globals={HTMLCanvasElement:{prototype:offscreen?{transferControlToOffscreen(){}}:{}},
    window:{getComputedStyle:()=>computed,devicePixelRatio:1},workerUtil,Math:Object.assign(Object.create(Math),{random:()=>0.5}),
    document:{body:{},createElement:()=>canvas('c'+(++made))},Object,Promise,Error};
  return {log,globals,container};
}

test('TextLabel: create, draw (skips identical text), restyle, both worker paths',{timeout:20000}, async()=>{
  for(const offscreen of [false,true]){
    await compare('TextLabel','TextLabel',()=>labelWorld({offscreen}),async(T,w)=>{
      const label=T.create({container:w.container,name:'time',text:'00:00',
        style:{widthPx:44,heightPx:16,fontSizePx:12,color:'#ccc'}});
      await flush();
      await label.drawText('00:01');await label.drawText('00:01');
      label.text='00:02';await flush();
      await label.style();
      const aligned=T.create({container:w.container,canvas:{width:10,height:10,style:{},dataset:{},
        getContext:()=>ctx2d(w.log,'given'),transferControlToOffscreen(){return this;}},style:{textAlign:'right',fontSizePx:10}});
      await aligned.drawText('x');
      return [label.text,label.canvas.dataset,aligned.text];
    },'offscreen='+offscreen);
  }
});

function captureWorld(){
  const log=[];let tid=0;const timers=new Map();
  const makeCanvas=()=>({width:0,height:0,getContext:()=>({drawImage:(...a)=>log.push(['draw',a.length,...a.slice(1).map(n=>typeof n==='number'?Math.round(n):n)]),
    getImageData:()=>log.push(['getImageData']),fillRect:(...a)=>log.push(['fillRect',...a]),set fillStyle(v){log.push(['fillStyle',v]);}}),
    toDataURL:()=>'data:image/png;base64,QUJD'});
  const listeners=new Map();
  const video={style:{},l:new Map(),readyState:0,seeking:false,currentTime:0,duration:NaN,videoWidth:640,videoHeight:360,
    addEventListener(n,f){this.l.set(n,f);log.push(['v.add',n]);},removeEventListener(n){this.l.delete(n);},
    pause(){log.push(['v.pause']);},load(){log.push(['v.load']);},removeAttribute(a){log.push(['v.removeAttr',a]);},remove(){log.push(['v.remove']);}};
  class Image{decode(){log.push(['img.decode',this.src]);return Promise.resolve();}}
  const globals={document:{createElement:t=>t==='canvas'?makeCanvas():{setAttribute:(k,v)=>log.push(['a',k,v]),click:()=>log.push(['click']),remove(){}},
      body:{append:e=>log.push(['body.append',e===video?'video':'a'])},querySelector:()=>null},
    window:{URL:{createObjectURL:()=>'blob:x',revokeObjectURL:u=>log.push(['revoke',u])},console:{info(){}},setTimeout:f=>f()},
    URL:Object.assign(class extends URL{},{revokeObjectURL:u=>log.push(['URL.revoke',u])}),Blob:class{constructor(p,o){log.push(['blob',o.type,p.join('').length]);}},
    Image,atob:s=>Buffer.from(s,'base64').toString('latin1'),Uint8Array,Number,Math,Promise,Error,TypeError,Object,
    createVideoElement:()=>video,sleep:ms=>{log.push(['sleep',ms]);return Promise.resolve();},
    setTimeout:(f,ms)=>{const i=++tid;timers.set(i,f);log.push(['setTimeout',ms]);return i;},clearTimeout:i=>timers.delete(i),
    self:{addEventListener:(t,f)=>listeners.set(t,f),removeEventListener:t=>listeners.delete(t)},location:{href:'https://www.nicovideo.jp/watch/sm9'}};
  return {log,globals,video,timers,listeners};
}

test('VideoCaptureUtil: canvas conversions, html overlay, save, capture flow and validation',{timeout:20000}, async()=>{
  await compare('VideoCaptureUtil','VideoCaptureUtil',captureWorld,async(V,w)=>{
    const r=[];
    r.push(await V.videoToCanvas({videoWidth:0,videoHeight:0}).then(()=>'ok',e=>e.message));
    r.push(await V.videoToCanvas({videoWidth:4,videoHeight:2,readyState:1}).then(()=>'ok',e=>e.message));
    const {canvas}=await V.videoToCanvas({videoWidth:4,videoHeight:2,readyState:4});
    r.push([canvas.width,canvas.height]);
    const html=await V.htmlToCanvas('<div>c</div>',320,180);
    r.push([html.canvas.width,html.canvas.height]);
    const nico=await V.nicoVideoToCanvas({video:{videoWidth:640,videoHeight:360,readyState:4},html:'<b/>',minHeight:720,
      processVideoCanvas:c=>{w.log.push(['process']);return c;}});
    r.push([nico.canvas.width,nico.canvas.height]);
    V.saveToFile(canvas,'shot.png');
    r.push(await V.capture('',1).then(()=>'ok',e=>[e.name,e.message]));
    r.push(await V.capture('https://x/v.mp4',-1).then(()=>'ok',e=>e.message));
    const p=V.capture('https://dmc.nico/v.m3u8',5);
    await flush();
    w.video.duration=3;w.video.l.get('loadedmetadata')();
    w.video.readyState=4;w.video.l.get('seeked')();
    const shot=await p;
    r.push([shot.width,shot.height,w.video.currentTime]);
    const ac=new AbortController();ac.abort();
    r.push(await V.capture('https://x/v.mp4',1,{signal:ac.signal}).then(()=>'ok',e=>e.message));
    r.push(V.initCapTube(),V.capTube({title:'t',videoId:'v',author:'a'}),V.capTubeThumbnail());
    return r;
  },'capture');
});

test('VideoCaptureUtil.initCapTube: YouTube origins only, request/response, timeout, replacement',{timeout:20000}, async()=>{
  await compare('VideoCaptureUtil','VideoCaptureUtil',()=>{
    const w=captureWorld();
    const frameWin={postMessage:(m,origin,t)=>w.log.push(['frame.post',m.body.command,m.sessionId,origin])};
    let src='https://www.youtube.com/embed/x';
    w.globals.document.querySelector=()=>({src,contentWindow:frameWin});
    w.setSrc=s=>{src=s;};w.frameWin=frameWin;
    return w;
  },async(V,w)=>{
    const r=[];
    const tube=V.initCapTube();
    r.push(tube===V.initCapTube());
    const p=V.capTubeThumbnail(160,90);
    const handler=w.listeners.get('message');
    handler({source:{},origin:'https://www.youtube.com',data:{id:'CapTube',sessionId:'send:CapTube:1',body:{command:'commandResult',status:'ok'}}});
    handler({source:w.frameWin,origin:'https://www.youtube.com',data:{id:'CapTube',sessionId:'send:CapTube:1',
      body:{command:'commandResult',status:'ok',params:{result:'thumb'}}}});
    r.push(await p);
    const p2=tube.post({command:'x'},{timeout:10});
    [...w.timers.values()].at(-1)();
    r.push(await p2.then(()=>'ok',e=>e));
    const p3=tube.post({command:'y'});
    handler({source:w.frameWin,origin:'https://www.youtube.com',data:{id:'CapTube',sessionId:'send:CapTube:3',
      body:{command:'commandResult',status:'fail'}}});
    r.push(await p3.then(()=>'ok',e=>e.message));
    V.capTube({title:'t',videoId:'v',author:'a'});
    w.setSrc('https://evil.example/embed');
    r.push(V.initCapTube());
    return r;
  },'captube');
});
