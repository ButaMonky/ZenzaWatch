'use strict';
// Task939: offline real Chrome layout/hit-test of the actual source tooltip CSS.
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'src/VideoControlBar.js'),'utf8');
const start=source.indexOf('.videoControlBar .volumeControl {');
const end=source.indexOf('.videoControlBar .volumeRange {',start);
assert(start>0&&end>start,'volume CSS source missing');
const css=source.slice(start,end);
const escapeHTML=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
const html='<!doctype html><html><head><meta charset="utf-8"><style>'+
  'html,body{margin:0;padding:0;height:100%;}' +
  '.videoControlBar{position:absolute;bottom:0;left:0;width:100%;' +
  'height:55px;display:flex;justify-content:center;align-items:center;' +
  'background:#181818;}' +
  '.volumeRange{width:64px;height:8px;}'+css+'</style></head>' +
  '<body class="is-mouseMoving"><div class="videoControlBar">' +
  '<div class="volumeControl" data-shortcut-hint="volume">' +
  '<input type="range" class="volumeRange" value="0.5" min="0.01" max="1" ' +
  'step="any" aria-label="音量調整"><span class="tooltip">' +
  escapeHTML('音量調整（上げる: Shift + ↑ / 下げる: Shift + ↓）') +
  '</span></div></div></body></html>';
const executable=process.env.CHROME_EXECUTABLE||
 (process.platform==='win32'?path.join(process.env.LOCALAPPDATA||'',
  'Google/Chrome/Application/chrome.exe'):
  ['google-chrome','chromium','chromium-browser'].map(name=>{
    const result=spawnSync('which',[name],{encoding:'utf8'});
    return result.status===0?result.stdout.trim():null;
  }).find(Boolean));
assert(executable&&fs.existsSync(executable),'Chrome executable not found');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-task939-'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let chrome,ws,id=0;
const pending=new Map();
async function send(method,params={}){
 const seq=++id;
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{pending.delete(seq);reject(Error(method+' timed out'));},12000);
  pending.set(seq,{resolve,reject,timeout});
  ws.send(JSON.stringify({id:seq,method,params}));
 });
}
async function evaluate(expression){
 const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
 return result.result?.value;
}

(async()=>{
 try{
  chrome=await startChromeCdp(executable,profile);
  const portFile=path.join(profile,'DevToolsActivePort');
  const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];
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
    clearTimeout(item.timeout);pending.delete(msg.id);
    msg.error?item.reject(Error(JSON.stringify(msg.error))):item.resolve(msg.result);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate',{url:'data:text/html;charset=utf-8,'+encodeURIComponent(html)});
  for(let i=0;i<40;i++){
    if(await evaluate('document.readyState==="complete" && !!document.querySelector(".volumeControl")'))break;
    await wait(80);
  }
  const snapshots=[];
  for(const width of [1280,640,360,300]){
    await send('Emulation.setDeviceMetricsOverride',{
      width,height:720,deviceScaleFactor:1,mobile:false
    });
    const input=await evaluate(`(()=>{const r=document.querySelector('.volumeRange').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:input.x,y:input.y,button:'none'});
    const info=await evaluate(`(()=>{
      const tip=document.querySelector('.volumeControl .tooltip');
      const input=document.querySelector('.volumeRange');
      const a=tip.getBoundingClientRect(),b=input.getBoundingClientRect();
      return {
        width:window.innerWidth,
        display:getComputedStyle(tip).display,
        pointerEvents:getComputedStyle(tip).pointerEvents,
        tip:{left:a.left,right:a.right,bottom:a.bottom,width:a.width},
        input:{top:b.top,left:b.left,right:b.right},
        hit:document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)?.className,
        value:input.value,
        text:tip.textContent
      };
    })()`);
    assert.strictEqual(info.width,width);
    assert.strictEqual(info.display,'block',JSON.stringify(info));
    assert.strictEqual(info.pointerEvents,'none',JSON.stringify(info));
    assert(info.tip.left>=0&&info.tip.right<=width+0.5,JSON.stringify(info));
    assert(info.tip.bottom<info.input.top,JSON.stringify(info));
    assert.strictEqual(info.hit,'volumeRange',JSON.stringify(info));
    assert.strictEqual(info.value,'0.5');
    assert(info.text.includes('Shift + ↑'));
    snapshots.push({viewport:width,tipWidth:Math.round(info.tip.width),visible:true});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:20,y:30,button:'none'});
  }
  await evaluate('document.body.classList.remove("is-mouseMoving")');
  assert.strictEqual(await evaluate('getComputedStyle(document.querySelector(".tooltip")).display'),'none');
  await evaluate('document.querySelector(".volumeRange").focus()');
  assert.strictEqual(await evaluate('getComputedStyle(document.querySelector(".tooltip")).display'),'block');
  console.log('TASK939_CHROME_PASS '+JSON.stringify(snapshots));
 }catch(error){
  console.error('TASK939_CHROME_FAIL '+error.stack);
  process.exitCode=1;
 }finally{
  for(const p of pending.values())clearTimeout(p.timeout);
  try{ws?.close()}catch(_){}
  try{chrome?.kill()}catch(_){}
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch(_){}
 }
})();
