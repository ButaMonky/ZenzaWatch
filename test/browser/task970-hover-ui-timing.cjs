'use strict';
// Real Chromium checks of production timer methods and production UI CSS. Offline only.
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {extract,read}=require('../helpers/extractSource');
const {startChromeCdp}=require('../helpers/startChromeCdp');
// Keep production helper calls coherent as the View evolves. The constructor
// is intentionally skipped; only external collaborators are fixture stubs.
const viewSource=extract('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialogView');
const bar=read('src/VideoControlBar.js'),dialog=read('src/NicoVideoPlayerDialog.js');
function range(source,begin,end){const a=source.indexOf(begin),b=source.indexOf(end,a);assert(a>=0&&b>a,begin);return source.slice(a,b);}
const tick=String.fromCharCode(96),end=dialog.indexOf("className: 'videoHoverMenu'");
const a=dialog.lastIndexOf('util.addStyle('+tick,end),b=dialog.lastIndexOf(tick+', {',end);
assert(a>=0&&b>a);
const css=range(bar,'  .controlButton {','  .settingPanelSwitch {')+
 range(bar,'.videoControlBar .volumeControl {','.videoControlBar .volumeRange {')+
 dialog.slice(a+'util.addStyle('.length+1,b);
const boot=`window.Emitter=class{};window.ClassList=e=>e.classList;window.util={StyleSwitcher:{update(){}}};window.Fullscreen={now:()=>false};
${viewSource}
const host=document.querySelector('#player');window.view=Object.assign(Object.create(NicoVideoPlayerDialogView.prototype),{
 addClass(c){host.classList.add(c)},removeClass(c){host.classList.remove(c)},
 _setThumbnail(){},_clearClass(){},_updateScreenModeStyle(){},
 _$dialog:[document.querySelector('#dialog')],_$playerContainer:[host],
 _$body:{raf:{addClass(){},removeClass(){}}},_state:{screenMode:'normal'}});
let mouseTimer;host.addEventListener('mousemove',()=>{
 view._onMouseMove();clearTimeout(mouseTimer);mouseTimer=setTimeout(()=>view._onMouseMoveEnd(),400);
});window.drive=()=>host.dispatchEvent(new MouseEvent('mousemove',{bubbles:true}));
window.sleep=ms=>new Promise(r=>setTimeout(r,ms));`;
const html='<!doctype html><meta charset="utf-8"><style>'+css+
 'html,body{margin:0;width:100%;height:100%;}#player{position:fixed;inset:0;}'+
 '.videoControlBar{position:absolute;left:0;right:0;bottom:0;height:64px;}'+
 '.playbackRateMenu{position:absolute;left:50%;bottom:0;}.volumeControl{position:absolute!important;left:10%;bottom:0;}'+
 '.menuItemContainer.leftBottom{position:absolute;left:8px;bottom:140px;}'+
 '.zenzaPopupMenu{visibility:hidden;pointer-events:none;position:absolute;bottom:40px;left:0;}'+
 '</style><div id="dialog" class="is-open"><div id="player" class="zenzaPlayerContainer">'+
 '<div class="hoverMenuContainer"><div class="menuItemContainer leftBottom"><div class="scalingUI">'+
 '<div class="menuButton showCommentSwitch"><span class="menuButtonInner">V</span></div></div></div></div>'+
 '<div class="videoControlBar"><div class="playbackRateMenu controlButton" tabindex="0">'+
 '<div class="controlButtonInner">1x</div><span class="tooltip">Playback rate</span>'+
 '<div class="zenzaPopupMenu"><button>Menu</button></div></div>'+
 '<div class="volumeControl"><input class="volumeRange" type="range" min="0" max="1" step="0.01">'+
 '<span class="tooltip">Volume</span></div></div></div></div><script>'+boot+'</script>';
const executable=process.env.CHROME_EXECUTABLE||(process.platform==='win32'?
 path.join(process.env.LOCALAPPDATA||'','Google/Chrome/Application/chrome.exe'):
 ['google-chrome','chromium','chromium-browser'].map(n=>{const r=spawnSync('which',[n],{encoding:'utf8'});return r.status===0?r.stdout.trim():null;}).find(Boolean));
assert(executable&&fs.existsSync(executable),'Chrome missing');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-task970-'));
let chrome,ws,sequence=0;const pending=new Map();
async function send(method,params={}){const id=++sequence;return new Promise((resolve,reject)=>{
 const timeout=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},15000);
 pending.set(id,{resolve,reject,timeout});ws.send(JSON.stringify({id,method,params}));
});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
(async()=>{try{
 chrome=await startChromeCdp(executable,profile);
 const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
 const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data),p=pending.get(m.id);if(!p)return;
  clearTimeout(p.timeout);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);});
 await send('Page.enable');await send('Runtime.enable');
 await send('Page.navigate',{url:'data:text/html;charset=utf-8,'+encodeURIComponent(html)});
 for(let i=0;i<60;i++){if(await evaluate('!!window.drive'))break;await new Promise(r=>setTimeout(r,50));}
 assert(await evaluate('!!window.drive'),'fixture not ready');
 const samples=[];
 for(const width of [1280,640,360,300]){
  await send('Emulation.setDeviceMetricsOverride',{width,height:720,deviceScaleFactor:1,mobile:false});
  for(const selector of ['.playbackRateMenu','.volumeControl']){
   await evaluate('document.activeElement.blur();view.show()');
   const pos=await evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',...pos,button:'none'});
   const result=await evaluate(`(async()=>{drive();const began=performance.now();const sample=()=>({
    elapsed:Math.round(performance.now()-began),mouse:document.querySelector('#player').classList.contains('is-mouseMoving'),
    ui:document.querySelector('#player').classList.contains('is-hoverUiActive'),
    tooltip:getComputedStyle(document.querySelector(${JSON.stringify(selector+' .tooltip')})).display,
    overlay:Number(getComputedStyle(document.querySelector('.showCommentSwitch')).opacity)});
    await sleep(550);const mid=sample();await sleep(950);return {mid,end:sample()}})()`);
   assert.strictEqual(result.mid.mouse,false,JSON.stringify(result));assert.strictEqual(result.mid.ui,true,JSON.stringify(result));
   assert.strictEqual(result.mid.tooltip,'block',selector+' '+JSON.stringify(result));assert(result.mid.overlay>0.7);
   assert.strictEqual(result.end.ui,false);assert.strictEqual(result.end.tooltip,'none');assert(result.end.overlay<0.01);
   samples.push({width,selector,...result});
  }
 }
 const focused=await evaluate(`(()=>{drive();document.querySelector('.playbackRateMenu').focus();const popup=document.querySelector('.zenzaPopupMenu');return {visibility:getComputedStyle(popup).visibility,pointer:getComputedStyle(popup).pointerEvents}})()`);
 assert.deepStrictEqual(focused,{visibility:'visible',pointer:'auto'});
 const hidden=await evaluate(`(()=>{view.hide();drive();return document.querySelector('#player').classList.contains('is-hoverUiActive')})()`);
 assert.strictEqual(hidden,false,'closed view cannot regain UI from queued input');
 console.log('TASK970_CHROMIUM_PASS '+JSON.stringify({cases:samples.length,samples,focused,closeCleared:!hidden}));
}catch(e){console.error('TASK970_CHROMIUM_FAIL '+e.message);process.exitCode=1;}
finally{for(const p of pending.values())clearTimeout(p.timeout);try{ws?.close()}catch(_){}try{chrome?.kill()}catch(_){}
 try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch(_){}}
})();
