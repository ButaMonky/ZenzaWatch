'use strict';
// Opt-in real-site QA for MylistPocket; never runs in offline npm test/CI.
// Isolated anonymous Chrome profile. The existing Chrome windows are untouched.
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const root=path.resolve(__dirname,'../..');
const exe=process.env.CHROME_EXECUTABLE||
 path.join(process.env.LOCALAPPDATA||'','Google/Chrome/Application/chrome.exe');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zw-task967-live-'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const pending=new Map(),responses=[];
let chrome,ws,seq=0;
async function send(method,params={}){
 const id=++seq;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},15000);
  pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expr){
 const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
 return r.result?.value;
}
function metrics(){
 const p=document.querySelector('#mylistPocket-popup');
 const card=p?.querySelector('.mpp-video-card');
 const owner=card?.querySelector('.mpp-card-owner');
 const icon=card?.querySelector('.mpp-card-owner-icon');
 const button=card?.querySelector('.mpp-card-info');
 const name=card?.querySelector('.mpp-card-owner-name');
 const counters=card?.querySelector('.mpp-card-counters');
 const a=card?.getBoundingClientRect(),b=button?.getBoundingClientRect(),c=owner?.getBoundingClientRect();
 return {
  popup:!!p?.classList.contains('show'),
  cardCount:p?.querySelectorAll('.mpp-video-card').length||0,
  videoId:card?.dataset.watchId,
  title:card?.querySelector('.mpp-card-title')?.textContent?.slice(0,105),
  likes:counters?.textContent?.match(/いいね:\s*[\d,.万億]+|いいね:\s*不明/)?.[0],
  ownerName:name?.textContent,
  ownerLink:owner?.getAttribute('href')||'',
  icon:icon?.getAttribute('src')||'',
  avatarLoaded:!!icon?.naturalWidth,
  infoAtRight:!!(a&&b&&c&&b.right<=a.right+0.5&&a.right-b.right<10&&c.right<=b.left),
  ownerIconSize:icon?[Math.round(icon.getBoundingClientRect().width),Math.round(icon.getBoundingClientRect().height)]:null,
  ownerStyle:owner?getComputedStyle(owner).color:null,
  gold:!!card?.classList.contains('is-adDecoration-gold'),
  informationButton:button?.textContent,
  state:card?.querySelector('.mpp-card-state')?.textContent
 };
}
(async()=>{
 try {
  if(!fs.existsSync(exe))throw Error('Chrome unavailable');
  const lodash=fs.readFileSync(path.join(root,'node_modules/lodash/lodash.min.js'),'utf8');
  const pocket=fs.readFileSync(path.join(root,'dist/MylistPocket.user.js'),'utf8');
  chrome=await startChromeCdp(exe,profile,{waitMs:45000});
  console.log('LAUNCHED_ISOLATED_CHROME_PID='+chrome.pid);
  let port;
  for(let i=0;i<35&&!port;i++){
   try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0]}
   catch(e){if(!['EBUSY','EPERM'].includes(e.code))throw e;await wait(100);}
  }
  if(!port)throw Error('Chrome CDP port unavailable');
  const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
   ws.addEventListener('open',resolve,{once:true});
   ws.addEventListener('error',reject,{once:true});
  });
  ws.addEventListener('message',ev=>{
   const msg=JSON.parse(ev.data);
   if(msg.id){
    const p=pending.get(msg.id);if(!p)return;
    clearTimeout(p.timer);pending.delete(msg.id);
    msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);
   }else if(msg.method==='Network.responseReceived'){
    const r=msg.params.response||{};
    if(/getthumbinfo|\/v1\/videos|\/decoration/.test(r.url||'')){
     if(responses.length<25)responses.push({url:new URL(r.url).pathname,status:r.status});
    }
   }
  });
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Page.setBypassCSP',{enabled:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:950,deviceScaleFactor:1,mobile:false});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:lodash});
  const inject='(function(){const run=()=>{'+pocket+'};'+
    'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();})();';
  await send('Page.addScriptToEvaluateOnNewDocument',{source:inject});
  await send('Page.navigate',{url:'https://www.nicovideo.jp/watch/sm46923344'});
  let started=false;
  for(let i=0;i<120;i++){
   const status=await evaluate('!!window.MylistPocket?.debug?.hoverMenu');
   if(status){started=true;break;}
   await wait(250);
  }
  if(!started)throw Error('MylistPocket did not initialize');
  await evaluate('window.MylistPocket.debug.hoverMenu.emit("info","sm46923344")');
  let result={};
  for(let i=0;i<110;i++){
   result=await evaluate('('+metrics.toString()+')()');
   if(i%25===0)console.log('PROGRESS '+i+' '+JSON.stringify(result));
   if(result.cardCount===1&&result.likes&&!result.likes.includes('不明')&&
      result.ownerName==='say2'&&result.infoAtRight&&result.gold){
    break;
   }
   await wait(350);
  }
  console.log('LIVE_RESULT '+JSON.stringify(result));
  console.log('LIVE_API_RESPONSES '+JSON.stringify(responses));
  if(result.cardCount===1){
    const dest=path.resolve(root,'../handoff/task967-mylistpocket-like-owner-live.png');
    await evaluate('document.querySelector(".mpp-video-card").scrollIntoView({block:"center"})');
    await wait(450);
    const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.mkdirSync(path.dirname(dest),{recursive:true});
    fs.writeFileSync(dest,Buffer.from(shot.data,'base64'));
    console.log('SCREENSHOT_SAVED '+dest);
  }
  if(result.cardCount!==1||result.likes.includes('不明')||!result.likes||
      result.ownerName!=='say2'||!result.infoAtRight||!result.gold){
    throw Error('Live MylistPocket checks did not all pass');
  }
  // Research case: getthumbinfo lacks owner, nvapi marks owner hidden,
  // but NicoAd publicly returns the uploader identity. Do not erase it.
  const diagnostic=await evaluate(`(()=>{
    const v=window.MylistPocket?.debug?.view;
    const target=document.querySelector('#mylistPocket-popup .description');
    if(!v||!target)return false;
    v._createDescription(target,'投稿者情報補完の確認: sm46778748');
    return true;
  })()`);
  if(!diagnostic)throw Error('Cannot render ownerless video');
  let missing={};
  for(let i=0;i<85;i++){
    missing=await evaluate('('+metrics.toString()+')()');
    if(missing.videoId==='sm46778748' &&
      missing.likes==='いいね: 0' &&
      missing.ownerLink.endsWith('/user/145346240') &&
      missing.ownerName && missing.ownerName!=='(投稿者情報なし)'){
      break;
    }
    await wait(350);
  }
  // Task968: this known owner has no currently readable derived CDN
  // avatar (HTTP404), so the visible card must settle on a blank fallback
  // instead of remaining on a broken image or retrying indefinitely.
  for(let i=0;i<36;i++){
    missing=await evaluate('('+metrics.toString()+')()');
    if(missing.icon.endsWith('/defaults/blank.jpg') && missing.avatarLoaded){break;}
    await wait(260);
  }
  console.log('OWNERLESS_VIDEO_RESULT '+JSON.stringify(missing));
  if(missing.videoId!=='sm46778748' ||
     missing.likes!=='いいね: 0' ||
     !missing.ownerLink.endsWith('/user/145346240') ||
     !missing.ownerName || missing.ownerName==='(投稿者情報なし)' ||
     !missing.icon.endsWith('/defaults/blank.jpg') || !missing.avatarLoaded){
    throw Error('NicoAd owner supplement / finite icon fallback failed in the live page');
  }
  const recoveredPath=path.resolve(root,'../handoff/task967-mylistpocket-owner-supplement-live.png');
  await evaluate('document.querySelector(".mpp-video-card")?.scrollIntoView({block:"center"})');
  await wait(500);
  fs.writeFileSync(recoveredPath,Buffer.from((await send(
    'Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  console.log('OWNERLESS_SCREENSHOT '+recoveredPath);
  console.log('TASK967_LIVE_CHROME_PASS');
 }catch(e){
  console.error('TASK967_LIVE_CHROME_FAIL '+e.stack);
  process.exitCode=1;
 }finally{
  for(const p of pending.values())clearTimeout(p.timer);
  try{ws?.close()}catch(_){}
  const pid=chrome?.pid;
  try{chrome?.kill()}catch(_){}
  await wait(500);
  if(pid && process.platform==='win32'){
   const r=spawnSync('taskkill',['/PID',String(pid),'/T','/F'],{encoding:'utf8',timeout:6000});
   console.log('BROWSER_EXIT '+JSON.stringify({pid,code:r.status}));
  }
  let cleaned=false;
  for(let i=0;i<8&&!cleaned;i++){
   try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:150});cleaned=true}
   catch(e){await wait(450)}
  }
  console.log('PROFILE_CLEANUP '+JSON.stringify({cleaned,exists:fs.existsSync(profile)}));
 }
})();
