// Task646: ThumbInfoCacheDb / WatchInfoCacheDb parity — open, GC, put guards,
// record shapes, update requests, acknowledgement checks, bridge and best effort.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const tick=(ms=5)=>new Promise(r=>setTimeout(r,ms));
const keys=o=>o&&typeof o==='object'?Object.keys(o):o;

function world(opt={}){
  const log=[];const L=(...a)=>log.push(snapshot(a));
  const rows=new Map(Object.entries(opt.rows||{}));
  const store={
    put:async r=>{L('put',r);if(opt.putFails)throw Error('quota');rows.set(r.watchId,r);return 'k';},
    update:async req=>{L('update',req);if(opt.updateResult!==undefined)return opt.updateResult(req);return {watchId:req.key,...req.defaults,...req.patch};},
    updateTime:async q=>{L('updateTime',q);return rows.get(q.key);},
    delete:async q=>{L('delete',q);return 'deleted';},
    close:async()=>{L('close');return 'closed';},
    gc:async(...a)=>{L('gc',...a);if(opt.gcFails)throw Error('gc');return 'gc-ok';}
  };
  const connect=async(kind,def)=>{L(kind,def);await new Promise(r=>setTimeout(r,1));if(opt.openFails)throw Error('blocked');return {cache:store};};
  const globals={
    IndexedDbStorage:{open:def=>connect('idb.open',def)},
    parseThumbInfo:x=>{L('parse',x);return opt.parsed||{status:'ok',v:'sm9',id:'sm9',postedAt:'2026/10/01 00:00:00'};},
    location:{host:opt.host||'www.nicovideo.jp'},
    console:{warn:(...a)=>L('warn',...a)},
    Date:class extends Date{constructor(...a){a.length?super(...a):super(5000);}static now(){return 5000;}},
    Number,Object,Error,Promise
  };
  return {globals,log,bridge:{bridgeDb:def=>connect('bridgeDb',def)}};
}
function pair(name){
  const spec=NICO_API_BY_NAME[name];
  return {before:read(spec.fixture),after:read(spec.runtime),name};
}
async function compare(mod,label,run,opt={}){
  const a=world(opt),b=world(opt);
  const A=loadLegacy(mod.before,mod.name,a.globals),B=loadLegacy(mod.after,mod.name,b.globals);
  const ra=await settle(()=>run(A,a)),rb=await settle(()=>run(B,b));
  await tick();
  assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
  assert.deepEqual(b.log,a.log,label+' side effects');
  return ra;
}

const thumb=pair('ThumbInfoCacheDb');
test('ThumbInfoCacheDb: open, 90-day GC per open, put/get/delete/close',async()=>{
  await compare(thumb,'round trip',async d=>{
    const c=await d.open();
    return [await c.put('<xml/>'),await c.put('<x2/>',{status:'ok',v:'so1',id:'so1',postedAt:'2026-01-01'}),
      await c.get('sm9'),await c.get('none'),await c.delete('sm9'),await c.close(),keys(c)];
  },{rows:{sm9:{watchId:'sm9',thumbInfo:{status:'ok'}}}});
  await compare(thumb,'non-ok parse is not stored',async d=>(await d.open()).put('<bad/>'),{parsed:{status:'fail',code:'DELETED'}});
  await compare(thumb,'given non-ok thumbInfo',async d=>(await d.open()).put('<x/>',{status:'fail'}));
  await compare(thumb,'null thumbInfo parses',async d=>(await d.open()).put('<x/>',null));
  await compare(thumb,'put failure propagates',async d=>(await d.open()).put('<x/>'),{putFails:true});
  await compare(thumb,'gc failure only warns',async d=>{await d.open();await tick();return 'ok';},{gcFails:true});
  await compare(thumb,'second open reuses connection',async d=>{await d.open();await d.open();return 'twice';});
  await compare(thumb,'open fails',d=>d.open(),{openFails:true});
});

const watch=pair('WatchInfoCacheDb');
const videoInfo=(extra={})=>({videoId:'sm9',threadId:'1173108780',postedAt:'2007-03-06T00:33:00+09:00',owner:{linkId:'user/4'},
  toJSON(){return {raw:true,videoId:'sm9'};},...extra});
test('WatchInfoCacheDb: update request shape and acknowledgement',async()=>{
  await compare(watch,'full put',d=>d.put('sm9',{videoInfo:videoInfo(),threadInfo:{t:1},heatMap:[1,2],config:{c:1},
    currentTime:12.5,watchCount:1,comment:{text:'x'}}));
  await compare(watch,'minimal put',d=>d.put('sm9'));
  await compare(watch,'videoInfo without toJSON/owner',d=>d.put('so1',{videoInfo:{videoId:'',threadId:'x',postedAt:'bad'},currentTime:0,watchCount:2}));
  await compare(watch,'negative/NaN time, falsy extras',d=>d.put('sm1',{currentTime:NaN,threadInfo:0,heatMap:'',config:null,comment:''}));
  for(const [i,res] of [null,'ok',{watchId:'other'},{}].entries())
    await compare(watch,'unacknowledged '+i,d=>d.put('sm9',{}),{updateResult:()=>res});
  await compare(watch,'best effort swallows',d=>d.putBestEffort('sm9',{}),{updateResult:()=>null});
  await compare(watch,'best effort success',d=>d.putBestEffort('sm9',{watchCount:1}));
});

test('WatchInfoCacheDb: open, bridge, get/delete/close/gc',async()=>{
  await compare(watch,'www ops',async d=>[keys(await d.initWorker()),await d.get('sm9'),await d.delete('sm9'),await d.close(),
    await d.gc(),await d.gc(1000),(await d.open())===(await d.open())],{rows:{sm9:{watchId:'sm9'}}});
  await compare(watch,'bridge',async(d,w)=>{const r=d.api(w.bridge);return [r===w.bridge,await d.get('sm9')];},{host:'live.nicovideo.jp'});
  await compare(watch,'bridge missing',d=>d.get('sm9'),{host:'live.nicovideo.jp'});
  await compare(watch,'open fails',d=>d.get('sm9'),{openFails:true});
});

// ---- StoryboardInfoLoader ----
const sb=pair('StoryboardInfoLoader');
test('StoryboardInfoLoader: domand first, then dmc, else reject',async()=>{
  const run=async(code,info)=>{
    const log=[];
    const L=loadLegacy(code,'StoryboardInfoLoader',{Promise,
      VideoSessionWorker:{storyboard:req=>{log.push(snapshot(req));return Promise.resolve('sb:'+req.type);}}});
    return [snapshot(await settle(()=>L.load('dmc',info))),log];
  };
  for(const info of [{hasDomandStoryboard:true,hasDmcStoryboard:true,id:1},{hasDmcStoryboard:1},{},{hasDomandStoryboard:0,hasDmcStoryboard:''}])
    assert.deepEqual(await run(sb.after,info),await run(sb.before,info));
});

// ---- NicoQuery ----
const nq=pair('NicoQuery');
function nqWorld(){
  const log=[];const L=(...a)=>log.push(snapshot(a));
  const textUtil={
    convertKansuEi:t=>String(t).replace(/一/g,'1'),
    parseQuery:q=>Object.fromEntries(q.split('&').filter(Boolean).map(kv=>{const [k,v='']=kv.split('=');return [decodeURIComponent(k),decodeURIComponent(v)];}))
  };
  const res=tag=>({tag,list:[]});
  const globals={textUtil,
    netUtil:{fetch:(u,o)=>{L('fetch',u,o);return Promise.resolve({json:async()=>({fetched:u})});}},
    MylistApiLoader:{getMylistList:async()=>{L('mylistlist');return res('mylists');}},
    RecommendAPILoader:{loadSeries:async(id,o)=>{L('series',id,o);return res('series');}},
    NicoRssLoader:{loadRanking:async o=>{L('ranking',o);return res('ranking');},load:async u=>{L('rss',u);return res('rss');}},
    NicoSearchApiV2Loader:{searchMore:async(w,p)=>{L('search',w,p);return res('search');}},
    Date,JSON,Object,Error,Promise};
  return {globals,log};
}
async function nqCompare(label,run){
  const a=nqWorld(),b=nqWorld();
  const SUB='({NicoQuery, ItemDataConverter})';
  const A=loadLegacy(nq.before,SUB,a.globals),B=loadLegacy(nq.after,SUB,b.globals);
  const ra=await settle(()=>run(A)),rb=await settle(()=>run(B));
  assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
  assert.deepEqual(b.log,a.log,label+' side effects');
  return ra;
}
const view=q=>({type:q.type,id:q.id,params:q.params,str:q.toString(),title:q.title,base:q.baseString,string:q.string,
  baseParams:q.baseParams,isSearch:q.isSearch,ready:q.isSearchReady,word:q.searchWord,owner:q.isOwnerFilterEnable,sp:q.searchParams});
const QUERIES=['tag/%E6%9D%B1%E6%96%B9?sort=%22-f%22&page=2&genre=%22game%22','search/ zz ?sort=%22%2Bv%22&fRange=1&lRange=2&start=%222026-01-01%22',
  'mylist/123?title=My%20list','mymylist/9','user/4?ownerFilter=true&userId=4','deflist/','nicorepo/','series/77','ranking/','ranking/game',
  'channel/ch1','/abc','search/?kind=%22user%22&selectContentType=%22long%22&channelVideoListingStatus=%22included%22&commentCount=5',
  'tag/x?bad=%7Bnot-json&n=3','unknown/x'];
test('NicoQuery: parse/build/getters/searchParams/equality',async()=>{
  // channel/'' titles changed intentionally in Task647 (tested below); everything else matches.
  for(const s of QUERIES){
    await nqCompare('query '+s,({NicoQuery:Q})=>{const v=view(new Q(s));if(/^(channel)?\//.test(s))delete v.title;return v;});
  }
  await nqCompare('parts and parse passthrough',({NicoQuery:Q})=>{const q=new Q({type:'tag',id:'w',params:{sort:'-n',title:'T'}});
    return [view(q),Q.parse(q)===q,Q.parse('a/b?c=1'),Q.build('x','i d',{z:1,a:'s',title:'t t',f:0,n:null})];});
  await nqCompare('setters',({NicoQuery:Q})=>{const q=new Q('search/w?userId=1&channelId=2');const r=[view(q)];
    q.isOwnerFilterEnable=true;r.push(view(q));q.isOwnerFilterEnable=0;r.push(view(q));q.title='new';r.push(view(q));return r;});
  await nqCompare('equality',({NicoQuery:Q})=>{const q=new Q('tag/a?sort=%22-f%22&title=x');
    return [q.equals('tag/a?sort=%22-f%22&title=x'),q.equals(new Q('tag/a?sort=%22-f%22')),q.nearlyEquals('tag/a?sort=%22-f%22&title=y'),q.nearlyEquals('tag/b')];});
});
test('NicoQuery.fetch: request URLs, loader routing and errors',async()=>{
  for(const s of ['mylist/1','user/2','mymylist/3','deflist/','nicorepo/','mylistlist/','series/5','ranking/','ranking/game','channel/ch9',
    'tag/w?sort=%22-f%22&page=3','search/k','bogus/1'])
    await nqCompare('fetch '+s,({NicoQuery:Q})=>Q.fetch(s));
  await nqCompare('fetch instance',({NicoQuery:Q})=>Q.fetch(new Q('series/9')));
});
test('ItemDataConverter: legacy list items',async()=>{
  const flapi={id:'sm9',title:'第一話 10',thumbnail_url:'https://t/9',is_middle_thumbnail:true,length_seconds:'320',num_res:'3',mylist_counter:'4',
    view_counter:'5',first_retrieve:'2007-03-06 00:33:00',create_time:1170000000,thread_update_time:'2026-01-01 00:00:00',mylist_comment:'c'};
  await nqCompare('flapi',({ItemDataConverter:C})=>[C.fromFlapiMylistItem(flapi),C.fromFlapiMylistItem({...flapi,id:'1234',is_middle_thumbnail:0,mylist_comment:''})]);
  await nqCompare('uploaded',({ItemDataConverter:C})=>C.fromUploadedVideo({...flapi,id:'so1',length:'5:20'}));
  await nqCompare('searchV2',({ItemDataConverter:C})=>C.fromSearchApiV2({...flapi,length_seconds:61}));
  await nqCompare('deflist',({ItemDataConverter:C})=>[C.fromDeflistItem({item_data:{video_id:'sm1',watch_id:'1',title:'t',length_seconds:1,num_res:2,
    mylist_counter:3,view_counter:4,thumbnail_url:'u',first_retrieve:1,update_time:2},create_time:3,description:'d'}),
    C.fromDeflistItem({item_data:{video_id:'so2',watch_id:'9',title:'t',first_retrieve:1,update_time:2},create_time:3})]);
  await nqCompare('sort text',({ItemDataConverter:C})=>[C.makeSortText('第一話 12 ３'),C.makeSortText('')]);
  await nqCompare('bad item throws',({ItemDataConverter:C})=>C.fromFlapiMylistItem({id:'sm1',title:'t',first_retrieve:'bad'}));
});

// ---- Task647 fixes on Task646 modules ----
test('Task647 NQ-CHANNEL-TITLE-001: channel queries get their title',async()=>{
  const SUB='({NicoQuery, ItemDataConverter})';
  const titles=code=>{const {NicoQuery:Q}=loadLegacy(code,SUB,nqWorld().globals);
    return [new Q('channel/ch1').title,new Q('/abc').title,new Q('channel/ch2?title=Own').title];};
  assert.deepEqual(titles(nq.before),['','チャンネル動画 channel/abc','Own']);
  assert.deepEqual(titles(nq.after),['チャンネル動画 channel/ch1','','Own']);
});

test('Task647 WI-OPEN-RACE-001: concurrent startup opens IndexedDB once and shares one facade',async()=>{
  const run=async(code,opt={})=>{
    const w=world(opt);const d=loadLegacy(code,'WatchInfoCacheDb',w.globals);
    const [c1,f1,f2,g]=await Promise.all([d.initWorker(),d.open(),d.open(),d.get('sm9')]);
    await tick();
    return {opens:w.log.filter(e=>e[0]==='idb.open').length,sameFacade:f1===f2,sameAfter:(await d.open())===f1,got:g,conn:Object.keys(c1)};
  };
  const legacy=await run(watch.before),fixed=await run(watch.after);
  assert.ok(legacy.opens>1||!legacy.sameFacade,'legacy opened twice or built two facades');
  assert.deepEqual(fixed,{opens:1,sameFacade:true,sameAfter:true,got:undefined,conn:['cache']});
  // A failed open is not cached: the next call retries.
  const w=world({openFails:true});const d=loadLegacy(watch.after,'WatchInfoCacheDb',w.globals);
  const first=await settle(()=>Promise.all([d.get('a'),d.get('b')]));
  assert.equal(first.ok,false);
  assert.equal(w.log.filter(e=>e[0]==='idb.open').length,1,'concurrent failing callers share one attempt');
  await settle(()=>d.get('c'));
  assert.equal(w.log.filter(e=>e[0]==='idb.open').length,2,'later call retries');
});
