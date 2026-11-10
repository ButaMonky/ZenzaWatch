import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

// Exercise the canonical class before any compiler emission or userscript build.
const source=fs.readFileSync(new URL('../hls-src/HlsVideoElement.ts',import.meta.url),'utf8');
const js=stripTypeScriptTypes(source,{mode:'strip'});
const begin=js.indexOf('class ZenzaVideoElement extends HTMLElement');
const end=js.indexOf('\n      if (window.customElements',begin);
assert(begin>=0 && end>begin,'canonical video element class boundaries');
const code=js.slice(begin,end);
const A='https://delivery.invalid/a/master.m3u8',B='https://delivery.invalid/b/master.m3u8';
const eventNames=['MANIFEST_PARSED','LEVEL_LOADED','LEVEL_SWITCHED','ERROR','FRAG_LOADED','BUFFER_EOS','MEDIA_ATTACHED','DESTROYING'];
function fixture({onInit,onLoad,onAttach,onStop,onDestroy,missingLibrary=false,loadLibrary}={}){
 const engines=[],events=[],calls=[];
 class Hls {
  static isSupported(){return true;}
  static Events=Object.fromEntries(eventNames.map(name=>[name,name]));
  constructor(config){this.config=config;this.handlers=new Map();this.loaded=[];this.attached=[];this.destroyed=false;engines.push(this);}
  on(name,handler){const list=this.handlers.get(name)||[];list.push(handler);this.handlers.set(name,list);return this;}
  emit(name,data){for(const handler of [...(this.handlers.get(name)||[])])handler(name,data);}
  loadSource(src){this.loaded.push(src);calls.push(['load',this,src]);onLoad?.(h,this,src);}
  attachMedia(video){this.attached.push(video);calls.push(['attach',this,video]);onAttach?.(h,this);}
  stopLoad(){calls.push(['stop',this]);onStop?.(h,this);}
  detachMedia(){calls.push(['detach',this]);}
  destroy(){calls.push(['destroy',this]);this.emit('DESTROYING');this.destroyed=true;this.handlers.clear();onDestroy?.(h,this);}
 }
 const context=vm.createContext({HTMLElement:class{setAttribute(){}},Hls:missingLibrary?undefined:Hls,loadLibrary:()=>loadLibrary(Hls),ErrorEvent:class{constructor(type){this.type=type;}},overrideTarget:e=>e,HLS_ERROR_CODE:{NETWORK:2},createFragmentLoader:()=>class FragmentLoader{},
  CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},
  PLAYER_MODE:{HLS_JS:'HLS-JS',DEFAULT:'DEFAULT'},console,performance});
 vm.runInContext(code+';globalThis.Subject=ZenzaVideoElement;',context);
 const player=Object.create(context.Subject.prototype);
 const config={startLevel:-1,testBandwidth:true,startFragPrefetch:false,progressive:false,autoStartLoad:true,enableSoftwareAES:true};
 const h={player,engines,events,calls,config};
 Object.assign(player,{_hls:null,_hlsConfig:config,_video:{readyState:0,videoWidth:0,canPlayType:()=>''},_eventWrapperMap:new Map(),_src:A,_label:{textContent:''},_videoCount:0,_throttledCurrentTime:{cancel(){}},getAttribute(){return null;},
  dispatchEvent(event){events.push(event);if(event.type==='init-hls-js')onInit?.(h,event.detail.hls);return true;}});
 player._resetReadiness();
 return h;
}
const operations=(h,engine)=>h.calls.filter(call=>call[1]===engine).map(call=>call[0]);

test('manifest starts without MEDIA_ATTACHED, with exactly one owned load and attachment',()=>{
 const h=fixture(),engine=h.player._initHLSJS(A);
 assert.deepEqual(engine.loaded,[A],'manifest must start while attachment remains pending');
 assert.deepEqual(engine.attached,[h.player._video]);
 assert.deepEqual(operations(h,engine),['load','attach']);
 engine.emit('MEDIA_ATTACHED');engine.emit('MEDIA_ATTACHED');
 assert.deepEqual(engine.loaded,[A],'late/repeated attachment cannot load again');
 assert.strictEqual(h.player.hls,engine);
});

test('normal handlers and existing init hook are installed before loadSource',()=>{
 let loaded=0;
 const required=eventNames.filter(name=>name!=='MEDIA_ATTACHED'&&name!=='DESTROYING');
 const h=fixture({onInit(h,engine){assert(required.every(name=>engine.handlers.has(name)));assert.equal(engine.loaded.length,0);},
  onLoad(h,engine){loaded++;assert(required.every(name=>engine.handlers.has(name)));assert.equal(h.events.filter(e=>e.type==='init-hls-js').length,1);}});
 h.player._initHLSJS(A);
 assert.equal(loaded,1);assert.equal(h.events.filter(e=>e.type==='init-hls-js').length,1);
});

test('early manifest retains synthetic readiness without claiming real media readiness',()=>{
 const h=fixture({onLoad(h,engine){engine.emit('MANIFEST_PARSED',{levels:[]});}});
 h.player._initHLSJS(A);
 assert.equal(h.player.readiness.manifestReady,true);
 for(const key of ['mediaCanPlay','firstPlaying','firstProgress','firstFrame'])assert.equal(h.player.readiness[key],false,key);
 for(const type of ['loadedmetadata','canplay']){
  const event=h.events.find(event=>event.type===type);assert(event);assert.equal(event.detail.synthetic,true);assert.equal(event.detail.stage,'manifestReady');
 }
 assert.equal(h.config.startLevel,-1);assert.equal(h.config.testBandwidth,true);
 assert.equal(h.config.startFragPrefetch,false);assert.equal(h.config.progressive,false);
 assert.equal(h.config.enableSoftwareAES,true);assert.equal(h.config.autoStartLoad,true);
});

for(const boundary of ['init','load'])test(`${boundary} reentry that replaces the engine cannot load/attach the old engine`,()=>{
 let once=false;
 const replace=(h,engine)=>{if(once)return;once=true;h.player._initHLSJS(B);};
 const h=fixture(boundary==='init'?{onInit:replace}:{onLoad:replace});
 const result=h.player._initHLSJS(A),[old,current]=h.engines;
 assert.strictEqual(result,current);assert.strictEqual(h.player.hls,current);
 assert.deepEqual(old.loaded,boundary==='init'?[]:[A]);assert.deepEqual(old.attached,[]);assert.equal(old.destroyed,true);
 assert.deepEqual(current.loaded,[B]);assert.deepEqual(current.attached,[h.player._video]);
 assert.deepEqual(operations(h,old).filter(op=>['stop','detach','destroy'].includes(op)),['stop','detach','destroy']);
});

for(const boundary of ['init','load'])test(`${boundary} reentry that disposes the player stops further startup`,()=>{
 const dispose=h=>h.player._destroyHLSJS();
 const h=fixture(boundary==='init'?{onInit:dispose}:{onLoad:dispose});
 h.player._initHLSJS(A);const [old]=h.engines;
 assert.equal(h.player.hls,null);assert.equal(old.destroyed,true);assert.deepEqual(old.attached,[]);
 assert.deepEqual(old.loaded,boundary==='init'?[]:[A]);assert.equal(h.config.fLoader,undefined);assert.equal(h.player._fragmentLoader,undefined);
});

test('direct destruction from the existing init hook prevents load and attachment',()=>{
 const h=fixture({onInit(h,engine){engine.destroy();}});
 h.player._initHLSJS(A);const [old]=h.engines;
 assert.deepEqual(old.loaded,[]);assert.deepEqual(old.attached,[]);assert.equal(h.player.hls,null);assert.equal(h.config.fLoader,undefined);
});

for(const boundary of ['load','attach'])test(`${boundary} failure releases the owned engine/loaders and propagates the same error`,()=>{
 const error=new Error('startup failed');const fail=()=>{throw error;};
 const h=fixture(boundary==='load'?{onLoad:fail}:{onAttach:fail});
 assert.throws(()=>h.player._initHLSJS(A),value=>value===error);
 const [old]=h.engines;assert.equal(old.destroyed,true);assert.equal(h.player.hls,null);
 assert.equal(h.config.fLoader,undefined);assert.equal(h.player._fragmentLoader,undefined);
 assert.deepEqual(operations(h,old).slice(-3),['stop','detach','destroy']);
});

for(const boundary of ['load','attach'])test(`${boundary} replacement followed by failure preserves the newer engine and original error`,()=>{
 const error=new Error('superseded startup failed');let once=false;
 const replaceAndFail=h=>{if(once)return;once=true;h.player._initHLSJS(B);throw error;};
 const h=fixture(boundary==='load'?{onLoad:replaceAndFail}:{onAttach:replaceAndFail});
 assert.throws(()=>h.player._initHLSJS(A),value=>value===error);
 const [old,current]=h.engines;assert.equal(old.destroyed,true);assert.equal(current.destroyed,false);
 assert.strictEqual(h.player.hls,current);assert.deepEqual(current.loaded,[B]);assert.deepEqual(current.attached,[h.player._video]);
 assert.strictEqual(h.config.fLoader,h.player._fragmentLoader);
});

test('source switch and repeated teardown retain the normal stop/detach/destroy lifecycle',()=>{
 const h=fixture(),old=h.player._initHLSJS(A),current=h.player._initHLSJS(B);
 assert.deepEqual(operations(h,old),['load','attach','stop','detach','destroy']);
 h.player._destroyHLSJS();h.player._destroyHLSJS();
 assert.deepEqual(operations(h,current),['load','attach','stop','detach','destroy']);
 assert.equal(h.player.hls,null);assert.equal(h.config.fLoader,undefined);
});

test('teardown reentry cannot destroy a newer owner or its fragment loader',()=>{
 let once=false;
 const h=fixture({onStop(h){if(once)return;once=true;h.player._initHLSJS(B);}});
 const old=h.player._initHLSJS(A);h.player._destroyHLSJS();const current=h.engines.at(-1);
 assert.notStrictEqual(current,old);assert.strictEqual(h.player.hls,current);assert.equal(current.destroyed,false);
 assert.strictEqual(h.config.fLoader,h.player._fragmentLoader);
 assert.deepEqual(operations(h,old),['load','attach','stop','detach','destroy']);
});

for(const boundary of ['init','load'])test('public src replacement during '+boundary+' retains the newer source',()=>{
 let once=false;const replace=h=>{if(once)return;once=true;h.player.src=B;};
 const h=fixture(boundary==='init'?{onInit:replace}:{onLoad:replace});
 h.player.src=A;assert.equal(h.player.src,B);assert.deepEqual(h.player.hls.loaded,[B]);
 assert.equal(h.player.playerMode,'HLS-JS');
});

test('direct destruction during loadSource stops media attachment',()=>{
 const h=fixture({onLoad(h,engine){engine.destroy();}});h.player._initHLSJS(A);
 assert.equal(h.player.hls,null);assert.equal(h.config.fLoader,undefined);assert.deepEqual(h.engines[0].attached,[]);
});

test('partial startup failure preserves its error even when teardown throws',()=>{
 const error=new Error('startup failed'),cleanupError=new Error('stop failed');
 const h=fixture({onLoad(){throw error;},onStop(){throw cleanupError;}});
 assert.throws(()=>h.player._initHLSJS(A),value=>value===error);
 const [old]=h.engines;assert.equal(old.destroyed,true);assert.equal(h.player.hls,null);
 assert.equal(h.config.fLoader,undefined);assert.deepEqual(operations(h,old),['load','stop','detach','destroy']);
});

for(const boundary of ['clear','disconnect'])test('teardown '+boundary+' invalidates the outer initialization even with no replacement engine',()=>{
 let armed=false;
 const h=fixture({onStop(h){if(!armed)return;armed=false;if(boundary==='clear')h.player.src='';else h.player.disconnectedCallback();}});
 h.player.src=B;const [old]=h.engines;armed=true;h.player.src=A;
 assert.equal(h.engines.length,1,'superseded A must not create another engine');
 assert.equal(h.player.hls,null);assert.equal(h.config.fLoader,undefined);assert.equal(old.destroyed,true);
 assert.deepEqual(operations(h,old),['load','attach','stop','detach','destroy']);
 if(boundary==='clear'){assert.equal(h.player.src,'');assert.equal(h.player.playerMode,'DEFAULT');}
});

test('clearing src cannot clear native media or mode installed by a teardown replacement',()=>{
 let armed=false;
 const h=fixture({onStop(h){if(!armed)return;armed=false;h.player.src=B;}});
 h.player._video.src='native sentinel';h.player.src=A;armed=true;h.player.src='';
 assert.equal(h.player.src,B);assert.equal(h.player.playerMode,'HLS-JS');
 assert.equal(h.player._video.src,'native sentinel','outer clear must not write to the newer media');
 assert.deepEqual(h.player.hls.loaded,[B]);assert.equal(h.engines[0].destroyed,true);
});

const flushLibrary=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
test('missing library retries for the current src without synchronous failure',async()=>{
 let resolve,library,loads=0;
 const h=fixture({missingLibrary:true,loadLibrary(Hls){loads++;library=Hls;return new Promise(r=>resolve=r);}});
 assert.doesNotThrow(()=>{h.player.src=A;});await flushLibrary();
 assert.equal(loads,1);assert.equal(h.engines.length,0);
 resolve(library);await flushLibrary();assert.deepEqual(h.engines[0].loaded,[A]);
 assert.deepEqual(h.engines[0].attached,[h.player._video]);
});
for(const replacement of [B,'','https://delivery.invalid/plain.mp4','disconnect'])test('pending library cannot mount stale src after '+replacement,async()=>{
 let resolve,library;
 const pending=new Promise(r=>resolve=r);
 const h=fixture({missingLibrary:true,loadLibrary(Hls){library=Hls;return pending;}});
 h.player.src=A;await flushLibrary();
 if(replacement==='disconnect')h.player.disconnectedCallback();else h.player.src=replacement;
 await flushLibrary();resolve(library);await flushLibrary();
 assert.equal(h.engines.length,replacement===B?1:0);
 if(replacement===B)assert.deepEqual(h.engines[0].loaded,[B]);
 assert.equal(h.events.filter(e=>e.type==='error').length,0);
});
test('library rejection emits one generic video error and later source retries',async()=>{
 let loads=0;
 const h=fixture({missingLibrary:true,loadLibrary(Hls){loads++;return loads===1?Promise.reject(Error('https://private.invalid/TOKEN')):Promise.resolve(Hls);}});
 h.player.src=A;await flushLibrary();assert.equal(h.events.filter(e=>e.type==='error').length,1);
 assert.equal(h.player.error.code,2);assert(!JSON.stringify(h.player.error).includes('TOKEN'));
 h.player.src=B;await flushLibrary();assert.equal(loads,2);assert.deepEqual(h.engines[0].loaded,[B]);
});
test('stale library failure is silent',async()=>{
 let reject;const h=fixture({missingLibrary:true,loadLibrary(){return new Promise((_,r)=>reject=r);}});
 h.player.src=A;await flushLibrary();h.player.src='';reject(Error('private'));await flushLibrary();
 assert.equal(h.events.filter(e=>e.type==='error').length,0);
});
