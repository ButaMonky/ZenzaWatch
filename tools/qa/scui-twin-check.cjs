'use strict';
const fs=require('fs'),path=require('path');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tools/typescript-stage1/.generated/scui-browser');
const os=require('os'),{spawn}=require('child_process');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'scui489-cdp-'));
let chrome;
async function client(url){
 const ws=new WebSocket(url),waiting=new Map(),errors=[];let seq=0;
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);
  if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails);
  if(v.method==='Runtime.consoleAPICalled')console.log('PAGE_CONSOLE '+v.params.args.map(a=>a.value).join(' '));
  const p=waiting.get(v.id);if(!p)return;waiting.delete(v.id);clearTimeout(p.timer);
  v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);
 });
 return {errors,close:()=>ws.close(),send(method,params={}){const id=++seq;
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{waiting.delete(id);reject(Error('CDP_TIMEOUT '+method));},30000);
   waiting.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}};
}

(async()=>{
 const exe=path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe');
 const log=fs.openSync(path.join(out,'twin-browser.log'),'w');
 // Fullscreen uses the virtual screen, not only CDP viewport emulation.
 chrome=spawn(exe,['--headless=new','--screen-info={1600x1000}','--no-first-run','--disable-extensions',
  '--disable-background-networking','--remote-debugging-port=0',
  '--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],
  {windowsHide:true,stdio:['ignore','ignore',log]});
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const portFile=path.join(profile,'DevToolsActivePort');
 for(let n=0;n<60&&!fs.existsSync(portFile);n++)await pause(250);
 if(!fs.existsSync(portFile))throw Error('DEVTOOLS_PORT_UNAVAILABLE');
 const address='http://127.0.0.1:'+fs.readFileSync(portFile,'utf8').split('\n')[0];
 const tab=await (await fetch(address+'/json/new?about:blank',{method:'PUT'})).json();
 const c=await client(tab.webSocketDebuggerUrl),checks=[];
 const evaluate=async expression=>{
  const r=await c.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result.value;
 };
 const record=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)throw Error(name+' '+JSON.stringify(detail));};
 const move=async(x,y)=>c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
 const click=async selector=>{
  const point=await evaluate("(()=>{const r=document.querySelector("+JSON.stringify(selector)+").getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
  await move(point.x,point.y);
  await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});
  await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
  await evaluate('new Promise(requestAnimationFrame)');
 };
 const state=()=>evaluate(`(()=>{
  const card=document.querySelector('.zenzaSceneLayout02'),mini=bar._commentPreview._view._view;
  const list=document.querySelector('.zenzaSceneTwinList'),image=card.querySelector('.zenzaSceneImageBox');
  return {shown:qaBinding.adapter.bridge.state.shown,miniActive:mini.classList.contains('is-scui-active'),
   listActive:list?.classList.contains('is-scui-active'),miniOver:mini.parentNode===image,
   mode:mini.dataset.commentPreviewMode,animation:getComputedStyle(mini.querySelector('.text')).animationPlayState,
   card:card.getBoundingClientRect().toJSON(),list:list?.getBoundingClientRect().toJSON(),
   fullscreen:document.fullscreenElement===host,subtree:!document.fullscreenElement||host.contains(list),
   listeners:bar._commentPreview._model._events.get('vpos').size};
 })()`);
 try{
  await c.send('Page.enable');await c.send('Runtime.enable');
  for(const width of [320,768,1536]){
   await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   await c.send('Page.navigate',{url:pathToFileURL(path.join(out,'fixture.html')).href+'?interactive=1'});
   for(let n=0;n<120;n++){if(await evaluate('typeof bar!=="undefined"'))break;await pause(100);}
   await evaluate(`window.qaBinding=new SceneSearchPlayerBinding({view:{videoControlBar:bar},dialog:player,document,
    container:host,events:events(),isFullscreen:()=>document.fullscreenElement===host});
    vals['sceneSearch.layout.normal']='02';vals['sceneSearch.layout.fullscreen']='02';
    vals['sceneSearch.idleHideSeconds']=0.5;qaBinding.attach();true`);
   for(const mode of ['normal','fullscreen']){
    if(mode==='fullscreen'){
     await evaluate('host.requestFullscreen()');
     await evaluate("qaBinding.adapter.screenModeChanged('fullscreen');true");
    }
    await click('#seek');
    await click('[data-scui-action="comment-toggle"]');
    if(!(await state()).listActive)await click('[data-scui-action="comment-toggle"]');
    let s=await state();
    record(width+'/'+mode+'/simultaneous',s.miniOver&&s.mode==='hover'&&s.listActive&&s.animation==='running',s);
    record(width+'/'+mode+'/bounds',s.card.left>=0&&s.list.right<=width&&
      s.list.left>=s.card.right-1&&s.list.bottom<=900&&s.subtree,s);
    if(mode==='fullscreen'){
     record(width+'/actual-fullscreen',s.fullscreen,s);
     record(width+'/fullscreen-bottom-alignment',Math.abs(s.card.bottom-s.list.bottom)<2,s);
    }
    const shot=await c.send('Page.captureScreenshot',{format:'png'});
    fs.writeFileSync(path.join(out,'task791-'+width+'-'+mode+'.png'),Buffer.from(shot.data,'base64'));
    await evaluate('qaNativeCommands.length=0');
    await click('.zenzaSceneTwinList .nicoChat .vposTime');
    record(width+'/'+mode+'/native-row-click',await evaluate("qaNativeCommands.some(([c])=>c==='seek')"),{});
    await evaluate("window.qaScrollDebug=[];document.querySelector('.zenzaSceneTwinList').addEventListener('wheel',e=>qaScrollDebug.push({type:'wheel',x:e.clientX,y:e.clientY,delta:e.deltaY,prevented:e.defaultPrevented}),{capture:true});document.querySelector('.zenzaSceneTwinList').addEventListener('scroll',e=>qaScrollDebug.push({type:'scroll',top:e.target.scrollTop}));true");
    const scrollPoint=await evaluate("(()=>{const r=document.querySelector('.zenzaSceneTwinList').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
    await move(scrollPoint.x,scrollPoint.y);
    await c.send('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:100,...scrollPoint});
    let scroll;
    for(let n=0;n<20;n++){
     await pause(50);
     scroll=await evaluate("(()=>{const p=document.querySelector('.zenzaSceneTwinList'),r=p.getBoundingClientRect();return {top:p.scrollTop,height:p.clientHeight,content:p.scrollHeight,hit:document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)?.className};})()");
     if(scroll.top>0)break;
    }
    record(width+'/'+mode+'/native-wheel-scroll',scroll.top>0,{...scroll,
      debug:await evaluate('qaScrollDebug'),style:await evaluate("(()=>{const p=document.querySelector('.zenzaSceneTwinList'),c=getComputedStyle(p);return {overflow:c.overflow,position:c.position,rect:p.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight]};})()")});
    await evaluate("document.querySelector('.zenzaSceneTwinList').focus();true");
    await move(width-2,2);await pause(1000);
    s=await state();record(width+'/'+mode+'/focus-hold',s.shown&&s.listActive,s);
    await evaluate("document.activeElement.blur();true");
    await click('#seek');await pause(800);
    s=await state();record(width+'/'+mode+'/common-idle-hide',!s.shown&&!s.miniActive&&!s.listActive,s);
    await click('#seek');await click('[data-scui-action="comment-toggle"]');
    record(width+'/'+mode+'/native-list-disposed',(await state()).listeners===1,await state());
   }
   await evaluate('document.exitFullscreen()');
   await evaluate('qaBinding.dispose();true');
   record(width+'/teardown',await evaluate("!document.querySelector('.zenzaSceneTwinList')&&bar._commentPreview._model._events.get('vpos').size===1"),{});
  }
  record('no-browser-exceptions',c.errors.length===0,c.errors);
  console.log('TASK791_NATIVE_BROWSER_PASS '+checks.length);
 }finally{
  fs.writeFileSync(path.join(out,'task791-native-browser.json'),JSON.stringify(checks,null,2));
  c.close();await fetch(address+'/json/close/'+tab.id).catch(()=>{});chrome.kill();fs.closeSync(log);
 }
})().catch(error=>{console.error('TASK791_NATIVE_BROWSER_FAIL '+error.stack);chrome?.kill();process.exitCode=1;});
