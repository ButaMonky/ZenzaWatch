'use strict';
module.exports=function buildShells({base,legacyBlog,header,runtime,externalModules,launcher,transport,network,closeRuntime,host,display,panelObserver,preferenceNames}) {
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
 const writeExternal=patch=>{const current=readExternalValues(),next=externalModules.settings.sanitizeExternal({...current,...patch});if(JSON.stringify(current)!==JSON.stringify(next)){gm.set(externalSlot,next);notifySettings(next);}};
 ${display}
 const displaySettings=createDisplaySettings(window,gm,${JSON.stringify([...preferenceNames])});
 `;
 const mainHeader=base.slice(0,base.indexOf('// ==/UserScript==')+'// ==/UserScript=='.length)
  .replace(/\/\/ @grant\s+none/, `// @grant          GM_addElement
// @grant          GM_getResourceText
// @resource       zenzaLodash https://cdn.jsdelivr.net/npm/lodash@4.18.1/lodash.min.js
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_deleteValue
// @grant          GM_addValueChangeListener
// @grant          GM_removeValueChangeListener
// @grant          GM_xmlhttpRequest
// @sandbox        DOM
// @connect        nicovideo.jp
// @connect        nimg.jp
// @connect        dmc.nico
// @match          https://ext.nicovideo.jp/api/getthumbinfo/*
// @require        https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js`);
 const main=mainHeader+'\n'+(/^\/\/ build: .*$/m.exec(base)?.[0]||'// build: external-playback')+`
(() => {
 ${externalModules}
 ${shared}
 ${launcher}
 ${transport}
 ${network}
 ${closeRuntime}
 ${panelObserver}
 async function runRuntime(window,externalTrial=null) {
   const {displaySettings,externalSettingsHost,writeExternal,readExternalValues,externalSlot,installInteractionGuard,frameTopologyChanged}=externalTrial||{};
   ${runtime}
 }
 if(!playerFrame&&!loader){
   if(official){displaySettings.publish();window.addEventListener('pagehide',()=>displaySettings.publish(),{once:true});}
   // The ordinary player remains in the page realm, with no GM capabilities.
   // Keep lodash lexical to avoid overwriting the site's own lodash instance.
   const dependency=GM_getResourceText('zenzaLodash');
   if(!dependency)throw Error('ZenzaWatch lodash resource unavailable');
   const source='(function(){const module={exports:{}},exports=module.exports;'+dependency+'\\n;const _=module.exports;('+runRuntime.toString()+')(window).catch(error=>console.error("ZenzaWatch initialization failed",error));})();';
   const script=GM_addElement(document.head||document.documentElement,'script',{textContent:source});
   script?.remove();
   return;
 }
 const privateTransport=createPrivateTransport(window,gm,()=>externalTrial.gm?.dispose());
 const externalTrial=createRuntimeSession({
   startRuntime,
   hasExistingRuntime:()=>!!window.ZenzaWatch||!!document.querySelector('.zenzaPlayerContainer,#ZenzaWatchLoader'),
   enable:async event=>{if(!event?.isTrusted)throw Error('USER_CLICK_REQUIRED');}
 });
 Object.assign(externalTrial,privateTransport,{displaySettings,externalSettingsHost,writeExternal,readExternalValues,externalSlot,installInteractionGuard,frameTopologyChanged});
 externalTrial.gm=createGmNetwork(options=>GM_xmlhttpRequest(options));
 const settingsListener=gm.listen(externalSlot,()=>externalTrial.onExternalSettings?.());
 window.addEventListener('pagehide',()=>gm.unlisten(settingsListener),{once:true});
 async function startRuntime(){
   if(playerFrame){displaySettings.apply();for(const [key,value] of Object.entries(readExternalValues()))localStorage.setItem('ZenzaWatchExternalTrial_'+key,JSON.stringify(value));}
   return runRuntime(window,externalTrial);
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
     subscribeSettings:send=>{notifySettings=send;}
   });
 }else if(privateTransport.acceptFrame()){
   void startRuntime().catch(()=>console.warn('ZenzaWatch: external bridge unavailable'));
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
   onClosed:()=>{closedResolve();void playerHost.close();}
 }):null;
 const playerHost=createPlayerHost(window,gm,privateTransport,mainClient);
 if(playerFrame){
   notifySettings=values=>mainClient.updateSettings(values);
   const listener=gm.listen(externalSlot,()=>mainClient.updateSettings(readExternalValues()));
   window.addEventListener('pagehide',()=>{gm.unlisten(listener);mainClient.dispose();},{once:true});
   playerHost.accept();return;
 }
 // Only optional availability checking remains in the launcher. Playback,
 // account operations and HLS networking are exclusively in the main script.
 const preflightNetwork=createGmNetwork(options=>GM_xmlhttpRequest(options));
 let launcherHandle,openVideo,legacyActive=false;
 const mount=()=>{
   launcherHandle?.dispose();openVideo=null;if(legacyActive)return;
   const settings=externalModules.settings.readExternal(readExternalValues());
   const preflight=externalModules.preflight.createPreflight(preflightNetwork.fetch,DOMParser);
   let active=true;
   const open=async(id,event)=>{
     if(!event?.isTrusted)throw Error('USER_CLICK_REQUIRED');
     if(settings.preflight!=='off'&&await preflight.check(id)==='unavailable')throw Error('VIDEO_UNAVAILABLE');
     if(!active)throw Error('CLOSED');return playerHost.open(id,event);
   };
   const overlay=externalModules.overlay.mountOverlay(window,settings,open,preflight.check);
   const inline=externalModules.inline.mountInlineButtons(window,settings,open,preflight.check);
   openVideo=open;launcherHandle={dispose(){active=false;preflight.dispose();overlay.dispose();inline.dispose();}};
 };
 const stopBlog=externalModules.blog.receiveBlogClicks(window,{get:GM_getValue,set:GM_setValue,remove:GM_deleteValue},readExternalValues,(id,event)=>openVideo&&!legacyActive?openVideo(id,event):Promise.reject(Error('LAUNCHER_UNAVAILABLE')));
 mount();
 const stopCoexistence=externalModules.coexistence.watchLegacyTrial(window,()=>{legacyActive=true;launcherHandle?.dispose();openVideo=null;playerHost.requestClose();});
 const listener=typeof GM_addValueChangeListener==='function'?gm.listen(externalSlot,mount):null;
 if(typeof GM_registerMenuCommand==='function')GM_registerMenuCommand('外部サイトからの再生設定',()=>externalModules.panel.openExternalSettings(document,readExternalValues(),values=>{writeExternal(values);mount();}));
 window.addEventListener('pagehide',()=>{stopCoexistence();stopBlog();launcherHandle?.dispose();preflightNetwork.dispose();if(listener!==null)gm.unlisten(listener);},{once:true});
})();
`;
 return {main,blog};
};