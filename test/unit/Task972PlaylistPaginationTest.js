'use strict';
const assert=require('assert');
const {extract,createContext,run,beginSection}=require('../helpers/extractSource');
const {createPlaylistContext}=require('../helpers/playlistHarness');
const row=i=>({watchId:'sm'+i,content:{id:'sm'+i,title:'Video '+i,duration:60,
 count:{view:1,comment:2,mylist:3},thumbnail:{url:'https://example.invalid/'+i},registeredAt:'2026-01-01'}});
const rows=(n,start=1)=>Array.from({length:n},(_,i)=>row(start+i));
function loader({total=1082,respond,store=new Map(),context,source='packages/lib/src/nico/PlaylistApiLoader.js'}={}){
 const calls=[],writes=[];
 const c=context||createContext();
 c.URL=URL;c.URLSearchParams=URLSearchParams;c.sessionStorage={};
 c.CacheStorage=class{
  getItem(k){const v=store.get(k);return v===undefined?null:JSON.parse(JSON.stringify(v));}
  setItem(k,v){writes.push(k);store.set(k,JSON.parse(JSON.stringify(v)));}
 };
 c.netUtil={fetch:async(url,options)=>{
  calls.push({url,options});const u=new URL(url),page=Number(u.searchParams.get('page')||1),size=Number(u.searchParams.get('pageSize')||500);
  const body=respond?await respond(page,size,calls.length):{meta:{status:200},data:{totalCount:total,items:rows(Math.max(0,Math.min(size,total-(page-1)*size)),(page-1)*size+1)}};
  return {json:async()=>body};
 }};
 // Only the backoff timer is mocked; actual loader and cache serialization run.
 c.setTimeout=fn=>{fn();return 1;};
 run('const PlaylistApiLoader='+extract(source,'PlaylistApiLoader','var')+';this.api=PlaylistApiLoader;',c);
 return {api:c.api,c,calls,writes,store};
}
describe('Task972 collection pagination',function(){
 this.timeout(20000);
 for(const type of ['user-uploaded','mylist','series','watchlater']){
  it(type+' loads 1082 entries across three pages in stable order',async()=>{
   const h=loader();const out=await h.api.load({type,id:'7'});
   assert.strictEqual(out.length,1082);assert.strictEqual(out[500].watchId,'sm501');
   assert.strictEqual(out[1081].watchId,'sm1082');assert.strictEqual(h.calls.length,3);
   assert.deepStrictEqual(h.calls.map(c=>new URL(c.url).searchParams.get('page')),['1','2','3']);
   assert(h.calls.every(c=>Number(new URL(c.url).searchParams.get('pageSize'))<=500));
  });
 }
 it('follows the 501st row, and does not fetch a spurious page at an exact 500-row boundary',async()=>{
  for(const n of [0,1,499,500,501,1000]){const h=loader({total:n}),a=await h.api.load({type:'mylist',id:9});
   assert.strictEqual(a.length,n);assert.strictEqual(h.calls.length,Math.max(1,Math.ceil(n/500)),String(n));}
 });
 it('never uses old single-page cache as a complete result and caches all pages together',async()=>{
  const store=new Map([['playlist; https://nvapi.nicovideo.jp/v1/playlist/user-uploaded/7?sortOrder=desc&sortKey=registeredAt',rows(500)]]);
  const h=loader({store});const req={type:'user-uploaded',id:7};
  assert.strictEqual((await h.api.load(req)).length,1082);assert.strictEqual(h.calls.length,3);
  assert.strictEqual((await h.api.load(req)).length,1082);assert.strictEqual(h.calls.length,3);
  assert.strictEqual(h.writes.length,1);
 });
 it('keeps explicit page and search single-page and separates sort filters',async()=>{
  const h=loader();const page=await h.api.load({type:'user-uploaded',id:1,options:{page:2,pageSize:100}});
  assert.strictEqual(page[0].watchId,'sm101');assert.strictEqual(h.calls.length,1);
  await h.api.load({type:'search',options:{keyword:'test',pageSize:100}});assert.strictEqual(h.calls.length,2);
  await h.api.load({type:'mylist',id:2,options:{sortOrder:'desc',pageSize:300}});
  assert(h.calls.slice(2).every(c=>new URL(c.url).searchParams.get('sortOrder')==='desc'));
  const n=h.calls.length;await h.api.load({type:'mylist',id:2,options:{sortOrder:'asc',pageSize:300}});assert(h.calls.length>n);
 });
 it('supports explicit series page options rather than repeating the first page',async()=>{
  const h=loader();const a=await h.api.load({type:'series',id:3,options:{page:2,pageSize:100}});
  assert.strictEqual(a[0].watchId,'sm101');assert.strictEqual(a.length,100);assert.strictEqual(h.calls.length,1);
 });
 it('stops at player capacity, carries capacity notice through serialized cache',async()=>{
  const h=loader({total:12050});const req={type:'mylist',id:1};
  for(let i=0;i<2;i++){const a=await h.api.load(req);assert.strictEqual(a.length,10000);assert(a.playlistLoadInfo?.limited);assert.strictEqual(a.playlistLoadInfo.totalCount,12050);}
  assert.strictEqual(h.calls.length,20);
 });
 it('can follow hasNext even after a short page and deduplicates overlaps',async()=>{
  const h=loader({respond:page=>({meta:{status:200},data:{hasNext:page<3,items:page===1?rows(4):page===2?rows(4,4):rows(2,8)}})});
  const a=await h.api.load({type:'series',id:1});assert.deepStrictEqual(Array.from(a,x=>x.watchId),rows(9).map(x=>x.watchId));assert.strictEqual(h.calls.length,3);
 });
 it('without count metadata continues full pages until the short terminal page',async()=>{
  const h=loader({respond:(page,size)=>({meta:{status:200},data:{items:page===1?rows(size):rows(1,501)}})});
  assert.strictEqual((await h.api.load({type:'mylist',id:1})).length,501);assert.strictEqual(h.calls.length,2);
 });
 for(const mode of ['empty','repeated','network','schema']){
  it(mode+' second page rejects without caching a partial collection',async()=>{
   const h=loader({respond:page=>{
    if(page===2&&mode==='network')throw Error('offline');
    if(page===2&&mode==='schema')return {meta:{status:200},data:{totalCount:1082,items:null}};
    return {meta:{status:200},data:{totalCount:1082,items:page===1||mode==='repeated'?rows(500):[]}};
   }});
   await assert.rejects(h.api.load({type:'mylist',id:1}));assert.strictEqual(h.writes.length,0);assert(h.calls.length<=3);
  });
 }
 it('retries one transient failure but never treats access denial as success',async()=>{
  const h=loader({respond:(page,size,n)=>{if(page===2&&n===2)throw Error('transient');return {meta:{status:200},data:{totalCount:501,items:page===1?rows(500):rows(1,501)}};}});
  assert.strictEqual((await h.api.load({type:'mylist',id:1})).length,501);assert.strictEqual(h.calls.length,3);
  const denied=loader({respond:()=>({meta:{status:403},data:{items:[]}})});
  await assert.rejects(denied.api.load({type:'mylist',id:1}));assert.strictEqual(denied.calls.length,1);
 });
 it('stale ownership stops the next request and does not cache or report completion',async()=>{
  let current=true;const h=loader({respond:()=>{current=false;return {meta:{status:200},data:{totalCount:1082,items:rows(500)}};}});
  await assert.rejects(h.api.load({type:'user-uploaded',id:1,isCurrent:()=>current}));assert.strictEqual(h.calls.length,1);assert.strictEqual(h.writes.length,0);
 });
 it('joins all pages before default upload reversal and exposes cap notice to the player',async()=>{
  const h=createPlaylistContext();const network=loader({context:h.c,total:1082});const p=h.createPlaylist();p._playlistApiLoader=network.api;
  await p.load({type:'user-uploaded',id:1});assert.strictEqual(p.model.length,1082);
  assert.strictEqual(p.model.items[0].watchId,'sm1082');assert.strictEqual(p.model.items[1081].watchId,'sm1');
  p.model.maxItems=700;const result=await p.load({type:'mylist',id:2});
  assert.strictEqual(p.model.length,700);assert(result.message.includes('700')&&result.message.includes('上限'));
 });
 it('a newer player load cancels the old pagination before its next page',async()=>{
  const h=createPlaylistContext(),requests=[];let finish;
  h.c.URL=URL;h.c.URLSearchParams=URLSearchParams;h.c.sessionStorage={};
  h.c.CacheStorage=class{getItem(){return null;}setItem(){}};
  h.c.netUtil={fetch:async url=>{requests.push(url);const u=new URL(url);
   if(u.pathname.endsWith('/1'))return {json:()=>new Promise(r=>{finish=r;})};
   return {json:async()=>({meta:{status:200},data:{totalCount:1,items:[row(99999)]}})};
  }};
  run('const PlaylistApiLoader='+extract('packages/lib/src/nico/PlaylistApiLoader.js','PlaylistApiLoader','var')+';this.api=PlaylistApiLoader;',h.c);
  const p=h.createPlaylist();p._playlistApiLoader=h.c.api;
  const old=p.load({type:'user-uploaded',id:1});for(let i=0;i<10;i++)await Promise.resolve();
  const current=await p.load({type:'mylist',id:2});assert.strictEqual(current.status,'ok');
  finish({meta:{status:200},data:{totalCount:1082,items:rows(500)}});
  assert.strictEqual((await old).status,'superseded');
  assert.strictEqual(p.model.items[0].watchId,'sm99999');assert.strictEqual(requests.length,2);
 });
 it('the installable userscript includes full pagination, not just the source helper',async()=>{
  const h=loader({source:'dist/ZenzaWatch-dev.user.js',total:1082});
  const result=await h.api.load({type:'user-uploaded',id:1});
  assert.strictEqual(result.length,1082);assert.strictEqual(result[1081].watchId,'sm1082');assert.strictEqual(h.calls.length,3);
 });
 it('changing capacity cannot return a cached smaller collection as the full one',async()=>{
  const h=loader({total:1082});
  const small=await h.api.load({type:'mylist',id:7,maxItems:500});assert.strictEqual(small.length,500);assert(small.playlistLoadInfo.limited);
  const large=await h.api.load({type:'mylist',id:7,maxItems:2000});assert.strictEqual(large.length,1082);assert(!large.playlistLoadInfo.limited);
  assert.strictEqual(h.calls.length,4);
 });
 it('failed second-page load cannot overwrite the already playing list',async()=>{
  const h=createPlaylistContext();const network=loader({context:h.c,respond:page=>page===1?{meta:{status:200},data:{totalCount:1001,items:rows(500)}}:{meta:{status:503},data:{}}});
  const p=h.createPlaylist();p.model.setItem([h.item('smSeed')]);p._playlistApiLoader=network.api;
  await assert.rejects(p.load({type:'mylist',id:1}));assert.strictEqual(p.model.items[0].watchId,'smSeed');
 });
});

describe('Task972 large playlist session',()=>{
 function setup(maxBytes=Infinity){const store=new Map([['other-feature','keep']]),writes=[];
  const storage={getItem:k=>store.get(k)||null,removeItem:k=>store.delete(k),
   setItem(k,v){writes.push(k);if(v.length>maxBytes){const e=Error('quota');e.name='QuotaExceededError';throw e;}store.set(k,v);}};
  const c=createContext({sessionStorage:storage,window:{console:{warn(){},error(){}}}});
  run(beginSection('packages/zenza/src/Playlist/PlayListSession.js')+';this.session=PlayListSession;',c);
  return {api:c.session,store,writes};
 }
 it('round trips all 10000 items and the active index instead of truncating at 1000',()=>{
  const h=setup(),items=Array.from({length:10000},(_,i)=>({id:'sm'+i}));h.api.save({items,index:8765});
  const result=h.api.restore();assert.strictEqual(result.items.length,10000);assert.strictEqual(result.index,8765);
  assert.strictEqual(result.items[0].id,'sm0');assert.strictEqual(result.items[9999].id,'sm9999');
 });
 it('quota fallback still preserves the active item and unrelated storage',()=>{
  const h=setup(8000),items=Array.from({length:10000},(_,i)=>({id:'sm'+i,title:'x'.repeat(30)}));
  h.api.save({items,index:8765});const result=h.api.restore();assert(result&&result.items.length<10000);
  assert.strictEqual(result.items[result.index].id,'sm8765');assert.strictEqual(h.store.get('other-feature'),'keep');assert(h.writes.every(k=>k==='ZenzaWatchPlaylist'));
 });
});


describe('Task972 existing own-mylist and watch-later reader audit',function(){
 this.timeout(15000);
 for(const type of ['mylist','watchLater']){
  it(type+' already follows hasNext beyond 500 and does not mutate the account',async()=>{
   const requests=[];const total=1201;
   const c=createContext({window:{},sessionStorage:{},emitter:{on(){},emitAsync(){}},
    CacheStorage:class{getItem(){return null;}setItem(){}removeItem(){}},
    netUtil:{fetch:async(url,options)=>{
     requests.push({url,options});const u=new URL(url),page=Number(u.searchParams.get('page'));
     const count=Math.max(0,Math.min(100,total-(page-1)*100));
     return {json:async()=>({meta:{status:200},data:{[type]:{hasNext:page*100<total,
      items:Array.from({length:count},(_,i)=>({watchId:'sm'+((page-1)*100+i+1),itemId:(page-1)*100+i+1}))}}})};
    }}});
   run('const MylistApiLoader='+extract('packages/lib/src/nico/MylistApiLoader.js','MylistApiLoader','var')+';this.reader=MylistApiLoader;',c);
   const result=type==='mylist'?await c.reader._getMylistItems(1):await c.reader._getDeflistItems();
   assert.strictEqual(result.length,1201);assert.strictEqual(result[1200].watchId,'sm1201');
   assert.strictEqual(requests.length,13);assert(requests.every(r=>!r.options.method||r.options.method==='GET'));
  });
 }
});
