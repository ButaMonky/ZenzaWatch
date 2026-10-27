'use strict';
const assert=require('assert');
const {createContext,run,extract,beginSection}=require('../helpers/extractSource');
const {createPlaylistContext}=require('../helpers/playlistHarness');
const {ZenzaCommentHistorySettings}=require('../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');
const row=i=>({watchId:'sm'+i,content:{id:'sm'+i,title:'vid '+i,duration:10,count:{mylist:1,comment:2,view:3},thumbnail:{url:'https://example.invalid/t'},registeredAt:'2026-01-01'}});
const rows=(count,start=1)=>Array.from({length:count},(_,i)=>row(start+i));
function schema() {
 const ctx=createContext({ZenzaCommentHistorySettings,PRODUCT:'ZenzaWatch',navigator:{},location:{host:'www.nicovideo.jp'},localStorage:{},buildDefaultKeyConfig:()=>({}),DataStorage:{create(defaults,options){return {default:defaults,options};}}});
 for(const [name,path] of [['CommentDisplayBudget','packages/zenza/src/commentLayer/CommentDisplayBudget.js'],['RelatedMenuActions','packages/zenza/src/menu/RelatedMenuActions.js'],['RelatedMenuOrder','src/RelatedMenuOrder.js'],['ScreenshotFileName','src/ScreenshotFileName.js'],['UiVisibilityRegistry','src/UiVisibilityRegistry.js']]){
  const {loadClass}=require('../helpers/extractSource');ctx[name]=loadClass(path,name,ctx);
 }
 run('const Config='+extract('src/Config.js','Config','var')+';globalThis.config=Config;',ctx);return {config:ctx.config,ctx};
}
describe('Task976 configured maximum becomes 10,000',function(){
 this.timeout(20000);
 it('keeps 3,000 default, offers exactly ten choices and rejects unsupported large imports',()=>{
  const {config,ctx}=schema();const valid=config.options.validateImport;
  assert.strictEqual(config.default['playlist.maxItems'],3000);
  for(let n=1000;n<=10000;n+=1000)assert.strictEqual(valid('playlist.maxItems',n),true);
  for(const n of [999,11000,12000,15000,20000,30000,Infinity,NaN,'10000'])
   assert.strictEqual(valid('playlist.maxItems',n),false,String(n));
  const {loadClass}=require('../helpers/extractSource');
  const M=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',ctx);
  config.getValue=k=>config.default[k];config.setValue=()=>{};
  const d=new M({config}).descriptor('playlist.maxItems');
  assert(d);assert.deepStrictEqual(Array.from(d.options,x=>x.value),[1000,2000,3000,4000,5000,6000,7000,8000,9000,10000]);
  assert(d.description.includes('10000'));assert(!d.description.includes('30000'));
 });
 it('normalizes a previously saved 30,000 setting to 10,000 without lowering the 3,000 default',()=>{
  const h=createPlaylistContext();
  assert.strictEqual(h.PlayList.normalizeRetentionLimit(30000),10000);
  assert.strictEqual(h.PlayList.normalizeRetentionLimit(11000),10000);
  assert.strictEqual(h.PlayList.normalizeRetentionLimit(undefined),3000);
 });
 it('displays 10,000 for an old persisted 30,000 preference without an invalid option',()=>{
  const {config,ctx}=schema(),{loadClass}=require('../helpers/extractSource');
  config.getValue=k=>k==='playlist.maxItems'?30000:config.default[k];
  config.setValue=()=>{};
  const m=new (loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',ctx))({config});
  assert.strictEqual(m.get('playlist.maxItems'),10000);
  assert.strictEqual(m.descriptor('playlist.maxItems').options.length,10);
 });
 it('restores a previously saved oversized playlist around its active video',()=>{
  const h=createPlaylistContext(),p=h.createPlaylist();
  h.c.console={log(){},warn(){}};
  p.unserialize({items:Array.from({length:12000},(_,i)=>h.raw('sm'+(i+1))),
    index:11500,enable:true,loop:false});
  assert.strictEqual(p.model.length,10000);
  assert.strictEqual(p.model.maxItems,10000);
  assert.strictEqual(p.model.items[p.getIndex()].watchId,'sm11501');
 });
 it('keeps 5,000 item fetched collection with a 1,000 rolling preference',async()=>{
  const h=createPlaylistContext(),p=h.createPlaylist();
  p.setRetentionLimit(1000);
  let requested;
  p._playlistApiLoader={load:async q=>{requested=q;return rows(5000)}};
  await p.load({type:'mylist',id:1});
  assert.strictEqual(requested.maxItems,10000);
  assert.strictEqual(p.model.length,5000);
  assert.strictEqual(p.model.maxItems,5000);
 });
 it('preserves all 7,000 old items while adding the first 3,000 of 5,000 new videos',async()=>{
  const h=createPlaylistContext(),p=h.createPlaylist();
  p.setRetentionLimit(1000);
  p.model.maxItems=7000;
  p.model.setItem(Array.from({length:7000},(_,i)=>h.item('sm'+(i+1))));
  p._playlistApiLoader={load:async()=>rows(5000,7001)};
  const result=await p.load({type:'mylist',id:2},{append:true});
  assert.strictEqual(p.model.length,10000);
  assert.strictEqual(p.model.maxItems,10000);
  assert(p.model.findByWatchId('sm1'));
  assert(p.model.findByWatchId('sm7000'));
  assert(p.model.findByWatchId('sm7001'));
  assert(p.model.findByWatchId('sm10000'));
  assert(!p.model.findByWatchId('sm10001'));
  assert(result.message.includes('2000')&&result.message.includes(String.fromCharCode(0x4e0a,0x9650)));
 });
 it('keeps existing 7,000 when direct appendItems receives 5,000 new items',()=>{
  const h=createPlaylistContext(),p=h.createPlaylist();
  p.setRetentionLimit(1000);
  p.model.maxItems=7000;
  p.model.setItem(Array.from({length:7000},(_,i)=>h.item('sm'+(i+1))));
  p.appendItems(Array.from({length:5000},(_,i)=>h.raw('sm'+(i+7001))));
  assert.strictEqual(p.model.length,10000);
  assert(p.model.findByWatchId('sm1'));
  assert(p.model.findByWatchId('sm7000'));
 });
 it('caps API automatic pagination at 10,000 even if callers request 30,000',async()=>{
  const ctx=createContext({URL,URLSearchParams,sessionStorage:{},CacheStorage:class{getItem(){return null}setItem(){}},netUtil:{fetch:async url=>{
   const u=new URL(url),page=Number(u.searchParams.get('page')),size=Number(u.searchParams.get('pageSize'));
   return {json:async()=>({meta:{status:200},data:{totalCount:12050,items:rows(size,(page-1)*size+1)}})};
  }}});
  let calls=0;const fetcher=ctx.netUtil.fetch;ctx.netUtil.fetch=(...a)=>{calls++;return fetcher(...a)};
  run('const PlaylistApiLoader='+extract('packages/lib/src/nico/PlaylistApiLoader.js','PlaylistApiLoader','var')+';globalThis.api=PlaylistApiLoader;',ctx);
  const out=await ctx.api.load({type:'series',id:1,maxItems:30000});
  assert.strictEqual(out.length,10000);
  assert.strictEqual(calls,20);
  assert(out.playlistLoadInfo.limited);
 });
 it('session storage limits persistence to 10,000 while keeping the playing video',()=>{
  let data='',writeCount=0;
  const ctx=createContext({sessionStorage:{getItem:()=>data,setItem:(k,v)=>{writeCount++;data=v;},removeItem:()=>{data='';}},window:{console:{warn(){},error(){}}}});
  run(beginSection('packages/zenza/src/Playlist/PlayListSession.js')+';globalThis.session=PlayListSession;',ctx);
  const items=Array.from({length:12000},(_,i)=>({id:'sm'+i}));
  ctx.session.save({items,index:11500});
  const restored=ctx.session.restore();
  assert.strictEqual(restored.items.length,10000);
  assert.strictEqual(restored.items[restored.index].id,'sm11500');
  assert(writeCount>=1);
 });
});
