'use strict';
// Offline Chrome fixture of the actual bundled notification panel and dock.
// The journal supplies synthetic records; external requests and OS clipboard writes are blocked.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const {startChromeCdp} = require('../helpers/startChromeCdp');
const root = path.resolve(__dirname, '../..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-task994-'));
let chrome, ws, server, id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const seq = ++id;
    const timer = setTimeout(() => {pending.delete(seq); reject(Error(method + ' timeout'));}, 20000);
    pending.set(seq, {resolve, reject, timer});
    ws.send(JSON.stringify({id: seq, method, params}));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}).catch(e=>{throw Error(e.message+' in '+expression.slice(0,130));});
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result?.value;
}
(async () => {
  try {
    server = http.createServer((req, res) => {res.setHeader('Content-Type','text/html'); res.end('<!doctype html><html><head></head><body>Settings fixture</body></html>');});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const executable = process.env.CHROME_EXECUTABLE || path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe');
    chrome = await startChromeCdp(executable, profile);
    const port = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0];
    const tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method:'PUT'})).json();
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {ws.addEventListener('open', resolve, {once:true}); ws.addEventListener('error', reject, {once:true});});
    ws.addEventListener('message', event => {
      const msg = JSON.parse(event.data), item = pending.get(msg.id);
      if (msg.method === 'Fetch.requestPaused') {
        const params = msg.params;
        const html = '<!doctype html><html><head></head><body>Settings fixture</body></html>';
        if(params.request.url === 'https://www.nicovideo.jp/my') send('Fetch.fulfillRequest',{requestId:params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html'}],body:Buffer.from(html).toString('base64')}).catch(()=>{});
        else send('Fetch.failRequest',{requestId:params.requestId,errorReason:'BlockedByClient'}).catch(()=>{});
        return;
      }
      if (!item) return;
      clearTimeout(item.timer); pending.delete(msg.id);
      msg.error ? item.reject(Error(JSON.stringify(msg.error))) : item.resolve(msg.result);
    });
    await send('Page.enable');
    await send('Network.enable');
    await send('Fetch.enable', {patterns:[{urlPattern:'*'}]});
    await send('Page.navigate', {url:'https://www.nicovideo.jp/my'});
    for (let i=0;i<50;i++) {if(await evaluate('document.readyState === "complete"')) break; await wait(50);}
    const {extract} = require('../helpers/extractSource');
    const panel = extract('dist/ZenzaWatch-dev.user.js','NotificationHistoryPanel','var');
    await evaluate(`document.body.innerHTML='<div id="player" style="position:relative;width:600px;max-width:100%;height:420px;background:#151515"><button id="bell">通知</button></div>';
      window.matchMedia=()=>({matches:true});
      window.__records=Array.from({length:24},(_,i)=>({id:'entry-'+i,timestamp:1800000002000-i,firstOccurredAt:1800000000000,lastOccurredAt:1800000002000,version:'2.7.370-task994',build:'2026-11-10 12:00Z abc1234',category:'network',source:'advertising',level:'info',message:'広告APIが対象なしを返しました '+i,details:{reason:'not-found',phase:'response',statusCode:404,errorCode:'RESOURCE_NOT_FOUND',count:2,outcome:'failed'}}));
      window.__subscribers=[];window.NotificationJournal={list:async()=>__records,subscribe:f=>{__subscribers.push(f);return()=>{};},clear:async()=>{__records=[];return true;}};
      window.__copy='';Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async t=>{window.__copy=t;}}});
      window.__errors=[];window.addEventListener('error',e=>__errors.push(e.message));
      window.__panel=${panel};window.__dock=__panel.mountDock({container:document.getElementById('player'),button:document.getElementById('bell')});__dock.toggle();`);
    await wait(80);
    const scroll = await evaluate(`(()=>{const dock=document.querySelector('.zenzaNotificationDock'),view=document.querySelector('.zenzaNotificationHistory'),list=document.querySelector('.znh-list');return {outer:getComputedStyle(dock).overflowY,view:getComputedStyle(view).overflowY,list:getComputedStyle(list).overflowY,canScroll:view.scrollHeight>view.clientHeight};})()`);
    assert.deepStrictEqual(scroll,{outer:'hidden',view:'auto',list:'visible',canScroll:true});
    const button = await evaluate(`(()=>{const r=document.querySelector('[data-entry-id]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    for(const type of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...button});
    assert.strictEqual(await evaluate('document.querySelector(".znh-list").hidden'),true);
    assert.strictEqual(await evaluate('document.querySelector(".znh-detail").textContent.includes("2.7.370-task994")'),true);
    assert.strictEqual(await evaluate('document.querySelector(".znh-detail").textContent.includes("API変更")'),true);
    await evaluate('document.querySelector("[data-history-action=copy]").click()');await wait(30);
    assert.strictEqual(await evaluate('__copy.includes("初回発生") && __copy.includes("RESOURCE_NOT_FOUND")'),true);
    await evaluate('__records[0].recoveredAt=1800000003000; __records[0].details.outcome="recovered"; __subscribers.forEach(f=>f())');await wait(30);
    assert.strictEqual(await evaluate('document.querySelector(".znh-detail").textContent.includes("復旧済み")'),true);
    await evaluate('__dock.close(); __dock.toggle()');await wait(30);
    assert.strictEqual(await evaluate('document.activeElement.hasAttribute("data-history-back")'),true);
    await evaluate('document.querySelector("[data-history-back]").click()');await wait(30);
    assert.strictEqual(await evaluate('document.activeElement.dataset.entryId'), 'entry-0');
    await send('Emulation.setDeviceMetricsOverride',{width:360,height:640,deviceScaleFactor:1,mobile:false});
    assert.strictEqual(await evaluate('document.querySelector(".zenzaNotificationDock").getBoundingClientRect().right <= innerWidth'),true);
    await evaluate('__dock.dispose()');
    assert.strictEqual(await evaluate('document.querySelector(".zenzaNotificationDock")===null'),true);
    assert.deepStrictEqual(await evaluate('__errors'),[]);
    console.log('TASK994_CHROME_PASS single scroll, real click, detail, report, live recovery, back focus, narrow viewport, dispose');
  } catch (error) {console.error(error.stack); process.exitCode=1;}
  finally {
    if (chrome) {
      const closed = new Promise(resolve=>chrome.once('exit',resolve));
      try {await send('Browser.close');} catch (_) {chrome.kill();}
      await Promise.race([closed, wait(5000)]);
      if(chrome.exitCode===null && chrome.signalCode===null) {chrome.kill(); await Promise.race([closed,wait(3000)]);}
      console.log('TASK994_CHROME_CLOSED '+(chrome.exitCode!==null || chrome.signalCode!==null));
    }
    for (const item of pending.values()) clearTimeout(item.timer);
    ws?.close(); server?.close();
    // Leave temporary QA profile for recycle-bin maintenance; never direct-delete it.
  }
})();
