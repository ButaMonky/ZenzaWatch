'use strict';
// Task954: offline native Chromium probe of real seekbar hover CSS and placement JS.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const {spawnSync}=require('child_process');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'src/VideoControlBar.js'),'utf8');
const first=source.indexOf('  .seekBarContainer {'),last=source.indexOf('  .seekBarContainer .seekBar * {',first);
assert(first>0&&last>first,'real seekbar CSS missing');
const seekCss=source.slice(first,last);
const placement=fs.readFileSync(path.join(root,'packages/zenza/src/sceneSearch/SceneSearchPlacement.js'),'utf8')
 .split('//===BEGIN===')[1].split('//===END===')[0];
const instrument=[
 'window.probe=(context,x)=>{',
 'const el=document.querySelector("#seek"),seek=el.getBoundingClientRect();',
 'const wrap=document.querySelector(".seekBarContainer").getBoundingClientRect();',
 'const buttons=document.querySelector("#controls").getBoundingClientRect();',
 'const form=document.querySelector(".commentInputPanel").getBoundingClientRect();',
 'const stable=context==="fullscreen"?Math.min(seek.bottom-24,buttons.top):wrap.top-14;',
 'const blocker=context==="fullscreen"&&document.activeElement.id==="draft"?[form]:[];',
 'const r=SceneSearchPlacement.compute({layout:"follow",context,',
 'viewport:{left:0,top:0,width:innerWidth,height:innerHeight},',
 'player:{left:0,top:0,width:innerWidth,height:innerHeight},',
 'seekbar:{left:seek.left,top:seek.top,width:seek.width,height:seek.height},',
 'obstacles:blocker,anchorX:x,imageSize:{width:180,height:90},',
 'requestedScale:100,listScale:100,listOpen:false,previous:null,hold:false,',
 'footerHeight:64,previewAnchorTop:stable});',
 'return {y:r.rect.top,h:r.rect.height,bottom:r.rect.top+r.rect.height,',
 'x:r.rect.left,seekTop:seek.top,seekBottom:seek.bottom,stable,',
 'buttonTop:buttons.top,collide:blocker.length?SceneSearchPlacement.overlap(r.rect,form):0};',
 '};'
].join('');
const html='<!doctype html><html><head><meta charset="utf-8"><style>'+
 'html,body{height:100%;margin:0;background:#09111a;overflow:hidden}'+
 '.videoControlBar{position:fixed;bottom:0;left:0;width:100%;height:55px}'+seekCss+
 '.seekBar{transition:none!important;background:#334455}'+
 'body.full .seekBarContainer{top:auto;bottom:0}'+
 'body.full .seekBar{height:24px;margin-top:0;margin-bottom:-14px}'+
 '.controlItemContainer.left{position:absolute;bottom:8px;left:0;width:150px;height:40px}'+
 'body.full .controlItemContainer.left{bottom:40px}'+
 '.commentInputPanel{position:fixed;bottom:120px;left:50%;transform:translateX(-50%);width:200px;height:50px}'+
 '</style></head><body><div class="videoControlBar">'+
 '<div class="seekBarContainer"><div class="seekBar" id="seek"></div></div>'+
 '<div class="controlItemContainer left" id="controls"></div></div>'+
 '<div class="commentInputPanel"><input id="draft"></div>'+
 '<script>'+placement+';'+instrument+'<\/script></body></html>';
const exe=process.env.CHROME_EXECUTABLE||(
 process.platform==='win32'?path.join(process.env.LOCALAPPDATA||'','Google/Chrome/Application/chrome.exe'):
 ['google-chrome','chromium'].map(name=>{
  const r=spawnSync('which',[name],{encoding:'utf8'});
  return r.status===0?r.stdout.trim():null;
 }).find(Boolean));
assert(exe&&fs.existsSync(exe),'Chrome executable missing');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-task954-'));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let chrome,ws,id=0;const pending=new Map();
async function send(method,params={}){
 const seq=++id;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(seq);reject(Error(method+' timeout'));},15000);
  pending.set(seq,{resolve,reject,timer});ws.send(JSON.stringify({id:seq,method,params}));
 });
}
async function evaluate(code){
 const r=await send('Runtime.evaluate',{expression:code,returnByValue:true});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.text);
 return r.result?.value;
}
(async()=>{
 try{
  chrome=await startChromeCdp(exe,profile);
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
  const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
   ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});
  });
  ws.addEventListener('message',event=>{
   const msg=JSON.parse(event.data),p=pending.get(msg.id);if(!p)return;
   clearTimeout(p.timer);pending.delete(msg.id);
   msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);
  });
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url:'data:text/html;charset=utf-8,'+encodeURIComponent(html)});
  for(let i=0;i<60;i++){
   if(await evaluate('document.readyState==="complete" && !!window.probe'))break;
   await delay(75);
  }
  assert(await evaluate('!!window.probe'),'placement script did not load');
  for(const width of [360,768,1535]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:720,deviceScaleFactor:1,mobile:false});
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:10,y:10,button:'none'});
   const before=await evaluate('window.probe("normal",'+(width/2)+')');
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:width/2,y:before.seekTop+4,button:'none'});
   await delay(40);
   const after=await evaluate('window.probe("normal",'+(width/2)+')');
   assert.notStrictEqual(after.seekTop,before.seekTop,'real CSS hover must move seekbar top');
   assert.strictEqual(after.y,before.y,'normal preview Y jittered at '+width);
   assert.strictEqual(after.h,before.h,'normal preview height jittered at '+width);
   assert(after.bottom<=after.stable-12+.01);
   const positions=[];
   for(const x of [15,width/4,width/2,width*.75,width-15])
    positions.push(await evaluate('window.probe("normal",'+x+')'));
   assert(positions.every(p=>p.y===after.y&&p.h===after.h),
    'seek cursor changed vertical position at '+width);
   console.log('TASK954_CHROME_NORMAL width='+width+' y='+after.y+
    ' h='+after.h+' seekBottomDelta='+(after.seekBottom-before.seekBottom));
  }
  await send('Emulation.setDeviceMetricsOverride',{width:1535,height:720,deviceScaleFactor:1,mobile:false});
  await evaluate('document.body.classList.add("full")');
  const points=[];
  for(const x of [150,350,767,950,1380])
   points.push(await evaluate('window.probe("fullscreen",'+x+')'));
  assert(points.every(p=>p.y===points[0].y&&p.h===points[0].h),
   'idle centered input caused a fullscreen preview jump');
  assert(points.every(p=>p.bottom<=p.buttonTop-12+.01),
   'fullscreen preview is below the control-button safe line');
  await evaluate('document.getElementById("draft").focus()');
  const focused=await evaluate('window.probe("fullscreen",767)');
  assert.strictEqual(focused.y,points[0].y,'focused input changed the preview Y');
  assert.strictEqual(focused.collide,0,'focused input is covered');
  console.log('TASK954_CHROME_FULLSCREEN '+JSON.stringify({points,focused}));
  console.log('TASK954_CHROME_PASS');
 }catch(error){console.error('TASK954_CHROME_FAIL '+error.stack);process.exitCode=1;}
 finally{
  for(const value of pending.values())clearTimeout(value.timer);
  try{ws?.close()}catch(_){}
  try{chrome?.kill()}catch(_){}
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch(_){}
 }
})();
