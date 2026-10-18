'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawn,spawnSync}=require('child_process');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..'),out=path.join(root,'tools/typescript-stage1/.generated/scui-browser');
process.chdir(root);
require('./scui-browser-check.cjs');
let html=fs.readFileSync(path.join(out,'fixture.html'),'utf8');
const oldTest=fs.readFileSync('test/browser/scui-live-layouts.js','utf8');
html=html.replace(oldTest,fs.readFileSync('tools/qa/scui-redesign-fixture.js','utf8'));
function css(file,tag){const source=fs.readFileSync(file,'utf8'),start=source.indexOf(tag+' = (\x60');
 if(start<0)throw Error('Native CSS missing '+tag);const a=source.indexOf('\x60',start)+1,b=source.indexOf('\x60).trim()',a);return source.slice(a,b);}
html=html.replace('</style>','</style><style>'+css('src/VideoControlBar.js','SeekBarToolTip.__css__')+
 css('packages/zenza/src/storyboard/SeekBarThumbnail.js','SeekBarThumbnail.__css__')+
 '#player:fullscreen{margin:0;width:100vw;height:100vh}#seek{z-index:20} .videoPlayer{pointer-events:auto}</style>');
const baseline=process.argv.includes('--baseline');
if(baseline){
 const {modules}=require('../../test/helpers/scenePlayerFixture');
 const {beginSection}=require('../../test/helpers/extractSource');
 for(const file of modules){
  const old=spawnSync('C:/Program Files/Git/cmd/git.exe',['show','f76cde6:'+file],{encoding:'utf8',maxBuffer:20*1024*1024});
  if(old.status!==0)continue; // unused new classes remain test support; old bootstrap/controller select old providers.
  const section=old.stdout.split('//===BEGIN===')[1]?.split('//===END===')[0];
  if(section)html=html.replace(beginSection(file),section);
 }
}
const fixture=path.join(out,baseline?'redesign-baseline.html':'redesign.html');fs.writeFileSync(fixture,html);
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'scui801-'));let chrome;
async function client(url){
 const ws=new WebSocket(url),waiting=new Map(),errors=[];let seq=0;
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',e=>{const v=JSON.parse(e.data);if(v.method==='Runtime.exceptionThrown')errors.push(v.params.exceptionDetails);
 const p=waiting.get(v.id);if(!p)return;waiting.delete(v.id);clearTimeout(p.timer);v.error?p.reject(Error(JSON.stringify(v.error))):p.resolve(v.result);});
 return {errors,close:()=>ws.close(),send(method,params={}){const id=++seq;return new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{waiting.delete(id);reject(Error('CDP_TIMEOUT '+method));},30000);
 waiting.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}};
}
(async()=>{
 const log=fs.openSync(path.join(out,'redesign-browser.log'),'w');
 chrome=spawn(path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),
 ['--headless=new','--screen-info={1600x1000}','--no-first-run','--disable-extensions','--disable-background-networking',
 '--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],
 {windowsHide:true,stdio:['ignore','ignore',log]});
 const pause=ms=>new Promise(r=>setTimeout(r,ms)),portFile=path.join(profile,'DevToolsActivePort');
 for(let i=0;i<80&&!fs.existsSync(portFile);i++)await pause(250);
 if(!fs.existsSync(portFile))throw Error('DEVTOOLS_PORT_UNAVAILABLE');
 const address='http://127.0.0.1:'+fs.readFileSync(portFile,'utf8').split('\n')[0];
 const tab=await(await fetch(address+'/json/new?about:blank',{method:'PUT'})).json(),c=await client(tab.webSocketDebuggerUrl);
 const checks=[];
 const evaluate=async expression=>{const r=await c.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
 const record=(name,ok,detail)=>{checks.push({name,ok,detail});if(!ok)throw Error(name+' '+JSON.stringify(detail));};
 const frame=()=>evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const move=(x,y)=>c.send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
 const click=async selector=>{const p=await evaluate('(()=>{const r=document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
 await move(p.x,p.y);await c.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...p});
 await c.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...p});await frame();};
 const state=()=>evaluate(`(()=>{
 const bridge=qaBinding.adapter.bridge,card=bridge._active.root,mini=bar._commentPreview._view._view;
 const list=card.querySelector('.zenzaSceneNativeList'),image=thumb.querySelector('canvas'),text=mini.querySelector('.text');
 return {layout:bridge.state.layoutId,shown:bridge.state.shown,rect:card.getBoundingClientRect().toJSON(),
 mini:mini.getBoundingClientRect().toJSON(),image:image.getBoundingClientRect().toJSON(),
 imageScale:image.getBoundingClientRect().width/160,miniScale:mini.getBoundingClientRect().width/180,
 list:list?.getBoundingClientRect().toJSON(),alpha:list&&getComputedStyle(list).backgroundColor,
 opacity:list&&getComputedStyle(list).opacity,flow:text&&getComputedStyle(text).animationPlayState,
 footer:{height:card.querySelector('.zenzaSceneFoot')?.clientHeight,content:card.querySelector('.zenzaSceneFoot')?.scrollHeight},
 hidden:card.hidden,listHidden:list?.hidden,miniHidden:mini.hidden,hitRects:bridge._previewRects().length,
 fullscreen:!!document.fullscreenElement,inside:!document.fullscreenElement||document.fullscreenElement.contains(card),
 canvas:[image.width,image.height]};})()`);
 try{
 await c.send('Page.enable');await c.send('Runtime.enable');
 for(const width of (process.argv.includes('--quick')?[768]:[320,768,1536])){
  await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
  await c.send('Page.navigate',{url:pathToFileURL(fixture).href});
  for(let i=0;i<100;i++){if(await evaluate('window.qaReady===true'))break;await pause(100);}
  for(const mode of ['normal','fullscreen']){
   if(mode==='fullscreen'){await evaluate('host.requestFullscreen()');await frame();}
   for(const layout of ['follow','fixed']){
    await evaluate("config.setValue('sceneSearch.presentation.'+(document.fullscreenElement?'fullscreen':'normal'),"+JSON.stringify(layout)+");true");await frame();
    await click('#seek');
    await evaluate("config.setValue('enableCommentPreview',true);true");await frame();
    record(width+'/'+mode+'/'+layout+'/semantic-layout',(await state()).layout===layout,await state());
    for(const scale of [50,100,150,200]){
     await evaluate("config.setValue('sceneSearch.thumbnailScale',"+scale+");true");await frame();
     let s=await state(),label=width+'/'+mode+'/'+layout+'/'+scale;
     record(label+'/bounds',s.rect.left>=7&&s.rect.right<=width-7&&s.rect.top>=7&&s.rect.bottom<=893&&s.inside,s);
     record(label+'/same-scale',Math.abs(s.imageScale-s.miniScale)<.01&&s.canvas[0]===160&&s.canvas[1]===90,s);
     record(label+'/adjacent',s.list&&s.list.left>=s.image.right&&s.list.right<=s.rect.right+1&&!s.listHidden,s);
     record(label+'/native-flow',s.flow==='running',s);
     record(label+'/controls-visible',s.footer.content<=s.footer.height,s);
    }
    for(const opacity of [0,40,90,100]){
     await evaluate("config.setValue('sceneSearch.commentListBackgroundOpacity',"+opacity+");true");await frame();
     const s=await state();record(width+'/'+mode+'/'+layout+'/alpha'+opacity,s.opacity==='1'&&
      (opacity===100?s.alpha==='rgb(7, 13, 24)':s.alpha==='rgba(7, 13, 24, '+opacity/100+')'),s);
    }
    await evaluate("config.setValue('sceneSearch.thumbnailScale',100);config.setValue('sceneSearch.commentListBackgroundOpacity',90);qaNativeCommands.length=0;true");await frame();
    await click('.zenzaSceneNativeList .nicoChat .vposTime');
    record(width+'/'+mode+'/'+layout+'/native-command',await evaluate("qaNativeCommands.some(([c])=>c==='seek')"),await evaluate('qaNativeCommands'));
    const p=await evaluate("(()=>{const r=document.querySelector('.zenzaSceneNativeList').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()");
    await move(p.x,p.y);await c.send('Input.dispatchMouseEvent',{type:'mouseWheel',deltaX:0,deltaY:100,...p});await pause(150);
    record(width+'/'+mode+'/'+layout+'/scroll',await evaluate("document.querySelector('.zenzaSceneNativeList').scrollTop>0"),await state());
    await evaluate("document.querySelector('.zenzaSceneNativeList').scrollTop=0;qaNativeCommands.length=0;true");await frame();
    const rp=await evaluate("(()=>{const r=document.querySelector('.zenzaSceneNativeList .nicoChat').getBoundingClientRect();return {x:r.left+10,y:r.top+r.height/2};})()");
    await move(rp.x,rp.y);await frame();await click('.zenzaSceneNativeList .addWordFilter');
    record(width+'/'+mode+'/'+layout+'/native-ng',await evaluate("qaNativeCommands.some(([c])=>c==='addWordFilter')"),await evaluate('qaNativeCommands'));
    await evaluate("config.setValue('sceneSearch.commentPreviewVisible',false);true");await frame();
    let off=await state();record(width+'/'+mode+'/'+layout+'/parent-off',off.miniHidden&&off.listHidden,off);
    await evaluate("config.setValue('sceneSearch.commentPreviewVisible',true);true");await frame();
    off=await state();record(width+'/'+mode+'/'+layout+'/parent-restore',!off.miniHidden&&!off.listHidden,off);
    await evaluate("config.setValue('sceneSearch.idleHideSeconds',0.5);document.querySelector('.zenzaSceneNativeList').focus();true");
    await move(2,2);await pause(700);record(width+'/'+mode+'/'+layout+'/focus-hold',(await state()).shown,await state());
    await evaluate("document.activeElement.blur();true");await click('#seek');await pause(700);
    const hidden=await state();record(width+'/'+mode+'/'+layout+'/idle',!hidden.shown&&hidden.hidden&&hidden.hitRects===0,hidden);
    await click('#seek');await evaluate("config.setValue('sceneSearch.idleHideSeconds',0);true");await pause(700);
    record(width+'/'+mode+'/'+layout+'/idle-zero',(await state()).shown,await state());
    await click('[data-scui-action="seek-step"]');
    const menu=await evaluate("(()=>{const p=document.querySelector('.zenzaSceneStepPopup'),r=p.getBoundingClientRect();return {visible:!p.hidden,rect:r.toJSON(),hit:p.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};})()");
    record(width+'/'+mode+'/'+layout+'/step-menu',menu.visible&&menu.hit&&menu.rect.top>=0&&menu.rect.bottom<=900,menu);
    await click('.zenzaSceneStepPopup [data-scui="cancel"]');
    await click('[data-scui-action="comment-search"]');
    const search=await evaluate("(()=>{const p=document.querySelector('.zenzaSceneCommentSearch'),r=p.getBoundingClientRect();return {visible:!p.hidden,rect:r.toJSON(),hit:p.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))};})()");
    record(width+'/'+mode+'/'+layout+'/search-panel',search.visible&&search.hit&&search.rect.top>=0&&search.rect.bottom<=900,search);
    await evaluate("document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));document.activeElement.blur();true");await frame();
    if(width===768){const shot=await c.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'task801-'+mode+'-'+layout+'.png'),Buffer.from(shot.data,'base64'));}
   }
   // The compatibility view retains original sibling ownership and switch behavior.
   await evaluate("config.setValue('sceneSearch.presentation.'+(document.fullscreenElement?'fullscreen':'normal'),'legacy');config.setValue('enableCommentPreview',false);true");await frame();
   for(const scale of [50,100,150,200]){
    await evaluate("config.setValue('sceneSearch.thumbnailScale',"+scale+");true");await click('#seek');
    const s=await evaluate("(()=>{const mini=bar._commentPreview._view._view,im=thumb.querySelector('canvas');return {mini:mini.getBoundingClientRect().toJSON(),image:im.getBoundingClientRect().toJSON(),owner:mini.parentNode===seek,scale:im.getBoundingClientRect().width/160};})()");
    record(width+'/'+mode+'/legacy-scale'+scale,s.owner&&Math.abs(s.scale-s.mini.width/180)<.01&&Math.abs(s.mini.bottom-s.image.bottom)<2,s);
   }
   await evaluate("config.setValue('enableCommentPreview',true);config.setValue('sceneSearch.commentListBackgroundOpacity',40);true");await click('#seek');
   record(width+'/'+mode+'/legacy-list-alpha',await evaluate("getComputedStyle(bar._commentPreview._view._view).backgroundColor==='rgba(7, 13, 24, 0.4)'"),{});
   await evaluate("config.setValue('sceneSearch.idleHideSeconds',0.5);true");await move(2,2);await click('#seek');await pause(700);
   record(width+'/'+mode+'/legacy-idle',await evaluate("!qaBinding.adapter.bridge.state.shown&&getComputedStyle(old).visibility==='hidden'&&getComputedStyle(bar._commentPreview._view._view).display==='none'"),{});
   await evaluate("config.setValue('sceneSearch.idleHideSeconds',0);true");
   if(mode==='fullscreen'){await evaluate('document.exitFullscreen()');await frame();}
  }
  // Small mode moves the VIDEO child, while the outer player rectangle stays unchanged.
  await evaluate("config.setValue('sceneSearch.presentation.normal','fixed');config.setValue('sceneSearch.presentation.fullscreen','fixed');config.setValue('sceneSearch.thumbnailScale',100);config.setValue('enableCommentPreview',true);player.screenMode='small';seek.style.cssText='position:fixed;left:0;bottom:0;width:100vw;height:40px;z-index:20';true");await frame();
  for(const [x,y,w,h] of [[0,0,400,225],[width-400,0,400,225],[0,620,400,225],[width-400,620,400,225],
    [width/2-200,330,400,225],[width-160,740,160,90],[0,80,200,600],[0,0,width*.9,780]]){
   await evaluate("video.style.cssText="+JSON.stringify('position:fixed;left:'+Math.max(0,x)+'px;top:'+y+'px;width:'+Math.min(width,w)+'px;height:'+h+'px;bottom:auto;background:#28536a')+";player.emit('sceneSearchGeometryChange',{active:false});true");await frame();await click('#seek');
   const s=await state();
   record(width+'/small/'+x+','+y+','+w+','+h,s.rect.left>=7&&s.rect.right<=width-7&&s.rect.bottom<=852&&s.rect.top>=7,s);
  }
  const held=await state();
  await evaluate("player.emit('sceneSearchGeometryChange',{active:true});true");await frame();
  await evaluate("video.style.left='0px';video.style.top='600px';true");await frame();
  const during=await state();record(width+'/small/drag-hold',held.rect.x===during.rect.x&&held.rect.y===during.rect.y,{held,during});
  await evaluate("player.emit('sceneSearchGeometryChange',{active:false});true");await frame();
  await evaluate("host.requestFullscreen()");await frame();
  record(width+'/small/to-fullscreen',(await state()).inside&&(await state()).fullscreen,await state());
  await evaluate("document.exitFullscreen()");await frame();
  record(width+'/small/from-fullscreen',await evaluate("qaBinding.adapter.bridge._placementContext==='small'"),await state());
  for(const side of ['above','below']){
   await evaluate(`(()=>{
    video.style.cssText='position:fixed;left:0;top:'+( ${JSON.stringify(side)}==='above'?620:20)+'px;width:'+Math.min(innerWidth,400)+'px;height:225px;background:#28536a';
    let input=host.querySelector('.commentInputPanel');
    if(!input){input=document.createElement('div');input.className='commentInputPanel';input.innerHTML='<input aria-label="コメント入力"><div class="commandPopover">コマンド</div>';host.append(input);}
    input.style.cssText='position:fixed;left:0;top:'+( ${JSON.stringify(side)}==='above'?580:250)+'px;width:'+Math.min(innerWidth,400)+'px;height:32px;background:#aaa';
    input.querySelector('.commandPopover').style.cssText='position:absolute;left:0;top:'+( ${JSON.stringify(side)}==='above'?-140:32)+'px;width:240px;height:140px;background:#777';
    input.querySelector('input').focus();player.emit('sceneSearchGeometryChange',{active:false});return true;
   })()`);await frame();
   const geometry=await evaluate(`(()=>{
    const r=qaBinding.adapter.bridge._active.root.getBoundingClientRect();
    const overlap=o=>Math.max(0,Math.min(r.right,o.right)-Math.max(r.left,o.left))*Math.max(0,Math.min(r.bottom,o.bottom)-Math.max(r.top,o.top));
    return [...host.querySelectorAll('.commentInputPanel,.commandPopover')].map(n=>({rect:n.getBoundingClientRect().toJSON(),overlap:overlap(n.getBoundingClientRect())}));
   })()`);
   record(width+'/small/input-'+side,geometry.every(g=>g.overlap===0),geometry);
  }
  await evaluate("host.querySelector('.commentInputPanel').remove();player.emit('sceneSearchGeometryChange',{active:false});true");await frame();
  for(const layout of ['follow','legacy']){
   await evaluate("config.setValue('sceneSearch.presentation.normal',"+JSON.stringify(layout)+");true");await frame();
   await click('#seek');
   const s=await state();record(width+'/small/'+layout+'/visible',s.shown&&s.rect.left>=-1&&s.rect.right<=width+1,s);
  }
  await evaluate("config.setValue('sceneSearch.presentation.normal','fixed');true");await frame();
  if(width===1536){
   await click('#seek');await click('[data-scui-action="pin"]');
   await c.send('Emulation.setDeviceMetricsOverride',{width:320,height:900,deviceScaleFactor:1,mobile:false});await frame();
   const s=await state();record('small/pinned-viewport-shrink',s.rect.left>=7&&s.rect.right<=313,s);
   await c.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});await frame();
   await evaluate('qaBinding.adapter.bridge.interaction.togglePin();true');
  }
  await evaluate('qaBinding.dispose();true');record(width+'/teardown',await evaluate("!document.querySelector('.zenzaScenePreviewPortal')&&bar._commentPreview._model._events.get('vpos').size===1"),{});
 }
 record('no-browser-exceptions',c.errors.length===0,c.errors);
 console.log('TASK801_BROWSER_PASS '+checks.length);
 }finally{fs.writeFileSync(path.join(out,baseline?'task801-baseline.json':'task801-browser.json'),JSON.stringify({passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok).length,cases:checks},null,2));c.close();chrome.kill();fs.closeSync(log);}
})().catch(e=>{console.error('TASK801_BROWSER_FAIL '+e.stack);chrome?.kill();process.exitCode=1;});
