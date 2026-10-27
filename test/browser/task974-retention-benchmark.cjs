'use strict';
// Offline real Chromium: actual playlist model + lazy item view + session saving.
// Separate temporary profile, localhost-only assets, no user's browser storage.
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http'),assert=require('assert');
const {spawnSync}=require('child_process');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const root=path.resolve(__dirname,'../..');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zw-task974-'));
const chromeBin=process.env.CHROME_EXECUTABLE||(process.platform==='win32'?path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'):['google-chrome','chromium','chromium-browser'].map(x=>{const r=spawnSync('which',[x],{encoding:'utf8'});return r.status===0?r.stdout.trim():null;}).find(Boolean));
assert(chromeBin&&fs.existsSync(chromeBin),'Chrome not found');
const extra=String.raw`
<script type="module">
while(!window.scrollFixture)await new Promise(r=>setTimeout(r,50));
const text=await(await fetch('../../packages/zenza/src/Playlist/PlayListSession.js')).text();
const session=new Function('sessionStorage','window',text.split('//===BEGIN===')[1].split('//===END===')[0]+';return PlayListSession;')(sessionStorage,window);
window.runRetentionBenchmark=async n=>{
 const {model,view,doc}=window.scrollFixture;const Item=model.items[0].constructor;
 model.maxItems=n;const start=performance.now();
 const items=Array.from({length:n},(_,i)=>new Item({id:'sm'+(i+1),uniq_id:'sm'+(i+1),title:'性能確認用の動画タイトル '+(i+1)+' / '+('説明'.repeat(20)),view_counter:123456,num_res:456,mylist_counter:23,like:17,length_seconds:180,thumbnail_url:'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="72"/%3E',first_retrieve:'2026/01/01'}));
 model.setItem(items);const modelMs=performance.now()-start;
 const renderStart=performance.now();await view._onModelUpdate(model.items);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const renderMs=performance.now()-renderStart;
 const reverseStart=performance.now();model.reverse();await view._onModelUpdate(model.items);await new Promise(requestAnimationFrame);const reverseMs=performance.now()-reverseStart;
 const serializeStart=performance.now();const data={items:model.serialize(),index:Math.floor(n/2),enable:true,loop:false};const json=JSON.stringify(data);const serializeMs=performance.now()-serializeStart;
 sessionStorage.setItem('task974-unrelated','keep');const saveStart=performance.now();session.save(data);const saveMs=performance.now()-saveStart;const restored=session.restore();
 const activePreserved=restored&&restored.items[restored.index].id===data.items[data.index].id;
 return {count:n,modelMs,renderMs,reverseMs,serializeMs,saveMs,jsonUtf8Bytes:new TextEncoder().encode(json).length,jsonUtf16Bytes:json.length*2,restoredItems:restored?.items.length||0,activePreserved,unrelatedPreserved:sessionStorage.getItem('task974-unrelated')==='keep',shells:doc.querySelectorAll('.videoItem').length,expanded:doc.querySelectorAll('.counter').length};
};
</script>`;
let base=fs.readFileSync(path.join(root,'test/browser/playlist-scroll-content.html'),'utf8');
base=base.replace('maxItems:2000','maxItems:10000').replace('Math.min(2000,','Math.min(10000,');
const server=http.createServer((req,res)=>{
 try{const u=new URL(req.url,'http://localhost');if(u.pathname==='/test/browser/task974-bench.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(base+extra);return;}
 const p=path.resolve(root,'.'+decodeURIComponent(u.pathname));if(!p.startsWith(root+path.sep)||!fs.statSync(p).isFile()){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});fs.createReadStream(p).pipe(res);
 }catch(_){res.writeHead(404);res.end();}
});
let chrome,ws,id=0;const pending=new Map();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function send(method,params={}){const key=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(key);reject(Error(method+' timeout'));},120000);pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 chrome=await startChromeCdp(chromeBin,profile);
 const cport=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
 const tab=await(await fetch('http://127.0.0.1:'+cport+'/json/new?about:blank',{method:'PUT'})).json();ws=new WebSocket(tab.webSocketDebuggerUrl);
 await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);});
 await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/test/browser/task974-bench.html?count=1'});
 for(let i=0;i<200;i++){if(await evaluate('typeof runRetentionBenchmark==="function"'))break;await sleep(100);}
 assert(await evaluate('typeof runRetentionBenchmark==="function"'),'fixture did not initialize');
 const results=[];for(const count of [3000,10000]){
  const r=await evaluate('runRetentionBenchmark('+count+')');console.log('TASK974_BROWSER_RAW '+JSON.stringify(r));assert.strictEqual(r.shells,count);assert(r.expanded>0&&r.expanded<count);assert(r.activePreserved&&r.unrelatedPreserved);results.push(r);console.log('TASK974_BROWSER_SAMPLE '+JSON.stringify(r));await sleep(200);
 }
 const report={node:process.version,chrome:(await send('Browser.getVersion')).product,platform:process.platform,cpu:os.cpus()[0]?.model,memoryGiB:Math.round(os.totalmem()/1024**3),scope:'synthetic local data; actual model/lazy renderer/session; separate headless profile; single run, not universal guarantee',results};
 const target=process.env.TASK974_BENCHMARK_REPORT||path.join(os.tmpdir(),'task974-benchmark.json');fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');console.log('TASK974_BROWSER_BENCHMARK_PASS');
 }catch(e){console.error('TASK974_BROWSER_BENCHMARK_FAIL '+e.message);process.exitCode=1;}
 finally{for(const p of pending.values())clearTimeout(p.timer);try{ws?.close();}catch(_){}try{chrome?.kill();}catch(_){}server.closeAllConnections?.();server.close();try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch(_){}}
})();
