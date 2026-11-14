import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createDialogHarness}=require('../../../test/helpers/dialogHarness.js');

const make=()=>{
 const h=createDialogHarness(),events=[];
 const settings={
  'playlist.prefetchAhead.enabled':true,
  'playlist.prefetchAhead.sourcePlaylist':true,'playlist.prefetchAhead.sourceRelated':false,
  'playlist.prefetchAhead.sourceDescription':false,
  'playlist.prefetchAhead.order':'playlist,related,description',
  'playlist.prefetchAhead.window':3,'playlist.prefetchAhead.cacheMB':64,
  'playlist.prefetchAhead.pacingMs':0,'playlist.prefetchAhead.notify':'off',
  'videoServerType':'domand','domandVideoQuality':'auto',autoDisableNew:false,loop:false
 };
 h.dialog._playerConfig.getValue=key=>settings[key];
 h.dialog._playerConfig.props.domandVideoQuality='auto';
 h.dialog._playlist={isEnable:true,peekNextIds:()=>['sm2','sm3'],on(){},insert(){}};
 h.context.navigator={connection:{saveData:false}};
 h.context.global.debug.playlistPrefetch={
  bytes:{activate:(value)=>events.push(['activated',value])},
  supported:()=>true,
  sample:()=>({currentTime:25,duration:120,rate:1,ended:false,buffered:{length:1,start:()=>0,end:()=>80}}),
  create:()=>({update:sample=>events.push(['update',sample]),interrupt:reason=>events.push(['interrupt',reason]),reset(){}})
 };
 const data={dispose(){events.push(['disposed']);}};
 return {h,settings,events,data};
};
const settle=async (h,id)=>{
 const open=h.dialog.open(id,{openNow:true});
 await h.flush();
 assert.equal(h.loader.calls.length,1,'foreground metadata load is still required');
 h.loader.calls[0].resolve(h.videoData(id));
 h.cacheGet.calls[0].resolve(null);
 await h.flush();
 await open;
};

test('Nico prefetch: cached session is adopted without requesting a new playback session',async()=>{
 const {h,events,data}=make();
 let promoted=0,closed=0,taken=0;
 const url='https://delivery.domand.nicovideo.jp/video/playlist.m3u8';
 const prepared={watchId:'sm2',settings:h.dialog._prefetchSettingsKey(),sessionInfo:{url,type:'domand'},bytes:data,
  session:{isDmc:false,serverType:'domand',promote:async()=>{promoted++},close(){closed++}},
  adopted:false,dispose(){closed++}};
 h.dialog._playlistPrefetch={interrupt(){},take(id){taken++;assert.equal(id,'sm2');return prepared;}};
 await settle(h,'sm2');
 assert.equal(taken,1);assert.equal(promoted,1);assert.equal(h.sessionCreate.calls.length,0);
 assert.equal(prepared.adopted,true);assert.equal(closed,0);
 assert.ok(events.some(e=>e[0]==='activated'&&e[1]===data));
 assert.ok(h.log.some(x=>x==='setVideo:'+url));
});

test('Nico prefetch: failed promotion disposes cache and uses the original session path',async()=>{
 const {h}=make();
 let disposed=0;
 const prepared={watchId:'sm2',settings:h.dialog._prefetchSettingsKey(),
  sessionInfo:{url:'https://delivery.domand.nicovideo.jp/old.m3u8'},
  session:{promote:async()=>{throw Error('expired')},close(){}},
  dispose(){disposed++}};
 h.dialog._playlistPrefetch={interrupt(){},take(){return prepared}};
 const opened=h.dialog.open('sm2',{openNow:true});
 await h.flush();h.loader.calls[0].resolve(h.videoData('sm2'));h.cacheGet.calls[0].resolve(null);
 await h.flush();
 assert.equal(h.sessionCreate.calls.length,1);
 const ordinary=h.openedSession('fallback');h.sessionCreate.calls[0].resolve(ordinary);
 await h.flush();ordinary.connect.calls[0].resolve({url:'https://delivery.domand.nicovideo.jp/fallback.m3u8',type:'domand'});
 await h.flush();await opened;
 assert.equal(disposed,1);
 assert.ok(h.log.some(x=>x.includes('setVideo:https://delivery.domand.nicovideo.jp/fallback.m3u8')));
});

test('Nico prefetch: scheduler reads candidates and buffer without altering selection',()=>{
 const {h,events}=make();
 h.state.isOpen=true;h.state.isPlaying=true;h.dialog._watchId='sm1';
 h.dialog._updateNextPrefetch();
 const update=events.find(e=>e[0]==='update');
 assert.ok(update);
 assert.deepEqual(Array.from(update[1].candidates),['sm2','sm3']);
 assert.equal(update[1].currentId,'sm1');
 assert.equal(update[1].bufferEnd,80);
 assert.equal(update[1].maxStoreBytes,64*1048576);
});

test('Nico prefetch: marker IDs follow cache readiness and the showMark switch',()=>{
 const {h,settings}=make();
 h.state.isOpen=true;h.state.isPlaying=true;h.dialog._watchId='sm1';
 h.dialog._playlistPrefetch={readyIds:()=>['sm2','sm3'],interrupt(){},reset(){},update(){}};
 h.dialog._updatePrefetchMarks();
 assert.deepEqual(Array.from(h.context.global.debug.playlistPrefetch.markIds),['sm2','sm3']);
 settings['playlist.prefetchAhead.showMark']=false;
 h.dialog._updatePrefetchMarks();
 assert.deepEqual(Array.from(h.context.global.debug.playlistPrefetch.markIds),[]);
});

test('Nico prefetch: no extra fetches or cache access while opt-in is disabled',async()=>{
 const {h,settings,events}=make();
 settings['playlist.prefetchAhead.enabled']=false;
 settings['playlist.prefetchNext']=false;
 h.state.isOpen=true;h.state.isPlaying=true;h.dialog._watchId='sm1';
 h.dialog._updateNextPrefetch();
 assert.equal(events.length,0,'no scheduling event on default-off');
 await settle(h,'sm2');
 assert.equal(h.sessionCreate.calls.length,1,'only the ordinary session is requested');
 const ordinary=h.openedSession('legacy');h.sessionCreate.calls[0].resolve(ordinary);
 await h.flush();ordinary.connect.calls[0].resolve({url:'https://delivery.domand.nicovideo.jp/legacy.m3u8',type:'domand'});
 await h.flush();
 assert.ok(h.log.some(x=>x==='setVideo:https://delivery.domand.nicovideo.jp/legacy.m3u8'));
});
test('Nico prefetch: rapid second open disposes the first pending prepared session',async()=>{
 const {h}=make();let disposed=0,promoted=0;
 const pending={watchId:'sm2',settings:h.dialog._prefetchSettingsKey(),
  sessionInfo:{url:'https://delivery.domand.nicovideo.jp/old.m3u8'},
  session:{promote(){promoted++;return Promise.resolve()},close(){}},
  dispose(){disposed++}};
 h.dialog._playlistPrefetch={interrupt(){},take(id){return id==='sm2'?pending:null},readyIds(){return[]}};
 const first=h.dialog.open('sm2',{openNow:true});await h.flush();
 const second=h.dialog.open('sm3',{openNow:true});await h.flush();
 assert.equal(disposed,1,'outdated cache session must be disposed immediately');
 h.loader.calls[0].resolve(h.videoData('sm2'));
 h.loader.calls[1].resolve(h.videoData('sm3'));
 for(const call of h.cacheGet.calls)call.resolve(null);
 await h.flush();
 assert.equal(promoted,0);
 assert.equal(h.sessionCreate.calls.length,1);
 const normal=h.openedSession('sm3');h.sessionCreate.calls[0].resolve(normal);
 await h.flush();normal.connect.calls[0].resolve({url:'https://delivery.domand.nicovideo.jp/current.m3u8',type:'domand'});
 await h.flush();await Promise.all([first,second]);
 assert.ok(h.log.some(x=>x==='setVideo:https://delivery.domand.nicovideo.jp/current.m3u8'));
});
test('Nico prefetch: adaptive bitrate telemetry does not invalidate prepared cache ownership',()=>{
 const {h}=make();
 h.context.global.debug.hlsConfig={startLevel:-1,abrEwmaDefaultEstimate:1000000};
 const key=h.dialog._prefetchSettingsKey();
 h.context.global.debug.hlsConfig.abrEwmaDefaultEstimate=2400000;
 assert.equal(h.dialog._prefetchSettingsKey(),key,
  'normal bandwidth estimates change during playback and must not clear ready videos');
 h.context.global.debug.hlsConfig.startLevel=2;
 assert.notEqual(h.dialog._prefetchSettingsKey(),key,
  'explicit start-level changes must invalidate cached startup assumptions');
});

test('Nico prefetch: brief non-HLS player transition interrupts only inflight work, retaining ready cache',()=>{
 const {h,settings}=make();
 h.state.isPlaying=true;h.state.isOpen=true;h.dialog._watchId='sm1';
 let supported=false,interrupts=0,resets=0,disposals=0;
 const stored={readyIds:()=>['sm2'],interrupt(){interrupts++},reset(){resets++},update(){}};
 h.dialog._playlistPrefetch=stored;
 const runtime=h.context.global.debug.playlistPrefetch;
 runtime.supported=()=>supported;
 h.dialog._updateNextPrefetch();
 assert.equal(interrupts,1);
 assert.equal(resets,0);
 assert.deepEqual(Array.from(stored.readyIds()),['sm2']);
 supported=true;
 h.dialog._updateNextPrefetch();
 assert.equal(resets,0);
 settings['playlist.prefetchAhead.enabled']=false;
 h.dialog._updateNextPrefetch();
 assert.equal(resets,1,'explicit OFF is the only immediate cache-clear gate');
});
test('Nico prefetch: OFF resets at most once across ordinary video timeupdates',()=>{
 const {h,settings}=make();
 let resets=0;
 h.dialog._playlistPrefetch={reset(){resets++}};
 settings['playlist.prefetchAhead.enabled']=false;
 settings['playlist.prefetchNext']=false;
 for(let i=0;i<5;i++) h.dialog._updateNextPrefetch();
 assert.equal(resets,1,'background cache must not be repeatedly torn down when feature is OFF');
 assert.equal(h.dialog._playlistPrefetch,null,'old cache owner is released');
});

test('Nico prefetch: mark setting applies immediately without waiting for a timeupdate',()=>{
 const {h,settings}=make();
 h.dialog._playlistPrefetch={readyIds:()=>['sm2'],reset(){},interrupt(){}};
 h.dialog._updatePrefetchMarks();
 assert.deepEqual(Array.from(h.context.global.debug.playlistPrefetch.markIds),['sm2']);
 settings['playlist.prefetchAhead.showMark']=false;
 h.dialog._onPlayerConfigUpdate('playlist.prefetchAhead.showMark',false);
 assert.deepEqual(Array.from(h.context.global.debug.playlistPrefetch.markIds),[],
  'the marker must disappear on a paused player without a new video event');
});

test('Nico prefetch: playback failure clears activated startup bytes so ordinary retries bypass stale cache',()=>{
 const {h}=make();
 let clears=0;
 h.context.global.debug.playlistPrefetch.bytes.clear=()=>{clears++};
 h.dialog._setErrorMessage=()=>{};
 h.dialog._onVideoError({type:'hls'});
 assert.equal(clears,1,'stale startup bytes must not be replayed after playback failure');
});
test('Nico prefetch: near-expiry prepared video is rejected with the 60-second buffer',async()=>{
 const {h}=make();
 let promoted=0,disposed=0;
 const warnings=[];
 h.dialog._getPrefetchReporter=()=>({staleAdoption:id=>warnings.push(id)});
 const prepared={watchId:'sm2',settings:h.dialog._prefetchSettingsKey(),
   expiresAt:Date.now()+30000,
   sessionInfo:{url:'https://delivery.domand.nicovideo.jp/old.m3u8'},
   session:{promote:async()=>{promoted++},close(){}},
   dispose(){disposed++}};
 h.dialog._playlistPrefetch={interrupt(){},take(){return prepared},readyIds(){return[]}};
 const opened=h.dialog.open('sm2',{openNow:true});
 await h.flush();h.loader.calls[0].resolve(h.videoData('sm2'));h.cacheGet.calls[0].resolve(null);
 await h.flush();
 assert.equal(promoted,0,'a nearly expired URL is never handed to the active player');
 assert.equal(disposed,1);
 assert.deepEqual(warnings,['sm2']);
 const session=h.openedSession('fresh');
 h.sessionCreate.calls[0].resolve(session);
 await h.flush();session.connect.calls[0].resolve({url:'https://delivery.domand.nicovideo.jp/fresh.m3u8',type:'domand'});
 await h.flush();await opened;
 assert.ok(h.log.includes('setVideo:https://delivery.domand.nicovideo.jp/fresh.m3u8'));
});
test('Nico prefetch: reporter exception cannot block expiry fallback',async()=>{
 const {h}=make();let disposed=0;
 const prepared={watchId:'sm2',settings:h.dialog._prefetchSettingsKey(),
  expiresAt:Date.now()+10000,
  sessionInfo:{url:'https://delivery.domand.nicovideo.jp/old.m3u8'},
  session:{promote:async()=>{throw Error('must never promote')},close(){}},
  dispose(){disposed++}};
 h.dialog._getPrefetchReporter=()=>{throw Error('journal unavailable')};
 h.dialog._playlistPrefetch={interrupt(){},take(){return prepared},readyIds(){return[]}};
 const open=h.dialog.open('sm2',{openNow:true});
 await h.flush();h.loader.calls[0].resolve(h.videoData('sm2'));h.cacheGet.calls[0].resolve(null);
 await h.flush();
 assert.equal(disposed,1);
 assert.equal(h.sessionCreate.calls.length,1,'normal fallback survives reporter failure');
 const s=h.openedSession('normal');h.sessionCreate.calls[0].resolve(s);
 await h.flush();s.connect.calls[0].resolve({url:'https://delivery.domand.nicovideo.jp/fresh.m3u8',type:'domand'});
 await h.flush();await open;
 assert.ok(h.log.includes('setVideo:https://delivery.domand.nicovideo.jp/fresh.m3u8'));
});