'use strict';
// Task956: isolated native Chromium pixel-space regression. No NicoNico requests.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const {spawnSync}=require('child_process');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const root=path.resolve(__dirname,'../..');
const body=file=>fs.readFileSync(path.join(root,file),'utf8')
  .split('//===BEGIN===')[1].split('//===END===')[0];
const placement=body('packages/zenza/src/sceneSearch/SceneSearchPlacement.js');
const bridge=body('packages/zenza/src/sceneSearch/SceneSearchIntegrationBridge.js');
const html='<!DOCTYPE html><html><head><meta charset="UTF-8"><style>'+
 'html,body{margin:0;height:100%;background:#101722;overflow:hidden}'+
 '.zenzaPlayerContainer{position:fixed;inset:0}'+
 '.videoControlBar{position:absolute;bottom:0;width:100%;height:55px}'+
 '.seekBar{position:absolute;bottom:0;left:0;width:100%;height:24px}'+
 '.controlItemContainer{position:absolute;bottom:0;height:40px}'+
 '.controlItemContainer.center{left:50%;width:300px;transform:translateX(-50%)}'+
 '.controlItemContainer.right{right:0;width:190px}'+
 '.scalingUI{height:40px;transform:translateY(-46px) scale(1.25);transform-origin:top center}'+
 '.controlButton{display:inline-block;position:relative;width:38px;height:32px;background:#437393;pointer-events:auto}'+
 '.zenzaScenePreviewPortal{position:fixed;inset:0;pointer-events:none;z-index:2147483000}'+
 '.zenzaSceneSharedPreview{position:absolute;box-sizing:border-box;border:1px solid #7886a7;'+
 'pointer-events:none;background:#20334855;padding:4px}'+
 '</style></head><body><div class="zenzaPlayerContainer" id="container">'+
 '<div class="videoControlBar"><div class="seekBar" id="seek"></div>'+
 '<div class="controlItemContainer center"><div class="scalingUI">'+
 '<div class="controlButton" id="centerButton"></div></div></div>'+
 '<div class="controlItemContainer right"><div class="scalingUI">'+
 '<div class="controlButton" id="rightButton"></div></div></div></div>'+
 '</div><div class="zenzaScenePreviewPortal" id="portal">'+
 '<section class="zenzaSceneSharedPreview" id="card"></section></div>'+
 '<script>'+placement+';'+bridge+';'+
 'window.check=function(x,mode="fullscreen"){' +
 'const B=Object.create(SceneSearchIntegrationBridge.prototype);'+
 'B.document=document;B.container=document.querySelector("#container");'+
 'B.seekElement=document.querySelector("#seek");'+
 'B._modernPortal=document.querySelector("#portal");'+
 'B._placementContext=mode;B._placementGeometry=null;'+
 'B._placementHold=false;B._placementResult=null;B._seekClientX=x;'+
 'B._classes={Placement:SceneSearchPlacement};'+
 'B.config={resolveSceneSearch:()=>({scale:100,listOpen:false,listScale:100})};'+
 'B.interaction={holdingPreview:false};'+
 'const card={root:document.querySelector("#card"),fit:()=>{}};'+
 'B._placeModern(card,{layoutId:"follow",pinned:false});'+
 'const rr=card.root.getBoundingClientRect();'+
 'const buttons=[...document.querySelectorAll(".controlButton")];'+
 'const br=buttons.map(b=>b.getBoundingClientRect());'+
 'return {anchor:B._placementGeometry.previewAnchorTop,card:{top:rr.top,bottom:rr.bottom,'+
 'height:rr.height},buttonTop:Math.min(...br.map(v=>v.top)),'+
 'rowTop:Math.min(...[...document.querySelectorAll(".controlItemContainer")].map(v=>v.getBoundingClientRect().top))};'+
 '};</script></body></html>';
const exe=process.env.CHROME_EXECUTABLE||(
 process.platform==='win32'?path.join(process.env.LOCALAPPDATA||'','Google/Chrome/Application/chrome.exe'):
 ['google-chrome','chromium'].map(name=>{
  const r=spawnSync('which',[name],{encoding:'utf8'});
  return r.status===0?r.stdout.trim():null;
 }).find(Boolean));
assert(exe&&fs.existsSync(exe),'Chrome executable missing');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-task956-'));
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
let chrome,ws,sequence=0;const pending=new Map();
async function send(method,params={}){
 const id=++sequence;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},12000);
  pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const result=await send('Runtime.evaluate',{expression,returnByValue:true});
 if(result.exceptionDetails)throw Error(result.exceptionDetails.text);
 return result.result?.value;
}
(async()=>{
 try{
  chrome=await startChromeCdp(exe,profile);
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
  const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((ok,fail)=>{
   ws.addEventListener('open',ok,{once:true});
   ws.addEventListener('error',fail,{once:true});
  });
  ws.addEventListener('message',event=>{
   const msg=JSON.parse(event.data),p=pending.get(msg.id);
   if(!p)return;
   clearTimeout(p.timer);pending.delete(msg.id);
   msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);
  });
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url:'data:text/html;charset=utf-8,'+encodeURIComponent(html)});
  for(let i=0;i<50;i++){
   if(await evaluate('document.readyState==="complete" && !!window.check'))break;
   await pause(100);
  }
  assert(await evaluate('!!window.check'),'real bridge did not load in Chrome');
  const results=[];
  for(const width of [360,768,1280,1920]){
   for(const [mode,transform] of [['normal','translateY(0) scale(1)'],
     ['fullscreen','translateY(-46px) scale(1.25)'],
     ['fullscreen','translateY(-62px) scale(1.5)']]){
    await send('Emulation.setDeviceMetricsOverride',
      {width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('document.querySelectorAll(".scalingUI").forEach(x=>x.style.transform='+JSON.stringify(transform)+')');
    const baseline=await evaluate('window.check('+Math.round(width/2)+','+JSON.stringify(mode)+')');
    const childTop=baseline.buttonTop;
    if(mode==='fullscreen'){
      // The scaled button glyph is ABOVE its wrapper: original Task954
      // measured only the wrapper and placed the preview over the buttons.
      assert(childTop<baseline.rowTop-5,'fixture failed to create overflowing control');
      assert(baseline.card.bottom<=childTop-11.5,
        'preview overlaps visible control glyphs: '+JSON.stringify({width,mode,transform,baseline}));
    }
    const moved=await evaluate('window.check('+(width-40)+','+JSON.stringify(mode)+')');
    assert.strictEqual(moved.card.top,baseline.card.top,
      'vertical preview position changed while moving the mouse');
    assert.strictEqual(moved.card.height,baseline.card.height,
      'preview height changed while moving the mouse');
    results.push({width,mode,transform,visualGap:Math.round(childTop-baseline.card.bottom)});
   }
  }
  console.log('TASK956_CHROME_PASS '+JSON.stringify(results));
 }catch(error){console.error('TASK956_CHROME_FAIL '+error.stack);process.exitCode=1;}
 finally{
  for(const item of pending.values())clearTimeout(item.timer);
  try{ws?.close()}catch(_){}
  try{chrome?.kill()}catch(_){}
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch(_){}
 }
})();
