import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

// Run the canonical view in memory, including its real panel mount and handlers.
// This suite also runs before a checkout has any ignored compiler emissions.
const source=fs.readFileSync(new URL('../nico-src/NicoVideoPlayerDialog.ts',import.meta.url),'utf8');
const text=stripTypeScriptTypes(source,{mode:'strip'});
const viewStart=text.indexOf('class NicoVideoPlayerDialogView extends');
const viewCode=text.slice(viewStart,text.indexOf('\n}',viewStart)+2);
function fixture({onMount,onActivate,mountError=false}={}){
 const calls=[],nativeSeek={},nativeMarker={},container={nativeSeek,nativeMarker};
 const dock={activate:async(id,duration)=>{calls.push(['activate',id,duration]);
  return onActivate?.(id,duration);},
  deactivate:()=>calls.push(['deactivate']),dispose(){}};
 const context=vm.createContext({Emitter:class{},console,
  window:{indexedDB:{},crypto:{}},
  VideoInfoPanel:class{on(){} update(info){calls.push(['update',info?.watchId]);}
   onLoadFail(){calls.push(['fail']);}},
  IndexedDbManualBookmarkBackend:class{},ManualBookmarkRepository:class{},
  ManualBookmarkSession:class{dispose(){}},ManualBookmarkDock:{mount:()=>{
   onMount?.(view);if(mountError)throw Error('optional dock unavailable');return dock;
  }}});
 vm.runInContext(viewCode+';globalThis.View=NicoVideoPlayerDialogView',context);
 const view=Object.create(context.View.prototype);
 view._dialog={_requestId:'request-A'};
 view._state={isError:false,videoInfo:null};
 view._$playerContainer=[container];view._currentTimeGetter=()=>0;
 for(const method of ['_onCommand','_clearActionFeedback','_clearHoverUiActive','_setThumbnail'])view[method]=()=>{};
 const info=(id='sm1')=>({watchId:id,duration:300});
 const load=value=>{view._state.videoInfo=value;view._onVideoInfoLoad(value);};
 const fail=value=>{view._state.isError=true;view._state.videoInfo=value??null;
  view._onVideoInfoLoad(value??null);view._onVideoInfoFail(value);};
 const mount=()=>view._initializeVideoInfoPanel();
 return {view,calls,container,nativeSeek,nativeMarker,info,load,fail,mount};
}
test('success before panel mount is replayed once after the optional dock exists',()=>{
 const h=fixture(),info=h.info();h.load(info);
 assert.deepEqual(h.calls,[]);h.mount();h.mount();h.load(info);
 assert.deepEqual(h.calls.filter(x=>x[0]==='activate'),[['activate','sm1',300]]);
 assert(h.calls.some(x=>x[0]==='update'&&x[1]==='sm1'));
 assert.equal(h.container.nativeSeek,h.nativeSeek);assert.equal(h.container.nativeMarker,h.nativeMarker);
});
for(const hasInfo of [true,false])test(`pre-mount failure ${hasInfo?'with':'without'} info never activates`,()=>{
 const h=fixture();h.fail(hasInfo?h.info():undefined);h.mount();
 assert.equal(h.calls.filter(x=>x[0]==='activate').length,0);
 assert(h.calls.some(x=>x[0]===(hasInfo?'update':'fail')));
});
test('mounted failure info notification has priority over the success subscription',()=>{
 const h=fixture();h.mount();h.fail(h.info());
 assert.equal(h.calls.filter(x=>x[0]==='activate').length,0);
 assert(h.calls.some(x=>x[0]==='update'&&x[1]==='sm1'));
});
test('switch during mount never replays an earlier request even for the same video',()=>{
 const h=fixture();h.load(h.info());h.view._dialog._requestId='request-B';h.mount();
 assert.equal(h.calls.filter(x=>x[0]==='activate'||x[0]==='update').length,0);
 h.load(h.info());assert.deepEqual(h.calls.filter(x=>x[0]==='activate'),[['activate','sm1',300]]);
});
test('only the latest video is replayed after a pre-mount switch',()=>{
 const h=fixture();h.load(h.info());h.view._dialog._requestId='request-B';
 h.view._onBeforeVideoOpen();h.load(h.info('sm2'));h.mount();
 assert.deepEqual(h.calls.filter(x=>x[0]==='activate'),[['activate','sm2',300]]);
});
test('a failed request followed by a new successful request can activate again',()=>{
 const h=fixture();h.fail();h.view._dialog._requestId='request-B';
 h.view._onBeforeVideoOpen();h.view._state.isError=false;h.load(h.info('sm2'));h.mount();
 assert.deepEqual(h.calls.filter(x=>x[0]==='activate'),[['activate','sm2',300]]);
});
test('mounted success followed by late failure deactivates without reactivation',()=>{
 const h=fixture();h.mount();h.load(h.info());h.fail(h.info());
 assert.equal(h.calls.filter(x=>x[0]==='activate').length,1);
 assert.equal(h.calls.at(-2)[0],'deactivate');assert.equal(h.calls.at(-1)[0],'update');
});
test('close before mount discards a pending presentation',()=>{
 const h=fixture();h.load(h.info());h.view._dialog._requestId=null;h.mount();
 assert.equal(h.calls.filter(x=>x[0]==='activate'||x[0]==='update').length,0);
});
test('a result arriving inside dock mount waits for dock ownership before activation',()=>{
 const h=fixture({onMount:view=>view._onVideoInfoLoad({watchId:'sm2',duration:120})});
 h.mount();
 assert.deepEqual(h.calls.filter(x=>x[0]==='activate'),[['activate','sm2',120]]);
});
test('optional dock failure still replays the video info panel',()=>{
 const h=fixture({mountError:true});h.load(h.info());h.mount();
 assert.deepEqual(h.calls.filter(x=>x[0]==='update'),[['update','sm1']]);
 assert.equal(h.calls.filter(x=>x[0]==='activate').length,0);
});
test('a reentrant render that switches requests cannot activate the old result',()=>{
 const h=fixture();h.mount();h.view.videoInfoPanel.update=()=>{
  h.view._dialog._requestId='request-B';h.view._onBeforeVideoOpen();
 };
 h.load(h.info());assert.equal(h.calls.filter(x=>x[0]==='activate').length,0);
});

for(const rejected of [false,true])test(`same request retries after bookmark activation ${rejected?'rejects':'reports an error'}`,async()=>{
 let attempts=0;
 const h=fixture({onActivate:()=>{
  if(++attempts===1){
   if(rejected)return Promise.reject(new Error('synthetic activation failure'));
   return {status:'error'};
  }
  return {status:'applied'};
 }});
 h.mount();const info=h.info();h.load(info);
 await new Promise(resolve=>setImmediate(resolve));
 h.load(info);
 await new Promise(resolve=>setImmediate(resolve));
 h.load(info);
 assert.equal(attempts,2,'failed activation must retry, successful retry must deduplicate');
});

test('late failure of an old activation cannot clear the newer request dedup owner',async()=>{
 let rejectOld;
 const old=new Promise((_,reject)=>{rejectOld=reject;});
 const h=fixture({onActivate:id=>id==='sm1'?old:{status:'applied'}});
 h.mount();h.load(h.info());
 h.view._dialog._requestId='request-B';h.view._onBeforeVideoOpen();
 h.load(h.info('sm2'));
 rejectOld(new Error('synthetic superseded activation failure'));
 await new Promise(resolve=>setImmediate(resolve));
 h.load(h.info('sm2'));
 assert.deepEqual(h.calls.filter(x=>x[0]==='activate'),[['activate','sm1',300],['activate','sm2',300]]);
});
