'use strict';
// Task947: use real toolbar tooltip rules in isolated headless Chrome at narrow widths.
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'src/VideoControlBar.js'),'utf8');
function extract(startMark,endMark){
 const start=source.indexOf(startMark),end=source.indexOf(endMark,start);
 assert(start>=0 && end>start,startMark+' CSS not found');
 return source.slice(start,end);
}
const css=extract('  .controlButton {','  .settingPanelSwitch {')+
  extract('  .playbackRateMenu {','  .playbackRateSelectMenu {');
const label='再生速度（上げる: Shift + . / 下げる: Shift + ,）';
const html='<!doctype html><html><head><meta charset="utf-8"><style>'+
 'html,body{margin:0;height:100%;overflow:hidden;}' +
 '.videoControlBar{position:fixed;left:0;bottom:0;width:100vw;height:64px;'+
 'background:#181818;will-change:transform;overflow:visible;}' + css +
 '</style></head><body class="is-mouseMoving">'+
 '<div class="videoControlBar"><div class="playbackRateMenu controlButton" '+
 'data-shortcut-hint="speed" style="position:absolute;bottom:0;left:65%">'+
 '<div class="controlButtonInner">1.0×</div><span class="tooltip">'+label+
 '</span></div></div></body></html>';
const executable=process.env.CHROME_EXECUTABLE||
 (process.platform==='win32'?path.join(process.env.LOCALAPPDATA||'',
  'Google/Chrome/Application/chrome.exe'):
 ['google-chrome','chromium','chromium-browser'].map(name=>{
   const r=spawnSync('which',[name],{encoding:'utf8'});
   return r.status===0?r.stdout.trim():null;
 }).find(Boolean));
assert(executable && fs.existsSync(executable),'Chrome executable missing');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-task947-'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let chrome,ws,seq=0;const pending=new Map();
async function send(method,params={}){
 const id=++seq;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},12000);
  pending.set(id,{resolve,reject,timer});
  ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const result=await send('Runtime.evaluate',{expression,returnByValue:true});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
 return result.result?.value;
}
(async()=>{
 try{
  chrome=await startChromeCdp(executable,profile);
  const file=path.join(profile,'DevToolsActivePort');
  const port=fs.readFileSync(file,'utf8').split(/\r?\n/)[0];
  const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',
    {method:'PUT'})).json();
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    ws.addEventListener('open',resolve,{once:true});
    ws.addEventListener('error',reject,{once:true});
  });
  ws.addEventListener('message',event=>{
    const msg=JSON.parse(event.data),item=pending.get(msg.id);
    if(!item)return;
    clearTimeout(item.timer);pending.delete(msg.id);
    msg.error?item.reject(Error(JSON.stringify(msg.error))):item.resolve(msg.result);
  });
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url:'data:text/html;charset=utf-8,'+encodeURIComponent(html)});
  for(let i=0;i<40;i++){
    if(await evaluate('document.readyState==="complete" && !!document.querySelector(".playbackRateMenu")'))break;
    await wait(80);
  }
  const measurements=[];
  for(const width of [1280,640,360,300]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:720,deviceScaleFactor:1,mobile:false});
    const pos=await evaluate(`(()=>{const r=document.querySelector('.playbackRateMenu').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x,y:pos.y,button:'none'});
    const info=await evaluate(`(()=>{const t=document.querySelector('.playbackRateMenu .tooltip'),
      b=document.querySelector('.playbackRateMenu');
      const r=t.getBoundingClientRect(),v=b.getBoundingClientRect();
      return {width:innerWidth,display:getComputedStyle(t).display,
        pointer:getComputedStyle(t).pointerEvents,
        box:{left:r.left,right:r.right,top:r.top,bottom:r.bottom},
        button:{left:v.left,right:v.right,top:v.top},
        hit:document.elementFromPoint(v.left+v.width/2,v.top+v.height/2)?.className,
        text:t.textContent};})()`);
    measurements.push(info);
    assert.strictEqual(info.display,'block',JSON.stringify(info));
    assert.strictEqual(info.pointer,'none',JSON.stringify(info));
    assert(info.box.left>=-0.5 && info.box.right<=width+0.5,JSON.stringify(info));
    assert(info.box.bottom<info.button.top,JSON.stringify(info));
    assert(info.hit==='controlButtonInner' || String(info.hit).includes('playbackRateMenu'),JSON.stringify(info));
    assert.strictEqual(info.text,label);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:15,y:15,button:'none'});
  }
  // An unusually long user-customized combination must wrap without covering
  // the speed button or escaping the narrow viewport.
  await send('Emulation.setDeviceMetricsOverride',{width:300,height:720,deviceScaleFactor:1,mobile:false});
  const long='再生速度（上げる: Ctrl + Alt + Shift + Num9 / 下げる: Ctrl + Alt + Shift + Num1）';
  await evaluate('document.querySelector(".playbackRateMenu .tooltip").textContent='+JSON.stringify(long));
  const pos=await evaluate(`(()=>{const b=document.querySelector('.playbackRateMenu').getBoundingClientRect();return {x:b.left+20,y:b.top+15};})()`);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x,y:pos.y,button:'none'});
  const wrapped=await evaluate(`(()=>{const e=document.querySelector('.playbackRateMenu .tooltip');
    const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,text:e.textContent};})()`);
  assert(wrapped.left>=-0.5&&wrapped.right<=300.5,JSON.stringify(wrapped));
  assert(wrapped.height>22,JSON.stringify(wrapped));
  assert.strictEqual(wrapped.text,long);
  console.log('TASK947_CHROME_PASS '+JSON.stringify({measurements,wrapped}));
 }catch(error){console.error('TASK947_CHROME_FAIL '+error.message);process.exitCode=1;}
 finally{
   for(const x of pending.values())clearTimeout(x.timer);
   try{ws?.close()}catch(_){}
   try{chrome?.kill()}catch(_){}
   try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch(_){}
 }
})();
