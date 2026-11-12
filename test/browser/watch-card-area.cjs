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

const {beginSection,extract}=require('../helpers/extractSource');
const helper=beginSection('packages/zenza/src/menu/WatchClickNavigation.js');
const hover=extract(process.env.ZENZA_TEST_BUNDLE || 'dist/ZenzaWatch-dev.user.js','HoverMenu');
const nico=beginSection('packages/lib/src/nico/nicoUtil.js');
const html=`<!doctype html><style>
body{margin:20px}#card{position:relative;width:300px}#content{display:flex;flex-direction:column}
#picture{position:relative}#image{display:block;width:300px;height:140px;background:#aaa}
#title{display:block;height:40px;margin:12px 0}#stats{height:22px;margin-bottom:12px}
#ownerRow{height:30px}#details{flex:1}#toggle{position:absolute;right:0;top:150px;background:white}
#overlay{position:absolute;top:5px;right:5px}#actions{margin-top:10px}
.horizontal #card{width:620px}.horizontal #content{flex-direction:row;gap:20px}
a{color:blue}img{width:100%;height:100%}
</style><div id="card" data-group="true" data-anchor-href="https://www.nicovideo.jp/watch/sm9"><div id="content"><div id="picture"><a id="image" href="https://www.nicovideo.jp/watch/sm9"><img id="img"></a><button id="overlay">later</button></div><div id="details"><a id="title" href="https://www.nicovideo.jp/watch/sm9"><span id="text">title</span></a><div id="stats"><time id="date" datetime="2026-11-11">date</time><span id="count">12</span></div><div id="ownerRow"><a id="owner" href="https://www.nicovideo.jp/user/12">owner</a></div></div></div><div id="actions"><span id="ng">NG</span></div><span id="toggle">▼</span></div><div id="CommonHeader"></div>`;
server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html+`<script>
document.body.className=new URL(location.href).searchParams.get('mode')||'';
window.result={opened:0,routes:0,actions:0,errors:[]};window.addEventListener('error',e=>result.errors.push(e.message));
const callbacks=[];class Header{on(name,fn){callbacks.push(fn);}closePanel(){}}
window.CommonHeader={default:Header};
${helper}
const api=new Header();api.on('commonHeader:linkClick',e=>{e.nativeEvent.preventDefault();result.routes++;});
document.querySelector('#CommonHeader').innerHTML='<a id="headerImage" href="https://www.nicovideo.jp/watch/sm9">image</a> <a id="headerTitle" href="https://www.nicovideo.jp/watch/sm9">title</a>';
document.querySelector('#CommonHeader').addEventListener('click',e=>callbacks.forEach(fn=>fn({nativeEvent:e,href:e.target.closest('a')?.href})));
const ZenzaWatch={emitter:{emit(){}}};
${nico}
${hover}
const menu=Object.create(HoverMenu.prototype);
menu._open=()=>result.opened++;menu._send=()=>result.opened++;
menu._overrideWatchLink();
document.body.addEventListener('click',e=>{if(!e.defaultPrevented)result.actions++;e.preventDefault();});
</script>`);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-navigation-research-'));
chrome=await startChromeCdp(process.env.CHROME_EXECUTABLE||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),profile);
const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);});await send('Page.enable');

async function click(x,y){await send('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button:'left',clickCount:1});await wait(150);}
const results=[];
for(const mode of ['tile','horizontal']){
 await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/?mode=${mode}`});await wait(350);
 for(const name of ['img','text','date','count','gap','toggle','ng','owner','ownerRow','overlay','headerImage','headerTitle']){
  const point=await evaluate(`(()=>{const r=id=>document.getElementById(id).getBoundingClientRect();if(${JSON.stringify(name)}==='gap'){const a=r('title'),b=r('stats');return {x:a.left+10,y:(a.bottom+b.top)/2};}const a=r(${JSON.stringify(name)});return {x:${JSON.stringify(name)}==='ownerRow'?a.right-10:a.left+a.width/2,y:a.top+a.height/2};})()`);
  const before=await evaluate('({...result})');await click(point.x,point.y);const after=await evaluate('({...result})');
  const opens=['img','text','date','count','gap','headerImage','headerTitle'].includes(name);
  assert.equal(after.opened-before.opened,opens?1:0,mode+': '+name+' '+JSON.stringify(after));
  assert.equal(after.routes,0,mode+': header route');
  results.push({mode,name,opens});
 }
}
console.log('PASS real mouse clicks in tile/horizontal layout, excluded overlay actions and owner whitespace; header image/title launch once without route',results.length);
}catch(e){console.error(e);process.exitCode=1;}finally{
if(chrome){const closed=new Promise(r=>chrome.once('exit',r));try{await send('Browser.close');}catch{chrome.kill();}await Promise.race([closed,wait(3000)]);if(chrome.exitCode===null&&chrome.signalCode===null)chrome.kill();console.log('RESEARCH_CHROME_CLOSED',chrome.exitCode!==null||chrome.signalCode!==null);}
for(const p of pending.values())clearTimeout(p.timer);ws?.close();server?.close();
}})();