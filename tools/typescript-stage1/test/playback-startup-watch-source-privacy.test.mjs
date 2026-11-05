import test from 'node:test';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';
import {read,loadLegacy,settle,snapshot} from './nico-api-harness.mjs';

const runtime='//===BEGIN===\n'+stripTypeScriptTypes(
 read('tools/typescript-stage1/nico-src/VideoInfoLoader.ts'),{mode:'strip'})
 .replace(/export\s*\{VideoInfoLoader\};/,'')+'\n//===END===';
const ID='sm987654321',OWNER='765432109',PRIVATE='PRIVATE_WATCH_RESPONSE_TOKEN';
const payload=(owner=true)=>({data:{response:{$watchV4:{data:{
 client:{watchId:ID,watchTrackId:PRIVATE},
 video:{id:ID,title:PRIVATE,description:PRIVATE,duration:42,count:{view:1},thumbnail:{url:PRIVATE}},
 player:{initialPlayback:{positionSec:0}},genre:{key:'game',label:'game'},
 tags:{edit:{isEditable:false},items:[]},
 comment:{nvComment:{server:PRIVATE,threadKey:PRIVATE,params:{}},ng:{channel:[],owner:[]},threads:[],layers:[]},
 media:{accessRightKey:PRIVATE,contents:{videos:[{id:PRIVATE}]}},
 payment:{admission:{isEnabled:false},ppv:{isEnabled:false},premium:{isEnabled:false}},
 viewer:{id:12345,isPremium:false},
 ...(owner?{metadata:{jsonLd:{owner:{type:'user',id:OWNER,name:PRIVATE}}}}:{})
}}}}});
function harness({owner=true,lookup='empty',failWatch=false}={}){
 const logs=[],events=[],requests=[],debug={watchApiData:{secret:PRIVATE}};
 const console=Object.fromEntries(['log','warn','info','error','time','timeEnd']
  .map(name=>[name,(...args)=>logs.push([name,...args])]));
 const search=lookup==='throw-getter'?Object.defineProperty({},'lookupOwnerIds',{
  get(){throw Error(PRIVATE);}}):{lookupOwnerIds:async()=>{
   if(lookup==='fail')throw Error(PRIVATE);return new Map();}};
 const loader=loadLegacy(runtime,'VideoInfoLoader',{
  CacheStorage:class{setItem(){}},sessionStorage:{},debug,console,window:{console},
  netUtil:{fetch:async(url,options)=>{requests.push({url,options});
   if(url.includes('/watch/')){
    if(failWatch)throw {reason:'network',message:PRIVATE,errorCode:PRIVATE,statusCode:PRIVATE};
    return {json:async()=>payload(owner)};
   }
   return {ok:lookup==='owner',json:async()=>({data:{id:ID,ownerId:OWNER,ownerName:PRIVATE}})};
  }},
  NicoSearchApiV2Loader:search,nicoUtil:{hasLargeThumbnail:()=>false},
  CommentPostTarget:{select:()=>({defaultThread:null,threadId:null,canPost:false,optionalThreads:[]})},
  Config:{getValue:()=>false},emitter:{emitAsync:(...args)=>events.push(args)},
  URLSearchParams,setTimeout:(fn)=>{queueMicrotask(fn);return 1;}
 });
 return {loader,logs,events,requests,debug};
}
const assertPrivateLogs=h=>{
 const text=JSON.stringify(snapshot(h.logs));
 for(const secret of [ID,OWNER,PRIVATE])assert.equal(text.includes(secret),false,secret+' leaked into diagnostics');
};
test('initialization drops old watch response retention before any request',()=>{
 const h=harness();assert.equal(h.debug.watchApiData,undefined);
});
test('successful watch data remains usable without becoming a debug or console retention',async()=>{
 const h=harness();const result=await h.loader.load(ID,{});
 assert.equal(result.isPlayable,true);assert.equal(h.events.filter(x=>x[0]==='loadVideoInfo').length,1);
 assert.equal(result.watchApiData.videoDetail.id,ID);
 assert.equal(h.debug.watchApiData,undefined);assertPrivateLogs(h);
});
for(const lookup of ['owner','empty','fail','throw-getter'])test(`owner supplement ${lookup} uses nonidentifying diagnostics`,async()=>{
 const h=harness({owner:false,lookup});const result=await h.loader.load(ID,{});
 assert.equal(result.isPlayable,true);
 if(lookup==='owner')assert.equal(result.watchApiData.uploaderInfo.id,OWNER);
 assertPrivateLogs(h);
});
test('retry diagnostics discard raw message/error/status and video identity',async()=>{
 const h=harness({failWatch:true});const result=await settle(()=>h.loader.load(ID,{}));
 assert.equal(result.ok,false);assert.equal(h.requests.length,2);
 assert.equal(result.error.watchId,ID);assertPrivateLogs(h);
});
test('pre-aborted request clears previously retained debug data without fetching',async()=>{
 const h=harness(),controller=new AbortController();h.debug.watchApiData={secret:PRIVATE};
 controller.abort(Error(PRIVATE));
 const result=await settle(()=>h.loader.load(ID,{signal:controller.signal}));
 assert.equal(result.ok,false);assert.equal(result.error.reason,'cancelled');
 assert.equal(h.requests.length,0);assert.equal(h.debug.watchApiData,undefined);assertPrivateLogs(h);
});
