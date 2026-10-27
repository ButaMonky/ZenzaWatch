'use strict';
// Task957: computed CSS and hit-testing of Pocket's actual description cards.
const assert=require('assert'),fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {startChromeCdp}=require('../helpers/startChromeCdp');
const {createContext,extract,run}=require('../helpers/extractSource');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'src/_pocket.js'),'utf8');
const start=source.indexOf('      #mylistPocket-popup .description a');
const end=source.indexOf('      #mylistPocket-popup .watch {',start);
assert(start>=0&&end>start,'legacy popup link CSS moved');
const legacy=source.slice(start,end);
// Simulate the actual optional NG stylesheet, which adds a
// display:block!important fallback when NG is disabled.
const ngStart=source.indexOf('      body.is-ng-disable .is-ng-rejected {');
const ngEnd=source.indexOf('      /* チャンネル検索 */',ngStart);
assert(ngStart>=0&&ngEnd>ngStart,'legacy NG disabled CSS moved');
const legacyNg=source.slice(ngStart,ngEnd);
const ctx=createContext();
run('const PocketDescriptionCard='+extract('packages/zenza/src/pocket/PocketDescriptionCard.js',
  'PocketDescriptionCard','var')+';this.cards=PocketDescriptionCard;',ctx);
const css=legacy+'\n'+ctx.cards.CSS+'\n'+legacyNg;
const html='<!doctype html><html><head><meta charset="utf-8"><style>'+css+'</style></head>'+
 '<body><div id="mylistPocket-popup" class="show"><div class="description">'+
 '<a class="ordinary" href="https://www.nicovideo.jp/watch/sm111">古い通常リンク</a>'+
 '<div class="mpp-video-card is-adDecoration-gold"><a class="mpp-card-thumb" href="https://www.nicovideo.jp/watch/sm222"><img src="data:," alt=""></a>'+
 '<div class="mpp-card-body"><a class="mpp-card-title" href="https://www.nicovideo.jp/watch/sm222">長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します長い動画タイトル：前後の動画を確認します</a>'+
 '<div class="mpp-card-counters"><span>再生: 2,821</span><span>いいね: 95</span></div>'+
 '<div class="mpp-card-actions"><a class="mpp-card-owner" href="https://www.nicovideo.jp/user/188548">'+
 '<img class="mpp-card-owner-icon" alt=""><span class="mpp-card-owner-name">とても長い名前の投稿者さんのテスト</span></a>'+
 '<button class="mpp-card-info">動画情報</button></div></div></div></div></div></body></html>';
const executable=process.env.CHROME_EXECUTABLE||
 (process.platform==='win32'?path.join(process.env.LOCALAPPDATA||'',
  'Google/Chrome/Application/chrome.exe'):
  ['google-chrome','chromium','chromium-browser'].map(name=>{
    const result=spawnSync('which',[name],{encoding:'utf8'});
    return result.status===0?result.stdout.trim():null;
  }).find(Boolean));
assert(executable&&fs.existsSync(executable),'Chrome executable not found');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'zenza-task957-'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let chrome,ws,seq=0;const pending=new Map();
async function send(method,params={}){
 const id=++seq;return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},12000);
  pending.set(id,{resolve,reject,timeout});ws.send(JSON.stringify({id,method,params}));
 });
}
async function evaluate(expression){
 const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result?.value;
}
(async()=>{
 try {
  chrome=await startChromeCdp(executable,profile);
  let port;
  for(let i=0;i<35&&!port;i++){
   try{port=fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split(/\r?\n/)[0];}
   catch(error){if(!['EBUSY','EPERM'].includes(error.code))throw error;await wait(100);}
  }
  assert(port,'Chrome CDP port unavailable');
  const tab=await(await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
   ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});
  });
  ws.addEventListener('message',event=>{
   const m=JSON.parse(event.data),p=pending.get(m.id);if(!p)return;
   clearTimeout(p.timeout);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);
  });
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url:'data:text/html;charset=utf-8,'+encodeURIComponent(html)});
  for(let i=0;i<45;i++){
   if(await evaluate('document.readyState==="complete" && !!document.querySelector(".mpp-card-title")'))break;
   await wait(70);
  }
  const output=[];
  for(const width of [1280,640,380]) {
   await send('Emulation.setDeviceMetricsOverride',{width,height:720,deviceScaleFactor:1,mobile:false});
   const actual=await evaluate(`(()=>{
    const el=document.querySelector('.mpp-card-title'),style=getComputedStyle(el);
    const ordinary=getComputedStyle(document.querySelector('a.ordinary'));
    const button=getComputedStyle(document.querySelector('button.mpp-card-info'));
    const badge=getComputedStyle(document.querySelector('.mpp-card-thumb'),'::after');
    const card=document.querySelector('.mpp-video-card');
    const owner=document.querySelector('.mpp-card-owner');
    const authorName=document.querySelector('.mpp-card-owner-name');
    const avatar=document.querySelector('.mpp-card-owner-icon');
    const like=document.querySelector('.mpp-card-counters');
    const cardBox=card.getBoundingClientRect(),ownerBox=owner.getBoundingClientRect();
    const buttonBox=document.querySelector('.mpp-card-info').getBoundingClientRect();
    const avatarBox=avatar.getBoundingClientRect();
    const rect=el.getBoundingClientRect();
    return {width:window.innerWidth,color:style.color,weight:style.fontWeight,
      display:style.display,webkitLineClamp:style.webkitLineClamp,
      normalColor:ordinary.color,buttonMargin:button.margin,
      inside:rect.width>0&&rect.left>=0&&rect.right<=window.innerWidth,
      height:rect.height,scrollHeight:el.scrollHeight,lineHeight:style.lineHeight,fontSize:style.fontSize,overflow:style.overflow,
      badgeImage:badge.backgroundImage.includes('data:image/svg+xml'),badgeWidth:badge.width,badgeHeight:badge.height,
      ownerColor:getComputedStyle(owner).color,ownerDisplay:getComputedStyle(owner).display,
      ownerOverflows:getComputedStyle(authorName).textOverflow,
      avatarSize:[Math.round(avatarBox.width),Math.round(avatarBox.height)],
      ownerInside:ownerBox.left>=cardBox.left&&ownerBox.right<=cardBox.right,
      ownerBeforeButton:ownerBox.right<=buttonBox.left+0.5,
      buttonRightGap:Math.round(cardBox.right-buttonBox.right),
      likeVisible:like.textContent.includes('いいね: 95')};
   })()`);
   assert.strictEqual(actual.width,width);
   assert.strictEqual(actual.color,'rgb(244, 243, 233)',JSON.stringify(actual));
   assert(['bold','700'].includes(actual.weight),JSON.stringify(actual));
   assert(actual.height>0 && actual.height<=42,JSON.stringify(actual));
   assert(actual.scrollHeight>actual.height+6,JSON.stringify(actual));
   assert.strictEqual(actual.webkitLineClamp,'2',JSON.stringify(actual));
   assert.strictEqual(actual.normalColor,'rgb(255, 255, 0)',JSON.stringify(actual));
   assert.strictEqual(actual.buttonMargin,'0px',JSON.stringify(actual));
   assert(actual.inside,JSON.stringify(actual));
   assert(actual.badgeImage,JSON.stringify(actual));
   assert.strictEqual(actual.badgeWidth,'22px',JSON.stringify(actual));
   assert.strictEqual(actual.ownerColor,'rgb(198, 200, 203)',JSON.stringify(actual));
   assert.strictEqual(actual.ownerDisplay,'flex',JSON.stringify(actual));
   assert.strictEqual(actual.ownerOverflows,'ellipsis',JSON.stringify(actual));
   assert.deepStrictEqual(actual.avatarSize,[20,20]);
   assert.strictEqual(actual.ownerInside,true,JSON.stringify(actual));
   assert.strictEqual(actual.ownerBeforeButton,true,JSON.stringify(actual));
   assert(actual.buttonRightGap>=0 && actual.buttonRightGap<=8,JSON.stringify(actual));
   assert.strictEqual(actual.likeVisible,true);
   output.push(actual);
  }
  const badges=await evaluate(`(()=>{
   const row=document.querySelector('.mpp-video-card');
   const thumb=row.querySelector('.mpp-card-thumb');
   const gold=getComputedStyle(thumb,'::after').backgroundImage;
   row.classList.replace('is-adDecoration-gold','is-adDecoration-silver');
   const silver=getComputedStyle(thumb,'::after').backgroundImage;
   row.classList.remove('is-adDecoration-silver');
   const normal=getComputedStyle(thumb,'::after').backgroundImage;
   return {gold:gold.includes('data:image/svg+xml'),
     silver:silver.includes('data:image/svg+xml'),different:gold!==silver,
     normal:normal==='none'};
  })()`);
  assert.deepStrictEqual(badges,{gold:true,silver:true,different:true,normal:true});
  const ng=await evaluate(`(()=>{
    const card=document.querySelector('.mpp-video-card');
    const display=()=>getComputedStyle(card).display;
    const initial=display();
    card.classList.add('is-ng-queue');
    const queued=getComputedStyle(card).outlineStyle;
    card.classList.remove('is-ng-queue');
    card.classList.add('is-fav-favorited');
    const favorited=getComputedStyle(card).outlineStyle;
    card.classList.add('is-ng-rejected');
    const rejected=display();
    document.body.classList.add('is-ng-disable');
    const restored=display(),opacity=getComputedStyle(card).opacity;
    document.body.classList.remove('is-ng-disable');
    const rejectedAgain=display();
    return {initial,queued,favorited,rejected,restored,opacity,rejectedAgain};
  })()`);
  assert.deepStrictEqual(ng,{
    initial:'grid',queued:'dotted',favorited:'dotted',rejected:'none',
    restored:'grid',opacity:'0.5',rejectedAgain:'none'
  });
  console.log('TASK957_POCKET_CSS_CHROMIUM_PASS '+JSON.stringify({widths:output,badges,ng}));
 } catch(error){console.error('TASK957_POCKET_CSS_CHROMIUM_FAIL '+error.stack);process.exitCode=1;}
 finally {
  for(const p of pending.values())clearTimeout(p.timeout);
  try{ws?.close()}catch(_){}try{chrome?.kill()}catch(_){}
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100})}catch(_){}
 }
})();
