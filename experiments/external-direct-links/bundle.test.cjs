const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const code=fs.readFileSync(path.join(__dirname,'ZenzaWatch-external-direct-trial.user.js'),'utf8');

test('shared runtime reaches configuration in isolated realm without loading the player or issuing account traffic',async()=>{
 const {VirtualConsole}=require('jsdom');
 const w=new JSDOM('',{url:'https://example.org/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}).window;
 w._=require('lodash');w.GM_getValue=()=>undefined;w.GM_setValue=()=>{};w.GM_deleteValue=()=>{};
 w.GM_addValueChangeListener=()=>1;w.GM_removeValueChangeListener=()=>{};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 let requests=0;w.fetch=()=>{requests++;throw Error('Unexpected traffic');};
 let instrumented=code.replace('Object.assign(externalTrial,privateTransport);',
  'Object.assign(externalTrial,privateTransport);window.__start=startRuntime;externalTrial.configure=value=>{window.__configured=value;};');
 // The DOM emulator has no dynamic browser imports. Keep this dependency
 // stub explicit: this is bootstrap coverage, not a playback success claim.
 instrumented=instrumented.replaceAll("new Function('u', 'return import(u)')","(() => Promise.resolve({}))");
 try {w.eval(instrumented);await w.__start();await new Promise(r=>w.setTimeout(r,40));
  assert.equal(typeof w.__configured?.api?.fetch,'function');assert.equal(typeof w.__configured?.initialize,'function');
  assert.equal(requests,0);assert.equal(w.document.querySelector('.zenzaPlayerContainer'),null);
  // Exercise the actual generated gate used by API calls and worker forwarding.
  Object.assign(w,{Headers,Request,Response,TextDecoder,TextEncoder});
  const gmCalls=[];
  w.GM_xmlhttpRequest=options=>{gmCalls.push(options);queueMicrotask(()=>options.onload({status:200,response:new TextEncoder().encode('{"ok":true}').buffer,responseHeaders:'Content-Type: application/json',finalUrl:options.url}));return {abort(){}};};
  for(const endpoint of ['https://nvapi.nicovideo.jp/v1/test','https://public.nvcomment.nicovideo.jp/v1/test']){
    const response=await w.__configured.api.fetch(endpoint,{method:'POST',body:'{}',headers:{'Content-Type':'application/json'}});
    assert.deepEqual(await response.json(),{ok:true});
  }
  const wire=await w.__configured.api.fetch('https://nvapi.nicovideo.jp/v1/test',{_format:'arraybuffer'});
  assert.ok(wire.buffer.byteLength>0);assert.equal(gmCalls.length,3);assert.equal(requests,0);
  w.GM_xmlhttpRequest=options=>{queueMicrotask(()=>options.onload({status:204,response:new ArrayBuffer(0),finalUrl:options.url,responseHeaders:''}));return {abort(){}};};
  const empty=await w.__configured.api.fetch('https://nvapi.nicovideo.jp/v1/test',{method:'DELETE'});
  assert.equal(empty.status,204);assert.equal(await empty.text(),'');
 } finally {w.close();}
});

test('installing the bundle only mounts buttons: no network, workers, or player',async()=>{
 const w=new JSDOM('<a href="https://www.nicovideo.jp/watch/sm9">video</a><a href="/watch/sm9">local</a>',
  {url:'https://example.org/',runScripts:'outside-only'}).window;
 let requests=0,writes=0;w.fetch=()=>{requests++;throw Error('Unexpected network');};
 w.GM_getValue=()=>false;w.GM_setValue=()=>{writes++;};w.Worker=()=>{throw Error('Unexpected worker');};
 w.eval(code);await new Promise(r=>w.setTimeout(r,35));
 assert.equal(w.document.querySelectorAll('[data-zenza-direct-button]').length,1);
 assert.equal(w.ZenzaWatch,undefined);assert.equal(requests,0);assert.equal(writes,0);
 w.document.querySelector('button').click();await new Promise(r=>w.setTimeout(r,0));
 assert.equal(writes,0,'scripted clicks cannot enable authenticated bridging');
 assert.equal(requests,0);w.close();
});
test('official pages are untouched by the trial entry',()=>{
 const w=new JSDOM('<a href="https://www.nicovideo.jp/watch/sm9">video</a>',{url:'https://www.nicovideo.jp/my',runScripts:'outside-only'}).window;
 w.eval(code);assert.equal(w.document.querySelector('button'),null);assert.equal(w.ZenzaWatch,undefined);w.close();
});
test('trial keeps the destination whitelist and confines extra source permission to enabled HTTPS origins',async()=>{
 const begin=code.indexOf('const gate = () => {'),end=code.indexOf('return { post, parseUrl, isNicoServiceHost, isWhiteHost, uFetch, xFetch, init };',begin);
 assert.ok(begin>0&&end>begin);
 const gateSource=code.slice(begin,code.indexOf('};',code.indexOf('};',end)+2)+2)+'\nwindow.testGate=gate();';
 const w=new JSDOM('',{url:'https://www.nicovideo.jp/robots.txt',runScripts:'outside-only'}).window;
 w.externalTrial={isEnabledOrigin:o=>o==='https://example.org'};w.PRODUCT='ZenzaWatchExternalTrial';
 w.eval(gateSource);
 assert.equal(w.testGate.isWhiteHost('https://example.org/page'),true);
 assert.equal(w.testGate.isWhiteHost('https://evil.example/'),false);
 assert.equal(w.testGate.isWhiteHost('http://example.org/'),false);
 assert.equal(w.testGate.isWhiteHost('https://account.nicovideo.jp/'),false);
 await assert.rejects(w.testGate.uFetch({url:'https://example.org/steal',options:{}}));
 w.close();
});
test('trial excludes old navigation interception and preserves original installation metadata separately',()=>{
 assert.ok(!code.includes('new HoverMenu({ playerConfig: Config })'));
 assert.ok(!code.includes('replaceRedirectLinks().catch('));
 assert.ok(!code.includes('initializeLastSession(dialog);'));
 assert.ok(!code.includes("dispatchCustomEvent(document.body, 'BeforeZenzaWatchInitialize'"));
 assert.ok(!code.includes("dispatchCustomEvent(document.body, 'ZenzaWatchInitialize'"));
 const header=code.slice(0,code.indexOf('// ==/UserScript=='));
 assert.ok(!header.includes('@updateURL'));assert.ok(!header.includes('@downloadURL'));
 assert.ok(header.includes('0.2.0-external-direct2'));
 assert.ok(code.includes("var VER = '2.7.383-external-direct.2'"));
 assert.ok(code.includes('const response=await externalTrial.gm.fetch(url,options);'));
 assert.ok(code.includes('loader: externalTrial.gm.Loader, fLoader: externalTrial.gm.Loader, pLoader: externalTrial.gm.Loader'));
 assert.ok(code.includes("video.setAttribute('use-native-hls', 'no');"));
 assert.ok(header.includes('@grant        GM_xmlhttpRequest'));
 assert.ok(!header.includes('@connect      *'));
});
