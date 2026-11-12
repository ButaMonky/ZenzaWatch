'use strict';
// Offline research only: this is not a proposed production navigation handler.
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('assert');
const {startChromeCdp}=require('../helpers/startChromeCdp');
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
link.addEventListener('click',e=>{if(experimentMode==='assign'){e.preventDefault();location.assign('/watch/sm9');}if(experimentMode==='spa'){e.preventDefault();history.pushState({video:'sm9'},'', '/watch/sm9');document.getElementById('screen').textContent='video DOM';}if(experimentMode==='menu'){e.preventDefault();document.getElementById('screen').textContent='menu';}});
</script>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-navigation-research-'));
chrome=await startChromeCdp(process.env.CHROME_EXECUTABLE||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),profile);
const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);});await send('Page.enable');
const results=[];
for(const mode of ['capture-stop','prevent-only','root-stop','cooperative-router']){
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?mode=menu`});await wait(100);
 await evaluate(`document.body.innerHTML='<main id="root"><a id="hit" href="/watch/sm9" style="display:block;width:200px;height:60px">video</a></main>';window.observed=0;window.routed=0;window.opened=0;
 const experimentMode=${JSON.stringify(mode)},root=document.getElementById('root');
 document.addEventListener('click',e=>{e.preventDefault();opened++;if(experimentMode==='capture-stop')e.stopImmediatePropagation();},true);
 root.addEventListener('click',e=>{if(experimentMode==='cooperative-router'&&e.defaultPrevented)return;routed++;document.body.dataset.screen='video';});
 if(experimentMode==='root-stop')root.addEventListener('click',e=>e.stopPropagation(),true);
 document.body.addEventListener('click',()=>observed++);`);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:30,y:30,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:30,y:30,button:'left',clickCount:1});
 results.push({mode,...await evaluate('({observed,routed,opened})')});
}
assert.deepStrictEqual(results.map(r=>[r.observed,r.routed,r.opened]),[[0,0,1],[1,1,1],[0,0,1],[1,0,1]]);
console.log(JSON.stringify(results,null,2));
}catch(e){console.error(e);process.exitCode=1;}finally{
if(chrome){const closed=new Promise(r=>chrome.once('exit',r));try{await send('Browser.close');}catch{chrome.kill();}await Promise.race([closed,wait(3000)]);if(chrome.exitCode===null&&chrome.signalCode===null)chrome.kill();console.log('RESEARCH_CHROME_CLOSED',chrome.exitCode!==null||chrome.signalCode!==null);}
for(const p of pending.values())clearTimeout(p.timer);ws?.close();server?.close();
}})();
