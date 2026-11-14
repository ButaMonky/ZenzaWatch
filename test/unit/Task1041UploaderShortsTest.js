'use strict';
const assert=require('assert');
const {extract,createContext,run}=require('../helpers/extractSource');
const {createPlaylistContext}=require('../helpers/playlistHarness');
describe('Task1041 uploader playlist with shorts',()=>{for(const fail of [false,true])it('works '+fail,async()=>{globalThis.LONG_FAIL=fail;
 const h=createPlaylistContext();const c=h.c;c.URL=URL;c.URLSearchParams=URLSearchParams;c.sessionStorage={};
 c.CacheStorage=class{getItem(){return null}setItem(){}};c.setTimeout=fn=>{fn();return 1;};const calls=[];
 c.netUtil={fetch:async(url)=>{calls.push(url);const u=new URL(url);
  if(u.pathname.startsWith('/v3/users/'))return {json:async()=>({meta:{status:200},data:{totalCount:2,items:[
   {series:null,essential:{type:'essential',id:'ss5',contentType:'short',title:'S5',registeredAt:'2026-01-05T00:00:00+09:00',duration:30,count:{view:1,comment:0,mylist:0,like:0},thumbnail:{url:'https://x/5'}}},
   {series:null,essential:{type:'essential',id:'ss2',contentType:'short',title:'S2',registeredAt:'2026-01-02T00:00:00+09:00',duration:30,count:{view:1,comment:0,mylist:0,like:0},thumbnail:{url:'https://x/2'}}}]}})};
  if(globalThis.LONG_FAIL)return {json:async()=>({meta:{status:404,errorCode:'NOT_FOUND'},data:{}})};
  return {json:async()=>({meta:{status:200},data:{totalCount:2,items:[
   {watchId:'sm4',content:{id:'sm4',title:'V4',duration:60,count:{},thumbnail:{url:'https://x'},registeredAt:'2026-01-04T00:00:00+09:00'}},
   {watchId:'sm1',content:{id:'sm1',title:'V1',duration:60,count:{},thumbnail:{url:'https://x'},registeredAt:'2026-01-01T00:00:00+09:00'}}]}})};
 }};
 run('const PlaylistApiLoader='+extract('dist/ZenzaWatch-dev.user.js','PlaylistApiLoader','var')+';this.api=PlaylistApiLoader;',c);
 const p=h.createPlaylist();p._playlistApiLoader=c.api;
 const r=await p.load({type:'user-uploaded',id:1});assert.strictEqual(r.status,'ok');assert(calls.some(u=>u.includes('/v3/users/1/videos?selectContentType=short')));
 assert.deepStrictEqual(Array.from(p.model.items,i=>String(i.watchId)),fail?['ss2','ss5']:['sm1','ss2','sm4','ss5']);if(fail)assert(r.message.includes('ショート動画だけ'));
});});
