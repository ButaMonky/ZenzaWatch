/**
 * Isolated real-browser regression: generated control methods, original seek CSS,
 * real layout and native mouse/keyboard range input. Preview rendering is recorded.
 * Run with CHROME_EXECUTABLE pointing to an installed Chromium browser (Edge works).
 * No account, live player, network page or user browser profile is used.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import type {ChildProcess} from 'node:child_process';

const require = createRequire(import.meta.url);
const {read, extract, beginSection} = require('../../../test/helpers/extractSource.js');
const {startChromeCdp} = require('../../../test/helpers/startChromeCdp.js');
const source: string = read('src/VideoControlBar.js');
const start = source.indexOf('  .seekBarContainer {');
const end = source.indexOf('  .videoControlBar .videoTime {', start);
assert(start >= 0 && end > start, 'Original seek CSS must exist');
const css = source.slice(start, end);
const fixture = `
class Emitter {}
const global = window;
const throttle = {raf: fn => fn};
const eventBindings = new Map();
const util = {
  secToTime: seconds => String(seconds),
  dispatchCommand(target, command, seconds) { qa.commands.push([command, seconds]); },
  $(value) {
    const target = value === 'body' ? document.body : value;
    return {
      on(name, handler, options) {
        const bindings = eventBindings.get(target) || new Map();
        bindings.set(name, handler); eventBindings.set(target, bindings);
        target.addEventListener(name.split('.')[0], handler, options); return this;
      },
      off(name) {
        const bindings = eventBindings.get(target), handler = bindings?.get(name);
        if (handler) target.removeEventListener(name.split('.')[0], handler);
        bindings?.delete(name); return this;
      }
    };
  }
};
${beginSection('packages/zenza/src/sceneSearch/TimelineGeometry.js')}
${extract('src/VideoControlBar.js', 'VideoControlBar')}
${extract('src/VideoControlBar.js', 'SmoothSeekBarPointer')}
${extract('packages/zenza/src/sceneSearch/SceneSearchLegacyAdapter.js', 'SceneSearchLegacyAdapter')}
const host = document.querySelector('.host'), seek = document.querySelector('.seekBar');
const range = document.querySelector('.seekRange');
const qa = window.qa = {
  host, seek, range, commands: [], previews: [], comments: [], nativeInputs: [],
  storyboard: [], pinned: null, commentTime: -1, lastTarget: '', labelWrites: 0,
  playbackTick() { for(let frame=0;frame<6;frame++)bar._onTimer(); },
  clear() {
    this.commands.length = this.previews.length = this.comments.length = 0;
    this.nativeInputs.length = this.storyboard.length = 0;
  },
  read() {
    const rect = e => {const r=e.getBoundingClientRect();return {
      left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width, height:r.height
    };};
    return {rect:rect(seek),rangeRect:rect(range),localWidth:seek.offsetWidth,
      commands:this.commands,previews:this.previews,comments:this.comments,
      nativeInputs:this.nativeInputs,storyboard:this.storyboard,
      value:Number(range.value),dragging:bar.state.isDragging,
      held:host.classList.contains('is-storyboardLongPress'),lastTarget:this.lastTarget,
      marker:document.querySelector('.seekBarPointer').style.transform,
      fullscreen:document.fullscreenElement===host,viewport:innerWidth,labelWrites:this.labelWrites};
  }
};
const bar = qa.bar = Object.create(VideoControlBar.prototype);
Object.assign(bar, {
  _duration:200, _seekBar:seek, _seekRange:range, _$seekBarContainer:[seek],
  _timerCount:0, player:{currentTime:50}, _wheelSeeker:{}, durationLabel:{}, emit(){},
  currentTimeLabel:{set text(value){qa.labelWrites++;}},
  state:{isDragging:false,isWheelSeeking:true}, classList:host.classList,
  _sceneSearchPinnedTime:()=>qa.pinned,
  _seekBarToolTip:{update:(time,left)=>qa.previews.push([time,left])},
  _commentPreview:{
    set currentTime(time){qa.commentTime=time;},
    update(left){qa.comments.push([qa.commentTime,left]);}
  },
  storyboard:{setCurrentTime:(time,force)=>qa.storyboard.push([time,force])}
});
range.addEventListener('input', event=>{
  qa.nativeInputs.push(Number(range.value)); bar._onSeekRangeInput(event);
});
range.addEventListener('change', event=>event.target.blur());
seek.addEventListener('mousemove', event=>{
  qa.lastTarget=event.target.className; bar._onSeekBarMouseMove(event);
});
seek.addEventListener('mousedown', event=>bar._onSeekBarMouseDown(event));
qa.pointer = new SmoothSeekBarPointer({
  pointer:document.querySelector('.seekBarPointer'), playerState:{onkey(){}},
  getTimelineGeometry:()=>bar._getTimelineGeometry()
});
qa.pointer.duration=200;
bar._pointer=qa.pointer;
qa.adapterTime=x=>SceneSearchLegacyAdapter.seekTime(seek,{clientX:x},200);
`;
const html = '<!doctype html><html><head><meta charset="utf-8"><style>' +
  'html,body{margin:0;height:100%;overflow:hidden;}' +
  '.host{position:fixed;left:0;top:140px;width:100vw;height:80px;transform-origin:top left;}' +
  '.host:fullscreen{inset:0;width:100vw!important;height:100vh;transform:none!important;zoom:1!important;}' +
  '.host:fullscreen .seekBarContainer{top:120px;}' + css +
  '</style></head><body><div class="host videoControlBar"><div class="seekBarContainer">' +
  '<div class="seekBar"><div class="seekBarPointer"></div>' +
  '<input type="range" class="seekRange" min="0" max="200" step="any" value="100">' +
  '</div></div></div><script>' + fixture + '</script></body></html>';

type Rect = {left:number;right:number;top:number;bottom:number;width:number;height:number};
type Snapshot = {
  rect:Rect; rangeRect:Rect; localWidth:number; commands:Array<[string,number]>;
  previews:Array<[number,number]>; comments:Array<[number,number]>;
  nativeInputs:number[]; storyboard:Array<[number,boolean]>; value:number;
  dragging:boolean; held:boolean; lastTarget:string; marker:string;
  fullscreen:boolean; viewport:number; labelWrites:number;
};
type Result = {result?:{value?:unknown};exceptionDetails?:{text?:string}};
type Pending = {resolve:(value:Result)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>};
const executable = process.env.CHROME_EXECUTABLE;
assert(executable && fs.existsSync(executable), 'Set CHROME_EXECUTABLE to an installed Chromium browser');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-seek-geometry-'));
const checks:Array<Record<string,unknown>> = [];
const pending = new Map<number,Pending>();
let chrome:ChildProcess|undefined;
let ws:WebSocket|undefined;
let seq=0;
const pause = (ms:number) => new Promise<void>(resolve=>setTimeout(resolve,ms));
function send(method:string,params:Record<string,unknown>={}):Promise<Result> {
  return new Promise((resolve,reject)=>{
    const id=++seq;
    const timer=setTimeout(()=>{pending.delete(id);reject(new Error(method+' timeout'));},15000);
    pending.set(id,{resolve,reject,timer});
    ws!.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate<T>(expression:string,options:Record<string,unknown>={}):Promise<T> {
  const result=await send('Runtime.evaluate',{expression,returnByValue:true,...options});
  assert(!result.exceptionDetails,JSON.stringify(result.exceptionDetails));
  return result.result?.value as T;
}
const snapshot = () => evaluate<Snapshot>('qa.read()');
function near(actual:number,expected:number,tolerance=0.000001) {
  assert(Math.abs(actual-expected)<=tolerance,JSON.stringify({actual,expected,tolerance}));
}
async function mouse(type:string,x:number,y:number,pressed=false) {
  await send('Input.dispatchMouseEvent',{
    type,x,y,button:type==='mouseMoved'&&!pressed?'none':'left',
    buttons:pressed?1:0,...(type==='mouseMoved'?{}:{clickCount:1})
  });
}
async function layout(viewport:number,width:number,left=0,scale=1,zoom=1) {
  await mouse('mouseMoved',5,20);
  await send('Emulation.setDeviceMetricsOverride',{
    width:viewport,height:720,deviceScaleFactor:1,mobile:false
  });
  await evaluate(`qa.bar._endMouseDrag();qa.pinned=null;
    Object.assign(qa.host.style,{width:'${width}px',left:'${left}px',
      transform:'scale(${scale})',zoom:'${zoom}'});
    qa.range.value='100';qa.clear();`);
}
function assertNativeOwnership(state:Snapshot) {
  assert(state.nativeInputs.length>0,'A real native input event must occur');
  assert.deepEqual(state.commands,state.nativeInputs.map(seconds=>['seek',seconds]));
  for(const seconds of state.nativeInputs) assert(Number.isFinite(seconds)&&seconds>=0&&seconds<=200);
}

try {
  chrome=await startChromeCdp(executable,profile);
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
  const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json() as {webSocketDebuggerUrl:string};
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise<void>((resolve,reject)=>{
    ws!.addEventListener('open',()=>resolve(),{once:true});
    ws!.addEventListener('error',()=>reject(new Error('CDP socket failed')),{once:true});
  });
  ws.addEventListener('message',event=>{
    const message=JSON.parse(String(event.data)) as {id?:number;error?:unknown;result:Result};
    const item=message.id===undefined?undefined:pending.get(message.id);
    if(!item)return;
    clearTimeout(item.timer);pending.delete(message.id!);
    message.error?item.reject(new Error(JSON.stringify(message.error))):item.resolve(message.result);
  });
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url:'data:text/html;charset=utf-8,'+encodeURIComponent(html)});
  for(let i=0;i<60;i++){
    if(await evaluate<boolean>('!!window.qa && document.readyState==="complete"'))break;
    await pause(50);
  }
  assert(await evaluate<boolean>('!!window.qa'),'Fixture did not initialize');
  const version=await evaluate<string>('navigator.userAgent');
  for(const scenario of [
    {name:'normal',viewport:1200,width:1200,left:0,scale:1,zoom:1,ratio:0.25},
    {name:'small viewport',viewport:360,width:360,left:0,scale:1,zoom:1,ratio:0.75},
    {name:'translated scale 1.5',viewport:1200,width:600,left:80,scale:1.5,zoom:1,ratio:0.5},
    {name:'CSS zoom 1.25',viewport:1200,width:600,left:40,scale:1,zoom:1.25,ratio:0.5},
    {name:'scale 0.75',viewport:900,width:600,left:25,scale:0.75,zoom:1,ratio:0.5}
  ]) {
    await layout(scenario.viewport,scenario.width,scenario.left,scenario.scale,scenario.zoom);
    const before=await snapshot();
    const x=Math.round(before.rect.left+before.rect.width*scenario.ratio);
    await mouse('mouseMoved',x,(before.rect.top+before.rect.bottom)/2);
    await evaluate('qa.pointer.currentTime=100');
    const state=await snapshot(), preview=state.previews.at(-1)!;
    assert(preview,'Hover must reach the actual control');
    near(preview[0],200*scenario.ratio,200/state.rect.width+0.000001);
    near(preview[1],state.localWidth*scenario.ratio,state.localWidth/state.rect.width+0.000001);
    assert.deepEqual(state.comments.at(-1),preview);
    assert.deepEqual(state.commands,[]);
    near(await evaluate<number>('qa.adapterTime('+x+')'),preview[0]);
    assert.equal(state.marker,'translateX('+(state.localWidth/2-6)+'px)');
    checks.push({name:scenario.name,rect:state.rect,localWidth:state.localWidth,preview,marker:state.marker});
  }

  // Exercise the real control timer, retaining player time across geometry changes.
  await layout(900,300,80,1.5);
  await evaluate('qa.bar.state.isWheelSeeking=false;qa.playbackTick()');
  let paused=await snapshot();
  assert.equal(paused.marker,'translateX(69px)');
  const pausedLabels=paused.labelWrites;
  await evaluate('qa.host.style.width="600px";qa.playbackTick()');
  paused=await snapshot();
  assert.equal(paused.marker,'translateX(144px)');
  assert.equal(paused.labelWrites,pausedLabels);
  assert.deepEqual(paused.commands,[]);
  checks.push({name:'paused control timer follows width-only resize',marker:paused.marker});

  await evaluate('qa.host.style.display="none";qa.bar.player.currentTime=75;qa.playbackTick()');
  const hiddenLabels=(await snapshot()).labelWrites;
  await evaluate('qa.host.style.display="";qa.playbackTick()');
  paused=await snapshot();
  assert.equal(paused.marker,'translateX(219px)');
  assert.equal(paused.labelWrites,hiddenLabels);
  assert.deepEqual(paused.commands,[]);
  checks.push({name:'paused control timer recovers visible geometry',marker:paused.marker});

  await evaluate('qa.bar.duration=400;qa.playbackTick()');
  paused=await snapshot();
  assert.equal(paused.marker,'translateX(106.5px)');
  assert.equal(paused.labelWrites,hiddenLabels);
  assert.deepEqual(paused.commands,[]);
  checks.push({name:'paused control timer follows corrected duration',marker:paused.marker});
  await evaluate('qa.bar.duration=200;qa.bar.player.currentTime=50;qa.playbackTick();qa.bar.state.isWheelSeeking=true');

  // Shrink a viewport-wide native range so both real input endpoints fit onscreen.
  // The production 100vw rule, thumb size, native value and blur-on-change are unchanged.
  await layout(900,900,80,0.75);
  for(const edge of ['left','right'] as const) {
    await evaluate('qa.range.value="100";qa.clear()');
    let state=await snapshot();
    await mouse('mouseMoved',state.rangeRect.left+20,(state.rangeRect.top+state.rangeRect.bottom)/2);
    state=await snapshot();
    const x=edge==='left'?state.rangeRect.left+0.1:state.rangeRect.right-0.1;
    const y=(state.rangeRect.top+state.rangeRect.bottom)/2;
    await mouse('mousePressed',x,y,true);await mouse('mouseReleased',x,y);
    state=await snapshot();assertNativeOwnership(state);
    assert.equal(state.value,edge==='left'?0:200);
    assert.equal(state.dragging,false);assert.equal(state.held,false);
    checks.push({name:'native '+edge+' endpoint click',value:state.value,events:state.nativeInputs.length});
  }
  for(const edge of ['left','right'] as const) {
    await evaluate('qa.range.value="100";qa.clear()');
    const initial=await snapshot(), r=initial.rangeRect, y=(r.top+r.bottom)/2;
    await mouse('mouseMoved',(r.left+r.right)/2,y);
    await mouse('mousePressed',(r.left+r.right)/2,y,true);
    const endX=edge==='left'?r.left-30:r.right+30;
    await mouse('mouseMoved',endX,y,true);
    await mouse('mouseReleased',endX,y);
    const state=await snapshot();assertNativeOwnership(state);
    assert.equal(state.value,edge==='left'?0:200);assert.equal(state.dragging,false);
    checks.push({name:'native drag beyond '+edge,value:state.value,events:state.nativeInputs.length});
  }

  await evaluate('qa.range.value="100";qa.clear()');
  for(const key of [
    {key:'ArrowRight',code:39},{key:'Home',code:36},{key:'End',code:35},{key:'ArrowLeft',code:37}
  ]) {
    await evaluate('qa.range.focus()');
    await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:key.key,code:key.key,
      windowsVirtualKeyCode:key.code,nativeVirtualKeyCode:key.code});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:key.key,code:key.key,
      windowsVirtualKeyCode:key.code,nativeVirtualKeyCode:key.code});
    const state=await snapshot();assertNativeOwnership(state);
    if(key.key==='Home')assert.equal(state.value,0);
    else if(key.key==='End')assert.equal(state.value,200);
    else assert(state.value>0&&state.value<200);
    checks.push({name:'native keyboard '+key.key,value:state.value});
  }

  await evaluate('qa.clear()');
  let state=await snapshot();
  let x=(state.rangeRect.left+state.rangeRect.right)/2;
  let y=(state.rangeRect.top+state.rangeRect.bottom)/2;
  await mouse('mouseMoved',x,y);await mouse('mousePressed',x,y,true);
  await pause(260);
  state=await snapshot();assert.equal(state.held,true);assert.equal(state.dragging,true);
  await mouse('mouseReleased',x,y);
  state=await snapshot();assert.equal(state.held,false);assert.equal(state.dragging,false);
  checks.push({name:'native 200ms hold and release',heldAfterRelease:state.held});

  await evaluate('qa.pinned=12;qa.bar._seekBarMouseX=123;qa.clear()');
  state=await snapshot();x=state.rect.left+state.rect.width*0.2;
  await mouse('mouseMoved',x,(state.rect.top+state.rect.bottom)/2);
  state=await snapshot();assert.deepEqual(state.previews.at(-1),[12,123]);
  assert.deepEqual(state.comments.at(-1),[12,123]);assert.deepEqual(state.commands,[]);
  checks.push({name:'pinned hover retains time and local anchor',preview:state.previews.at(-1)});

  await evaluate(`qa.pinned=null;qa.clear();
    const child=document.createElement('span');child.className='nested-target';
    Object.assign(child.style,{position:'absolute',left:'25%',width:'30%',height:'100%',zIndex:1000,pointerEvents:'auto'});
    qa.seek.append(child);`);
  const child=await evaluate<Rect>(`(()=>{const r=document.querySelector('.nested-target').getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};})()`);
  x=Math.round((child.left+child.right)/2);y=(child.top+child.bottom)/2;
  await mouse('mouseMoved',x,y);
  state=await snapshot();assert.equal(state.lastTarget,'nested-target');
  near(state.previews.at(-1)![0],80,200/state.rect.width+0.000001);
  near(await evaluate<number>('qa.adapterTime('+x+')'),state.previews.at(-1)![0]);
  assert.deepEqual(state.commands,[]);
  checks.push({name:'real child-target hover',target:state.lastTarget,preview:state.previews.at(-1)});
  await evaluate('document.querySelector(".nested-target").remove()');

  await evaluate(`qa.clear();qa.host.style.display='none';qa.range.value='50';
    qa.range.dispatchEvent(new Event('input',{bubbles:true}));`);
  state=await snapshot();assertNativeOwnership(state);
  assert.deepEqual(state.commands,[['seek',50]]);assert.deepEqual(state.previews,[]);
  checks.push({name:'hidden geometry preserves valid range input',value:state.value});
  await evaluate('qa.host.style.display="";qa.clear()');

  await evaluate('qa.host.style.width="600px";qa.bar.state.isWheelSeeking=false;qa.playbackTick()');
  const beforeFullscreen=await snapshot();
  assert.equal(beforeFullscreen.marker,'translateX(144px)');
  await evaluate('qa.host.requestFullscreen()', {awaitPromise:true,userGesture:true});
  assert(await evaluate<boolean>('document.fullscreenElement===qa.host'),'Actual Fullscreen API must enter');
  await pause(80);
  await evaluate('qa.playbackTick()');
  state=await snapshot();x=Math.round(state.rect.left+state.rect.width*0.99);
  await mouse('mouseMoved',x,(state.rect.top+state.rect.bottom)/2);
  state=await snapshot();assert.equal(state.fullscreen,true);
  near(state.previews.at(-1)![0],198,200/state.rect.width+0.000001);
  checks.push({name:'actual Fullscreen API 99% hover',viewport:state.viewport,rect:state.rect,preview:state.previews.at(-1)});
  assert.equal(state.marker,'translateX(219px)');
  assert.equal(state.labelWrites,beforeFullscreen.labelWrites);
  assert.deepEqual(state.commands,[]);
  await evaluate('document.exitFullscreen()', {awaitPromise:true});
  await evaluate('qa.playbackTick()');
  state=await snapshot();
  assert.equal(state.fullscreen,false);
  assert.equal(state.marker,'translateX(144px)');
  assert.equal(state.labelWrites,beforeFullscreen.labelWrites);
  checks.push({name:'paused marker follows fullscreen entry and exit',marker:state.marker});

  const report={passed:true,browser:version,checks,
    limits:['Isolated control fixture, not a logged-in NicoNico playback session',
      'CSS zoom and positive transforms tested; browser UI page zoom, Firefox and Safari not tested',
      'Preview rendering is recorded; DOM/CSS/placement implementations remain unchanged']};
  if(process.env.SEEK_GEOMETRY_REPORT)fs.writeFileSync(process.env.SEEK_GEOMETRY_REPORT,JSON.stringify(report,null,2));
  console.log('SEEK_GEOMETRY_BROWSER_PASS '+JSON.stringify(report));
} catch(error) {
  console.error('SEEK_GEOMETRY_BROWSER_FAIL',error);
  console.error('Completed checks: '+JSON.stringify(checks));
  process.exitCode=1;
} finally {
  // Graceful browser shutdown releases child-process file locks on Windows.
  try{
    if(ws?.readyState===WebSocket.OPEN){
      await Promise.race([send('Browser.close'),pause(2000)]);
    }
  }catch{}
  if(chrome && chrome.exitCode===null){
    await new Promise<void>(resolve=>{
      const timer=setTimeout(()=>{chrome?.kill();resolve();},3000);
      chrome!.once('exit',()=>{clearTimeout(timer);resolve();});
    });
  }
  for(const item of pending.values())clearTimeout(item.timer);
  pending.clear();
  try{ws?.close();}catch{}
  try{
    await fs.promises.rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});
  }catch(error){
    console.error('Temporary browser profile cleanup incomplete: '+String(error));
    process.exitCode=1;
  }
}
