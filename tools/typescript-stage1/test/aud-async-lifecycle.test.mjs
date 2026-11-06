import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes, createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const parser=require('../../../node_modules/@babel/parser');
function load(file,name,extra={}) {
 const text=stripTypeScriptTypes(readFileSync(new URL('../nico-src/'+file+'.ts',import.meta.url),'utf8'));
 const ast=parser.parse(text,{sourceType:'module',allowUndeclaredExports:true});
 let found;
 const visit=n=>{if(!n||typeof n!=='object')return;
  if(n.type==='ClassDeclaration'&&n.id?.name===name)found=n;
  for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);
 };visit(ast);
 const context={Emitter:class{},VideoList:class{},console,Promise,window:{console},...extra};
 return vm.runInNewContext(text.slice(found.start,found.end)+';'+name,context);
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const tick=()=>new Promise(r=>setImmediate(r));
function player(hook=()=>{}) {
 const C=load('NicoVideoPlayer','NicoVideoPlayer',{global:{emitter:{emit:(_,e)=>hook(e)}}});
 const p=Object.create(C.prototype),sources=[];
 Object.assign(p,{_cancelSupporterCredit(){},_videoPlayer:{setSrc:s=>sources.push(s),close(){}},_commentPlayer:{close(){}}});
 return {p,sources};
}
test('late extension source cannot replace a newer source',async()=>{
 const d=deferred();const {p,sources}=player(e=>{if(e.src==='A')e.promise=d.promise;});
 const a=p.setVideo('A');p.setVideo('B');d.resolve('A');await a;assert.deepEqual(sources,['B']);
});
test('close invalidates a pending extension source',async()=>{
 const d=deferred();const {p,sources}=player(e=>e.promise=d.promise);
 const a=p.setVideo('A');p.close();d.resolve('A');await a;assert.deepEqual(sources,[]);
});
test('synchronous extension reentry leaves the latest source active',()=>{
 let p;const h=player(e=>{if(e.src==='A')p.setVideo('B');});p=h.p;p.setVideo('A');assert.deepEqual(h.sources,['B']);
});
test('current extension resolves normally and resets seeking',async()=>{
 const d=deferred();const {p,sources}=player(e=>e.promise=d.promise);p._isSeeking=true;
 const a=p.setVideo('A');d.resolve('resolved');await a;assert.deepEqual(sources,['resolved']);assert.equal(p._isSeeking,false);
});
test('owner partial metadata produces an incomplete-result notice',()=>{
 const C=load('PlayList','PlayList');assert.notEqual(C.searchNotice({isPartial:true,list:[{}]}),'');
});
test('retired YouTube quality request never resumes a paused player',()=>{
 const C=load('YouTubeWrapper','YouTubeWrapper');const p=Object.create(C.prototype),calls=[];
 p._player={getAvailableQualityLevels:()=>['hd1080'],pauseVideo:()=>calls.push('pause'),setPlaybackQuality:()=>calls.push('quality'),playVideo:()=>calls.push('play'),getPlaybackQuality:()=>''};
 p.selectBestQuality();assert.deepEqual(calls,[]);
});
function dialog(){
 const timers=[],messages=[],apiCalls=[],d=deferred();
 const C=load('NicoVideoPlayerDialog','NicoVideoPlayerDialog',{util:{isLogin:()=>true},window:{setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){}}});
 const p=Object.create(C.prototype);
 Object.assign(p,{_state:{isOpen:true},_requestId:'A',_watchId:'smA',_videoInfo:{watchId:'smA',owner:{},msgInfo:{}},_playerConfig:{props:{},getValue:()=>false},execCommand:(...m)=>messages.push(m),_mylistApiLoader:{}});
 for(const name of ['addMylistItem','removeMylistItem','addDeflistItem','removeDeflistItem'])p._mylistApiLoader[name]=(...args)=>{apiCalls.push({name,args});return d.promise;};
 return {p,timers,messages,apiCalls,d};
}
for(const method of ['_onMylistAdd','_onMylistRemove','_onDeflistAdd','_onDeflistRemove']){
 test(method+' keeps pending requests locked after ten seconds',async()=>{
  const h=dialog();h.p[method]();await tick();h.timers.filter(t=>t.ms===10000).forEach(t=>t.fn());h.p[method]();await tick();assert.equal(h.apiCalls.length,1);h.d.resolve({message:'ok'});await tick();
 });
 for(const fail of [false,true])test(method+' suppresses stale '+(fail?'failure':'success')+' messages',async()=>{
  const h=dialog();h.p[method]();await tick();h.p._requestId='B';h.p._videoInfo={watchId:'smB'};fail?h.d.reject(Error('failed')):h.d.resolve({message:'ok'});await tick();assert.deepEqual(h.messages,[]);
 });
}
test('Nicoru rejects the original request without alerting a different video',async()=>{
 const h=dialog(),d=deferred(),rejected=[];h.p.threadLoader={nicoru:()=>d.promise};
 h.p._onCommand('nicoru',{}, {reject:e=>rejected.push(e)});h.p._requestId='B';h.p._videoInfo={msgInfo:{}};d.reject(Error('failed'));await tick();assert.equal(rejected.length,1);assert.deepEqual(h.messages,[]);
});

for(const list of [[{id:1}],[]])test('search with '+list.length+' fetched items preserves warnings when nothing is added',async()=>{
 const C=load('PlayList','PlayList',{VideoListItem:{createByMylistItem:x=>x}});
 const p=Object.create(C.prototype),result={list,partial:true,unappliedConditions:['genre']};
 Object.assign(p,{_initializeView(){},_nicoSearchApiLoader:{searchMore:async()=>result},_beginReplaceLoad(){},_beginAdditiveLoad(){},_waitForAdditiveTurn:p=>p,_isStalePlaylistLoad:()=>false,_boundedBulkItems:items=>({items}),_reserveLoadedItems(){},_appendAll:()=>0,emit(){}});
 const r=await p.loadSearchVideo('x',{append:true},10);assert.equal(r.status,'ok');assert(r.message.includes(C.searchNotice(result)));
});
for(const method of ['_onMylistAdd','_onMylistRemove','_onDeflistAdd','_onDeflistRemove'])test(method+' still notifies current video and releases lock after completion',async()=>{
 const h=dialog();h.p[method]();await tick();h.d.resolve({message:'ok'});await tick();
 assert.equal(h.messages.length,1);h.timers.filter(t=>t.ms===2000).forEach(t=>t.fn());h.p[method]();await tick();assert.equal(h.apiCalls.length,2);
});
test('current extension rejection remains available to callers',async()=>{
 const d=deferred(),{p}=player(e=>e.promise=d.promise),a=p.setVideo('A');d.reject(Error('hook failed'));await assert.rejects(a,/hook failed/);
});
