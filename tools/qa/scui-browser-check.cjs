'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {spawnSync}=require('child_process');
const {pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..');
process.chdir(root);
const {modules}=require('../../test/helpers/scenePlayerFixture');
const {beginSection}=require('../../test/helpers/extractSource');
const output=path.join(root,'tools/typescript-stage1/.generated/scui-browser');
fs.mkdirSync(output,{recursive:true});
const source=modules.map(f=>beginSection(f)).join('\n');
const tests=fs.readFileSync(path.join(root,'test/browser/scui-live-layouts.js'),'utf8');
// Replay the REAL legacy CommentPreviewView hover stylesheet, including its
// top:auto absolute rows and paused text animation. Previous one-row fixture
// completely missed the user-visible rows clustering at the bottom.
const native=fs.readFileSync(path.join(root,'src/VideoControlBar.js'),'utf8').replace(/\r\n/g,'\n');
const cssBegin=native.indexOf('  .zenzaCommentPreview:where([data-comment-preview-mode="hover"]) {\n    bottom: 24px;');
const cssEnd=native.indexOf("`, {className: 'commentPreview hover'}",cssBegin);
if(cssBegin<0||cssEnd<0)throw Error('Legacy comment hover stylesheet changed');
const nativeHoverCss=native.slice(cssBegin,cssEnd);
// Reproduce the real native base/list styles too, rather than a fabricated
// single CSS rule. The original UI switches these stylesheets on list toggle.
function nativeStyle(name){
  const end=native.indexOf("`, {className: '"+name+"'",0);
  const start=native.lastIndexOf('util.addStyle(`',end);
  if(end<0||start<0)throw Error('Native comment CSS missing: '+name);
  return native.slice(start+'util.addStyle(`'.length,end)
    .replace(/\$\{CommentPreviewView\.(ITEM_HEIGHT|MAX_HEIGHT|WIDTH)\}/g,
      (_,key)=>({ITEM_HEIGHT:20,MAX_HEIGHT:200,WIDTH:350})[key]);
}
const nativeBaseCss=nativeStyle('commentPreview');
const nativeListCss=nativeStyle('commentPreview list');
const nativeClasses=native.slice(native.indexOf('  class CommentPreviewModel'),native.indexOf('  class SeekBarToolTip'));
const lodash=fs.readFileSync(require.resolve('lodash/lodash.js'),'utf8');
const nativeRuntime="\nclass Emitter {\n constructor(){this._events=new Map();}\n on(k,f){if(!this._events.has(k))this._events.set(k,new Set());this._events.get(k).add(f);}\n off(k,f){this._events.get(k)?.delete(f);}\n emit(k,...v){for(const f of [...this._events.get(k)||[]])f(...v);}\n}\nconst wrap=node=>{const list=[node];\n list.append=other=>{node.append(other[0]||other);return list;};\n list.on=(event,fn,options)=>{node.addEventListener(event,fn,options);return list;};return list;};\nwrap.html=html=>{const t=document.createElement('template');t.innerHTML=html;return wrap(t.content.firstElementChild);};\nvar global=window;\nconst cssUtil={registerProps(){},s:v=>v+'s',px:v=>v+'px',\n setProps:(...rows)=>rows.forEach(([node,key,value])=>node.style.setProperty(key,value))};\nconst throttle={raf:fn=>{let id=null,lastArgs;const f=(...args)=>{lastArgs=args;if(id!==null)return;id=requestAnimationFrame(()=>{id=null;fn(...lastArgs);});};\n f.cancel=()=>{cancelAnimationFrame(id);id=null;};return f;}};\nwindow.qaNativeCommands=[];\nconst util={$:wrap,addStyle(){},secToTime:sec=>String(sec),\n dispatchCommand:(node,command,value)=>window.qaNativeCommands.push([command,value])};\n";
const html='<!doctype html><meta charset="utf-8"><title>SCUI offline QA</title>'+
 '<style>body{margin:0;background:#e8e8e8}#player{position:relative;margin:16px;width:calc(100vw - 32px);height:550px;background:#232a35;overflow:visible}'+
 '#seek{position:absolute;bottom:0;width:100%;height:20px;background:#6baac2}'+
 '#qa-result{white-space:pre-wrap;font-size:10px}</style>'+
 '<style id="native-comment-base">'+nativeBaseCss+'</style>'+
 '<style id="native-comment-list">'+nativeListCss+'</style>'+
 '<style id="native-comment-hover">'+nativeHoverCss+'</style>'+
 '<div id="player"><div id="seek"></div><aside id="comments" class="zenzaCommentPreview">'+
 '</aside>'+
 '<div id="old"><div id="thumb" class="zenzaSeekThumbnail"><canvas width="160" height="90"></canvas></div></div></div>'+
 '<pre id="qa-result">RUNNING</pre><script>'+(lodash+'\n'+nativeRuntime+'\n'+nativeClasses+'\n'+source).replace(/<\/script/gi,'<\\/script')+'\n'+tests+'</script>';
const file=path.join(output,'fixture.html');fs.writeFileSync(file,html);
console.log('SCUI_BROWSER_FIXTURE_READY '+file);
