'use strict';
// Task725: real Chromium Fullscreen API probe. No NicoNico network or account.
const fs=require('fs'),path=require('path'),os=require('os');
const {spawn,spawnSync}=require('child_process');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..');
const out=path.join(root,'tools/typescript-stage1/.generated/scui-browser');
fs.mkdirSync(out,{recursive:true});
const generate=spawnSync(process.execPath,['tools/qa/scui-browser-check.cjs'],{
 cwd:root,encoding:'utf8'});
if(generate.status!==0)throw Error('Fixture generation failed '+generate.stderr);
const original=fs.readFileSync(path.join(out,'fixture.html'),'utf8');
const from="if(new URLSearchParams(location.search).has('one') && (n!==1||mode!=='normal'))continue;";
const to="if(new URLSearchParams(location.search).has('one') && (n!==1||mode!=='fullscreen'))continue;";
const cleanup=" b.dispose();record(label+'/cleanup',";
const hold=" if(portal&&mode==='fullscreen'&&location.search.includes('hold=1')){"+
 "document.body.dataset.nativeFullHold='ready';return;} b.dispose();record(label+'/cleanup',";
if(!original.includes(from)||!original.includes(cleanup))throw Error('Fixture selector missing');
const source=original.replace(from,to).replace(cleanup,hold);
const file=path.join(out,'fixture-native-fullscreen.html');
fs.writeFileSync(file,source,'utf8');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'scui725-fullscreen-'));
const exe=path.join(process.env.LOCALAPPDATA||'','Google/Chrome/Application/chrome.exe');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let chrome,connection;
async function attach(url){
 const ws=new WebSocket(url),waiting=new Map();let id=0;
 await new Promise((ok,fail)=>{
  ws.addEventListener('open',ok,{once:true});
  ws.addEventListener('error',fail,{once:true});
 });
 ws.addEventListener('message',event=>{
  const msg=JSON.parse(event.data),p=waiting.get(msg.id);
  if(!p)return;
  waiting.delete(msg.id);clearTimeout(p.timer);
  msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result);
 });
 return {close:()=>ws.close(),send(method,params={}){
  return new Promise((resolve,reject)=>{
   const next=++id;
   const timer=setTimeout(()=>{waiting.delete(next);
    reject(Error('CDP timeout: '+method));},20000);
   waiting.set(next,{resolve,reject,timer});
   ws.send(JSON.stringify({id:next,method,params}));
  });
 }};
}
async function evalValue(expr,options={}){
 const r=await connection.send('Runtime.evaluate',{
  expression:expr,returnByValue:true,...options});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.text);
 return r.result?.value;
}
(async()=>{
 const log=fs.openSync(path.join(out,'task725-native-fullscreen-chrome.log'),'w');
 try{
  chrome=spawn(exe,['--headless=new','--disable-background-networking',
   '--no-first-run','--disable-extensions','--remote-debugging-port=0',
   '--window-size=1536,900','--user-data-dir='+profile,'about:blank'],
   {stdio:['ignore','ignore',log],windowsHide:true});
  const portfile=path.join(profile,'DevToolsActivePort');
  for(let i=0;i<80&&!fs.existsSync(portfile);i++)await delay(200);
  if(!fs.existsSync(portfile))throw Error('Chrome DebugPort unavailable');
  const port=fs.readFileSync(portfile,'utf8').split('\n')[0];
  const base='http://127.0.0.1:'+port;
  const tab=await (await fetch(base+'/json/new?about:blank',{method:'PUT'})).json();
  connection=await attach(tab.webSocketDebuggerUrl);
  await connection.send('Page.enable');await connection.send('Runtime.enable');
  await connection.send('Emulation.setDeviceMetricsOverride',{
   width:1536,height:900,deviceScaleFactor:1,mobile:false});
  await connection.send('Page.navigate',{url:pathToFileURL(file).href+'?one=1&hold=1'});
  let ready=false;
  for(let i=0;i<60;i++){await delay(180);
   ready=await evalValue("document.body?.dataset.nativeFullHold==='ready'");
   if(ready)break;
  }
  if(!ready)throw Error('Native fullscreen fixture did not mount UI01');
  console.log('NATIVE_FULLSCREEN_MOUNTED');
  const request=await evalValue(
   'document.getElementById("player").requestFullscreen().then(()=>true)',
   {userGesture:true,awaitPromise:true});
  console.log('FULLSCREEN_REQUEST='+request);
  await delay(280);
  const expression=[
   '(()=>{const host=document.getElementById("player");',
   'const root=document.querySelector(".zenzaSceneLayout01");',
   'const comment=document.querySelector(".zenzaCommentPreview");',
   'if(!root||!comment)return {missing:true};',
   'const r=root.getBoundingClientRect(),c=comment.getBoundingClientRect();',
   'const target=document.fullscreenElement;',
   'const hit=document.elementFromPoint(r.left+r.width/2,r.top+Math.min(30,r.height/2));',
   'return {native:target===host,descendant:host.contains(root),',
   'commentDescendant:host.contains(comment),',
   'display:getComputedStyle(root).display,visibility:getComputedStyle(root).visibility,',
   'opacity:getComputedStyle(root).opacity,',
   'hitWithinRoot:hit===root||root.contains(hit),',
   'sceneLeft:r.left,sceneRight:r.right,commentLeft:c.left,commentRight:c.right,',
   'viewportWidth:innerWidth};})()'
  ].join('');
  const result=await evalValue(expression);
  console.log('NATIVE_FULLSCREEN_RESULT='+JSON.stringify(result));
  if(!result.native||!result.descendant||!result.commentDescendant||
   result.display==='none'||result.visibility==='hidden'||
   !result.hitWithinRoot||result.commentLeft<result.sceneRight||
   result.commentRight>result.viewportWidth+2)throw Error('Native fullscreen visible UI01 contract failed');
  const shot=await connection.send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(out,'task725-native-fullscreen.png'),Buffer.from(shot.data,'base64'));
  console.log('NATIVE_FULLSCREEN_PASS');
 }finally{
  connection?.close();chrome?.kill();
  fs.closeSync(log);
 }
})().catch(error=>{console.error('NATIVE_FULLSCREEN_FAIL '+error.message);
 process.exitCode=1;});
