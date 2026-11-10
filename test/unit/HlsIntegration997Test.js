'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const {stripTypeScriptTypes}=require('node:module');
const {JSDOM}=require('jsdom');
function moduleSubject(name,globals={}){
 const context=vm.createContext({...globals,exports:{},console,setTimeout,clearTimeout,URL,Promise});
 const source=fs.readFileSync('tools/typescript-stage1/hls-src/'+name+'.ts','utf8');
 const code=stripTypeScriptTypes(source).replace(/^import .*;\s*$/gm,'').replace(/export \{([^}]+)\};/g,(_,items)=>items.split(',').map(x=>'exports.'+x.trim()+'='+x.trim()+';').join(''));
 vm.runInContext(code,context);return context.exports[name]||context.exports['create'+name];
}
describe('Task997 integrated HLS library ownership',()=>{
 const fixture=()=>{const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>');const window=dom.window;return {window,document:window.document,loader:moduleSubject('HlsLibrary',{window,document:window.document})};};
 it('is lazy and shares one pinned script request',async()=>{
  const h=fixture();assert.equal(h.document.scripts.length,0);
  const a=h.loader.load(),b=h.loader.load();assert.strictEqual(a,b);assert.equal(h.document.scripts.length,1);
  const script=h.document.scripts[0];assert.equal(script.src,'https://cdn.jsdelivr.net/npm/hls.js@1.7.3');
  h.window.Hls={isSupported:()=>true};script.dispatchEvent(new h.window.Event('load'));
  assert.strictEqual(await a,h.window.Hls);assert.strictEqual(await h.loader.load(),h.window.Hls);assert.equal(h.document.scripts.length,1);
 });
 it('a blocked load rejects all waiters and permits explicit retry',async()=>{
  const h=fixture(),a=h.loader.load(),b=h.loader.load();const failed=Promise.all([assert.rejects(a),assert.rejects(b)]);
  h.document.scripts[0].dispatchEvent(new h.window.Event('error'));await failed;
  const c=h.loader.load();assert.equal(h.document.scripts.length,1);h.window.Hls={isSupported:()=>true};h.document.scripts[0].dispatchEvent(new h.window.Event('load'));await c;
 });
 it('a silent load times out and releases its script',async()=>{const h=fixture();await assert.rejects(h.loader.load(5));assert.equal(h.document.scripts.length,0);});
 it('reuses an existing library without loading a second copy',async()=>{const h=fixture();h.window.Hls={isSupported:()=>true};assert.strictEqual(await h.loader.load(),h.window.Hls);assert.equal(h.document.scripts.length,0);});
});
describe('Task997 main/retired entry contracts',()=>{
 it('main owns installation before player construction and old entry is notice-only',()=>{
  const main=fs.readFileSync('src/initializer.js','utf8'),old=fs.readFileSync('src/_hls.js','utf8');
  assert(main.includes('HlsRuntime.install'));
  assert(main.indexOf('HlsRuntime.install')<main.indexOf('initializeDialogPlayer(Config)'));
  assert(old.includes('削除してください'));assert(old.includes('ZenzaWatch本体'));
  assert(!old.includes('@require'));assert(!old.includes('new Worker'));assert(!old.includes('customElements.define'));assert(!old.includes('ZenzaHLS ='));
 });
});

describe('Task997 integrated HLS installation',()=>{
 function fixture(legacy=false,missing=false){
  const window=new JSDOM('<!doctype html><body></body>',{url:'https://www.nicovideo.jp/'}).window,document=window.document,calls={library:0,storage:0,element:0};
  window.Hls=missing?undefined:{isSupported:()=>true};
  if(missing)window.MediaSource=class{};
  if(legacy){window.customElements.define('zenza-video',class extends window.HTMLElement{});window.ZenzaHLS={createVideoElement:()=>document.createElement('video')};}
  const config={raw:{use_native_hls:true},get:k=>k==='autoAbrEwmaDefaultEstimate'?false:config.raw[k],set:(k,v)=>config.raw[k]=v,on(){}};
  const subject=moduleSubject('HlsRuntime',{window,document,localStorage:window.localStorage,
   HlsLibrary:{version:'1.7.3',url:'https://example.invalid/hls',load:()=>{calls.library++;return missing&&calls.library===1?Promise.reject(Error('blocked')):Promise.resolve(window.Hls);}},
   createHlsConfig:()=>({Config:config,DEFAULT_CONFIG:{},nativeHlsPreference:()=> 'yes',debounce:x=>x,throttle:x=>x}),
   createHlsStorage:()=>{calls.storage++;return {};},createHlsVideoElement:deps=>{calls.element++;window.__elementDependencies=deps;},defineHlsDebugElements(){}});
  const zenza={version:'test',debug:{},emitter:{promise:()=>new Promise(()=>{}),once(){},on(){}},util:{}};
  return {window,document,calls,subject,zenza,dependencies:{Emitter:class{},dimport:()=>Promise.resolve({})}};
 }
 it('installs once and gives the player one factory and preserved settings interface',async()=>{
  const h=fixture(),a=h.subject.install(h.zenza,h.dependencies),b=h.subject.install(h.zenza,h.dependencies);assert.strictEqual(a,b);
  const installed=await a;assert.deepStrictEqual(h.calls,{library:1,storage:1,element:1});
  assert.strictEqual(h.zenza.debug.createVideoElement,installed.createVideoElement);assert.equal(h.zenza.debug.isHLSSupported,true);
  h.zenza.debug.hlsConfig.use_native_hls=false;assert.equal(h.zenza.debug.hlsConfig.use_native_hls,false);
 });
 it('keeps an MSE playback retry reachable after installation library failure',async()=>{
  const h=fixture(false,true);await h.subject.install(h.zenza,h.dependencies);
  assert.equal(h.zenza.debug.isHLSSupported,true,'dialog must allow a later HLS src retry');
  h.window.Hls={isSupported:()=>true};
  assert.strictEqual(await h.window.__elementDependencies.loadLibrary(),h.window.Hls);
  assert.equal(h.calls.library,2,'fresh loader call rather than rejected install promise');
 });
 it('adopts an already running old factory without another worker, element or download',async()=>{
  const h=fixture(true),old=h.window.ZenzaHLS;
  assert.strictEqual(await h.subject.install(h.zenza,h.dependencies),old);assert.deepStrictEqual(h.calls,{library:0,storage:0,element:0});
 });
});

describe('Task997 preserved HLS settings',()=>{
 class Emitter {emit(){} on(){} off(){}}
 it('uses existing keys without a migration copy',()=>{
  const saved={'ZenzaWatch_video.hls.use_native_hls':'"force"','ZenzaWatch_video.hls.show_video_label':'true'};
  const create=moduleSubject('HlsConfig',{localStorage:saved});const {Config}=create(Emitter,'1.7.3');
  assert.equal(Config.get('use_native_hls'),'force');assert.equal(Config.get('show_video_label'),true);
  Config.set('show_video_label',false);assert.equal(saved['ZenzaWatch_video.hls.show_video_label'],'false');
 });
 it('storage denial preserves working in-memory defaults and updates',()=>{
  const storage=new Proxy({},{get(){throw Error('denied');},set(){throw Error('denied');}});
  const create=moduleSubject('HlsConfig',{localStorage:storage});const {Config}=create(Emitter,'1.7.3');
  assert.equal(Config.get('use_native_hls'),true);Config.set('use_native_hls','force');assert.equal(Config.get('use_native_hls'),'force');
 });
});
