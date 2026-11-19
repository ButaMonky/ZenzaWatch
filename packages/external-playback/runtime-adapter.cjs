'use strict';
// A single compiled player implementation serves normal pages and the isolated
// external host. The adapter supplies capabilities; it is never a second UI.
module.exports=function adaptRuntime(base) {
 const currentSiteIds=require('./generated/settings').externalDescriptors.filter(d=>d.addCurrentSite).map(d=>d.id);
 let body=base.slice(base.indexOf('// ==/UserScript==')+'// ==/UserScript=='.length).replace(/^\/\/ build: .*$/gm,'');
 const once=(from,to)=>{
  if(body.split(from).length!==2)throw Error('Runtime adapter anchor changed: '+from.slice(0,80));
  body=body.replace(from,to);
 };
 once('const monkey = async (_product, START_PAGE_QUERY)', 'const monkey = async (_product, START_PAGE_QUERY, externalTrial = null)');
 once('    const Array = window.PureArray', '    const {displaySettings,externalSettingsHost,writeExternal,readExternalValues,externalSlot,installInteractionGuard,frameTopologyChanged} = externalTrial || {};\n    const Array = window.PureArray');
 once("if (window.top === window) {\n      window.ZenzaLib = { _ };", "if (externalTrial || window.top === window) {\n      window.ZenzaLib = { _ };");
 body=body.replaceAll("const PRODUCT = 'ZenzaWatch';", "const PRODUCT = externalTrial ? 'ZenzaWatchExternalTrial' : 'ZenzaWatch';");
 once('ModernAdvancedSettingsModel.visibleExtraSettings()', "ModernAdvancedSettingsModel.visibleExtraSettings().map(d=>externalTrial && "+JSON.stringify(currentSiteIds)+".includes(d.id) ? {...d,addCurrentSite:true,currentSite:externalSettingsHost} : d)");
 once('return gate = {};','if (!externalTrial) return gate = {};');
 // Task1033: この箇所はワーカー（別スレッド）の中で動く。ワーカーには externalTrial が無く、
 // 以前は「externalTrial is not defined」で動画のセッション作成が必ず失敗していた。
 // ワーカーは env で受け取る PRODUCT で外部再生かを判断する（外部再生中は同一オリジンでも本体経由で取得）。
 once('if (url.startsWith(location.origin)) {',"if ((typeof PRODUCT === 'undefined' || PRODUCT !== 'ZenzaWatchExternalTrial') && url.startsWith(location.origin)) {");
 const advancedBegin=body.indexOf("    if (location.host === 'www.nicovideo.jp') {\n      const advancedSettings");
 const advancedEnd=body.indexOf('    uq.ready().then(() => initializeExternalSite',advancedBegin);
 if(advancedBegin<0||advancedEnd<0)throw Error('Advanced lifecycle anchor missing');
 const advanced=body.slice(advancedBegin,advancedEnd);
 if(advanced.split('      return initialize();').length!==2)throw Error('Advanced initialize anchor changed');
 body=body.slice(0,advancedBegin)+advanced.replace('      return initialize();','      if (!externalTrial) return initialize();')+body.slice(advancedEnd);
 once("if (location.host !== 'www.nicovideo.jp' && typeof NicoVideoApi !== 'undefined') {", "if ((externalTrial || location.host !== 'www.nicovideo.jp') && typeof NicoVideoApi !== 'undefined') {");
 const workerBegin=body.indexOf("if (!location.origin.endsWith('.nicovideo.jp')");
 const workerEnd=body.indexOf('{',workerBegin);
 if(workerBegin<0||workerEnd<0)throw Error('Worker route missing');
 const workerCondition=body.slice(workerBegin+4,workerEnd).trim();
 body=body.slice(0,workerBegin)+"if (PRODUCT === 'ZenzaWatchExternalTrial' || ("+workerCondition.slice(0,-1)+')) '+body.slice(workerEnd);
 once('document.body.append($dialog[0]);','if (externalTrial) installInteractionGuard(window, container);\n        document.body.append($dialog[0]);');
 once('hoverMenu.setPlayer(dialog);',"hoverMenu.setPlayer(dialog);\n if (externalTrial) dialog.on('close', () => externalTrial.closeOverlay([...dialog._playbackPositionSaves?.values() || []]));");
 once('_fetch(url, options = {}) {', `_fetch(url, options = {}) {
   if (externalTrial) return externalTrial.gm.fetch(url,options).then(async response=>({
     buffer:await response.arrayBuffer(),init:{status:response.status,statusText:response.statusText},headers:[...response.headers]
   }));
 `);
 if(body.split('return new Response(buffer, _init);').length!==3)throw Error('Response adapter count changed');
 body=body.replaceAll('return new Response(buffer, _init);','return new Response([204,205,304].includes(_init.status) ? null : buffer, _init);');
 // Recognize both known constructors; external trial must override HLS loaders last.
 const legacyHls='const hls = new Hls(Object.assign({}, this._hlsConfig));';
 const prefetchHls='const hls = new Hls(Object.assign({}, this._hlsConfig, prefetchActive ? { loader: prefetchRuntime.wrapLoader(Hls.DefaultConfig.loader), startLevel: startupLevel } : {}));';
 const trialLoaders='externalTrial ? {loader:externalTrial.gm.Loader,fLoader:externalTrial.gm.Loader,pLoader:externalTrial.gm.Loader} : {}';
 if(body.includes(prefetchHls) && !body.includes(legacyHls)){
   once(prefetchHls,'const hls = new Hls(Object.assign({}, this._hlsConfig, prefetchActive ? { loader: prefetchRuntime.wrapLoader(Hls.DefaultConfig.loader), startLevel: startupLevel } : {}, '+trialLoaders+'));');
 } else {
   once(legacyHls,'const hls = new Hls(Object.assign({}, this._hlsConfig, '+trialLoaders+'));');
 }
 body=body.replaceAll('`ZenzaWatch_video.hls.', '`\${externalTrial ? "ZenzaWatchExternalTrial" : "ZenzaWatch"}_video.hls.');
 // HLS settings use a fixed prefix in the canonical implementation.
 body=body.replaceAll("'ZenzaWatch_video.hls.", "(externalTrial ? 'ZenzaWatchExternalTrial_video.hls.' : 'ZenzaWatch_video.hls.') + '");
 once("changes.forEach(key => { emitter.emit(`update-${key}`, config[key]); emitter.emit('update', { key, value: config[key] }); });",
 "changes.forEach(key => { emitter.emit(`update-${key}`, config[key]); emitter.emit('update', { key, value: config[key] }); });\n if(externalTrial) displaySettings.scheduleSave();");
 once("video.setAttribute('use-native-hls', nativeHlsPreference(Config.get('use_native_hls')));",
 "video.setAttribute('use-native-hls', externalTrial ? 'no' : nativeHlsPreference(Config.get('use_native_hls')));");
 once('const res = await fetch(request, params).catch(() => null);',
 'const res = await (externalTrial ? externalTrial.gm.fetch(request, params) : fetch(request, params)).catch(() => null);');
 const commentBegin=body.indexOf('class CommentInputPanel extends Emitter {'),commentEnd=body.indexOf('CommentInputPanel.CommandPicker =',commentBegin);
 let comment=body.slice(commentBegin,commentEnd);
 for(const handler of ['_onSubmit','_onSubmitButtonClick']){
  if(comment.split(handler+'(e) {').length!==2)throw Error('Comment handler anchor changed');
  comment=comment.replace(handler+'(e) {',handler+'(e) {\n if(externalTrial && !e?.isTrusted){e?.preventDefault();return;}');
 }
 body=body.slice(0,commentBegin)+comment+body.slice(commentEnd);
 once('(function (window) {','return (async function (window) {');
 const begin=body.indexOf('    uq.ready().then(() => initializeExternalSite({');
 const endMarker="    })).catch(err => window.console.warn('ZenzaWatch external initialization failed', err?.message || err));";
 const end=body.indexOf(endMarker,begin);
 if(begin<0||end<begin)throw Error('External initialization anchor missing');
 const original=body.slice(begin,end+endMarker.length);
 body=body.slice(0,begin)+`    if (externalTrial) {
      externalTrial.configure({
        api:NicoVideoApi, diagnostics:()=>displaySettings.diagnostics(Config),
        connect:async()=>{},setLogin:()=>{nicoUtil.isLogin=util.isLogin=()=>true;},
        initialize:async()=>{await initialize();},
        close:()=>ZenzaWatch.external.execCommand('close'),
        open:id=>ZenzaWatch.external.open(id,{autoCloseFullScreen:false}),
        // Task1036: 外部再生の失敗を通知履歴へ（この枠の中の履歴。外部ページごとに保存領域が分かれる）。
        journal:(stage,code,errorName,missing)=>{try{if(typeof NotificationJournal!=='undefined')NotificationJournal.recordDiagnostic('external-'+stage+'-'+code,{
          category:'player',source:'external-playback',level:'error',
          message:'外部サイトからの再生に失敗しました（'+stage+'）: '+code,
          details:{operation:'external-playback',outcome:'failed',reason:errorName?'script':'external',errorCode:/^[A-Z_]{1,40}$/.test(code)?code:'OTHER',
            phase:stage.toLowerCase(),module:'packages/external-playback/launcher.cjs',...(errorName?{errorName}:{}),...(missing?{missing}:{})}});}catch(_){}}
      });
      Config.on('update',()=>displaySettings.scheduleSave());
      Config.on('update',(key)=>{if(typeof key==='string'&&key.startsWith('externalLinks.'))writeExternal({[key]:Config.getValue(key)});});
      externalTrial.onExternalSettings=()=>{for(const [key,value] of Object.entries(readExternalValues()))if(Config.getValue(key)!==value)Config.setValue(key,value);};
    } else {
`+original+'\n    }'+body.slice(end+endMarker.length);
 once('  boot(monkey, PRODUCT, START_PAGE_QUERY);',`  if (externalTrial && window.name === 'ZenzaWatchExternalTrialPlayer') return monkey(PRODUCT, encodeURIComponent(''), externalTrial);
  return boot(monkey, PRODUCT, START_PAGE_QUERY, !externalTrial);`);
 once('const hoverMenu = global.debug.hoverMenu = new HoverMenu({ playerConfig: Config });',
 'const hoverMenu = externalTrial ? {setPlayer() {}} : (global.debug.hoverMenu = new HoverMenu({ playerConfig: Config }));');
 if(body.split('new this.win.MutationObserver(()=>this._listen())').length!==3)throw Error('Comment observer count changed');
 body=body.replaceAll('new this.win.MutationObserver(()=>this._listen())','new this.win.MutationObserver(records=>{if(!externalTrial || frameTopologyChanged(records))this._listen();})');
 once("replaceRedirectLinks().catch(() => console.warn('Legacy redirect-link enhancement unavailable'));","if(!externalTrial) replaceRedirectLinks().catch(() => console.warn('Legacy redirect-link enhancement unavailable'));");
 once('initializeLastSession(dialog);','if(externalTrial) PlayerSession.init(sessionStorage); else initializeLastSession(dialog);');
 for(const event of ['BeforeZenzaWatchInitialize','ZenzaWatchInitialize']){
  const original=`domEvent.dispatchCustomEvent(document.body, '${event}', window.ZenzaWatch, { bubbles: true, composed: true });`;
  once(original,'if(!externalTrial) '+original);
 }
 once('_initializeCrossDomainGate() {','_initializeCrossDomainGate() {\n if(externalTrial){externalTrial.connectGate(this,TOKEN,PRODUCT);return;}');
 once("_disconnect(error = new Error('Gate disconnected')) {","_disconnect(error = new Error('Gate disconnected')) {\n this._pendingPrivatePort?.close(); this._pendingPrivatePort=null;");
 const gateBegin=body.indexOf('const gate = () => {'),postBegin=body.indexOf('const post = function',gateBegin);
 if(postBegin<0)throw Error('Gate post anchor missing');
 body=body.slice(0,postBegin)+body.slice(postBegin).replace('const post = function','const post = externalTrial ? ((body,options)=>externalTrial.postGate(body,options)) : function');
 once('if (localStorage.ZenzaWatch_whiteHost) {','if (externalTrial?.isEnabledOrigin(u.origin)) return true;\n                if (localStorage.ZenzaWatch_whiteHost) {');
 once('})(globalThis ? globalThis.window : window);','})(window);');
 return body;
};