'use strict';
// Offline Chrome regression: bundled loader + preview renderer, synthetic inputs.
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const {extract}=require('../helpers/extractSource');
const root=path.resolve(__dirname,'../..'),built='dist/ZenzaWatch-dev.user.js';
const bundle=fs.readFileSync(path.join(root,built),'utf8');
assert(bundle.includes('2.7.372'),'Build Task996 before running this fixture');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-task996-'));
let chrome,ws,id=0;const pending=new Map();
function send(method,params={}){return new Promise((resolve,reject)=>{
 const seq=++id,timer=setTimeout(()=>{pending.delete(seq);reject(Error(method+' timeout'));},20000);
 pending.set(seq,{resolve,reject,timer});ws.send(JSON.stringify({id:seq,method,params}));
});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;}
(async()=>{try{
 const executable=process.env.CHROME_EXECUTABLE||path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe');
 chrome=await startChromeCdp(executable,profile);
 const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
 const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const msg=JSON.parse(event.data),item=pending.get(msg.id);
 if(msg.method==='Fetch.requestPaused'){send('Fetch.failRequest',{requestId:msg.params.requestId,errorReason:'BlockedByClient'}).catch(()=>{});return;}
 if(!item)return;clearTimeout(item.timer);pending.delete(msg.id);msg.error?item.reject(Error(JSON.stringify(msg.error))):item.resolve(msg.result);
 });
 await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'http*'}]});
 const modules=['Emitter','StoryboardInfoModel','SavedSceneLoader','Storyboard'].map(name=>extract(built,name)).join(';');
 await evaluate(`(async()=>{
 window.__errors=[];addEventListener('error',e=>__errors.push(e.message));addEventListener('unhandledrejection',e=>__errors.push(String(e.reason)));
 ${modules}
 window.__calls={meta:0,sheets:[],put:0,abort:0};window.__late=null;
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=16;const ctx=canvas.getContext('2d');ctx.fillStyle='#0a8';ctx.fillRect(0,0,32,16);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));const imageBytes=await blob.arrayBuffer();
 const raw={watchId:'sm9',format:'domand',status:'ok',duration:40,storyboard:{thumbnail:{width:16,height:16},columns:2,rows:1,interval:10000,count:4,images:[{url:'https://fixture.invalid/unused.png'},{url:'https://fixture.invalid/needed.png'}]}};
 const cache={captureGeneration:()=>1,getPreview:async()=>null,put:async()=>{__calls.put++;}};
 const loader=new SavedSceneLoader({cache,enabled:()=>true,loadMetadata:async(id,signal)=>{__calls.meta++;if(id==='sm8')return new Promise((resolve,reject)=>{__late=()=>resolve({...raw,watchId:id});signal.addEventListener('abort',()=>{__calls.abort++;reject(new DOMException('Cancelled','AbortError'));},{once:true});});return {...raw,watchId:id};},fetchImage:async(url)=>{__calls.sheets.push(url);return imageBytes;}});
 const StoryboardCacheDb=cache;
 const preview=Object.create(Storyboard.prototype);preview.config={props:{enableStoryboard:true,savedSceneFetch:true}};preview._savedScenes=loader;preview._currentVideoWatchId=null;preview.on=()=>{};preview.off=()=>{};
 window.__preview=preview;window.__loader=loader;window.__dispose=[];
 for(const [id,time] of [['sm9',21],['sm9',31]]){const host=document.createElement('div');host.style.cssText='width:160px;height:160px';document.body.append(host);__dispose.push(preview.createSavedPreview(host,id,time));}
 })()`);
 for(let i=0;i<100;i++){if(await evaluate('document.querySelectorAll("img").length===2 && [...document.images].every(i=>i.complete&&i.naturalWidth===32)'))break;await wait(30);}
 assert.strictEqual(await evaluate('[...document.images].filter(i=>i.complete&&i.naturalWidth===32).length'),2,'Both previews decode real PNGs');
 assert.deepStrictEqual(await evaluate('__calls.sheets'),['https://fixture.invalid/needed.png'],'Only required sheet fetched, once');
 assert.strictEqual(await evaluate('__calls.meta'),1,'Shared metadata');
 assert.strictEqual(await evaluate('new Set([...document.images].map(i=>i.src)).size'),1,'Shared object URL');
 assert.strictEqual(await evaluate('__preview._savedPreviewDecodedBytes'),2048,'Shared decoded reservation');
 await evaluate('__dispose[0]()');assert.strictEqual(await evaluate('document.images.length'),1);
 assert(await evaluate('__loader.activeResources>0'),'Remaining owner retains shared lease');
 await evaluate('__dispose[1]()');
 assert.strictEqual(await evaluate('__loader.activeResources'),0);
 assert.strictEqual(await evaluate('__preview._savedPreviewDecodedBytes'),0);
 const before=await evaluate('__calls.put');
 await evaluate('window.__hidden=document.createElement("div");document.body.append(__hidden);window.__cancel=__preview.createSavedPreview(__hidden,"sm8",21)');
 for(let i=0;i<50;i++){if(await evaluate('__late!==null'))break;await wait(20);}
 assert.strictEqual(await evaluate('__late!==null'),true,'Deferred metadata started');
 await evaluate('__cancel();__late()');await wait(50);
 assert.strictEqual(await evaluate('__calls.abort'),1,'Disposal aborts request');
 assert.strictEqual(await evaluate('__calls.put'),before,'Cancelled result cannot persist');
 assert.strictEqual(await evaluate('__hidden.children.length'),0,'Cancelled result cannot mount');
 assert.strictEqual(await evaluate('__loader.activeResources'),0);
 assert.deepStrictEqual(await evaluate('__errors'),[]);
 console.log('TASK996_CHROME_PASS bundled saved loader + real PNG previews, requested-sheet-only, coalescing, disposal and no late writes');
 }catch(error){console.error(error.stack);process.exitCode=1;}
 finally{
 if(chrome){const closed=new Promise(resolve=>chrome.once('exit',resolve));
 try{await send('Browser.close');}catch(_){chrome.kill();}
 await Promise.race([closed,wait(5000)]);
 if(chrome.exitCode===null&&chrome.signalCode===null){chrome.kill();await Promise.race([closed,wait(3000)]);}
 console.log('TASK996_CHROME_CLOSED '+(chrome.exitCode!==null||chrome.signalCode!==null));
 }
 for(const item of pending.values())clearTimeout(item.timer);ws?.close();
 // Retain owned temporary profile for recycle-bin maintenance.
 }
})();
