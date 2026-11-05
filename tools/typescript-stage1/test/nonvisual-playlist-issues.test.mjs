import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes,createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createPlaylistContext}=require('../../../test/helpers/playlistHarness.js');
const text=name=>stripTypeScriptTypes(fs.readFileSync(new URL('../nico-src/'+name+'.ts',import.meta.url),'utf8'),{mode:'strip'});
const classBody=(name,file=name)=>{
 const source=text(file),start=source.indexOf('class '+name+' ');
 assert(start>=0,name+' missing');return source.slice(start,source.indexOf('\n}',start)+2);
};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function playlist(){
 const h=createPlaylistContext(),saves=[],pending=new Set(),timers=[],logs=[];
 h.c._={...h.c._,shuffle:items=>items.slice().reverse(),debounce:fn=>()=>pending.add(fn)};
 h.c.PlayListSession.save=data=>saves.push(JSON.parse(JSON.stringify(data)));
 h.c.setTimeout=()=>1;
 h.c.console={time:label=>timers.push(['start',label]),timeEnd:label=>timers.push(['end',label]),log:(...args)=>logs.push(args),warn(){}};
 vm.runInContext(classBody('PlayList').replace(/\bPlayList\b/g,'CandidatePlayList')+';globalThis.Candidate=CandidatePlayList;',h.c);
 Object.assign(h.c.Candidate,h.PlayList);
 const p=new h.c.Candidate();p.initialize({loop:false,container:null,loader:{}});
 p.view={scrollToItem(){},scrollTop(){}};p._initializeView=()=>{};
 const save=()=>{for(const fn of pending)fn();pending.clear();};
 const seed=active=>{p.model.setItem([h.item('sm1',{played:true}),h.item('sm2',{played:true}),h.item('sm3',{played:true})]);p.setIndex(active,true);save();saves.length=0;};
 return {...h,p,saves,save,seed,timers,logs};
}
test('#139 reset played flags schedules exactly one session update containing cleared flags',()=>{
 const h=playlist();h.seed(0);let updates=0;h.p.on('update',()=>updates++);
 h.p._onCommand('resetPlayedItemFlag');h.save();
 assert.equal(updates,1);assert.equal(h.saves.length,1);
 assert(h.saves[0].items.every(item=>item.played===false));
});
for(const active of [-1,0,2])test(`#139 shuffle persists changed order with initial index ${active}`,()=>{
 const h=playlist();h.seed(active);const before=h.p.model.items.map(x=>x.watchId);let updates=0;h.p.on('update',()=>updates++);
 h.p.shuffle();h.save();assert.equal(updates,1);assert.equal(h.saves.length,1);
 assert.notDeepEqual(h.saves[0].items.map(x=>x.id),before);
 assert.equal(h.saves[0].index,active<0?-1:0);
 if(active>=0)assert.equal(h.saves[0].items[0].id,before[active]);
});
for(const kind of ['_appendAll','_insertAll'])for(const active of [-1,0])test(`#116 ${kind} preserves one selection with old index ${active}`,()=>{
 const h=playlist();h.seed(active);h.p[kind]([h.item('sm4')],{watchId:'sm4'});
 const selected=active<0?'sm4':'sm1';
 assert.deepEqual(Array.from(h.p.model.items.filter(x=>x.isActive),x=>x.watchId),[selected]);
 assert.equal(h.p._activeItem.watchId,selected);
 h.p.removeNonActiveItem();assert.deepEqual(Array.from(h.p.model.items,x=>x.watchId),[selected]);
});
for(const kind of ['load','loadSearchVideo'])test(`#119 ${kind} closes every unique timer on concurrent rejection`,async()=>{
 const h=playlist(),error=Error('synthetic API failure');
 h.p._playlistApiLoader={load:()=>Promise.reject(error)};
 h.p._nicoSearchApiLoader={searchMore:()=>Promise.reject(error)};
 const call=()=>kind==='load'?h.p.load({type:'mylist',id:'PRIVATE_ID'}):h.p.loadSearchVideo('PRIVATE_WORD');
 const results=await Promise.allSettled([call(),call()]);
 assert.equal(results[0].status,'fulfilled');assert.equal(results[0].value.status,'superseded');
 assert.equal(results[1].status,'rejected');assert.equal(results[1].reason,error);
 const starts=h.timers.filter(x=>x[0]==='start').map(x=>x[1]),ends=h.timers.filter(x=>x[0]==='end').map(x=>x[1]);
 assert.equal(new Set(starts).size,2);assert.deepEqual(ends.slice().sort(),starts.slice().sort());
 assert(!JSON.stringify(h.timers).includes('PRIVATE_'));
});
for(const kind of ['load','loadSearchVideo'])for(const empty of [false,true])test(`#119 ${kind} timer ends once for ${empty?'empty result':'success'}`,async()=>{
 const h=playlist(),items=empty?[]:[h.raw('sm4')];
 h.p._playlistApiLoader={load:()=>Promise.resolve(items)};
 h.p._nicoSearchApiLoader={searchMore:()=>Promise.resolve({list:items})};
 const result=await Promise.allSettled([kind==='load'?h.p.load({type:'mylist',id:'1'}):h.p.loadSearchVideo('term')]);
 assert.equal(result[0].status,empty?'rejected':'fulfilled');
 if(!empty)assert.equal(result[0].value.status,'ok');
 assert.equal(h.timers.length,2);assert.equal(h.timers[0][0],'start');assert.equal(h.timers[1][0],'end');
 assert.equal(h.timers[0][1],h.timers[1][1]);
});
test('#40 restoring a playlist forwards item data without retaining its raw diagnostic payload',()=>{
 const h=playlist(),marker='PRIVATE_PLAYLIST_SESSION_SENTINEL';
 h.p.unserialize({index:-1,items:[h.raw('sm4',{title:marker})],privateField:marker});
 assert.equal(h.p.model.items[0].title,marker);
 assert(!JSON.stringify(h.logs).includes(marker));
});
for(const stale of [false,true])test(`#117 startup playlist rejection is handled while canPlay continues (stale=${stale})`,async()=>{
 const calls=[],load=deferred();let catches=0;
 const originalCatch=load.promise.catch.bind(load.promise);load.promise.catch=fn=>{catches++;return originalCatch(fn);};
 const quiet={timeEnd(){},log(){},warn:label=>calls.push(label)};
 const context=vm.createContext({Emitter:class{},console:quiet,window:{console:quiet},WatchInfoCacheDb:{putBestEffort(){}}});
 vm.runInContext(classBody('NicoVideoPlayerDialog')+';globalThis.Dialog=NicoVideoPlayerDialog;',context);
 const d=Object.create(context.Dialog.prototype);
 Object.assign(d,{_requestId:'A',_watchId:'sm1',_videoInfo:{watchId:'sm1',videoId:'sm1',msgInfo:{}},
  _state:{isLoading:true,setVideoCanPlay(){this.isLoading=false;calls.push('ready');}},
  _videoWatchOptions:{isPlaylistStartRequest:true,mylistLoadOptions:{},query:{playlist:{type:'mylist',id:'1'}}},
  _playerConfig:{props:{}},promise:()=>Promise.resolve(),
  _playlist:{load:(p,o,m,isCurrent)=>{calls.push(isCurrent);return load.promise;},toggleEnable(){},insertCurrentVideo(){}},
  emitAsync:()=>calls.push('canPlay'),emitResolve:()=>calls.push('firstCanPlay')});
 await d._onVideoCanPlay();
 assert.equal(catches,1,'the real load promise must have an explicit rejection handler');
 assert(calls.includes('ready'));assert(calls.includes('canPlay'));assert(calls.includes('firstCanPlay'));
 const current=calls.find(x=>typeof x==='function');assert.equal(current(),true);
 if(stale)d._requestId='B';load.reject(Error('synthetic API failure'));await tick();
 assert.equal(calls.filter(x=>x==='Initial playlist load failed').length,stale?0:1);
 assert.equal(current(),!stale);
});
