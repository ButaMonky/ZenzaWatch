'use strict';
// Offline renderer: actual settings DOM/styles, local demo interactions only.
const fs=require('fs'),path=require('path'),os=require('os'),{spawn}=require('child_process');
const {uiFixture}=require('../../test/helpers/sceneSearchUIFixture');
const {extract}=require('../../test/helpers/extractSource');
const out=path.resolve('tools/typescript-stage1/.generated/scene-settings');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const h=await uiFixture(),defaults=JSON.stringify(h.config.default),source=extract('src/ModernAdvancedSettingsUI.js','ModernAdvancedSettingsUI');
 h.panel.className='zenzaAdvancedSettingPanel zw-modern-active show';
 for(const e of h.panel.querySelectorAll('input[type=checkbox]'))e.toggleAttribute('checked',e.checked);
 let html=h.dom.serialize();h.dispose();
 const script=source+`;const values=${defaults};const ui=Object.create(ModernAdvancedSettingsUI.prototype);
 Object.assign(ui,{doc:document,root:document.querySelector('.zw-modern-root'),cards:document.querySelector('[data-zw-cards]'),_sceneLayoutTab:'normal',model:{get:k=>values[k],isDifferentFromDefault:k=>false,config:{resolveSceneSearch:()=>({})}}});
 const rows=[...ui.cards.querySelectorAll('[data-zw-id]')];ui.cards.replaceChildren(ui._createSceneSettingsPanel(rows));ui._updateSceneSettingsPreview();
 window.changeSetting=(key,value)=>{values[key]=value;ui._updateSceneSettingsPreview();};
 document.querySelector('[data-zw-title]').textContent='シーンサーチ';
 `;
 html=html.replace('</body>','<script>'+script.replace(/<\/script/gi,'<\\/script')+'</script></body>');
 const file=path.join(out,'settings.html');fs.writeFileSync(file,html);
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'scene-settings-'));
 const chrome=spawn(path.join(process.env.LOCALAPPDATA,'Google/Chrome/Application/chrome.exe'),['--headless=new','--no-first-run','--disable-extensions','--disable-background-networking','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws;try{
  const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<80&&!fs.existsSync(portFile);i++)await new Promise(r=>setTimeout(r,250));
  const address='http://127.0.0.1:'+fs.readFileSync(portFile,'utf8').split('\n')[0],tab=await(await fetch(address+'/json/new?about:blank',{method:'PUT'})).json();
  ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();
  ws.addEventListener('message',e=>{const x=JSON.parse(e.data),p=pending.get(x.id);if(p){pending.delete(x.id);clearTimeout(p.timer);x.error?p.reject(Error(JSON.stringify(x.error))):p.resolve(x.result);}});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error(method+' timeout')),20000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});
  const ev=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:1536,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:require('url').pathToFileURL(file).href});await new Promise(r=>setTimeout(r,700));
  const results=[];for(const screen of ['normal','fullscreen','small']){
   await ev(`document.querySelector('[data-demo-screen="${screen}"]').click()`);
   await new Promise(r=>setTimeout(r,200));
   results.push(await ev(`(()=>{const r=document.querySelector('.zw-scene-demo-video').getBoundingClientRect();return {screen:'${screen}',width:r.width,height:r.height}})()`));
  }
  if(!(results[1].width>results[0].width&&results[2].width<results[0].width))throw Error(JSON.stringify(results));
  const checks=await ev(`(()=>{changeSetting('sceneSearch.presentation.normal','legacy');const image=document.querySelector('.zw-scene-demo-image'),list=document.querySelector('.zw-scene-demo-list');const legacy=image.hidden&&list.parentElement.classList.contains('zw-scene-demo-thumb');document.querySelector('[data-demo-comments]').click();const swap=!image.hidden&&list.hidden;document.querySelector('[data-demo-comments]').click();const h=list.clientHeight,font=getComputedStyle(list).fontSize;changeSetting('sceneSearch.commentListScale',200);const bigger=list.clientHeight>h&&getComputedStyle(list).fontSize===font;changeSetting('sceneSearch.commentListBackgroundOpacity',0);const transparent=getComputedStyle(list).backgroundColor==='rgba(7, 13, 24, 0)';changeSetting('sceneSearch.enabled',false);const hidden=document.querySelector('[data-zw-demo-panels]').hidden;return {legacy,swap,bigger,transparent,hidden};})()`);
  if(!Object.values(checks).every(Boolean))throw Error(JSON.stringify(checks));
  await ev(`changeSetting('sceneSearch.enabled',true);changeSetting('sceneSearch.presentation.normal','follow');changeSetting('sceneSearch.commentListScale',100);changeSetting('sceneSearch.commentListBackgroundOpacity',90);document.querySelector('[data-demo-screen="normal"]').click()`);
  const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'settings.png'),Buffer.from(shot.data,'base64'));
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({results,checks},null,2));console.log(JSON.stringify({results,checks,screenshot:path.join(out,'settings.png')}));
 }finally{ws?.close();chrome.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
