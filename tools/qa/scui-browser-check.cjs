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
const html='<!doctype html><meta charset="utf-8"><title>SCUI offline QA</title>'+
 '<style>body{margin:0;background:#e8e8e8}#player{position:relative;margin:16px;width:calc(100vw - 32px);height:550px;background:#232a35;overflow:visible}'+
 '#seek{position:absolute;bottom:0;width:100%;height:20px;background:#6baac2}'+
 '#comments{position:absolute;right:10px;bottom:70px;width:160px;height:40px;background:#586476}'+
 '#qa-result{white-space:pre-wrap;font-size:10px}</style>'+
 '<div id="player"><div id="seek"></div><aside id="comments" class="zenzaCommentPreview">comments</aside>'+
 '<div id="old"><div id="thumb" class="zenzaSeekThumbnail"><canvas width="160" height="90"></canvas></div></div></div>'+
 '<pre id="qa-result">RUNNING</pre><script>'+source.replace(/<\/script/gi,'<\\/script')+'\n'+tests+'</script>';
const file=path.join(output,'fixture.html');fs.writeFileSync(file,html);
console.log('SCUI_BROWSER_FIXTURE_READY '+file);
