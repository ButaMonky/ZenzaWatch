'use strict';
const {readFileSync} = require('node:fs');
const path = require('node:path');
const mountXClipAttachment = require('./x-clip-attachment.cjs');
const mountCompanionButtons = require('./companion-buttons.cjs');
const {createXDraftTransfer,mountXDraftSender} = require('./x-draft-transfer.cjs');
const {startOrdinaryRuntime} = require('./ordinary-startup.cjs');
const {splitOptionalPanels,panelLoader,providePanels} = require('./optional-panels.cjs');
module.exports=function buildShells({base,legacyBlog,header,runtime,externalModules,launcher,transport,network,closeRuntime,host,display,panelObserver,preferenceNames}) {
 const panels = splitOptionalPanels(runtime);
 const shared=`
 const official=/(^|\\.)nicovideo\\.jp$/.test(location.hostname);
 const playerFrame=window!==window.top&&window.name==='ZenzaWatchExternalTrialPlayer'&&location.hostname==='www.nicovideo.jp'&&location.pathname==='/robots.txt';
 const loader=window!==window.top&&((location.hostname==='www.nicovideo.jp'&&location.pathname==='/robots.txt'&&window.name.startsWith('nicovideoApiZenzaWatchExternalTrialLoader'))||(location.hostname==='ext.nicovideo.jp'&&window.name.startsWith('thumbInfoZenzaWatchExternalTrialLoader')));
 const externalSettingsHost=(()=>{try{return new URL(playerFrame?document.referrer:location.href).hostname;}catch{return '';}})();
 const gm={get:key=>GM_getValue(key),set:(key,value)=>GM_setValue(key,value),remove:key=>GM_deleteValue(key),
   listen:(key,fn)=>GM_addValueChangeListener(key,fn),unlisten:id=>GM_removeValueChangeListener(id)};
 const externalSlot='external-links-v1';
 const readExternalValues=()=>externalModules.settings.sanitizeExternal(gm.get(externalSlot));
 let notifySettings=()=>{};
 // Task1032: 調査用の記録。上級者設定「外部サイトからの再生」の consoleLog がONのときだけ出す。
 // どのスクリプト・どの枠の記録かを scope/frame で区別する。URLのクエリ・Cookie・認証情報は出さない。
 const extDiagStart=Date.now();
 const extDiagOn=()=>{try{return readExternalValues()['externalLinks.consoleLog']===true;}catch(_){return false;}};
 // Task1034: 重さの調査用。10秒ごとに、主スレッドの詰まり・通信・保存・映像の状態をまとめて出す。
 const createPerfMonitor=(scope,extra=()=>({}))=>{
   let longCount=0,longMs=0,longMax=0,lagMax=0,last=performance.now(),timer=0,lagTimer=0,observer=null;
   try{observer=new PerformanceObserver(list=>{for(const e of list.getEntries()){longCount++;longMs+=e.duration;longMax=Math.max(longMax,e.duration);}});
     observer.observe({type:'longtask',buffered:false});}catch(_){observer=null;}
   lagTimer=setInterval(()=>{const now=performance.now();lagMax=Math.max(lagMax,now-last-250);last=now;},250);
   timer=setInterval(()=>{
     const mem=performance.memory;
     extDiag(scope,'perf',{longTasks:longCount,longTaskMs:Math.round(longMs),longTaskMaxMs:Math.round(longMax),
       loopLagMaxMs:Math.round(Math.max(0,lagMax)),heapMB:mem?Math.round(mem.usedJSHeapSize/1048576):null,
       domNodes:document.getElementsByTagName('*').length,...extra()});
     longCount=0;longMs=0;longMax=0;lagMax=0;
   },10000);
   return ()=>{clearInterval(timer);clearInterval(lagTimer);observer?.disconnect();};
 };
 const extDiag=(scope,event,data={})=>{
   if(!extDiagOn())return;
   try{console.info('ZENZA_EXT',JSON.stringify({scope,event,ms:Date.now()-extDiagStart,host:location.hostname,
     path:location.pathname.slice(0,40),frame:window===window.top?'top':(String(window.name||'child').slice(0,48)),...data}));}catch(_){}
 };
 const writeExternal=patch=>{const current=readExternalValues(),next=externalModules.settings.sanitizeExternal({...current,...patch});if(JSON.stringify(current)!==JSON.stringify(next)){gm.set(externalSlot,next);notifySettings(next);}};
 ${display}
 const displaySettings=createDisplaySettings(window,gm,${JSON.stringify([...preferenceNames])});
 `;
 const clipClipboard=readFileSync(path.join(__dirname,'../../src/ShareClipClipboard.js'),'utf8').split('//===BEGIN===')[1].split('//===END===')[0];
 const mainHeader=base.slice(0,base.indexOf('// ==/UserScript==')+'// ==/UserScript=='.length)
  .replace(/\/\/ @grant\s+none/, `// @match          https://x.com/intent/post*
// @match          https://x.com/intent/tweet*
// @match          https://x.com/compose/post*
// @grant          GM_addElement
// @grant          GM_getResourceText
// @resource       zenzaLodash https://cdn.jsdelivr.net/npm/lodash@4.18.1/lodash.min.js
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_deleteValue
// @grant          GM_addValueChangeListener
// @grant          GM_removeValueChangeListener
// @grant          GM_openInTab
// @grant          GM_getTab
// @grant          GM_saveTab
// @grant          GM_getTabs
// @grant          GM_xmlhttpRequest
// @sandbox        DOM
// @connect        nicovideo.jp
// @connect        nimg.jp
// @connect        dmc.nico
// @match          https://ext.nicovideo.jp/api/getthumbinfo/*
// @require        https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js`);
 const main=mainHeader+'\n'+(/^\/\/ build: .*$/m.exec(base)?.[0]||'// build: external-playback')+`
(() => {
 let draftTransfer;
 function getDraftTransfer() {
   if(typeof GM_openInTab!=='function')return null;
   if(draftTransfer)return draftTransfer;
   const hasDraftTabData=typeof GM_getTab==='function' && typeof GM_saveTab==='function' && typeof GM_getTabs==='function';
   return draftTransfer=(${createXDraftTransfer.toString()})({
     open:(url,options)=>GM_openInTab(url,options),tab:()=>new Promise(resolve=>GM_getTab(resolve)),
     save:tab=>new Promise(resolve=>GM_saveTab(tab,resolve)),tabs:hasDraftTabData ? ()=>new Promise(resolve=>GM_getTabs(resolve)) : null,
     get:key=>GM_getValue(key),set:(key,value)=>GM_setValue(key,value),remove:key=>GM_deleteValue(key),
     listen:(key,fn)=>GM_addValueChangeListener(key,fn),unlisten:id=>GM_removeValueChangeListener(id)
   });
 }
 if (location.hostname==='x.com') {
   ${clipClipboard}
   (${mountXClipAttachment.toString()})(ShareClipClipboard,getDraftTransfer);
   return;
 }
 ${externalModules}
 ${shared}
 if(typeof GM_openInTab==='function' && official && location.protocol==='https:' && (window===window.top || playerFrame)) {
   (${mountXDraftSender.toString()})(getDraftTransfer,playerFrame?'ZenzaWatchExternalTrial_':'ZenzaWatch_');
 }
 ${launcher}
 ${transport}
 ${network}
 ${closeRuntime}
 ${panelObserver}
 const packagedPanels = ${panels.factories};
 async function runRuntime(window,externalTrial=null,loadOptionalPanel=name=>Promise.resolve(packagedPanels[name])) {
   const {displaySettings,externalSettingsHost,writeExternal,readExternalValues,externalSlot,installInteractionGuard,frameTopologyChanged}=externalTrial||{};
   ${panels.runtime}
 }
 // Task1032: 再生用の枠・API用の枠の中だけは、設定に関係なく記録する（本体の設定は接続後にしか届かず、
 // 「本体が枠で動いていない」のか「動いて落ちた」のかを区別できなかったため）。枠は利用者の画面に出ない。
 const frameDiag=(event,data={})=>{try{console.info('ZENZA_EXT',JSON.stringify({scope:'main',event,ms:Date.now()-extDiagStart,
   host:location.hostname,path:location.pathname.slice(0,40),frame:String(window.name||'child').slice(0,48),...data}));}catch(_){}};
 if(playerFrame||loader){
   window.addEventListener('error',e=>frameDiag('frame-error',{message:String(e.message||'').slice(0,200),
     source:String(e.filename||'').replace(/[?#].*$/,'').slice(-80),line:e.lineno||null}));
   window.addEventListener('unhandledrejection',e=>frameDiag('frame-rejection',{message:String(e.reason?.message||e.reason||'').slice(0,200)}));
 }
 if(playerFrame||loader)frameDiag('boot',{playerFrame,loader,referrerHost:externalSettingsHost,
   version:${JSON.stringify(/@version\s+([^\s]+)/.exec(base)?.[1]||'')},hls:typeof Hls!=='undefined',lodash:typeof _!=='undefined',
   gmXhr:typeof GM_xmlhttpRequest==='function',readyState:document.readyState});
 if(!playerFrame&&!loader){
   if(official){displaySettings.publish();window.addEventListener('pagehide',()=>displaySettings.publish(),{once:true});}
   (${startOrdinaryRuntime})(window, () => {
     // The ordinary player remains in the page realm, with no GM capabilities.
     // Keep lodash lexical to avoid overwriting the site's own lodash instance.
     const dependency=GM_getResourceText('zenzaLodash');
     if(!dependency)throw Error('ZenzaWatch lodash resource unavailable');
     // Task1036: sourceURL を付けて、ZenzaWatch 自身のエラーをページのエラーと区別できるようにする（通知履歴のスクリプトエラー記録）。
     const namespace='zenza-optional-'+crypto.getRandomValues(new Uint32Array(2)).join('-')+'-';
     (${providePanels.toString()})(document,namespace,packagedPanels,GM_addElement);
     const pageLoader=${JSON.stringify(panelLoader.toString())};
     const source='(function(){const module={exports:{}},exports=module.exports;'+dependency+'\\n;const _=module.exports;('+runRuntime.toString()+')(window,null,('+pageLoader+')(document,'+JSON.stringify(namespace)+')).catch(error=>{if(error?.name==="ZenzaWatchStartupError")throw error;console.error("ZenzaWatch initialization failed",error);});})();\\n//# sourceURL=ZenzaWatchRuntime.js';
     // Task1059: 本文を Blob の <script src> で入れる。インラインの <script> はメインスレッドで約3MBを
     // コンパイルするため起動時に画面が固まっていた（手元の計測で長いタスク合計 約290ms → 約110ms）。
     // 外部スクリプト扱いならブラウザが裏のスレッドでコンパイルできる。sourceURL はそのまま効く。
     // Blob が使えない・止められた（厳しい CSP など）時は、従来どおりインラインで入れる。
     const injectInline=()=>{const script=GM_addElement(document.head||document.documentElement,'script',{textContent:source});script?.remove();};
     let blobUrl=null;
     try{blobUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));}catch(_){blobUrl=null;}
     if(!blobUrl){injectInline();return;}
     const release=()=>{try{URL.revokeObjectURL(blobUrl);}catch(_){}};
     let runtimeScript=null;
     try{runtimeScript=GM_addElement(document.head||document.documentElement,'script',{src:blobUrl});}catch(_){runtimeScript=null;}
     if(!runtimeScript){release();injectInline();return;}
     runtimeScript.addEventListener('load',()=>{release();runtimeScript.remove();},{once:true});
     runtimeScript.addEventListener('error',()=>{release();runtimeScript.remove();if(!window.ZenzaWatch)injectInline();},{once:true});
   });
   return;
 }
 try{
 const privateTransport=createPrivateTransport(window,gm,()=>externalTrial.gm?.dispose());
 const externalTrial=createRuntimeSession({
   startRuntime,
   hasExistingRuntime:()=>!!window.ZenzaWatch||!!document.querySelector('.zenzaPlayerContainer,#ZenzaWatchLoader'),
   enable:async event=>{if(!event?.isTrusted)throw Error('USER_CLICK_REQUIRED');},
   diag:(event,data)=>extDiag('main-session',event,data)
 });
 Object.assign(externalTrial,privateTransport,{displaySettings,externalSettingsHost,writeExternal,readExternalValues,externalSlot,installInteractionGuard,frameTopologyChanged});
 const gmStats={count:0,bytes:0,ms:0,maxMs:0,errors:0,active:0,maxActive:0};
 externalTrial.gm=createGmNetwork(options=>{
   const started=performance.now();gmStats.count++;gmStats.active++;gmStats.maxActive=Math.max(gmStats.maxActive,gmStats.active);
   const end=(bytes,error)=>{gmStats.active=Math.max(0,gmStats.active-1);const ms=performance.now()-started;gmStats.ms+=ms;gmStats.maxMs=Math.max(gmStats.maxMs,ms);
     if(error)gmStats.errors++;else gmStats.bytes+=bytes||0;};
   const wrap=(fn,error)=>fn?(r=>{end(r?.response?.byteLength||0,error);return fn(r);}):fn;
   return GM_xmlhttpRequest({...options,onload:wrap(options.onload,false),onerror:wrap(options.onerror,true),
     ontimeout:wrap(options.ontimeout,true),onabort:wrap(options.onabort,true)});
 });
 const settingsListener=gm.listen(externalSlot,()=>externalTrial.onExternalSettings?.());
 window.addEventListener('pagehide',()=>gm.unlisten(settingsListener),{once:true});
 async function startRuntime(){
   extDiag('main','runtime-start',{playerFrame,loader});
   if(playerFrame){displaySettings.apply();for(const [key,value] of Object.entries(readExternalValues()))localStorage.setItem('ZenzaWatchExternalTrial_'+key,JSON.stringify(value));}
   const started=Date.now();
   const failed=error=>{
     // 失敗は設定に関係なく1行は出す（以前は握りつぶしていて原因が追えなかった）。
     console.warn('ZenzaWatch external runtime failed',String(error?.message||error));
     extDiag('main','runtime-failed',{ms:Date.now()-started,message:String(error?.message||error),name:error?.name||null,
       stack:typeof error?.stack==='string'?error.stack.split('\\n').slice(0,10).join(' | '):null});
     throw error;
   };
   return runRuntime(window,externalTrial).then(result=>{extDiag('main','runtime-ready',{ms:Date.now()-started});return result;},failed);
 }
 let closing;
 externalTrial.closeOverlay=pendingSaves=>{
   if(closing)return closing;
   closing=finishPlayerClose(pendingSaves,{
     hide:()=>externalTrial.reportStage('CLOSING'),
     dispose:()=>{displaySettings.save();privateTransport.dispose();},
     finish:()=>externalTrial.reportStage('CLOSED')
   });
   return closing;
 };
 if(playerFrame){
   externalModules.mainBridge.installMainPlayerProvider(window,externalTrial,{
     setup:snapshot=>{displaySettings.migrate(snapshot);writeExternal(externalModules.settings.sanitizeExternal(snapshot?.external));},
     onSettings:values=>{writeExternal(externalModules.settings.sanitizeExternal(values));externalTrial.onExternalSettings?.();},
     subscribeSettings:send=>{notifySettings=send;},
     onDiag:(event,data)=>{if(event==='provider-opened'&&extDiagOn()&&!externalTrial.perfStop){
       // 再生が始まったら計測を始める（設定ONのときだけ）。
       externalTrial.perfStop=createPerfMonitor('main-perf',()=>{
         const v=document.querySelector('zenza-video')||document.querySelector('video');const q=(v?.getVideoPlaybackQuality||v?.video?.getVideoPlaybackQuality)?.call(v?.getVideoPlaybackQuality?v:v.video);
         let ahead=null;try{if(v&&v.buffered.length){for(let i=0;i<v.buffered.length;i++)if(v.buffered.start(i)<=v.currentTime+0.1&&v.buffered.end(i)>v.currentTime)ahead=+(v.buffered.end(i)-v.currentTime).toFixed(1);}}catch(_){}
         const out={gm:{...gmStats,mbps:gmStats.ms?+((gmStats.bytes*8/1e6)/(gmStats.ms/1000)).toFixed(1):null,mb:+(gmStats.bytes/1048576).toFixed(1)},
           settingsSaves:displaySettings.storageTiming?.()??null,
           video:v?{t:+v.currentTime.toFixed(1),paused:v.paused,rate:v.playbackRate,w:v.videoWidth,h:v.videoHeight,ahead,
             dropped:q?.droppedVideoFrames??null,frames:q?.totalVideoFrames??null}:null,
           comments:document.querySelectorAll('.nicoChat,.chat').length};
         for(const k of ['count','bytes','ms','maxMs','errors','maxActive'])gmStats[k]=0;
         return out;
       });
     }
     if(/^provider-(installed|not-eligible|hello|open-failed|message-rejected)$/.test(event))frameDiag(event,data);else extDiag('main-provider',event,data);}
   });
 }else if(privateTransport.acceptFrame()){
   extDiag('main','loader-accepted',{});
   void startRuntime().catch(error=>console.warn('ZenzaWatch: external bridge unavailable',String(error?.message||error)));
 }else if(loader){
   extDiag('main','loader-rejected',{});
 }
 }catch(error){
   frameDiag('setup-failed',{message:String(error?.message||error),name:error?.name||null,
     stack:typeof error?.stack==='string'?error.stack.split('\\n').slice(0,10).join(' | '):null});
   throw error;
 }
})();
`;
 const legacy=legacyBlog.slice(legacyBlog.indexOf('// ==/UserScript==')+'// ==/UserScript=='.length).replace(/^\/\/ build: .*$/gm,'')
 .replace('button.onclick = e => {', "button.onclick = e => { if(!e.isTrusted)return; const parentOrigin=getParentOrigin(); if(parentOrigin==='*')externalModules.blog.sendBlogClick(window,{get:GM_getValue,set:GM_setValue,remove:GM_deleteValue},watchId,e); if(parentOrigin !== '*' && !/(^|\\.)nicovideo\\.jp$/.test(new URL(parentOrigin).hostname)){ externalModules.blog.sendBlogClick(window,{get:GM_getValue,set:GM_setValue,remove:GM_deleteValue},watchId,e); return; }");
 const blog=header.replace(/^\/\/ @require.*\n/gm,'')+`
(() => {
 ${externalModules}
 if(location.hostname==='ext.nicovideo.jp'&&location.pathname.startsWith('/thumb/')){
   ${legacy}
   return;
 }
 ${shared}
 if(official&&!playerFrame){
   const disconnect=typeof GM_addValueChangeListener==='function'?externalModules.officialSettings.connectOfficialExternalSettings(window,gm):()=>{};
   displaySettings.publish();window.addEventListener('pagehide',()=>{disconnect();displaySettings.publish();},{once:true});return;
 }
 if(window!==window.top&&!playerFrame)return;
 extDiag('companion','boot',{playerFrame,version:${JSON.stringify(/@version\s+([^\s]+)/.exec(header)?.[1]||'')},readyState:document.readyState});
 ${transport}
 ${network}
 ${closeRuntime}
 ${host}
 const privateTransport=createPrivateTransport(window,gm);
 let closedResolve;
 const closed=new Promise(resolve=>{closedResolve=resolve;});
 const mainClient=playerFrame?externalModules.mainBridge.createMainPlayerClient(window,{
   snapshot:()=>({official:gm.get('settings-v2'),saved:gm.get('trial-settings-v2'),external:readExternalValues()}),
   onSettings:values=>writeExternal(externalModules.settings.sanitizeExternal(values)),
   onClosing:()=>{void playerHost.close([closed]);},
   onClosed:()=>{closedResolve();void playerHost.close();},
   onDiag:(event,data)=>extDiag('companion-client',event,data)
 }):null;
 const playerHost=createPlayerHost(window,gm,privateTransport,mainClient,undefined,(event,data)=>extDiag('companion-host',event,data));
 if(playerFrame){
   notifySettings=values=>mainClient.updateSettings(values);
   const listener=gm.listen(externalSlot,()=>mainClient.updateSettings(readExternalValues()));
   window.addEventListener('pagehide',()=>{gm.unlisten(listener);mainClient.dispose();},{once:true});
   const accepted=playerHost.accept();extDiag('companion','frame-accept',{accepted});return;
 }
 // Only optional availability checking remains in the launcher. Playback,
 // account operations and HLS networking are exclusively in the main script.
 const preflightNetwork=createGmNetwork(options=>GM_xmlhttpRequest(options));
 let launcherHandle,openVideo,legacyActive=false;
 const mount=()=>{
   launcherHandle?.dispose();openVideo=null;if(legacyActive)return;
   const settings=externalModules.settings.readExternal(readExternalValues());
   extDiag('companion','mount',{enabled:settings.enabled,siteMode:settings.siteMode,siteEnabled:externalModules.settings.siteEnabled?.(location.href,settings)??null,
     activation:settings.activation,preflight:settings.preflight,textIds:settings.textIds,redirects:settings.redirects,prefixes:settings.prefixes,
     links:document.querySelectorAll('a[href*="nicovideo.jp/watch/"],a[href*="nico.ms/"]').length});
   const preflight=externalModules.preflight.createPreflight(preflightNetwork.fetch,DOMParser);
   let active=true;
   const open=async(id,event)=>{
     extDiag('companion','click',{id,trusted:!!event?.isTrusted,preflight:settings.preflight});
     if(!event?.isTrusted)throw Error('USER_CLICK_REQUIRED');
     if(settings.preflight!=='off'){const result=await preflight.check(id);extDiag('companion','preflight',{id,result});if(result==='unavailable')throw Error('VIDEO_UNAVAILABLE');}
     if(!active)throw Error('CLOSED');
     const started=Date.now();
     try{await playerHost.open(id,event);extDiag('companion','opened',{id,ms:Date.now()-started});
       if(extDiagOn()&&!window.__zenzaExtPerf)window.__zenzaExtPerf=createPerfMonitor('companion-page-perf',()=>({
         playerFrames:document.querySelectorAll('[data-zenza-player-host]').length}));}
     catch(error){extDiag('companion','open-failed',{id,ms:Date.now()-started,code:String(error?.message||error),stage:error?.stage||null});throw error;}
   };
   const buttons=(${mountCompanionButtons.toString()})(window,externalModules,settings,open,preflight.check);
   setTimeout(()=>extDiag('companion','buttons',{inline:document.querySelectorAll('[data-zenza-external-inline]').length,
     overlay:document.querySelectorAll('[data-zenza-external-overlay]').length}),1500);
   openVideo=open;launcherHandle={dispose(){active=false;preflight.dispose();buttons.dispose();}};
 };
 const stopBlog=externalModules.blog.receiveBlogClicks(window,{get:GM_getValue,set:GM_setValue,remove:GM_deleteValue},readExternalValues,(id,event)=>openVideo&&!legacyActive?openVideo(id,event):Promise.reject(Error('LAUNCHER_UNAVAILABLE')));
 mount();
 const stopCoexistence=externalModules.coexistence.watchLegacyTrial(window,()=>{extDiag('companion','legacy-trial-detected',{});legacyActive=true;launcherHandle?.dispose();openVideo=null;playerHost.requestClose();});
 const listener=typeof GM_addValueChangeListener==='function'?gm.listen(externalSlot,mount):null;
 if(typeof GM_registerMenuCommand==='function')GM_registerMenuCommand('外部サイトからの再生設定',()=>externalModules.panel.openExternalSettings(document,readExternalValues(),values=>{writeExternal(values);mount();}));
 window.addEventListener('pagehide',()=>{stopCoexistence();stopBlog();launcherHandle?.dispose();preflightNetwork.dispose();if(listener!==null)gm.unlisten(listener);},{once:true});
})();
`;
 return {main,blog};
};
