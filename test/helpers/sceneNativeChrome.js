'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const {startChromeCdp}=require('./startChromeCdp');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function createChrome(){
 const exe=process.env.CHROME_EXECUTABLE||path.join(process.env.LOCALAPPDATA||'',
 'Google/Chrome/Application/chrome.exe');
 assert(fs.existsSync(exe),'Chrome missing: '+exe);
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'scene-vcb-cdp-'));
 const chrome=await startChromeCdp(exe,profile);
 // Windows occasionally holds DevToolsActivePort under a transient lock
 // (EBUSY) even after Chrome signals readiness. Retry, don't misclassify QA.
 let content='';
 for(let attempt=0;attempt<30;attempt++){
  try{content=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8');break;}
  catch(error){if(!['EBUSY','EACCES','ENOENT'].includes(error.code)||attempt===29)throw error;
   await pause(60);}
 }
 const port=content.split(/\r?\n/)[0];
 const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',
 {method:'PUT'})).json();
 const ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((res,rej)=>{ws.addEventListener('open',res,{once:true});
  ws.addEventListener('error',rej,{once:true});});
 let id=0;const pending=new Map(),exceptions=[];
 ws.addEventListener('message',event=>{
  const msg=JSON.parse(event.data);
  if(msg.method==='Runtime.exceptionThrown')exceptions.push(
   msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);
  const task=pending.get(msg.id);
  if(!task)return;
  pending.delete(msg.id);clearTimeout(task.timer);
  msg.error?task.reject(Error(JSON.stringify(msg.error))):task.resolve(msg.result);
 });
 function send(method,params={}){
  const requestId=++id;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(requestId);
    reject(Error('CDP_TIMEOUT '+method));},25000);
   pending.set(requestId,{resolve,reject,timer});
   ws.send(JSON.stringify({id:requestId,method,params}));
  });
 }
 async function evaluate(expression,opts={}){
  const r=await send('Runtime.evaluate',{
   expression,returnByValue:true,awaitPromise:!!opts.awaitPromise,
   userGesture:!!opts.userGesture
  });
  if(r.exceptionDetails)throw Error(
   r.exceptionDetails.exception?.description||r.exceptionDetails.text);
  return r.result?.value;
 }
 await send('Page.enable');await send('Runtime.enable');
 return {send,evaluate,pause,exceptions,
  async navigate(url){
   exceptions.length=0;await send('Page.navigate',{url});
   for(let i=0;i<70;i++){
    if(await evaluate('document.readyState==="complete"&&typeof window.qaStart==="function"'))return;
    await pause(90);
   }
   throw Error('VCB_RUNTIME_MISSING '+JSON.stringify(exceptions));
  },
  async move(x,y){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'none'});},
  async down(x,y){await send('Input.dispatchMouseEvent',{
   type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});},
  async up(x,y){await send('Input.dispatchMouseEvent',{
   type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1});},
  async wheel(x,y,deltaY,buttons=0){await send('Input.dispatchMouseEvent',{
   type:'mouseWheel',x,y,deltaY,deltaX:0,buttons});},
  async key(key,code,vk){
   for(const type of ['keyDown','keyUp'])
    await send('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:vk});
  },
  async close(){
   for(const task of pending.values())clearTimeout(task.timer);
   try{ws.close();}catch(_){}
   try{chrome.kill();}catch(_){}
   try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:4,retryDelay:100});}catch(_){}
  }};
}
module.exports={createChrome};
