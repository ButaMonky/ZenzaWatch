const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const {createPrivateTransport}=require('./private-port.cjs');
const read=name=>fs.readFileSync(path.join(__dirname,'../../dist',name),'utf8');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function storage(initial=[]){
 const values=new Map(initial),listeners=new Map();let id=0;
 const gm={get:k=>values.get(k),set:(k,v)=>{const old=values.get(k);values.set(k,v);for(const [name,fn] of [...listeners.values()])if(name===k)queueMicrotask(()=>fn(k,old,v,true));},
 remove:k=>values.delete(k),listen:(k,fn)=>{listeners.set(++id,[k,fn]);return id;},unlisten:n=>listeners.delete(n)};
 return {values,gm};
}
function execute(w,code,store,extras={}){
 const bindings={GM_getValue:store.gm.get,GM_setValue:store.gm.set,GM_deleteValue:store.gm.remove,
 GM_addValueChangeListener:store.gm.listen,GM_removeValueChangeListener:store.gm.unlisten,
 _:require('lodash'),...extras};
 w.Function(...Object.keys(bindings),code)(...Object.values(bindings));
}
for(const mainFirst of [true,false])test('distributed main and launcher use separate GM stores, preserve preferences and main-owned login; main first='+mainFirst,async()=>{
 const parent=new JSDOM('',{url:'https://example.org/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:new VirtualConsole()}).window;
 const frame=parent.document.createElement('iframe');frame.src='https://www.nicovideo.jp/robots.txt#ticket';parent.document.body.append(frame);
 const w=frame.contentWindow;w.name='ZenzaWatchExternalTrialPlayer';w.document.open();w.document.write('<html><head></head><body></body></html>');w.document.close();
 // jsdom omits MessageEvent.source for postMessage; emulate the native same-frame delivery only.
 w.postMessage=data=>queueMicrotask(()=>w.dispatchEvent(new w.MessageEvent('message',{source:w,origin:w.location.origin,data})));
 Object.assign(w,{Headers,Request,Response,TextEncoder,TextDecoder});
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
 const companion=storage([
 ['player:ticket',{origin:'https://example.org',expires:Date.now()+60000,channel:'test-launch'}],
 ['settings-v2',{version:2,values:{screenMode:'small',menuScale:1.4}}],
 ['trial-settings-v2',{version:2,official:{screenMode:'small',menuScale:1.4},values:{screenMode:'small',menuScale:1.6}}],
 ['external-links-v1',{'externalLinks.textIds':true}]
 ]),main=storage();
 const mainRequests=[],messages=[],opened=[];
 const transport=createPrivateTransport(parent,companion.gm),port=transport.port('test-launch','parent');
 port.addEventListener('message',e=>{
  messages.push(e.data);
  if(e.data.type==='ready')port.postMessage({type:'open',id:'sm9',requestId:1});
 });
 w.__open=id=>opened.push(id);w.__config=null;
 let source=read('ZenzaWatch-dev.user.js')
  .replaceAll("new Function('u', 'return import(u)')","(() => Promise.resolve({}))")
  .replace('initialize:async()=>{await initialize();}','initialize:async()=>{window.__config=Config;}')
  .replace("open:id=>ZenzaWatch.external.open(id,{autoCloseFullScreen:false})","open:id=>window.__open(id)");
 const startMain=()=>execute(w,source,main,{GM_xmlhttpRequest:options=>{
  mainRequests.push(options.url);queueMicrotask(()=>options.onload({status:200,response:new TextEncoder().encode('{"meta":{"status":200},"data":{"mylists":[]}}').buffer,responseHeaders:'Content-Type: application/json',finalUrl:options.url}));return {abort(){}};
 }});
 const startCompanion=()=>execute(w,read('ZenzaBlogPartsButton.user.js'),companion,{GM_xmlhttpRequest:()=>{throw Error('launcher must not authenticate or play');}});
 try{
  if(mainFirst){startMain();startCompanion();}else{startCompanion();await wait(5);startMain();}
  for(let i=0;i<300&&!messages.some(m=>m.type==='opened'||m.type==='error');i++)await wait(10);
  assert.deepEqual(messages.filter(m=>m.type==='error'),[]);
  assert.deepEqual(opened,['sm9']);assert.ok(messages.some(m=>m.type==='opened'));
  assert.deepEqual(mainRequests,['https://nvapi.nicovideo.jp/v1/users/me/mylists']);
  assert.equal(w.__config.getValue('screenMode'),'small');assert.equal(w.__config.getValue('menuScale'),1.6);
  assert.equal(w.__config.getValue('externalLinks.textIds'),true);
  w.__config.setValue('externalLinks.textIds',false);
  for(let i=0;i<100&&companion.values.get('external-links-v1')['externalLinks.textIds']!==false;i++)await wait(10);
  assert.equal(companion.values.get('external-links-v1')['externalLinks.textIds'],false);
  companion.gm.set('external-links-v1',{'externalLinks.textIds':true});
  for(let i=0;i<100&&!w.__config.getValue('externalLinks.textIds');i++)await wait(10);
  assert.equal(w.__config.getValue('externalLinks.textIds'),true);
  assert.ok(!JSON.stringify(messages).includes('mylists'),'account response must never go to outer parent');
 }finally{w.dispatchEvent(new w.Event('pagehide'));transport.dispose();parent.close();}
});

test('normal main bootstrap stays in page realm without granting page code privileged APIs',async()=>{
 const w=new JSDOM('',{url:'https://www.nicovideo.jp/my',runScripts:'outside-only',virtualConsole:new VirtualConsole()}).window;
 const store=storage();let product,seen=0;
 const dependency=fs.readFileSync(require.resolve('lodash/lodash.min.js'),'utf8');
 const source=read('ZenzaWatch-dev.user.js').replace('return boot(monkey, PRODUCT, START_PAGE_QUERY);','window.__seenBoot(PRODUCT, window.ZenzaLib._.VERSION);');
 w.__seenBoot=(p,version)=>{product=p;seen++;assert.equal(version,require('lodash').VERSION);assert.equal(w.GM_xmlhttpRequest,undefined);};
 try{
  execute(w,source,store,{
   GM_getResourceText:()=>dependency,
   GM_addElement:(parent,tag,attrs)=>{const script=w.document.createElement(tag);script.textContent=attrs.textContent;parent.append(script);w.eval(attrs.textContent);return script;},
   GM_xmlhttpRequest:()=>{throw Error('normal bootstrap must not use external transport');}
  });
  await wait(10);assert.equal(product,'ZenzaWatch');assert.equal(seen,1);
  assert.equal(w.GM_getValue,undefined);assert.equal(w.document.querySelector('script'),null);
 }finally{w.dispatchEvent(new w.Event('pagehide'));w.close();}
});
