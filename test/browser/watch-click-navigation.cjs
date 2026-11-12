'use strict';
// Offline browser regression using the production navigation adapter and captured header contract.
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('assert');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let chrome,ws,server,id=0;const pending=new Map();
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error(method));},10000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
(async()=>{try{
const {stripTypeScriptTypes}=require('node:module');
const helper=stripTypeScriptTypes(fs.readFileSync(path.join(__dirname,'../../packages/zenza/src/menu/WatchClickNavigation.ts'),'utf8')).replace(/^export \{WatchClickNavigation\};/m,'');
server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(`<!doctype html><body><div id="CommonHeader"></div><script>
window.result={observed:0,opened:0,routes:0,diagnostic:null};const originalOpen=window.open;
console.info=message=>{if(message.startsWith('ZENZA_CLICK_TRIAL '))result.diagnostic=JSON.parse(message.slice(18));};
const mode=new URL(location.href).searchParams.get('mode');
const callbacks=[];class Header{on(name,fn){callbacks.push(fn);}closePanel(){}}
const root=document.querySelector('#CommonHeader');
function mount(){const api=new Header();root.innerHTML='<a id="hit" href="/watch/sm9" style="display:block;width:200px;height:60px">video</a>';api.on('commonHeader:linkClick',e=>{e.nativeEvent.type!=='auxclick'&&(e.nativeEvent.ctrlKey||e.nativeEvent.metaKey||e.nativeEvent.target.closest('a')?.target!=='_blank'&&(e.nativeEvent.preventDefault(),api.closePanel(),result.routes++));});root.addEventListener('click',e=>callbacks.forEach(fn=>fn({nativeEvent:e,href:hit.href})));}
if(mode!=='lazy')window.CommonHeader={default:Header};
if(mode==='late')mount();
${helper}
WatchClickNavigation.install(window);
if(mode==='lazy'){window.CommonHeader={default:Header};const s=document.createElement('script');s.addEventListener('load',mount);s.src='data:text/javascript,void 0';document.head.append(s);}else if(mode!=='late')mount();
if(mode==='ordinary'){document.body.append(hit);}
document.addEventListener('click',e=>{if(mode!=='unclaimed')WatchClickNavigation.begin(window,e,'sm9',()=>{result.opened++;result.restored=window.open===originalOpen;});},true);
document.body.addEventListener('click',()=>result.observed++);
</script>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-navigation-research-'));
chrome=await startChromeCdp(process.env.CHROME_EXECUTABLE||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),profile);
const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);});await send('Page.enable');
const results=[];
for(const mode of ['early','lazy','late','ordinary','unclaimed']){
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?mode=${mode}`});await wait(150);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',x:30,y:30,button:'left',clickCount:1});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:30,y:30,button:'left',clickCount:1});await wait(150);
 results.push({mode,...await evaluate('({...result,pathname:location.pathname})')});
}
for(const r of results){assert.equal(r.pathname,'/');assert.equal(r.routes,r.mode==='unclaimed'?1:0);assert.equal(r.opened,r.mode==='unclaimed'?0:1);assert.equal(r.observed,r.mode==='late'?0:1);if(r.opened)assert.equal(r.restored,true);}
const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();assert.equal(pages.filter(p=>p.type==='page'&&p.url.includes('/watch/')).length,0);
console.log(JSON.stringify(results,null,2));
}catch(e){console.error(e);process.exitCode=1;}finally{
if(chrome){const closed=new Promise(r=>chrome.once('exit',r));try{await send('Browser.close');}catch{chrome.kill();}await Promise.race([closed,wait(3000)]);if(chrome.exitCode===null&&chrome.signalCode===null)chrome.kill();console.log('RESEARCH_CHROME_CLOSED',chrome.exitCode!==null||chrome.signalCode!==null);}
for(const p of pending.values())clearTimeout(p.timer);ws?.close();server?.close();
}})();
