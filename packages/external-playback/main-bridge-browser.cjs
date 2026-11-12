'use strict';
// Offline fixture only: localhost replaces the eligibility origin. No Nico
// requests, account operations or live-page access are performed.
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('node:assert/strict');
const {startChromeCdp}=require('../../test/helpers/startChromeCdp');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let chrome,ws,server,id=0;const pending=new Map();
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error(method));},15000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression,contextId){const r=await send('Runtime.evaluate',{expression,contextId,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
(async()=>{try{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(req.url==='/robots.txt'?'<html><body>static fixture</body></html>':'<!doctype html><body><iframe name="ZenzaWatchExternalTrialPlayer" src="/robots.txt"></iframe>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-main-bridge-'));
 chrome=await startChromeCdp(process.env.CHROME_EXECUTABLE||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),profile);
 const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
 const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);});
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:origin});await wait(250);
 const tree=(await send('Page.getFrameTree')).frameTree,frameId=tree.childFrames[0].frame.id;
 const mainWorld=(await send('Page.createIsolatedWorld',{frameId,worldName:'main-userscript'})).executionContextId;
 const companionWorld=(await send('Page.createIsolatedWorld',{frameId,worldName:'companion-userscript'})).executionContextId;
 const targetSource=fs.readFileSync(path.join(__dirname,'generated/targets.js'),'utf8');
 const bridgeSource=fs.readFileSync(path.join(__dirname,'generated/main-player-bridge.js'),'utf8').replaceAll('https://www.nicovideo.jp',origin);
 const moduleSource='window.bridge=(()=>{const targets=(()=>{const exports={};'+targetSource+';return exports;})();const require=()=>targets,exports={};'+bridgeSource+';return exports;})();';
 await evaluate(moduleSource,companionWorld);
 await evaluate("window.events=[];window.client=bridge.createMainPlayerClient(window,{retryMs:20,timeoutMs:2000,onClosing:()=>events.push('closing'),onClosed:()=>events.push('closed')});window.client.open('sm9',{isTrusted:true}).then(()=>window.done=true,error=>window.done=error.message);void 0;",companionWorld);
 await wait(30);
 await evaluate(moduleSource+"window.opened=[];window.session={open:async id=>opened.push(id),setStageListener(fn){this.report=fn;},close(){this.report('CLOSING');setTimeout(()=>this.report('CLOSED'),10);return true;}};bridge.installMainPlayerProvider(window,session);",mainWorld);
 for(let i=0;i<100&&!await evaluate('window.done',companionWorld);i++)await wait(20);
 assert.equal(await evaluate('window.done',companionWorld),true);
 assert.deepEqual(await evaluate('window.opened',mainWorld),['sm9']);
 await evaluate("document.querySelector('iframe').contentWindow.postMessage({protocol:'zenza-main-player-v1',channel:'12345678-1234-1234-1234-123456789abc',type:'hello'},'*');");
 await wait(30);assert.deepEqual(await evaluate('window.opened',mainWorld),['sm9']);
 await evaluate('window.client.close()',companionWorld);await wait(50);
 assert.deepEqual(await evaluate('window.events',companionWorld),['closing','closed']);
 console.log('PASS isolated-world launch, opposite startup order, parent rejection and close lifecycle');
 const parentWorld=(await send('Page.createIsolatedWorld',{frameId:tree.frame.id,worldName:'normal-main-userscript'})).executionContextId;
 const lodash=fs.readFileSync(require.resolve('lodash/lodash.min.js'),'utf8');
 const bundle=fs.readFileSync(path.join(__dirname,'../../dist/ZenzaWatch-dev.user.js'),'utf8')
   .replace('return boot(monkey, PRODUCT, START_PAGE_QUERY);',"document.body.dataset.boot=PRODUCT;document.body.dataset.gm=typeof GM_xmlhttpRequest;");
 const code='(()=>{const GM_getValue=()=>undefined,GM_setValue=()=>{},GM_deleteValue=()=>{},GM_addValueChangeListener=()=>1,GM_removeValueChangeListener=()=>{},GM_xmlhttpRequest=()=>{throw Error("unexpected transport")},GM_getResourceText=()=>'+JSON.stringify(lodash)+',GM_addElement=(parent,tag,attrs)=>{const element=document.createElement(tag);Object.assign(element,attrs);parent.append(element);return element;};'+bundle+'})();';
 await evaluate(code,parentWorld);await wait(100);
 assert.deepEqual(await evaluate('[document.body.dataset.boot,document.body.dataset.gm]'),['ZenzaWatch','undefined']);
 console.log('PASS normal main executes in page realm without privileged GM APIs');
}catch(error){console.error(error);process.exitCode=1;}finally{
 if(chrome){const exited=new Promise(r=>chrome.once('exit',r));try{await send('Browser.close');}catch{chrome.kill();}await Promise.race([exited,wait(3000)]);if(chrome.exitCode===null&&chrome.signalCode===null)chrome.kill();}
 for(const p of pending.values())clearTimeout(p.timer);ws?.close();server?.close();
}})();