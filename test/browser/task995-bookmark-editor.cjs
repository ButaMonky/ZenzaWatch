'use strict';
// Offline Chrome fixture of bundled bookmark dock and actual player click handler.
// Synthetic bookmark records only; external requests are blocked.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const {startChromeCdp} = require('../helpers/startChromeCdp');
const root = path.resolve(__dirname, '../..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-task995-'));
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
    const {extract}=require('../helpers/extractSource');
    const built='dist/ZenzaWatch-dev.user.js';
    const modules='const displayTime='+extract(built,'displayTime','var')+';const contentSelector='+extract(built,'contentSelector','var')+';'+extract(built,'ManualBookmarkPanel')+';'+extract(built,'ManualBookmarkDock')+';';
    const dialog=fs.readFileSync(path.join(root,'src/NicoVideoPlayerDialog.js'),'utf8');
    const from=dialog.indexOf("container.addEventListener('click'");
    const playerClick=dialog.slice(from,dialog.indexOf("container.addEventListener('command'",from));
    assert(from>=0 && playerClick.includes('e.preventDefault()'));
    await evaluate(`document.body.innerHTML='<div id="player" class="zenzaPlayerContainer" style="position:relative;width:800px;height:700px"></div><div class="zenzaWatchVideoInfoPanel"><div class="tabs videoInfoTab"><div class="zenzaWatchVideoInfoPanelContent"></div></div></div>';
      window.matchMedia=()=>({matches:true});window.__errors=[];window.addEventListener('error',e=>__errors.push(e.message));
      ${modules}
      const container=document.getElementById('player'),classList=container.classList,config={props:{enableTogglePlayOnClick:true}},global={emitter:{emitAsync(){window.__playerClicks++;}}},onCommand=()=>{};
      window.__playerClicks=0;${playerClick}
      window.__snapshot={status:'ready',videoId:'sm1',bookmarks:[{id:'one',videoId:'sm1',time:20,label:'scene',createdAt:1,updatedAt:1}]};let subscriber;
      const session={get snapshot(){return __snapshot},subscribe(f){subscriber=f;f(__snapshot);return()=>{};},refreshIfIdle:async()=>{},remove:async id=>{__snapshot={...__snapshot,bookmarks:__snapshot.bookmarks.filter(x=>x.id!==id)};subscriber(__snapshot);},dispose(){}};
      window.__recording=true;window.__dock=ManualBookmarkDock.mount(document.body,session,{currentVideoId:()=> 'sm1',currentTime:()=>25,timestamp:()=>2,newId:()=> 'new',seek:()=>{},duration:()=>200,automaticTime:()=>15,recordingEnabled:()=>__recording,setRecordingEnabled:value=>{__recording=value;}});__dock.toggle(container);`);
    async function click(selector){
      const point=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      for(const type of ['mousePressed','mouseReleased'])await send('Input.dispatchMouseEvent',{type,button:'left',clickCount:1,...point});await wait(30);
    }
    await click('.zw-automatic-edit > summary');assert.strictEqual(await evaluate('document.querySelector(".zw-automatic-edit").open'),true);
    await click('[data-recording-enabled]');assert.strictEqual(await evaluate('__recording'),false);
    await click('[data-point-tab="manual"]');await click('.zw-bookmark-edit > summary');assert.strictEqual(await evaluate('document.querySelector(".zw-bookmark-edit").open'),true);
    await click('[data-bookmark-action="remove"]');assert.strictEqual(await evaluate('__snapshot.bookmarks.length'),0);
    assert.strictEqual(await evaluate('__playerClicks'),0);await evaluate('document.getElementById("player").click()');assert.strictEqual(await evaluate('__playerClicks'),1);
    await evaluate('__dock.dispose()');assert.deepStrictEqual(await evaluate('__errors'),[]);
    console.log('TASK995_CHROME_PASS actual player handler, editors, recording checkbox, delete, player isolation');
  } catch (error) {console.error(error.stack); process.exitCode=1;}
  finally {
    if (chrome) {
      const closed = new Promise(resolve=>chrome.once('exit',resolve));
      try {await send('Browser.close');} catch (_) {chrome.kill();}
      await Promise.race([closed, wait(5000)]);
      if(chrome.exitCode===null && chrome.signalCode===null) {chrome.kill(); await Promise.race([closed,wait(3000)]);}
      console.log('TASK995_CHROME_CLOSED '+(chrome.exitCode!==null || chrome.signalCode!==null));
    }
    for (const item of pending.values()) clearTimeout(item.timer);
    ws?.close(); server?.close();
    // Leave temporary QA profile for recycle-bin maintenance; never direct-delete it.
  }
})();
