'use strict';
const assert=require('assert');
const {extract,createContext,run,loadClass,read,beginSection}=require('../helpers/extractSource');
const {createPlaylistContext}=require('../helpers/playlistHarness');
const {ZenzaCommentHistorySettings}=require('../../packages/comment-history/src/generated/ZenzaCommentHistorySettings.generated.js');
function configSchema(){
 const c=createContext({ZenzaCommentHistorySettings,PRODUCT:'ZenzaWatch',navigator:{},location:{host:'www.nicovideo.jp'},localStorage:{},buildDefaultKeyConfig:()=>({}),DataStorage:{create(d,o){return {default:d,options:o};}}});
 for(const [name,path] of [['CommentDisplayBudget','packages/zenza/src/commentLayer/CommentDisplayBudget.js'],['RelatedMenuActions','packages/zenza/src/menu/RelatedMenuActions.js'],['RelatedMenuOrder','src/RelatedMenuOrder.js'],['ScreenshotFileName','src/ScreenshotFileName.js'],['UiVisibilityRegistry','src/UiVisibilityRegistry.js']])c[name]=loadClass(path,name,c);
 run('const Config='+extract('src/Config.js','Config','var')+';this.cfg=Config;',c);return c.cfg;
}
const records=(n,start=1)=>Array.from({length:n},(_,i)=>({watchId:'sm'+(i+start),content:{id:'sm'+(i+start),title:'video',duration:1,count:{view:1,mylist:1,comment:1},thumbnail:{url:'https://example.invalid/t'},registeredAt:'2026-01-01'}}));
function playlist(){const h=createPlaylistContext();h.c.console={log(){},warn(){},error(){},time(){},timeEnd(){}};return {...h,p:h.createPlaylist()};}
describe('Task974 retention config and settings',()=>{
 it('default3000 accepts only 1000 steps from1000 through10000',()=>{
  const c=configSchema();assert.strictEqual(c.default['playlist.maxItems'],3000);
  for(let n=1000;n<=10000;n+=1000)assert(c.options.validateImport('playlist.maxItems',n));
  for(const n of [0,999,1500,11000,30000,30001,31000,NaN,Infinity,'3000',null])assert.strictEqual(c.options.validateImport('playlist.maxItems',n),false,String(n));
 });
 it('has exactly30 choices with accurate retention/bulk/storage warnings in playlist category',()=>{
  const cfg=configSchema();cfg.getValue=k=>cfg.default[k];cfg.setValue=()=>{};
  const c=createContext();c.UiVisibilityRegistry=loadClass('src/UiVisibilityRegistry.js','UiVisibilityRegistry',c);
  const Model=loadClass('src/ModernAdvancedSettingsModel.js','ModernAdvancedSettingsModel',c),m=new Model({config:cfg});
  const d=m.descriptor('playlist.maxItems');assert(d);assert.strictEqual(d.category,'プレイリスト・検索');assert.strictEqual(d.subcategory,'プレイリスト');
  assert.strictEqual(d.type,'select');assert.deepStrictEqual(Array.from(d.options,x=>x.value),Array.from({length:10},(_,i)=>(i+1)*1000));
  for(const word of ['連続再生','取得','3000','10000','保存'])assert(d.description.includes(word),word);
  const search=m.descriptor('search.limit');assert.strictEqual(search.type,'slider');assert.strictEqual(search.min,1);assert.strictEqual(search.max,5000);assert.strictEqual(search.step,1);
  assert.strictEqual(search.subcategory,'検索');assert(search.description.includes('連続再生'));
 });
 it('saved valid search values1,37,99 are not rounded up to100',()=>{
  const {PlayList}=playlist();const c=configSchema();
  for(const n of [1,37,99,100,1000,5000]){assert(c.options.validateImport('search.limit',n));assert.strictEqual(PlayList.normalizeSearchLimit(n),n);}
  assert.strictEqual(PlayList.normalizeSearchLimit(NaN),1000);assert.strictEqual(PlayList.normalizeSearchLimit(5001),5000);
 });
 it('legacy settings preserve small search values and no longer claim1000-item reload cap',()=>{
  const s=read('src/_setting.js');const at=s.indexOf('class="searchLimitControl');const block=s.slice(at,s.indexOf('class="maxDisplayCommentControl',at));
  assert(block.includes('min="1"')&&block.includes('max="5000"'));
  assert(!block.includes('前後1000件'));assert(block.includes('保存容量'));
  assert(s.includes('data-setting-name="playlist.maxItems"'));
 });
});
describe('Task974 configured rolling retention and bulk precedence',function(){
 this.timeout(20000);
 it('starts at3000 and applies changes without deleting existing entries',()=>{
  const {p,item}=playlist();assert.strictEqual(p.model.maxItems,3000);
  p.setRetentionLimit(1000);p.model.setItem(Array.from({length:1000},(_,i)=>item('sm'+i)));
  const active=p.model.items[0];active.isActive=true;
  p.model.appendItem(item('sm1001'));assert.strictEqual(p.model.length,1000);assert(p.model.items.includes(active));
  p.setRetentionLimit(10000);assert.strictEqual(p.model.maxItems,10000);
  p.model.setItem(Array.from({length:4200},(_,i)=>item('sm'+i)));
  p.setRetentionLimit(1000);assert.strictEqual(p.model.length,4200);assert(p.model.maxItems>=4200);
 });
 for(const kind of ['series','mylist','user-uploaded','watchlater']){
  it(kind+' keeps4200 fetched entries despite retention1000 and uses an independent fetch budget',async()=>{
   const {p}=playlist();p.setRetentionLimit(1000);let request;
   p._playlistApiLoader={load:async q=>{request=q;return records(4200);}};
   await p.load({type:kind,id:1});assert.strictEqual(p.model.length,4200);assert(request.maxItems===10000);
   p.model.appendItem(p.model.items[0]);assert.strictEqual(p.model.length,4200);
   p._playlistApiLoader={load:async()=>records(10)};await p.load({type:kind,id:2});
   assert.strictEqual(p.model.length,10);assert.strictEqual(p.model.maxItems,1000);
  });
 }
 for(const action of ['append','insert']){
  it('bulk '+action+' preserves existing and fetched items without trimming either',async()=>{
   const {p,item}=playlist();p.setRetentionLimit(1000);p.model.setItem(Array.from({length:700},(_,i)=>item('sm'+(i+1))));p.setIndex(350);
   const active=p.model.items[350];p._playlistApiLoader={load:async()=>records(4200,601)};
   await p.load({type:'series',id:1},{[action]:true,watchId:active.watchId});
   assert.strictEqual(p.model.length,4800);assert(p.model.items.includes(active));assert(p.model.findByWatchId('sm4800'));
  });
 }
 it('search honors small count exactly and keeps a bulk result larger than rolling retention',async()=>{
  const {p}=playlist();p.setRetentionLimit(1000);let limit;
  p._nicoSearchApiLoader={searchMore:async(w,o,n)=>{limit=n;return {list:records(n)};}};
  await p.loadSearchVideo('test',{},37);assert.strictEqual(limit,37);assert.strictEqual(p.model.length,37);
  await p.loadSearchVideo('test',{},5000);assert.strictEqual(p.model.length,5000);
  assert(p.model.maxItems>=5000);
 });
 it('restoring a5000-item saved list does not lose rows at the3000 default',()=>{
  const {p,raw}=playlist();const items=Array.from({length:5000},(_,i)=>raw('sm'+i));
  p.unserialize({items,index:4500,enable:true,loop:false});assert.strictEqual(p.model.length,5000);assert.strictEqual(p.getIndex(),4500);
 });
 it('large neighbour insertion is linear instead of rescanning the whole list for every video',async()=>{
  const h=playlist(),{p}=h;p.setRetentionLimit(3000);p.model.setItem([h.item('sm1000')]);p.setIndex(0);
  run('globalThis.scanWork=0; const originalFI=Array.prototype.findIndex; Array.prototype.findIndex=function(fn,...rest){return originalFI.call(this,(...xs)=>{globalThis.scanWork++;return fn(...xs);},...rest);};',h.c);
  p._playlistApiLoader={load:async()=>records(2000)};
  await p.load({type:'series',id:1},{insert:true,watchId:'sm1000'});
  assert.strictEqual(p.model.length,2000);assert.strictEqual(p.model.items[0].watchId,'sm1');assert.strictEqual(p.model.items[1999].watchId,'sm2000');
  assert(h.c.scanWork<20000,'quadratic neighbour scans: '+h.c.scanWork);
 });
 it('retains a newly playing video at the end of a full rolling playlist',()=>{
  const h=playlist(),{p}=h;p.setRetentionLimit(1000);
  p.model.setItem(Array.from({length:1000},(_,i)=>h.item('sm'+(i+1))));p.setIndex(999);
  p.insertCurrentVideo(h.videoInfo('sm1001'));
  assert.strictEqual(p.model.length,1000);
  const current=p.model.findByWatchId('sm1001');assert(current,'newly playing video must not be trimmed');
  assert.strictEqual(current.isActive,true);assert.strictEqual(p.model.items[p.getIndex()],current);
 });
 it('stale load cannot inflate retention capacity or replace a newer list',async()=>{
  const {p}=playlist();p.setRetentionLimit(1000);let resolve;
  p._playlistApiLoader={load:q=>q.id===1?new Promise(r=>resolve=r):Promise.resolve(records(10))};
  const old=p.load({type:'mylist',id:1});await p.load({type:'mylist',id:2});resolve(records(8000));
  assert.strictEqual((await old).status,'superseded');assert.strictEqual(p.model.length,10);assert.strictEqual(p.model.maxItems,1000);
 });
});
describe('Task974 initial/live setting wiring',()=>{
 it('real playlist initialization forwards saved retention and observes setting updates',async()=>{
  const calls=[],handlers={};const fakePlaylist={on(){},restoreFromSession(){},setRetentionLimit:n=>calls.push(['update',n])};
  const c=createContext({Emitter:class{},PlayList:class{constructor(params){calls.push(['initial',params.retentionLimit]);return fakePlaylist;}},ThumbInfoLoader:{},PlayListSession:{isExist:()=>false},_:{debounce:f=>f},window:{console:{warn(){}}}});
  run(extract('src/NicoVideoPlayerDialog.js','NicoVideoPlayerDialog','class')+';this.P=NicoVideoPlayerDialog;',c);
  const p=Object.create(c.P.prototype);p._view={appendTab:()=>[{}]};p._playerConfig={props:{playlistLoop:false,'playlist.maxItems':7000},onkey:(k,f)=>handlers[k]=f};p._onCommand=()=>{};p._onPlaylistStatusUpdate=()=>{};p.emitResolve=()=>{};
  await p._initializePlaylist();assert.deepStrictEqual(calls,[['initial',7000]]);assert.strictEqual(typeof handlers['playlist.maxItems'],'function');
  p._playerConfig.props['playlist.maxItems']=10000;handlers['playlist.maxItems']();assert.deepStrictEqual(calls[1],['update',10000]);
 });
});


describe('Task974 large-budget distribution guards',function(){
 this.timeout(20000);
 it('the emitted session keeps10000 entries when storage permits and retains its active position',()=>{
  let saved='';const c=createContext({sessionStorage:{getItem:()=>saved,setItem:(k,v)=>saved=v,removeItem:()=>saved=''},window:{console:{warn(){},error(){}}}});
  run(beginSection('packages/zenza/src/Playlist/PlayListSession.js')+';this.session=PlayListSession;',c);
  c.session.save({items:Array.from({length:10000},(_,i)=>({id:'sm'+i})),index:9500});
  const value=c.session.restore();assert.strictEqual(value.items.length,10000);assert.strictEqual(value.index,9500);
 });
 it('the installable player uses10k for collection safety while retaining a3000 default preference',async()=>{
  let calls=0;const c=createContext({URL,URLSearchParams,sessionStorage:{},CacheStorage:class{getItem(){return null}setItem(){}},
   netUtil:{fetch:async url=>{calls++;const u=new URL(url),page=Number(u.searchParams.get('page')),size=Number(u.searchParams.get('pageSize'));
    return {json:async()=>({meta:{status:200},data:{totalCount:30001,items:records(size,(page-1)*size+1)}})};
   }}});
  run('const PlaylistApiLoader='+extract('dist/ZenzaWatch-dev.user.js','PlaylistApiLoader','var')+';this.api=PlaylistApiLoader;',c);
  const list=await c.api.load({type:'series',id:1});assert.strictEqual(list.length,10000);assert.strictEqual(calls,20);assert.strictEqual(list.playlistLoadInfo.limited,true);
  assert(read('dist/ZenzaWatch-dev.user.js').includes("'playlist.maxItems': 3000"));
  assert(read('dist/ZenzaAdvancedSettings.user.js').includes("presentation: 'dropdown'"));
 });
});
