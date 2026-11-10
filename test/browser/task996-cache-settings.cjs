'use strict';
// Offline Chrome fixture of the shipped bundle. Only player startup is bypassed;
// Config, panel factory, model, UI, and controller are the real distribution code.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const {startChromeCdp} = require('../helpers/startChromeCdp');
const root = path.resolve(__dirname, '../..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'zenza-task996-settings-'));
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
    await evaluate(fs.readFileSync(require.resolve('lodash/lodash.min.js'), 'utf8'));
    let source = fs.readFileSync(path.join(root, 'dist/ZenzaWatch-dev.user.js'), 'utf8');
    assert(source.includes('2.7.372'),'Build Task996 before running this fixture');
    const start = 'boot(monkey, PRODUCT, START_PAGE_QUERY);';
    assert.strictEqual(source.split(start).length, 2);
    source = source.replace(start, 'window.__testMonkey = monkey;');
    const anchor = "if (window.name === 'commentLayerFrame') {";
    assert.strictEqual(source.split(anchor).length, 2);
    source = source.replace(anchor, 'window.__settingsFixture = {Config, createAdvancedSettingsPanel, AdvancedSettingsController, ShortcutKeyEmitter, StoryboardCacheDb}; window.ZenzaWatch = ZenzaWatch;\n' + anchor);
    await evaluate('window.alert = message => {window.__fixtureErrors.push("alert: "+message);}; window.name="commentLayerFrame"; window.__fixtureErrors=[]; window.addEventListener("error",e=>__fixtureErrors.push(e.message)); window.addEventListener("unhandledrejection",e=>__fixtureErrors.push(String(e.reason)));');
    await evaluate(source);
    await evaluate('window.ZenzaLib.dimport = async () => ({}); window.__testMonkey("ZenzaWatch", "")');
    const initial = await evaluate(`(async()=>{
      const f=window.__settingsFixture;
      window.__cacheFixture={bytes:2097152,entries:2,clears:0};
      localStorage.setItem('__fixtureBookmarks',JSON.stringify([{watchId:'sm9',time:21,label:'keep'}]));
      f.StoryboardCacheDb.stats=async()=>({bytes:__cacheFixture.bytes,entries:__cacheFixture.entries});
      f.StoryboardCacheDb.clear=async()=>{__cacheFixture.clears++;__cacheFixture.bytes=0;__cacheFixture.entries=0;};

      window.__keyEvents=[]; f.ShortcutKeyEmitter.create(f.Config,document.body,{promise:async()=>{},on(){}}).on('keyDown',name=>__keyEvents.push(name));
      window.__controller=new f.AdvancedSettingsController({config:f.Config,createPanel:c=>f.createAdvancedSettingsPanel(c,window._),document});
      await __controller.open();
      return {panels:document.querySelectorAll('.zenzaAdvancedSettingPanel').length,modern:!!document.querySelector('[data-zw-save]'),visible:document.querySelector('.zenzaAdvancedSettingPanel').classList.contains('show')};
    })()`);
    assert.deepStrictEqual(initial, {panels:1,modern:true,visible:true});
    const defaults=await evaluate(`({
      max:__settingsFixture.Config.getValue('storyboardCacheMaxMB'),
      days:__settingsFixture.Config.getValue('storyboardCacheDays'),
      fetch:__settingsFixture.Config.getValue('savedSceneFetch')
    })`);
    assert.deepStrictEqual(defaults,{max:128,days:7,fetch:true});
    await evaluate(`(()=>{
      document.querySelector('[data-zw-major="画面・映像"]').click();
      document.querySelector('[data-zw-sub="画面・映像|シーンサムネイルのキャッシュ"]').click();
    })()`);
    await wait(100);
    assert.deepStrictEqual(await evaluate(`({
      max:document.querySelector('[data-zw-choice="storyboardCacheMaxMB"].is-selected').dataset.zwValue,
      days:document.querySelector('[data-zw-choice="storyboardCacheDays"].is-selected').dataset.zwValue,
      fetch:document.querySelector('[data-setting-name="savedSceneFetch"]').checked
    })`),{max:'128',days:'7',fetch:true});
    assert.strictEqual(await evaluate('document.querySelector("[data-zw-scene-cache-usage]").textContent.includes("2.0 MB")'),true);
    const before=await evaluate('localStorage.getItem("__fixtureBookmarks")');
    await evaluate(`(()=>{
      const capacity=document.querySelector('[data-zw-choice="storyboardCacheMaxMB"][data-zw-value="0"]');
      if(!capacity)throw Error('zero capacity missing');
      capacity.click();
      const fetch=document.querySelector('[data-setting-name="savedSceneFetch"]');
      fetch.checked=false;fetch.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    assert.strictEqual(await evaluate('__settingsFixture.Config.getValue("storyboardCacheMaxMB")'),128,'draft before save');
    await evaluate('document.querySelector("[data-zw-save]").click()');
    assert.strictEqual(await evaluate('__settingsFixture.Config.getValue("storyboardCacheMaxMB")'),0);
    assert.strictEqual(await evaluate('__settingsFixture.Config.getValue("savedSceneFetch")'),false);
    await evaluate('__controller.open()');
    await evaluate('document.querySelector("[data-zw-clear-scene-cache]").click()');
    await wait(100);
    assert.strictEqual(await evaluate('__cacheFixture.clears'),1);
    assert.strictEqual(await evaluate('document.querySelector("[data-zw-scene-cache-usage]").textContent.includes("0.0 MB")'),true);
    assert.strictEqual(await evaluate('localStorage.getItem("__fixtureBookmarks")'),before,'image clear must preserve bookmarks');
    assert.strictEqual(await evaluate('document.querySelector("[data-zw-clear-scene-cache]").parentElement.querySelector("[role=status]").textContent.includes("削除しました")'),true);
    assert.deepStrictEqual(await evaluate('__fixtureErrors'),[]);
    await evaluate('__controller.dispose()');
    console.log('TASK996_SETTINGS_CHROME_PASS bundled defaults 128MB/7days, capacity zero/save, fetch toggle, usage and image-only clear');
  } catch (error) {console.error(error.stack); process.exitCode=1;}
  finally {
    if (chrome) {
      const closed = new Promise(resolve=>chrome.once('exit',resolve));
      try {await send('Browser.close');} catch (_) {chrome.kill();}
      await Promise.race([closed, wait(5000)]);
      if(chrome.exitCode===null && chrome.signalCode===null) {chrome.kill(); await Promise.race([closed,wait(3000)]);}
      console.log('TASK996_SETTINGS_CHROME_CLOSED '+(chrome.exitCode!==null || chrome.signalCode!==null));
    }
    for (const item of pending.values()) clearTimeout(item.timer);
    ws?.close(); server?.close();
    // Leave temporary QA profile for recycle-bin maintenance; never direct-delete it.
  }
})();
