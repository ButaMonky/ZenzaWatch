'use strict';
const assert=require('assert');
const {JSDOM}=require('jsdom');
const {extract,createContext,run}=require('../helpers/extractSource');
const {pocketUtil}=require('../helpers/pocketHarness');
const HQ='https://img.cdn.nimg.jp/s/original/r1280x720l?key=TEST%2Bvalue&expires=123';
const PLAYER='https://img.cdn.nimg.jp/s/original/a960x540l?key=PLAYER%2Fvalue';
const COMPOSITE='https://goptim.video.nimg.jp/thumbnail/1280x720?b=p&i=9';
const LOW='https://nicovideo.cdn.nimg.jp/thumbnails/9/9';
const payload=(thumbnail,id='sm9')=>({data:{response:{$watchV4:{data:{video:{id,thumbnail}}}}}});
const htmlOf=(thumbnail,id='sm9')=>'<html><head><meta name="server-response" content="'+
 JSON.stringify(payload(thumbnail,id)).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+
 '"></head><body><script>window.untrustedExecuted=true</script></body></html>';
function modules(context){
 for(const [name,file] of [
  ['ThumbnailSourcePolicy','packages/lib/src/nico/ThumbnailSourcePolicy.js'],
  ['PocketThumbnail','packages/zenza/src/pocket/PocketThumbnail.js'],
  ['PocketCardMetadataLoader','packages/zenza/src/pocket/PocketCardMetadataLoader.js'],
  ['PocketDescriptionCard','packages/zenza/src/pocket/PocketDescriptionCard.js']]){
  run('const '+name+'='+extract(file,name,'var')+';this.'+name+'='+name+';',context);
 }
 return context;
}
function fixture(){
 const dom=new JSDOM('',{url:'https://www.nicovideo.jp/my'});
 return {dom,api:modules(createContext({DOMParser:dom.window.DOMParser})).PocketThumbnail};
}
describe('Task971 Pocket HQ image routes',function(){
 this.timeout(15000);let h;
 afterEach(()=>{h?.dom?.window.close();h=null;});
 it('reads current server-response HTML without the obsolete query or script execution',async()=>{
  h=fixture();const seen=[];
  const urls=await h.api.getHighQuality('sm9',async(url,options)=>{
   seen.push({url,options});
   return url.endsWith('?responseType=json')?{ok:false}:{ok:true,text:async()=>htmlOf({ogp:HQ,player:PLAYER,url:LOW})};
  },'www.nicovideo.jp');
  assert.deepStrictEqual([...urls],[HQ,PLAYER,LOW]);
  assert.deepStrictEqual(seen.map(x=>x.url),['https://www.nicovideo.jp/watch/sm9']);
  assert.strictEqual(seen[0].options.credentials,'include');
  assert.strictEqual(h.dom.window.untrustedExecuted,undefined);
 });
 it('uses clean player rather than the goptim preview and preserves signed URLs',async()=>{
  h=fixture();
  const urls=await h.api.getHighQuality('sm9',async()=>({ok:true,
   text:async()=>htmlOf({ogp:COMPOSITE,player:PLAYER,url:LOW})}),'www.nicovideo.jp');
  assert.deepStrictEqual([...urls],[PLAYER,LOW]);
 });
 it('rejects a mismatched named video in an otherwise valid response',async()=>{
  h=fixture();
  const urls=await h.api.getHighQuality('sm9',async()=>({ok:true,
   json:async()=>payload({ogp:HQ},'sm8')}),'www.nicovideo.jp');
  assert.deepStrictEqual([...urls],[]);
 });
 it('rejects credential-bearing image URLs instead of exposing credentials in requests',()=>{
  h=fixture();
  assert.deepStrictEqual([...h.api.normalize(['https://sample:example@img.cdn.nimg.jp/image',HQ])],[HQ]);
 });
 it('does not use an unrelated named video from card metadata',()=>{
  const c=modules(createContext());
  const result=c.PocketCardMetadataLoader.parse({meta:{status:200},data:{items:[{
   watchId:'sm9',video:{id:'sm8',thumbnail:{ogp:HQ}}
  }]}},'sm9');
  assert.strictEqual(result,null);
 });
 it('fails softly once for missing/invalid HTML and preserves negative caching',async()=>{
  h=fixture();let calls=0;
  const fetcher=async()=>{calls++;return {ok:true,text:async()=>'<meta name="server-response" content="bad">'};};
  assert.deepStrictEqual([...await h.api.getHighQuality('sm9',fetcher,'www.nicovideo.jp')],[]);
  assert.deepStrictEqual([...await h.api.getHighQuality('sm9',fetcher,'www.nicovideo.jp')],[]);
  assert.strictEqual(calls,1);
 });
 it('keeps the normal thumbnail when HQ and player fail without using a composited fallback',()=>{
  h=fixture();
  const urls=h.api.watchUrls(payload({ogp:COMPOSITE,player:PLAYER,url:LOW}));
  const img={src:'',onerror:null};h.api.install(img,urls);
  assert.strictEqual(img.src,PLAYER);img.onerror();assert.strictEqual(img.src,LOW);
  img.onerror();assert.strictEqual(img.onerror,null);
 });
 it('preserves safe thumbnail variants returned by the already-existing card metadata request',()=>{
  const c=modules(createContext());
  const data=c.PocketCardMetadataLoader.parse({meta:{status:200},data:{items:[{
   watchId:'sm9',video:{id:'sm9',thumbnail:{ogp:HQ,player:PLAYER,url:LOW},count:{like:12}}
  }]}},'sm9');
  assert(data.thumbnail,'thumbnail data must not be thrown away');
  assert.strictEqual(data.thumbnail.ogp,HQ);assert.strictEqual(data.thumbnail.player,PLAYER);
  assert.strictEqual(data.likeCount,12);
 });
});

describe('Task971 real description-card image wiring',function(){
 this.timeout(15000);let h;
 function setup(extra){
  const s=pocketUtil({url:'https://www.nicovideo.jp/my'});s.util.hasLargeThumbnail=()=>false;
  const host=s.doc.createElement('div');host.id='mylistPocket-popup';host.className='show';
  const desc=s.doc.createElement('div');host.append(desc);s.doc.body.append(host);
  const calls={thumb:0,extra:0,watch:0};
  const c=modules(createContext({document:s.doc,window:s.w,DOMParser:s.w.DOMParser,
   util:s.util,location:s.w.location,Emitter:class{},
   ThumbInfoLoader:{load:async id=>{calls.thumb++;return {status:'ok',id,videoId:id,
    title:'Video',thumbnail:LOW,duration:10,owner:{type:'user',id:'1',name:'owner'}};}},
   AdDecorationLoader:{load:async()=>new Map()},
   netUtil:{fetch:()=>{calls.watch++;throw Error('No extra watch traffic for cards');}}
  }));
  c.PocketCardMetadataLoader.load=async()=>{calls.extra++;return await extra;};
  run('const View='+extract('src/_pocket.js','VideoInfoView','class')+';this.View=View;',c);
  const view=Object.create(c.View.prototype);view._videoInfo={watchId:'sm1'};
  view._isZenzaReady=false;view._hostDom=host;view._descriptionCardsGeneration=0;
  return {s,host,desc,view,calls,flush:async()=>{for(let i=0;i<25;i++)await Promise.resolve();},close:()=>s.close()};
 }
 afterEach(()=>{h?.close();h=null;});
 for(const [name,ogp,wanted] of [['clean original',HQ,HQ],['composited OGP',COMPOSITE,PLAYER]]){
  it('upgrades '+name+' via card extras without an additional watch request',async()=>{
   h=setup({videoId:'sm9',likeCount:3,thumbnail:{ogp,player:PLAYER,url:LOW}});
   h.view._createDescription(h.desc,'sm9');await h.flush();
   const image=h.desc.querySelector('.mpp-card-thumb img');
   assert(image);assert.strictEqual(image.src,wanted);
   assert.deepStrictEqual(h.calls,{thumb:1,extra:1,watch:0});
   image.onerror();if(wanted===HQ){assert.strictEqual(image.src,PLAYER);image.onerror();}
   assert.strictEqual(image.src,LOW);
  });
 }
 it('does not install a late high-quality image into a hidden popup',async()=>{
  let resolve;h=setup(new Promise(r=>resolve=r));h.view._createDescription(h.desc,'sm9');
  await h.flush();const image=h.desc.querySelector('.mpp-card-thumb img');assert.strictEqual(image.src,LOW);
  h.host.classList.remove('show');resolve({videoId:'sm9',thumbnail:{ogp:HQ}});await h.flush();
  assert.strictEqual(image.src,LOW);
 });
});
