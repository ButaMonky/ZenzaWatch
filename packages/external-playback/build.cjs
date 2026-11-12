const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
require('node:child_process').execFileSync(process.execPath,[path.join(root,'tools/typescript-stage1/node_modules/typescript/bin/tsc'),'--project',path.join(__dirname,'tsconfig.json')],{stdio:'inherit'});
const {externalDefaults,externalDescriptors}=require('./generated/settings.js');
require('./sync-preferences.cjs')();
module.exports=function buildExternalPlayback(input, legacyBlog) {
const companionVersion=/@version\s+([^\s]+)/.exec(legacyBlog)?.[1];
if(!companionVersion)throw Error('Missing companion version');
const base=input.replace(/\r\n/g,'\n');
const baseVersion=/@version\s+([^\s]+)/.exec(base)?.[1];
if(!baseVersion)throw Error('Missing main runtime version');
const sourceHash=crypto.createHash('sha256').update(base.replace(/^\/\/ build: .*$/gm,'// build: <BUILD>').replace(/var BUILD = '[^']*';/g,"var BUILD = '<BUILD>';")).digest('hex');

// Derive stored preference names from the shared default declarations, rather
// than maintaining a second UI or a presentation-only list.
const configStart=base.indexOf('const Config = (() => {');
const defaultsEnd=base.indexOf('const config = DataStorage.create(DEFAULT_CONFIG',configStart);
const defaultsAst=require('@babel/parser').parse(base.slice(configStart,defaultsEnd)+'return {};})();');
const preferenceNames=new Set();
function collectDefaults(node){
 if(!node||typeof node!=='object')return;
 if(node.type==='ObjectProperty'&&!node.computed){const name=node.key.name??node.key.value;if(typeof name==='string')preferenceNames.add(name);}
 for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(collectDefaults);else if(value&&typeof value==='object')collectDefaults(value);}
}
collectDefaults(defaultsAst);
Object.keys(externalDefaults).forEach(key=>preferenceNames.add(key));
for(const key of ['debug','message','lastPlayerId','lastWatchId','videoSearch.word'])preferenceNames.delete(key);
function once(source,from,to) {
 if(source.split(from).length!==2)throw Error('Trial integration anchor changed: '+from.slice(0,70));
 return source.replace(from,to);
}
function transform(source) {
 let body=source.slice(source.indexOf('// ==/UserScript==')+'// ==/UserScript=='.length).replace(/^\/\/ build: .*$/gm,'');
 // Current main bundle already contains the shared external preferences.
 for(const key of Object.keys(externalDefaults))if(!body.includes(JSON.stringify(key)))throw Error('Missing shared preference '+key);
 body=once(body,'ModernAdvancedSettingsModel.visibleExtraSettings()', 'ModernAdvancedSettingsModel.visibleExtraSettings().map(d=>'+JSON.stringify(externalDescriptors.filter(d=>d.addCurrentSite).map(d=>d.id))+'.includes(d.id)?{...d,addCurrentSite:true,currentSite:externalSettingsHost}:d)');
 body=once(body,"if (window.top === window) {\n      window.ZenzaLib = { _ };", "if (true) {\n      window.ZenzaLib = { _ };");
 body=once(body,'return gate = {};','/* Trial player always creates the GM-backed gate. */');
 body=once(body,'if (url.startsWith(location.origin)) {','if (false) {');
 // Custom element registries survive clearing a document. Isolate the shared
 // implementations from definitions installed by another userscript/version.
 for(const tag of ['zenza-video','zenza-setting-panel','video-debug-dialog','video-debug-checkbox','video-debug-slider']){
   body=body.replace(new RegExp('\\b'+tag+'\\b(?!-)','g'),'zw-trial-'+tag);
 }
 body=body.replaceAll('ZenzaWatch.integratedHls','ZenzaWatchExternalTrial.integratedHls');
 const advancedBegin=body.indexOf("    if (location.host === 'www.nicovideo.jp') {\n      const advancedSettings");
 const advancedEnd=body.indexOf('    uq.ready().then(() => initializeExternalSite',advancedBegin);
 if(advancedBegin<0||advancedEnd<0)throw Error('Advanced settings lifecycle anchor missing');
 let advanced=body.slice(advancedBegin,advancedEnd);
 advanced=once(advanced,'      return initialize();','      /* Session starts playback after authenticated initialization. */');
 body=body.slice(0,advancedBegin)+advanced+body.slice(advancedEnd);
 body=once(body,"if (location.host !== 'www.nicovideo.jp' && typeof NicoVideoApi !== 'undefined') {", "if (typeof NicoVideoApi !== 'undefined') {");
 const workerRoute=body.indexOf("if (!location.origin.endsWith('.nicovideo.jp')");
 const workerRouteEnd=body.indexOf('{',workerRoute);
 if(workerRoute<0||workerRouteEnd<0)throw Error('Worker route missing');
 body=body.slice(0,workerRoute)+'if (true) '+body.slice(workerRouteEnd);
 body=once(body,'document.body.append($dialog[0]);','installInteractionGuard(window, container);\n        document.body.append($dialog[0]);');
 body=once(body,'hoverMenu.setPlayer(dialog);',"hoverMenu.setPlayer(dialog);\n dialog.on('close', () => externalTrial.closeOverlay?.([...dialog._playbackPositionSaves?.values() || []]));");
 const fetchBegin=body.indexOf('_fetch(url, options = {}) {');
 const fetchEnd=body.indexOf('async fetch(resource, options = {}) {',fetchBegin);
 if(fetchBegin<0||fetchEnd<0)throw Error('Gate fetch anchor missing');
 body=body.slice(0,fetchBegin)+`async _fetch(url, options = {}) {
   const response=await externalTrial.gm.fetch(url,options);
   return {buffer:await response.arrayBuffer(),init:{status:response.status,statusText:response.statusText},headers:[...response.headers]};
 }
 `+body.slice(fetchEnd);
 if(body.split('return new Response(buffer, _init);').length!==3)throw Error('Response adapters changed');
 body=body.replaceAll('return new Response(buffer, _init);',
   'return new Response([204,205,304].includes(_init.status) ? null : buffer, _init);');
 body=once(body,'const hls = new Hls(Object.assign({}, this._hlsConfig));',
   'const hls = new Hls(Object.assign({}, this._hlsConfig, {loader: externalTrial.gm.Loader, fLoader: externalTrial.gm.Loader, pLoader: externalTrial.gm.Loader}));');
 body=body.replaceAll('ZenzaWatch_video.hls.','ZenzaWatchExternalTrial_video.hls.');
 body=once(body,"changes.forEach(key => { emitter.emit(`update-${key}`, config[key]); emitter.emit('update', { key, value: config[key] }); });",
   "changes.forEach(key => { emitter.emit(`update-${key}`, config[key]); emitter.emit('update', { key, value: config[key] }); });\n displaySettings.scheduleSave();");
 body=once(body,"video.setAttribute('use-native-hls', nativeHlsPreference(Config.get('use_native_hls')));",
   "video.setAttribute('use-native-hls', 'no');");
 body=once(body,'const res = await fetch(request, params).catch(() => null);',
   'const res = await externalTrial.gm.fetch(request, params).catch(() => null);');
 const commentStart=body.indexOf('class CommentInputPanel extends Emitter {');
 const commentEnd=body.indexOf('CommentInputPanel.CommandPicker =',commentStart);
 if(commentStart<0||commentEnd<0)throw Error('Comment input integration changed');
 let comment=body.slice(commentStart,commentEnd);
 for(const handler of ['_onSubmit','_onSubmitButtonClick']){
   comment=once(comment,handler+'(e) {',handler+'(e) {\n if (!e?.isTrusted) { e?.preventDefault(); return; }');
 }
 body=body.slice(0,commentStart)+comment+body.slice(commentEnd);
 body=once(body,'(function (window) {','return (async function (window) {');
 body=body.replaceAll("const PRODUCT = 'ZenzaWatch';","const PRODUCT = 'ZenzaWatchExternalTrial';");
 // Preserve the main runtime version; companion has its own metadata version.
 const builds=[...body.matchAll(/var BUILD = '[^']*';/g)];
 if(builds.length!==1)throw Error('Runtime build marker changed');
 body=once(body,builds[0][0],"var BUILD = 'external-playback GM transport base "+sourceHash.slice(0,12)+"';");
 const begin=body.indexOf('    uq.ready().then(() => initializeExternalSite({');
 const endMarker="    })).catch(err => window.console.warn('ZenzaWatch external initialization failed', err?.message || err));";
 const end=body.indexOf(endMarker,begin);
 if(begin<0||end<begin)throw Error('External initialization anchor missing');
 body=body.slice(0,begin)+`    externalTrial.configure({
      api: NicoVideoApi,
      diagnostics: () => displaySettings.diagnostics(Config),
      // The isolated player already owns its local settings. Do not relay every
      // panel setting through GM storage and a second same-origin frame.
      connect: async () => {},
      setLogin: () => { nicoUtil.isLogin = util.isLogin = () => true; },
      initialize: async () => { await initialize(); },
      close: () => ZenzaWatch.external.execCommand('close'),
      open: id => ZenzaWatch.external.open(id, {autoCloseFullScreen: false})
    });
    Config.on('update', () => displaySettings.scheduleSave());
    Config.on('update', (key,value)=>{if(typeof key==='string'&&key.startsWith('externalLinks.'))writeExternal({[key]:Config.getValue(key)});});
    if(typeof GM_addValueChangeListener==='function'){
      const externalListener=GM_addValueChangeListener(externalSlot,()=>{for(const [key,value] of Object.entries(readExternalValues()))if(Config.getValue(key)!==value)Config.setValue(key,value);});
      window.addEventListener('pagehide',()=>GM_removeValueChangeListener(externalListener),{once:true});
    }
`+body.slice(end+endMarker.length);
 body=once(body,'  boot(monkey, PRODUCT, START_PAGE_QUERY);',`  if (window.top !== window && window.name !== 'ZenzaWatchExternalTrialPlayer') return boot(monkey, PRODUCT, START_PAGE_QUERY);
  return monkey(PRODUCT, encodeURIComponent(''));`);
 body=once(body,'const hoverMenu = global.debug.hoverMenu = new HoverMenu({ playerConfig: Config });',
   'const hoverMenu = {setPlayer() {}};');
 if(body.split('new this.win.MutationObserver(()=>this._listen())').length!==3)throw Error('Comment panel observer count changed');
 body=body.replaceAll('new this.win.MutationObserver(()=>this._listen())',
   'new this.win.MutationObserver(records=>{if(frameTopologyChanged(records))this._listen();})');
 body=once(body,"replaceRedirectLinks().catch(() => console.warn('Legacy redirect-link enhancement unavailable'));",'/* Direct-link trial does not rewrite page links. */');
 body=once(body,'initializeLastSession(dialog);','PlayerSession.init(sessionStorage);');
 for(const event of ['BeforeZenzaWatchInitialize','ZenzaWatchInitialize'])
   body=once(body,`domEvent.dispatchCustomEvent(document.body, '${event}', window.ZenzaWatch, { bubbles: true, composed: true });`,
     '/* Trial runtime objects stay in the userscript realm. */');
 const methodBegin=body.indexOf('_initializeCrossDomainGate() {');
 const methodEnd=body.indexOf('_onMessage(event) {',methodBegin);
 if(methodBegin<0||methodEnd<0)throw Error('Gate initialization anchor missing');
 body=body.slice(0,methodBegin)+`_initializeCrossDomainGate() {
   window.console.time(\`GATE OPEN: \${this.name} \${PRODUCT}\`);
   externalTrial.connectGate(this,TOKEN,PRODUCT);
 }
 `+body.slice(methodEnd);
 const disconnect='_disconnect(error = new Error(\'Gate disconnected\')) {';
 body=once(body,disconnect,disconnect+'\n this._pendingPrivatePort?.close(); this._pendingPrivatePort=null;');
 const gateBegin=body.indexOf('const gate = () => {');
 const postBegin=body.indexOf('const post = function',gateBegin);
 const postEnd=body.indexOf('const parseUrl =',postBegin);
 if(gateBegin<0||postBegin<0||postEnd<0)throw Error('Gate post anchor missing');
 body=body.slice(0,postBegin)+'const post = (body, options) => externalTrial.postGate(body,options);\n'+body.slice(postEnd);
 // The private frame ticket is only created by this userscript after a click.
 // No account traffic or transferable ports travel through window messages.
 // Never change the official allowlist or the gate.uFetch destination check.
 body=once(body,'if (localStorage.ZenzaWatch_whiteHost) {',
   'if (externalTrial.isEnabledOrigin(u.origin)) { return true; }\n                if (localStorage.ZenzaWatch_whiteHost) {');
 return body;
}
const externalModuleNames=['site-rules','settings','targets','preflight','overlay','inline-buttons','settings-panel','player-background','official-settings','blog-clicks','coexistence'];
const externalModules="const externalModules=(()=>{const factories={"+externalModuleNames.map(name=>JSON.stringify('./'+name)+':(exports,require)=>{'+fs.readFileSync(path.join(__dirname,'generated',name+'.js'),'utf8')+'}').join(',')+"},cache={};const require=name=>{if(!cache[name]){const exports=cache[name]={};factories[name](exports,require);}return cache[name];};return {settings:require('./settings'),targets:require('./targets'),overlay:require('./overlay'),inline:require('./inline-buttons'),preflight:require('./preflight'),panel:require('./settings-panel'),background:require('./player-background'),officialSettings:require('./official-settings'),blog:require('./blog-clicks'),coexistence:require('./coexistence')};})();";
const runtime=transform(base);
const launcher=fs.readFileSync(path.join(__dirname,'launcher.cjs'),'utf8').replace(/^module\.exports=.*;$/m,'');
const transport=fs.readFileSync(path.join(__dirname,'private-port.cjs'),'utf8').replace(/^module\.exports=.*;$/m,'');
const network=fs.readFileSync(path.join(__dirname,'gm-network.cjs'),'utf8').replace(/^module\.exports=.*;$/m,'');
const closeModule=fs.readFileSync(path.join(__dirname,'generated/player-close.js'),'utf8');
const closeRuntime='const {finishPlayerClose}=(()=>{const exports={};'+closeModule+';return exports;})();';
const host=fs.readFileSync(path.join(__dirname,'player-host.cjs'),'utf8').replace("const {finishPlayerClose}=require('./generated/player-close.js');",'').replace("const {installPlayerBackground}=require('./generated/player-background.js');",'const {installPlayerBackground}=externalModules.background;').replace("const {validVideoId}=require('./generated/targets.js');",'const {validVideoId}=externalModules.targets;').replace(/^module\.exports=.*;$/m,'');
const display=fs.readFileSync(path.join(__dirname,'display-settings.cjs'),'utf8').replace(/^module\.exports=.*;$/m,'');
const panelObserver=fs.readFileSync(path.join(__dirname,'panel-observer.cjs'),'utf8').replace(/^module\.exports=.*;$/m,'');
const header=`// ==UserScript==
// @name         ZenzaBlogPartsButton
// @namespace    https://github.com/segabito/
// @version      ${companionVersion}
// @description  ブログパーツや外部サイトの動画リンクから、そのページ上でZenzaWatchを開く
// @match        https://*/*
// @match        http://ext.nicovideo.jp/thumb/*
// @homepageURL  https://github.com/ButaMonky/ZenzaWatch
// @supportURL   https://github.com/ButaMonky/ZenzaWatch/issues
// @downloadURL  https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaBlogPartsButton.user.js
// @updateURL    https://github.com/ButaMonky/ZenzaWatch/raw/develop/dist/ZenzaBlogPartsButton.user.js
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_xmlhttpRequest
// @connect      nicovideo.jp
// @connect      nimg.jp
// @connect      dmc.nico
// @sandbox      DOM
// @require      https://cdn.jsdelivr.net/npm/lodash@4.18.1/lodash.min.js
// @require      https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.min.js
// ==/UserScript==
// build: ${/^\/\/ build: (.*)$/m.exec(legacyBlog)?.[1]||'external-playback'}
// Shared runtime normalized SHA256: ${sourceHash}
`;
const entry=`
(() => {
 ${externalModules}
 if(location.hostname==='ext.nicovideo.jp' && location.pathname.startsWith('/thumb/') && !window.name.startsWith('thumbInfoZenzaWatchExternalTrialLoader')) {
 ${legacyBlog.slice(legacyBlog.indexOf('// ==/UserScript==')+'// ==/UserScript=='.length).replace(/^\/\/ build: .*$/gm,'').replace("button.onclick = e => {","button.onclick = e => { if(!e.isTrusted)return; const parentOrigin=getParentOrigin(); if(parentOrigin==='*')externalModules.blog.sendBlogClick(window,{get:GM_getValue,set:GM_setValue,remove:GM_deleteValue},watchId,e); if(parentOrigin !== '*' && !/(^|\\.)nicovideo\\.jp$/.test(new URL(parentOrigin).hostname)){ externalModules.blog.sendBlogClick(window,{get:GM_getValue,set:GM_setValue,remove:GM_deleteValue},watchId,e); return; }")}
 return;
 }
 const official = /(^|\\.)nicovideo\\.jp$/.test(location.hostname);
 const playerFrame=window!==window.top && window.name==='ZenzaWatchExternalTrialPlayer' && location.hostname==='www.nicovideo.jp' && location.pathname==='/robots.txt';
 const externalSettingsHost=(()=>{try{return new URL(playerFrame?document.referrer:location.href).hostname;}catch{return '';}})();
 const loader = window !== window.top &&
   ((location.hostname === 'www.nicovideo.jp' && location.pathname === '/robots.txt' &&
     window.name.startsWith('nicovideoApiZenzaWatchExternalTrialLoader')) ||
    (location.hostname === 'ext.nicovideo.jp' && window.name.startsWith('thumbInfoZenzaWatchExternalTrialLoader')));
 ${display}
 ${panelObserver}
 const displaySettings=createDisplaySettings(window,{get:key=>GM_getValue(key),set:(key,value)=>GM_setValue(key,value)},${JSON.stringify([...preferenceNames])});
 if (official && !loader && !playerFrame) {
   const disconnectExternal=typeof GM_getValue === 'function' && typeof GM_addValueChangeListener === 'function' ? externalModules.officialSettings.connectOfficialExternalSettings(window,{get:key=>GM_getValue(key),set:(key,value)=>GM_setValue(key,value),listen:(key,fn)=>GM_addValueChangeListener(key,fn),unlisten:id=>GM_removeValueChangeListener(id)}) : ()=>{};
   window.addEventListener('pagehide',disconnectExternal,{once:true});
   displaySettings.publish();
   window.addEventListener('pagehide',()=>displaySettings.publish(),{once:true});
   return;
 }
 if (!loader && !playerFrame && window !== window.top) return;
 ${launcher}
 ${transport}
 ${network}
 ${closeRuntime}
 ${host}
 const externalSlot='external-links-v1';
 const readExternalValues=()=>externalModules.settings.sanitizeExternal(GM_getValue(externalSlot));
 const writeExternal=patch=>{const current=readExternalValues(),next=externalModules.settings.sanitizeExternal({...current,...patch});if(JSON.stringify(current)!==JSON.stringify(next))GM_setValue(externalSlot,next);};
 const privateTransport=createPrivateTransport(window,{
   get:(key)=>GM_getValue(key),set:(key,value)=>GM_setValue(key,value),remove:(key)=>GM_deleteValue(key),
   listen:(key,fn)=>GM_addValueChangeListener(key,fn),unlisten:(id)=>GM_removeValueChangeListener(id)
 },()=>externalTrial.gm?.dispose());
 const externalTrial=createRuntimeSession({
   startRuntime,
   hasExistingRuntime:()=>!!window.ZenzaWatch || !!document.querySelector('.zenzaPlayerContainer, #ZenzaWatchLoader'),
   enable:async event=>{
     if (!event?.isTrusted) throw Error('USER_CLICK_REQUIRED');
   }
 });
 Object.assign(externalTrial,privateTransport);
 externalTrial.gm=createGmNetwork(options=>GM_xmlhttpRequest(options));
 async function startRuntime(){
 if(playerFrame){displaySettings.apply();for(const [key,value] of Object.entries(readExternalValues()))localStorage.setItem('ZenzaWatchExternalTrial_'+key,JSON.stringify(value));}
${runtime}
 }
 const playerHost=createPlayerHost(window,{get:key=>GM_getValue(key),set:(key,value)=>GM_setValue(key,value),remove:key=>GM_deleteValue(key)},privateTransport,externalTrial);
 externalTrial.closeOverlay=(pendingSaves)=>{
   try{displaySettings.save();}finally{void playerHost.close(pendingSaves);}
 };
 if(playerFrame){playerHost.accept();}
 else if(loader){
   if(privateTransport.acceptFrame()) void startRuntime().catch(()=>console.warn('Zenza external trial: bridge unavailable'));
 } else {
   let launcherHandle,openVideo,legacyActive=false;
   const mount=()=>{launcherHandle?.dispose();openVideo=null;if(legacyActive)return;const settings=externalModules.settings.readExternal(readExternalValues()),preflight=externalModules.preflight.createPreflight(externalTrial.gm.fetch,DOMParser);let active=true;const open=async(id,event)=>{if(!event?.isTrusted)throw Error('USER_CLICK_REQUIRED');if(settings.preflight!=='off'&&await preflight.check(id)==='unavailable')throw Error('VIDEO_UNAVAILABLE');if(!active)throw Error('CLOSED');return playerHost.open(id,event);},overlay=externalModules.overlay.mountOverlay(window,settings,open,preflight.check),inline=externalModules.inline.mountInlineButtons(window,settings,open,preflight.check);openVideo=open;launcherHandle={dispose(){active=false;preflight.dispose();overlay.dispose();inline.dispose();}};};
   const stopBlog=externalModules.blog.receiveBlogClicks(window,{get:GM_getValue,set:GM_setValue,remove:GM_deleteValue},readExternalValues,(id,event)=>openVideo&&!legacyActive?openVideo(id,event):Promise.reject(Error('LAUNCHER_UNAVAILABLE')));
   mount();
   const stopCoexistence=externalModules.coexistence.watchLegacyTrial(window,()=>{legacyActive=true;launcherHandle?.dispose();openVideo=null;playerHost.requestClose();});
   const settingListener=typeof GM_addValueChangeListener==='function'?GM_addValueChangeListener(externalSlot,()=>mount()):null;
   if(typeof GM_registerMenuCommand==='function')GM_registerMenuCommand('外部サイトからの再生設定',()=>externalModules.panel.openExternalSettings(document,readExternalValues(),values=>{writeExternal(values);mount();}));
   window.addEventListener('pagehide',()=>{stopCoexistence();stopBlog();launcherHandle?.dispose();if(settingListener!==null)GM_removeValueChangeListener(settingListener);},{once:true});
 }
})();
`;
const result=(header+entry).replace(/[ \t]+$/gm,'');
require('@babel/parser').parse(result,{sourceType:'script'});
return result;
};
