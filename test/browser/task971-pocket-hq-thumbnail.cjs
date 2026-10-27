'use strict';
// Offline Chromium: current watch HTML -> actual generated Pocket helper -> image.
// Every image request is intercepted; no NicoNico network or user browser profile.
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {extract}=require('../helpers/extractSource');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const root=path.resolve(__dirname,'../..');
const dist='dist/MylistPocket.user.js';
const code=['ThumbnailSourcePolicy','PocketThumbnail'].map(name=>
 'const '+name+'='+extract(dist,name,'var')+';').join('\n');
const executable=process.env.CHROME_EXECUTABLE||(process.platform==='win32'?
 path.join(process.env.LOCALAPPDATA||'','Google/Chrome/Application/chrome.exe'):
 ['google-chrome','chromium','chromium-browser'].map(name=>{
  const r=spawnSync('which',[name],{encoding:'utf8'});return r.status===0?r.stdout.trim():null;
 }).find(Boolean));
assert(executable&&fs.existsSync(executable),'Chrome executable missing');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zw-task971-'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let chrome,ws,seq=0;const pending=new Map(),imageRequests=[];let failOriginal=false;
async function send(method,params={}){
 const id=++seq;return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},15000);
  pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result?.value;
}
(async()=>{
 try{
  chrome=await startChromeCdp(executable,profile);
  const port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];
  const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true});});
  ws.addEventListener('message',event=>{
   const m=JSON.parse(event.data);
   if(m.method==='Fetch.requestPaused'){
    const {requestId,request}=m.params;imageRequests.push(request.url);
    if(failOriginal&&request.url.includes('/original/')){
     send('Fetch.failRequest',{requestId,errorReason:'Failed'}).catch(()=>{});return;
    }
    const w=request.url.includes('/original/')?1280:request.url.includes('/player/')?960:320;
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+w+'" height="'+(w*9/16)+'"><rect width="100%" height="100%" fill="#abc"/></svg>';
    send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[
     {name:'Content-Type',value:'image/svg+xml'},{name:'Cache-Control',value:'no-store'}],
     body:Buffer.from(svg).toString('base64')}).catch(()=>{});return;
   }
   const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);
   m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
  });
  await send('Page.enable');await send('Runtime.enable');
  await send('Fetch.enable',{patterns:[{urlPattern:'*',resourceType:'Image'}]});
  await send('Page.navigate',{url:'data:text/html,<html><body><img id="poster" style="width:384px;height:216px;object-fit:contain"></body></html>'});
  for(let i=0;i<30;i++){if(await evaluate('!!document.querySelector("#poster")'))break;await sleep(40);}
  await evaluate(code+';globalThis.pocket=PocketThumbnail;globalThis.calls=[];');
  const results=[];
  for(const [id,composite,fail] of [['sm971001',false,false],['sm971002',true,false],['sm971003',false,true]]){
   failOriginal=fail;
   const original='https://img.cdn.nimg.jp/original/'+id+'?key=test%2Bexact&size=original';
   const player='https://img.cdn.nimg.jp/player/'+id+'?key=player%2Fexact';
   const low='https://nicovideo.cdn.nimg.jp/low/'+id;
   const payload={data:{response:{$watchV4:{data:{video:{id,thumbnail:{
    ogp:composite?'https://goptim.video.nimg.jp/thumbnail/'+id:original,player,url:low}}}}}}};
   const html='<meta name="server-response" content="'+JSON.stringify(payload).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">';
   const count=await evaluate(`(async()=>{const urls=await pocket.getHighQuality(${JSON.stringify(id)},async(url,options)=>{calls.push({url,credentials:options.credentials});return new Response(${JSON.stringify(html)},{status:200});},'www.nicovideo.jp');pocket.install(document.querySelector('#poster'),urls);return urls.length;})()`);
   assert(count>=2);
   const expected=composite||fail?player:original;let image;
   for(let i=0;i<100;i++){
    image=await evaluate(`(()=>{const i=document.querySelector('#poster');return {src:i.src,width:i.naturalWidth,height:i.naturalHeight,complete:i.complete};})()`);
    if(image.complete&&image.width>0&&image.src===expected)break;await sleep(30);
   }
   assert.strictEqual(image.src,expected);assert.strictEqual(image.width,composite||fail?960:1280);
   results.push({id,composite,failedOriginal:fail,width:image.width,height:image.height});
  }
  assert(!imageRequests.some(u=>u.includes('goptim.video.nimg.jp')));
  const calls=await evaluate('calls');assert.strictEqual(calls.length,3);
  assert(calls.every(x=>!x.url.includes('?responseType=')&&x.credentials==='include'));
  // The same metadata request must restore structural HTML that thumbinfo strips.
  const description='First line<br><br>Wishlist: <a href="http://amzn.asia/9gA3HpS">http://amzn.asia/9gA3HpS</a><br>'+
   '<a href="https://www.nicovideo.jp/watch/sm46723246">sm46723246</a>&lt; previous '+
   '<a href="https://www.nicovideo.jp/watch/sm46778968">sm46778968</a> next';
  const html='<meta name="server-response" content="'+JSON.stringify({data:{response:{$watchV4:{data:{video:{id:'sm46751412',description}}}}}}).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">';
  const viewCode='const MylistPocket={};const util='+extract('src/_pocket.js','util','var')+';'+
   'const PocketDescriptionCard='+extract(dist,'PocketDescriptionCard','var')+';'+
   'const Emitter=class{};const VideoInfoView='+extract('src/_pocket.js','VideoInfoView','class')+';'+
   `util.hasLargeThumbnail=()=>false;
    const ThumbInfoLoader={load:async id=>({status:'ok',id,videoId:id,title:id,
      thumbnail:'https://nicovideo.cdn.nimg.jp/low/'+id,duration:10,
      owner:{type:'user',id:'1',name:'owner'}})};
    const AdDecorationLoader={load:async()=>new Map()};
    const PocketCardMetadataLoader={load:async()=>null};
    globalThis.testView=Object.create(VideoInfoView.prototype);
    const host=document.createElement('div');host.id='mylistPocket-popup';host.className='show';
    const desc=document.createElement('div');desc.className='description';host.append(desc);document.body.append(host);
    const style=document.createElement('style');style.textContent=PocketDescriptionCard.CSS;document.head.append(style);
    testView._hostDom=host;testView._slot={description:desc};testView._videoInfo={_rawData:{}};
    testView._descriptionCardsGeneration=0;testView._isZenzaReady=false;`;
  await evaluate(viewCode);
  await evaluate(`(async()=>{const metadata=await pocket.getPresentation('sm46751412',async()=>new Response(${JSON.stringify(html)},{status:200}),'www.nicovideo.jp');testView.updateDescription(testView._videoInfo,metadata.description);})()`);
  let descriptionResult;
  for(let i=0;i<50;i++){
   descriptionResult=await evaluate(`(()=>{const d=testView._slot.description,a=d.querySelector('a[href^="http://amzn.asia/"]');
     return {amazon:a?.getAttribute('href'),breaks:d.querySelectorAll('br').length,
       cards:[...d.querySelectorAll('.mpp-video-card')].map(n=>n.dataset.watchId),
       visibleLines:d.innerText.split('\\n').filter(Boolean).length};})()`);
   if(descriptionResult.cards.length===2)break;await sleep(30);
  }
  assert.strictEqual(descriptionResult.amazon,'http://amzn.asia/9gA3HpS');
  assert.deepStrictEqual(descriptionResult.cards,['sm46723246','sm46778968']);
  assert(descriptionResult.breaks>=3&&descriptionResult.visibleLines>=3);
  console.log('TASK971_CHROMIUM_PASS '+JSON.stringify({cases:results,imageRequests:imageRequests.length,
    compositedRequests:0,description:descriptionResult}));
 }catch(e){console.error('TASK971_CHROMIUM_FAIL '+e.message);process.exitCode=1;}
 finally{
  for(const p of pending.values())clearTimeout(p.timer);
  try{ws?.close();}catch(_){}try{chrome?.kill();}catch(_){}
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch(_){}
 }
})();
