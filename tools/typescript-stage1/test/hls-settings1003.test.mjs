import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
const read=name=>stripTypeScriptTypes(fs.readFileSync(new URL(`../hls-src/${name}.ts`,import.meta.url),'utf8'),{mode:'strip'}).replace(/export \{[^}]+\};/g,'');
function fixture(saved={}) {
 class Emitter {handlers={};on(key,f){(this.handlers[key]??=[]).push(f);}emit(key,...args){for(const f of [...(this.handlers[key]||[])])f(...args);}}
 const localStorage={...saved},context=vm.createContext({localStorage,window:{console},console,Emitter});
 vm.runInContext(read('HlsConfig')+';globalThis.subject=createHlsConfig(Emitter,"1.7.3");',context);
 return {...context.subject,localStorage};
}
test('partial UI save retains protected playback defaults and ignores injected keys',()=>{
 const {Config,DEFAULT_CONFIG}=fixture();
 assert.equal(Config.applySettings({maxBufferLength:45,xhrSetup:null,useMediaCapabilities:true,alien:1}),true);
 assert.equal(Config.get('maxBufferLength'),45);assert.equal(Config.get('xhrSetup'),DEFAULT_CONFIG.xhrSetup);
 assert.equal(Config.get('useMediaCapabilities'),false);assert.equal(Config.get('alien'),undefined);
});
test('stored malformed values cannot override functions, booleans or numeric safety',()=>{
 const {Config}=fixture({'ZenzaWatch_video.hls.xhrSetup':'null','ZenzaWatch_video.hls.debug':'"yes"','ZenzaWatch_video.hls.maxBufferSize':'-1','ZenzaWatch_video.hls.maxSeekHole':'99','ZenzaWatch_video.hls.maxBufferLength':'100','ZenzaWatch_video.hls.maxMaxBufferLength':'20'});
 assert.equal(typeof Config.get('xhrSetup'),'function');assert.equal(Config.get('debug'),false);
 assert.equal(Config.get('maxBufferSize'),0);assert.equal(Config.get('maxSeekHole'),undefined);
 assert.equal(Config.get('maxMaxBufferLength'),100);
});
test('UI save rejects wrong types atomically and accepts false and zero',()=>{
 const {Config}=fixture();assert.equal(Config.applySettings({debug:true,maxBufferSize:NaN}),false);assert.equal(Config.get('debug'),false);
 assert.equal(Config.applySettings({debug:'true'}),false);assert.equal(Config.applySettings({debug:false,minAutoBitrate:0,maxBufferLength:200,maxMaxBufferLength:50,abrEwmaDefaultEstimate:50000000}),true);
 assert.equal(Config.get('maxMaxBufferLength'),200);assert.equal(Config.get('abrEwmaDefaultEstimate'),50000000);
});
test('pending settings merge preserves hidden config without mutating current engine',()=>{
 const js=read('HlsVideoElement'),start=js.indexOf('class ZenzaVideoElement extends HTMLElement'),end=js.indexOf('\n      if (window.customElements',start);
 const context=vm.createContext({HTMLElement:class{}});vm.runInContext(js.slice(start,end)+';globalThis.Subject=ZenzaVideoElement;',context);
 const player=Object.create(context.Subject.prototype),credentials=()=>{};
 player._hlsConfig={xhrSetup:credentials,maxBufferLength:30};player._hls={config:{maxBufferLength:30},destroy(){throw Error('must not rebuild');}};
 player.hlsConfig={maxBufferLength:60};assert.equal(player.hlsConfig.xhrSetup,credentials);assert.equal(player.hlsConfig.maxBufferLength,60);assert.equal(player._hls.config.maxBufferLength,30);
});
test('failed persistence leaves in-memory settings unchanged and rolls back touched keys',()=>{
 let fail=false;const values={},localStorage=new Proxy(values,{set(target,key,value){if(fail && String(key).endsWith('debug'))throw Error('quota');target[key]=value;return true;}});
 class Emitter {on(){}emit(){}}
 const context=vm.createContext({localStorage,window:{console},console,Emitter});vm.runInContext(read('HlsConfig')+';globalThis.config=createHlsConfig(Emitter,"1.7.3").Config;',context);
 fail=true;assert.equal(context.config.applySettings({maxBufferLength:50,debug:true}),false);
 assert.equal(context.config.get('maxBufferLength'),30);assert.equal(context.config.get('debug'),false);assert.equal(values['ZenzaWatch_video.hls.maxBufferLength'],undefined);
});
test('runtime treats edits/reset as drafts, applies complete save, and reports storage failures',async()=>{
 class Emitter {handlers={};on(key,f){(this.handlers[key]??=[]).push(f);}once(key,f){this.on(key,f);}emit(key,...args){for(const f of [...(this.handlers[key]||[])])f(...args);}promise(){return new Promise(()=>{});}}
 const nodes=[];class Element {listeners={};attrs={};setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,f){this.listeners[k]=f;}send(k,detail){this.listeners[k]?.({detail});}open(){}reset(v){this.resetValue=v;}setStatus(message,kind){this.status={message,kind};}setSaving(v){this.saving=v;}setValue(){}canPlayType(){return '';}}
 const window={console,customElements:{get(){return null;}},Hls:{version:'1.7.3',isSupported:()=>true}},document={createElement(){const e=new Element();nodes.push(e);return e;},body:{append(){}}},localStorage={};
 const context=vm.createContext({window,document,localStorage,console,Symbol,createHlsStorage:()=>({}),createHlsVideoElement(){},defineHlsDebugElements(){},HlsLibrary:{version:'1.7.3',url:'test',load:async()=>window.Hls}});
 vm.runInContext(read('HlsConfig')+'\n'+read('HlsRuntime')+';globalThis.runtime=HlsRuntime;',context);
 const z={version:'2.7.379',debug:{},emitter:new Emitter(),util:{addStyle(){}}};
 const runtime=await context.runtime.install(z,{Emitter,dimport:async()=>({html(){},render(){}})});await Promise.resolve();
 assert.equal(z.debug.playlistPrefetch,undefined,'optional prefetch modules must not be required to start ordinary HLS playback');
 const video=runtime.createVideoElement();z.emitter.emit('command-toggleHLSDebug');const dialog=z.debug.hlsDebugDialog;
 dialog.send('change',{name:'show_video_label',value:true});assert.equal(z.debug.hlsConfig.show_video_label,false);
 dialog.send('reset');assert.equal(z.debug.hlsConfig.maxBufferLength,30);assert.equal(dialog.resetValue.maxBufferLength,30);
 dialog.send('save',{config:{maxBufferLength:90,show_video_label:true}});assert.equal(z.debug.hlsConfig.maxBufferLength,90);assert.equal(typeof video.hlsConfig.xhrSetup,'function');assert.equal(video.hlsConfig.useMediaCapabilities,false);assert.equal(video.attrs['show-video-label'],'on');assert.equal(dialog.saving,false);assert.equal(dialog.status.kind,'success');
 dialog.send('save',{config:{maxBufferLength:NaN}});assert.equal(z.debug.hlsConfig.maxBufferLength,90);assert.equal(dialog.status.kind,'error');
});

test('native force and unbounded live defaults survive validation while obsolete keys stay ignored',()=>{
 const {Config}=fixture({'ZenzaWatch_video.hls.use_native_hls':'"force"','ZenzaWatch_video.hls.liveMaxLatencyDurationCount':'null','ZenzaWatch_video.hls.clone':'{}','ZenzaWatch_video.hls.hls_js_ver':'"old"','ZenzaWatch_video.hls.lowBufferWatchdogPeriod':'90'});
 assert.equal(Config.get('use_native_hls'),'force');assert.equal(Config.get('liveMaxLatencyDurationCount'),Infinity);assert.equal(Config.get('liveSyncDuration'),undefined);assert.equal(typeof Config.get('clone'),'function');assert.equal(Config.get('hls_js_ver'),'1.7.3');assert.equal(Config.get('lowBufferWatchdogPeriod'),undefined);
});

test('optional live durations retain valid saved numbers without accepting malformed values',()=>{
 const {Config}=fixture({'ZenzaWatch_video.hls.liveSyncDuration':'8','ZenzaWatch_video.hls.liveMaxLatencyDuration':'20'});
 assert.equal(Config.get('liveSyncDuration'),8);assert.equal(Config.get('liveMaxLatencyDuration'),20);
 Config.set('liveSyncDuration',-1);Config.set('liveMaxLatencyDuration',null);assert.equal(Config.get('liveSyncDuration'),8);assert.equal(Config.get('liveMaxLatencyDuration'),20);
});
