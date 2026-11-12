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
const externalModuleNames=['site-rules','settings','targets','preflight','overlay','inline-buttons','settings-panel','player-background','official-settings','blog-clicks','coexistence','main-player-bridge'];
const externalModules="const externalModules=(()=>{const factories={"+externalModuleNames.map(name=>JSON.stringify('./'+name)+':(exports,require)=>{'+fs.readFileSync(path.join(__dirname,'generated',name+'.js'),'utf8')+'}').join(',')+"},cache={};const require=name=>{if(!cache[name]){const exports=cache[name]={};factories[name](exports,require);}return cache[name];};return {settings:require('./settings'),targets:require('./targets'),overlay:require('./overlay'),inline:require('./inline-buttons'),preflight:require('./preflight'),panel:require('./settings-panel'),background:require('./player-background'),officialSettings:require('./official-settings'),blog:require('./blog-clicks'),coexistence:require('./coexistence'),mainBridge:require('./main-player-bridge')};})();";
const runtime=require('./runtime-adapter.cjs')(base);
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
const result=require('./build-shells.cjs')({base,legacyBlog,header,runtime,externalModules,launcher,transport,network,closeRuntime,host,display,panelObserver,preferenceNames});
for(const key of ['main','blog']){
 result[key]=result[key].replace(/[ \t]+$/gm,'');
 require('@babel/parser').parse(result[key],{sourceType:'script'});
}
return result;
};
