const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const base=fs.readFileSync(path.join(root,'dist/ZenzaWatch-dev.user.js'),'utf8').replace(/\r\n/g,'\n');
const sourceHash=crypto.createHash('sha256').update(base).digest('hex');
if(!base.includes('// @version        2.7.383-task1007'))throw Error('Review runtime changes before rebasing this trial');
function once(source,from,to) {
 if(source.split(from).length!==2)throw Error('Trial integration anchor changed: '+from.slice(0,70));
 return source.replace(from,to);
}
function transform(source) {
 let body=source.slice(source.indexOf('// ==/UserScript==')+'// ==/UserScript=='.length);
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
 body=once(body,"var VER = '2.7.383-task1007';","var VER = '2.7.383-external-direct.1';");
 const builds=[...body.matchAll(/var BUILD = '[^']*';/g)];
 if(builds.length!==1)throw Error('Runtime build marker changed');
 body=once(body,builds[0][0],"var BUILD = 'external-direct.1 base "+sourceHash.slice(0,12)+"';");
 const begin=body.indexOf('    uq.ready().then(() => initializeExternalSite({');
 const endMarker="    })).catch(err => window.console.warn('ZenzaWatch external initialization failed', err?.message || err));";
 const end=body.indexOf(endMarker,begin);
 if(begin<0||end<begin)throw Error('External initialization anchor missing');
 body=body.slice(0,begin)+`    externalTrial.configure({
      api: NicoVideoApi,
      connect: () => NicoVideoApi.configBridge(Config),
      setLogin: () => { nicoUtil.isLogin = () => true; },
      initialize: async () => { await initialize(); installInteractionGuard(window); },
      open: id => ZenzaWatch.external.open(id, {autoCloseFullScreen: false})
    });
`+body.slice(end+endMarker.length);
 body=once(body,'  boot(monkey, PRODUCT, START_PAGE_QUERY);',`  if (window.top !== window) return boot(monkey, PRODUCT, START_PAGE_QUERY);
  return monkey(PRODUCT, encodeURIComponent(''));`);
 body=once(body,'const hoverMenu = global.debug.hoverMenu = new HoverMenu({ playerConfig: Config });',
   'const hoverMenu = {setPlayer() {}};');
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
const runtime=transform(base);
const launcher=fs.readFileSync(path.join(__dirname,'launcher.cjs'),'utf8').replace(/^module\.exports=.*;$/m,'');
const transport=fs.readFileSync(path.join(__dirname,'private-port.cjs'),'utf8').replace(/^module\.exports=.*;$/m,'');
const header=`// ==UserScript==
// @name         ZenzaWatch 外部直接リンク検証版
// @namespace    https://github.com/ButaMonky/ZenzaWatch/experiments
// @version      0.1.0-external-direct1
// @description  ニコニコへの直接リンクから、このページ上でZenzaWatchを開く検証版
// @match        https://*/*
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @sandbox      DOM
// @require      https://cdn.jsdelivr.net/npm/lodash@4.18.1/lodash.min.js
// ==/UserScript==
// Shared runtime SHA256: ${sourceHash}
`;
const entry=`
(() => {
 const official = /(^|\\.)nicovideo\\.jp$/.test(location.hostname);
 const loader = window !== window.top &&
   ((location.hostname === 'www.nicovideo.jp' && location.pathname === '/robots.txt' &&
     window.name.startsWith('nicovideoApiZenzaWatchExternalTrialLoader')) ||
    (location.hostname === 'ext.nicovideo.jp' && window.name.startsWith('thumbInfoZenzaWatchExternalTrialLoader')));
 if (official && !loader) return;
 if (!loader && window !== window.top) return;
 ${launcher}
 ${transport}
 const privateTransport=createPrivateTransport(window,{
   get:(key)=>GM_getValue(key),set:(key,value)=>GM_setValue(key,value),remove:(key)=>GM_deleteValue(key),
   listen:(key,fn)=>GM_addValueChangeListener(key,fn),unlisten:(id)=>GM_removeValueChangeListener(id)
 });
 const externalTrial=createRuntimeSession({
   startRuntime,
   hasExistingRuntime:()=>!!window.ZenzaWatch || !!document.querySelector('.zenzaPlayerContainer, #ZenzaWatchLoader'),
   enable:async event=>{
     if (!event?.isTrusted) throw Error('USER_CLICK_REQUIRED');
   }
 });
 Object.assign(externalTrial,privateTransport);
 async function startRuntime(){
${runtime}
 }
 if(loader){
   if(privateTransport.acceptFrame()) void startRuntime().catch(()=>console.warn('Zenza external trial: bridge unavailable'));
 } else {
   mountLauncher(window,{open:(id,event)=>externalTrial.open(id,event)});
 }
})();
`;
const result=header+entry;
require('@babel/parser').parse(result,{sourceType:'script'});
const out=path.join(__dirname,'ZenzaWatch-external-direct-trial.user.js');
fs.writeFileSync(out,result);
console.log(JSON.stringify({output:path.basename(out),bytes:Buffer.byteLength(result),sha256:crypto.createHash('sha256').update(result).digest('hex')}));
