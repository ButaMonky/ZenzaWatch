// Task651: VideoSessionWorker parity — storyboard classes (domand/dmc loaders and
// sessions, geometry/URL validation, image fetch), the Worker body (session
// create/connect/getState/close, heartbeat, storyboard commands) and the main-thread
// storyboard cache path. The Worker body runs in-process through a fake workerUtil.
// 467 root tests that execute this section (Storyboard*, VideoSession* ...) also pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,legacySection,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.VideoSessionWorker;
const before=read(spec.fixture),after=read(spec.runtime);

const json=(status,body)=>({ok:status<400,status,json:async()=>structuredClone(body),arrayBuffer:async()=>new ArrayBuffer(4)});
function world(opt={}){
  const log=[];const L=(...a)=>log.push(snapshot(a));
  const routes=opt.routes||{};
  const fetch=(url,o)=>{L('fetch',String(url),o&&{method:o.method,credentials:o.credentials,headers:o.headers,body:o.body,timeout:o.timeout});
    const k=Object.keys(routes).find(k=>String(url).includes(k));
    if(!k)return Promise.reject(Error('unrouted'));const r=routes[k];return r instanceof Error?Promise.reject(r):Promise.resolve(typeof r==='function'?r():r);};
  const cache=new Map(Object.entries(opt.cache||{}));
  let workerSelf=null;
  const workerUtil={createCrossMessageWorker:(func,o)=>{
    L('worker.create',o.name,o.inject.startsWith('const createStoryboardClasses = '));
    if(opt.workerFails)throw Error('worker blocked');
    // Run the Worker body in this realm with the injected factory, like workerUtil does.
    const self={xFetch:(u,p)=>{L('xFetch',u);return fetch(u,p);}};
    const ctx=createContext({self,fetch,URL,URLSearchParams,console:{time(){},timeEnd(){},error:(...a)=>L('w.error',a[0])},
      location:{origin:'https://www.nicovideo.jp',href:'https://www.nicovideo.jp/watch/sm9'},AbortController,
      setTimeout:(fn,ms)=>{L('w.setTimeout',ms);return setTimeout(fn,0);},clearTimeout,setInterval:(fn,ms)=>{L('w.setInterval',ms);return 1;},clearInterval:()=>L('w.clearInterval'),
      Date:{now:()=>1000},Symbol,Object,Promise,JSON,Error,Number,Math,Array,isNaN});
    runInContext(`${o.inject}\n(${func.toString()})(self);`,ctx);
    workerSelf=self;
    return {post:async m=>{L('post',m.command);return self.onmessage(structuredClone(m));}};
  }};
  const StoryboardCacheDb={get:async id=>{L('cache.get',id);return cache.has(id)?structuredClone(cache.get(id)):null;},
    put:async(id,v)=>{L('cache.put',id,v.status);},delete:async id=>{L('cache.delete',id);}};
  const globals={workerUtil,StoryboardCacheDb,fetch,URL,URLSearchParams,
    console:{time(){},timeEnd(){},error:(...a)=>L('error',a[0]),warn:(...a)=>L('warn',a[0])},
    setTimeout:(fn,ms)=>{L('setTimeout',ms);return setTimeout(fn,0);},clearTimeout,
    Promise,Object,JSON,Error,Number,Array,Symbol,Math};
  return {globals,log};
}
function load(code,w){
  const ctx=createContext({...w.globals});
  runInContext(legacySection(code)+'\nglobalThis.__s={VideoSessionWorker,createStoryboardClasses};',ctx,{timeout:1000});
  return ctx.__s;
}
async function compare(label,run,opt={}){
  const a=world(opt),b=world(opt);
  const ra=await settle(()=>run(load(before,a))),rb=await settle(()=>run(load(after,b)));
  await new Promise(r=>setTimeout(r,20));
  assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
  assert.deepEqual(b.log,a.log,label+' side effects');
  return ra;
}
const domandSb={meta:{status:200},data:{contentUrl:'https://sb.example/v1/storyboard.json'}};
const domandJson={thumbnailWidth:160,thumbnailHeight:90,columns:10,rows:10,interval:2000,images:[{timestamp:0,url:'sb1.jpg'},{timestamp:200,url:'https://cdn.example/sb2.jpg'}]};
const info=(extra={})=>({toJSON:()=>({watchId:'sm9',duration:100,actionTrackId:'T',
  domandInfo:{videoId:'sm9',accessRightKey:'ARK',availableVideos:[{id:'v1',label:'720p'},{id:'v2',label:'360p'}],availableVideoIds:['v1','v2'],availableAudioIds:['a1']},
  dmcStoryboardInfo:{urls:[{url:'https://dmc.example/sb'}],authTypes:{storyboard:'ht2'},videos:['sb1'],playerId:'P',contentId:'C'},...extra})});
const sbRoutes={'access-rights/storyboard':json(200,domandSb),'storyboard.json':json(200,domandJson),'sb1.jpg':json(200,{}),'sb2.jpg':json(200,{})};

test('storyboard via worker: domand, cache hit/invalid, worker failure',async()=>{
  await compare('domand storyboard (no cache)',s=>s.VideoSessionWorker.storyboard({type:'domand',info:info()}),{routes:sbRoutes});
  const cached={status:'ok',watchId:'sm9',format:'domand',duration:100,storyboard:{rows:10,columns:10,interval:2000,count:50,
    thumbnail:{width:160,height:90},images:[{url:'https://c/1.jpg',buffer:new ArrayBuffer(2)}]}};
  await compare('valid cache',s=>s.VideoSessionWorker.storyboard({type:'domand',info:info()}),{routes:sbRoutes,cache:{sm9_domand:cached}});
  await compare('invalid cache evicted',s=>s.VideoSessionWorker.storyboard({type:'domand',info:info()}),
    {routes:sbRoutes,cache:{sm9_domand:{...cached,watchId:'other'}}});
  await compare('worker fails, no cache',s=>s.VideoSessionWorker.storyboard({type:'domand',info:info()}),{workerFails:true});
  await compare('worker fails, cache ok',s=>s.VideoSessionWorker.storyboard({type:'domand',info:info()}),{workerFails:true,cache:{sm9_domand:cached}});
  await compare('domand api error',s=>s.VideoSessionWorker.storyboard({type:'domand',info:info()}),
    {routes:{...sbRoutes,'access-rights/storyboard':json(200,{meta:{status:403}})}});
  await compare('bad geometry -> fail',s=>s.VideoSessionWorker.storyboard({type:'domand',info:info()}),
    {routes:{...sbRoutes,'storyboard.json':json(200,{...domandJson,rows:0})}});
  await compare('dmc storyboard',s=>s.VideoSessionWorker.storyboard({type:'dmc',info:info()}),
    {routes:{'dmc.example/sb':json(200,{meta:{status:201},data:{session:{content_uri:'https://dmc.example/sb.json'}}}),
      'sb.json':json(200,{meta:{status:200},data:{version:2,storyboards:[{quality:1,thumbnail_width:80,thumbnail_height:45,columns:5,rows:5,interval:1000,images:[{timestamp:0,uri:'https://dmc.example/i1'}]},
        {quality:2,thumbnail_width:160,thumbnail_height:90,columns:10,rows:10,interval:1000,images:[{timestamp:0,uri:'https://dmc.example/i2'}]}]}}),
      'dmc.example/i':json(200,{})}});
});

test('video sessions via worker: domand create/connect/state/close and supersede',async()=>{
  const routes={'access-rights/hls':json(200,{meta:{status:201},data:{contentUrl:'https://hls/master.m3u8',expireTime:'2030-01-01T00:00:00Z'}})};
  await compare('domand auto',async s=>{
    const h=await s.VideoSessionWorker.create({videoInfo:info(),serverType:'domand',useHLS:true});
    const c=await h.connect();const st=await h.getState();await h.close();const after=await h.getState();
    return {h:{serverType:h.serverType,isDomand:h.isDomand,sessionId:h.sessionId},c,st,after};
  },{routes});
  await compare('domand quality + no HLS',async s=>{
    const h=await s.VideoSessionWorker.create({videoInfo:info(),serverType:'domand',useHLS:false,videoQuality:'360p'});
    return settle(()=>h.connect());
  },{routes});
  await compare('domand quality pick',async s=>{
    const h=await s.VideoSessionWorker.create({videoInfo:info(),serverType:'domand',useHLS:true,videoQuality:'360p'});
    return h.connect();
  },{routes});
  await compare('stale handle after new create',async s=>{
    const h1=await s.VideoSessionWorker.create({videoInfo:info(),serverType:'domand',useHLS:true});
    const h2=await s.VideoSessionWorker.create({videoInfo:info(),serverType:'domand',useHLS:true});
    return [await settle(()=>h1.connect()),await h1.getState(),await h2.getState()];
  },{routes});
  await compare('unknown server type',s=>s.VideoSessionWorker.create({videoInfo:info(),serverType:'smile'}),{routes});
});

test('createStoryboardClasses: direct use',async()=>{
  await compare('loader factory and validation',async s=>{
    const util={fetch:(u,o)=>Promise.resolve(json(200,domandJson))};
    const C=s.createStoryboardClasses(util);
    const d=C.StoryboardInfoLoader.create({type:'domand',url:'https://x/a/storyboard.json'});
    d.duration=100;await d.load();
    const base=new C.StoryboardInfoLoader({url:'u'});
    return [Object.keys(C),d.toJSON(),d.getStoryboardWithUrls(),base.toJSON(),await settle(()=>base.load()),
      await settle(()=>C.StoryboardInfoLoader.fetchImages([{url:'javascript:1'}])),
      await settle(()=>Promise.resolve().then(()=>C.StoryboardInfoLoader.create({type:'x'})))];
  });
});
