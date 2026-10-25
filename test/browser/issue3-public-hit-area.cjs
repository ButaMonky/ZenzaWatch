'use strict';
// Offline Chromium hit testing of actual public fullscreen source CSS.
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const {spawn,spawnSync}=require('child_process'),{pathToFileURL}=require('url');
const ROOT=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(ROOT,'src/VideoControlBar.js'),'utf8');
const marker="{className: 'screenMode for-screen-full videoControlBar'";
const end=source.indexOf(marker),start=source.lastIndexOf('util.addStyle('+String.fromCharCode(96),end);
assert(start>=0&&end>start,'fullscreen CSS marker missing');
const snippet=source.slice(start+'util.addStyle('.length+1,end);
const css=snippet.slice(0,snippet.lastIndexOf(String.fromCharCode(96)));
assert(css.includes(':where(.videoControlBar .controlItemContainer.right > .scalingUI) > .controlButton'));
const exe=process.env.CHROME_EXECUTABLE||(
 process.platform==='win32'?
 path.join(process.env.LOCALAPPDATA||'','Google/Chrome/Application/chrome.exe'):
 ['google-chrome','chromium','chromium-browser'].map(name=>{
   const result=spawnSync('which',[name],{encoding:'utf8'});
   return result.status===0?result.stdout.trim():null;
 }).find(Boolean));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zw-issue3-public-'));
let chrome,ws,seq=0;
const pending=new Map(),stats={redReproduced:false,seekPoints:0,buttons:0,menus:0};
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
async function send(method,params={}){
 const id=++seq;return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP '+method+' timeout'));},20000);
  pending.set(id,{resolve,reject,timer});
  ws.send(JSON.stringify({id,method,params}));
 });
}
async function evalValue(expression){
 const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error('Runtime '+r.exceptionDetails.text);
 return r.result?.value;
}
const move=(x,y)=>send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'none'});
async function click(x,y){
 await move(x,y);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});
}
const center=async selector=>evalValue("(()=>{const r=document.querySelector("+JSON.stringify(selector)+").getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];})()");
const hit=(x,y)=>evalValue("document.elementFromPoint("+x+","+y+")?.className");

async function run(){
 check(fs.existsSync(exe),'Chrome not installed: '+exe);
 chrome=spawn(exe,['--headless=new','--disable-background-networking','--disable-extensions',
  '--no-first-run',...(process.platform==='linux'?['--no-sandbox','--disable-dev-shm-usage']:[]),
  '--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],
  {windowsHide:true,stdio:'ignore'});
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<100&&!fs.existsSync(portFile);i++)await sleep(150);
 check(fs.existsSync(portFile),'Chrome CDP port unavailable');
 const port=fs.readFileSync(portFile,'utf8').split('\n')[0];
 const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
 ws.addEventListener('message',event=>{
  const m=JSON.parse(event.data),p=pending.get(m.id);if(!p)return;
  pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
 });
 await send('Page.enable');await send('Runtime.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:pathToFileURL(path.join(ROOT,'test/fixtures/issue3-public-hit-area.html')).href});
 for(let i=0;i<50;i++){if(await evalValue('document.readyState==="complete"&&!!window.evidence'))break;await sleep(80)}
 check(await evalValue('!!window.evidence'),'Issue #3 fixture did not load');
 await evalValue("(()=>{const s=document.createElement('style');s.id='public-issue3-style';s.textContent="+JSON.stringify(css)+";document.head.append(s);return true})()");
 const geometry="(()=>[...document.querySelectorAll('.seekBarContainer,.controlItemContainer.right,.controlButton')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}) )()";
 const expectedGeometry=JSON.stringify(await evalValue(geometry));
 await evalValue("document.querySelector('#public-issue3-style').disabled=true");
 await move(30,30);await move(1260,718);
 const red=await hit(1260,718);
 check(red!=='seekRange','Original unpatched CSS unexpectedly passes seek click');
 stats.redReproduced=true;
 await evalValue("document.querySelector('#public-issue3-style').disabled=false");
 check(expectedGeometry===JSON.stringify(await evalValue(geometry)),'CSS repair changed control geometry');
 await move(30,30);await move(1260,718);
 check((await hit(1260,718))==='seekRange','Final 5% remains blocked');
 check((await evalValue('evidence.moves.length'))>0,'Seek mousemove was lost');
 check((await evalValue('getComputedStyle(document.querySelector(".seekBarToolTip")).visibility'))==='visible','Seek preview did not appear');
 await click(1260,718);
 check((await evalValue('evidence.inputs.at(-1)||0'))>570,'Native range failed to seek near the end');
 await move(640,718);await send('Input.dispatchMouseEvent',{type:'mousePressed',x:640,y:718,button:'left',buttons:1,clickCount:1});
 for(let i=1;i<=8;i++)await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:640+620*i/8,y:718,button:'left',buttons:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:1260,y:718,button:'left',buttons:0,clickCount:1});
 check((await evalValue('evidence.inputs.at(-1)||0'))>570,'Drag-to-end failed');

 const z=()=>evalValue("(()=>{const a=s=>getComputedStyle(document.querySelector(s)).zIndex;return [a('.seekBarContainer'),a('.controlItemContainer.right')]})()");
 check(JSON.stringify(await z())==='["300","310"]','Task101 z-index repair changed');
 for(const [selector,expected] of [
  ['.settingPanelSwitch','settingPanel'],['.fullscreenSwitch','fullscreen'],
  ['.commentHistorySwitch','toggle-commentHistoryPanel'],
  ['.screenFilterSwitch','toggle-screenFilterPanel']]){
  const [x,y]=await center(selector);await click(x,y);
  check((await evalValue('evidence.commands.at(-1)'))===expected,'Button '+selector+' lost pointer target');
  stats.buttons++;
 }
 await evalValue("document.querySelector('.videoServerTypeMenu').focus()");
 const pointers=await evalValue("(()=>{const b=document.querySelector('.videoServerTypeMenu');return [getComputedStyle(b).pointerEvents,getComputedStyle(b.querySelector('.zenzaPopupMenu')).pointerEvents]})()");
 check(JSON.stringify(pointers)==='["none","auto"]','Focus-menu pointer ownership changed');
 const [mx,my]=await center('[data-command="quality"]');await click(mx,my);
 check(await evalValue('evidence.commands.at(-1)')==='quality','Popup menu click was lost');
 stats.menus++;
 await evalValue("document.querySelector('div.videoControlBar').classList.add('is-menuOpen')");
 const menuZ=await z();
 check(menuZ[1]==='320','Open menu no longer above seekbar: '+JSON.stringify(menuZ)+' '+await evalValue('document.querySelector("div.videoControlBar").className'));
 check(await evalValue('getComputedStyle(document.querySelector(".controlItemContainer.right")).pointerEvents')==='none',
  'Transparent wrapper intercepts clicks when menu-open');
 await move(30,30);await move(1260,718);
 check((await hit(1260,718))==='seekRange','Menu-open class restores Issue #3');
 // Reporter proposal re-enables hit testing on the entire parent when a menu is open.
 // Demonstrate the resulting regression, then remove this negative-control rule.
 await evalValue("(()=>{const s=document.createElement('style');s.id='proposed-menu-pointer-override';s.textContent='.videoControlBar.is-menuOpen .controlItemContainer.right {pointer-events:auto}';document.head.append(s)})()");
 await move(30,30);await move(1260,718);
 check((await hit(1260,718))!=='seekRange','Reporter proposal did not reproduce the menu-open regression');
 await evalValue("document.querySelector('#proposed-menu-pointer-override').remove()");
 await move(30,30);await move(1260,718);
 check((await hit(1260,718))==='seekRange','Recovery from proposed rule failed');
 stats.reporterOverrideRegressionConfirmed=true;
 await evalValue("document.querySelector('div.videoControlBar').classList.remove('is-menuOpen');document.activeElement.blur()");
 await evalValue("document.querySelector('#public-issue3-style').disabled=true;document.querySelector('#full').disabled=true");
 check(await evalValue('getComputedStyle(document.querySelector(".controlItemContainer.right")).pointerEvents')==='auto',
  'Non-fullscreen pointer behavior changed');
 await evalValue("document.querySelector('#full').disabled=false;document.querySelector('#public-issue3-style').disabled=false");
 for(const width of [960,1280,1920,2560]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:720,deviceScaleFactor:1,mobile:false});
  for(const scale of [0.75,1,1.25,1.5,2]){
   await evalValue("(()=>{document.documentElement.style.setProperty('--zenza-ui-scale',"+JSON.stringify(scale)+");document.documentElement.style.setProperty('--zenza-control-bar-height','"+(40*scale)+"px');return true})()");
   for(const f of [0.9,0.95,0.99,0.999])for(const dy of [1,3,5]){
    const x=Math.min(width-1,width*f),y=720-dy;
    await move(30,30);await move(x,y);
    const target=await hit(x,y);
    check(target==='seekRange','hit target '+JSON.stringify({width,scale,x,y,target}));
    await click(x,y);
    const v=Number(await evalValue("document.querySelector('.seekRange').value"));
    check(Math.abs(v-600*x/width)<=5,'range value '+JSON.stringify({width,scale,x,y,v}));
    stats.seekPoints++;
   }
  }
 }
 check(stats.seekPoints===240,'matrix coverage mismatch');
 console.log('ISSUE3_PUBLIC_CHROMIUM_PASS '+JSON.stringify(stats));
}
(async()=>{
 try{await run()}
 catch(e){console.error('ISSUE3_PUBLIC_CHROMIUM_FAIL '+e.stack);process.exitCode=1}
 finally{
  for(const item of pending.values())clearTimeout(item.timer);
  try{ws?.close()}catch(_){}
  try{chrome?.kill()}catch(_){}
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:80})}catch(_){}
 }
})();
