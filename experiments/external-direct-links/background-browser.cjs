'use strict';
// Offline research only: this is not a proposed production navigation handler.
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('assert');
const {startChromeCdp}=require('../../test/helpers/startChromeCdp');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let chrome,ws,server,id=0;const pending=new Map();
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error(method));},10000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
(async()=>{try{
server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><body><a id="link" href="/watch/sm9" style="display:block;width:200px;height:60px">video</a><div id="screen">list</div><script>
window.records=[];window.readers=0;
document.body.addEventListener('click',()=>readers++);
navigation.addEventListener('navigate',e=>{records.push({type:e.navigationType,cancelable:e.cancelable,userInitiated:e.userInitiated,source:e.sourceElement?.id||null});if(new URL(e.destination.url).pathname.startsWith('/watch/'))e.preventDefault();});
const mode=new URL(location.href).searchParams.get('mode');
link.addEventListener('click',e=>{if(mode==='assign'){e.preventDefault();location.assign('/watch/sm9');}if(mode==='spa'){e.preventDefault();history.pushState({video:'sm9'},'', '/watch/sm9');document.getElementById('screen').textContent='video DOM';}if(mode==='menu'){e.preventDefault();document.getElementById('screen').textContent='menu';}});
</script>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-navigation-research-'));
chrome=await startChromeCdp(process.env.CHROME_EXECUTABLE||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),profile);
const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);});await send('Page.enable');
await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});await wait(150);
const background=require('./generated/player-background');
await evaluate(`document.documentElement.style.background='#111';document.body.style.background='#111';(${background.installPlayerBackground.toString()})(document);`);
for(const [mode,expected] of [['normal','rgb(17, 17, 17)'],['small','rgba(0, 0, 0, 0)'],['normal','rgb(17, 17, 17)'],['small','rgba(0, 0, 0, 0)']]){
 const colors=await evaluate(`document.body.className='zenzaScreenMode_${mode}';[getComputedStyle(document.documentElement).backgroundColor,getComputedStyle(document.body).backgroundColor]`);
 assert.deepStrictEqual(colors,[expected,expected]);
}
console.log('PASS small-mode background and normal-mode restoration');
}catch(e){console.error(e);process.exitCode=1;}finally{
if(chrome){const closed=new Promise(r=>chrome.once('exit',r));try{await send('Browser.close');}catch{chrome.kill();}await Promise.race([closed,wait(3000)]);if(chrome.exitCode===null&&chrome.signalCode===null)chrome.kill();console.log('RESEARCH_CHROME_CLOSED',chrome.exitCode!==null||chrome.signalCode!==null);}
for(const p of pending.values())clearTimeout(p.timer);ws?.close();server?.close();
}})();
