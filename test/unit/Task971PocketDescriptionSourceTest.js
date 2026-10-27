'use strict';
const assert=require('assert');
const {pocketUtil,toDom}=require('../helpers/pocketHarness');
const {extract,createContext,run}=require('../helpers/extractSource');
const AMAZON='http://amzn.asia/9gA3HpS';
const FLAT='Wishlist: '+AMAZON+'sm46723246&lt; previous mylist/79146401 next sm46778968';
const ORIGINAL='First line<br><br>Wishlist: <a href="'+AMAZON+'">'+AMAZON+'</a><br>'+
 '<a href="https://www.nicovideo.jp/watch/sm46723246">sm46723246</a>&lt; previous '+
 '<a href="https://www.nicovideo.jp/mylist/79146401">mylist/79146401</a> next '+
 '<a href="https://www.nicovideo.jp/watch/sm46778968">sm46778968</a>';
const flush=async()=>{for(let i=0;i<45;i++)await Promise.resolve();};
function fixture(){
 const s=pocketUtil({url:'https://www.nicovideo.jp/my'});s.util.hasLargeThumbnail=()=>false;
 const host=s.doc.createElement('div');host.id='mylistPocket-popup';host.className='show';
 const description=s.doc.createElement('div');description.className='description';
 const image=s.doc.createElement('img');host.append(image,description);s.doc.body.append(host);
 const calls=[];const answers=new Map();
 const context=createContext({document:s.doc,window:s.w,DOMParser:s.w.DOMParser,
  location:s.w.location,util:s.util,protocol:'https:',Emitter:class{},
  textUtil:{secToTime:n=>String(n)},
  ThumbInfoLoader:{load:async id=>({status:'ok',v:id,id,videoId:id,watchId:id,title:id,
   thumbnail:'https://cdn.example/'+id+'.jpg',description:id==='sm46751412'?FLAT:'New video',
   owner:{type:'user',id:'1',name:'owner'},tagList:[],duration:10})},
  AdDecorationLoader:{load:async()=>new Map()},
  PocketCardMetadataLoader:{load:async()=>null},
  netUtil:{fetch:(url,options)=>{calls.push({url,options});return new Promise(r=>answers.set(url,r));}}
 });
 for(const [name,path] of [
  ['ThumbnailSourcePolicy','packages/lib/src/nico/ThumbnailSourcePolicy.js'],
  ['PocketThumbnail','packages/zenza/src/pocket/PocketThumbnail.js'],
  ['PocketDescriptionCard','packages/zenza/src/pocket/PocketDescriptionCard.js']]){
  run('const '+name+'='+extract(path,name,'var')+';this.'+name+'='+name+';',context);
 }
 run('const VideoInfo='+extract('src/_pocket.js','VideoInfo','class')+';',context);
 run('const VideoInfoView='+extract('src/_pocket.js','VideoInfoView','class')+';this.View=VideoInfoView;',context);
 run('this.loader='+extract('src/_pocket.js','createVideoInfoLoader','var')+';',context);
 const view=Object.create(context.View.prototype);
 view._hostDom=host;view._slot={'video-thumbnail':image,description};view._isZenzaReady=false;
 view._descriptionCardsGeneration=0;view._videoInfo=null;
 view.reset=function(){this._videoInfo=null;this._descriptionCardsGeneration++;};
 view.show=()=>host.classList.add('show');
 view.bind=function(info){this._videoInfo=info;image.src=info.videoThumbnail||'';this._createDescription(description,info.description);};
 const load=context.loader(view);
 const answer=(id,html=ORIGINAL,thumbnail={})=>{
  const payload={data:{response:{$watchV4:{data:{video:{id,description:html,thumbnail}}}}}};
  const page='<meta name="server-response" content="'+JSON.stringify(payload).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">';
  answers.get('https://www.nicovideo.jp/watch/'+id)({ok:true,text:async()=>page});
 };
 return {s,host,description,image,view,load,answer,calls,context,close:()=>s.close()};
}
describe('Task971 original description and intact URL boundaries',function(){
 this.timeout(15000);let h;afterEach(()=>{h?.close();h=null;});
 it('uses original watch HTML and creates both adjacent video cards with a correct Amazon URL',async()=>{
  h=fixture();await h.load('sm46751412');await flush();h.answer('sm46751412');await flush();
  const amazon=h.description.querySelector('a[href^="http://amzn.asia/"]');
  assert(amazon);assert.strictEqual(amazon.getAttribute('href'),AMAZON);
  assert(h.description.querySelectorAll('br').length>=3,'original breaks must survive');
  assert.deepStrictEqual([...h.description.querySelectorAll('.mpp-video-card')].map(n=>n.dataset.watchId),['sm46723246','sm46778968']);
  assert.strictEqual(h.view._videoInfo.description,ORIGINAL);
  assert.strictEqual(h.calls.length,1,'HQ and description must share one watch request');
 });
 it('updates original description even when the watch response has no high-quality thumbnail',async()=>{
  h=fixture();await h.load('sm46751412');await flush();h.answer('sm46751412','A<br>B');await flush();
  assert.strictEqual(h.description.innerHTML,'A<br>B');
  assert.strictEqual(h.image.src,'https://cdn.example/sm46751412.jpg');
 });
 it('sanitizes active HTML when applying the rich description',async()=>{
  h=fixture();await h.load('sm46751412');await flush();
  h.answer('sm46751412','safe<br><script>window.bad=1</script><img src="x" onerror="bad()"><a href="javascript:bad()">label</a>');await flush();
  assert(h.description.querySelector('br'));
  assert.strictEqual(h.description.querySelector('script,[onerror],[href^="javascript:"]'),null);
  assert.strictEqual(h.s.w.bad,undefined);
 });
 it('never overwrites a different popup with an earlier rich description',async()=>{
  h=fixture();await h.load('sm46751412');await flush();await h.load('sm99');await flush();
  h.answer('sm46751412');await flush();assert.strictEqual(h.description.textContent,'New video');
 });
 it('does not render the original description into a closed popup',async()=>{
  h=fixture();await h.load('sm46751412');await flush();const before=h.description.innerHTML;
  h.host.classList.remove('show');h.answer('sm46751412');await flush();assert.strictEqual(h.description.innerHTML,before);
 });
 it('retains plain-text LF/CRLF as visible breaks and keeps a video ID outside an external URL',()=>{
  h=fixture();const result=toDom(h.s.w,h.s.util.httpLink(AMAZON+'\r\nsm46723246\n\nsm46778968'));
  assert.strictEqual(result.querySelectorAll('br').length,3);
  assert.deepStrictEqual([...result.querySelectorAll('a')].map(a=>a.getAttribute('href')),[AMAZON,
   'https://www.nicovideo.jp/watch/sm46723246','https://www.nicovideo.jp/watch/sm46778968']);
 });
 it('shares cached presentation with HQ consumers without exposing mutable URL arrays',async()=>{
  h=fixture();const api=h.context.PocketThumbnail;let count=0;
  const fetcher=async()=>{count++;return {ok:true,json:async()=>({data:{response:{video:{
   id:'sm8',description:'A<br>B',thumbnail:{player:'https://cdn.example/high.jpg'}
  }}}})};};
  const [meta,urls]=await Promise.all([api.getPresentation('sm8',fetcher,'www.nicovideo.jp'),
   api.getHighQuality('sm8',fetcher,'www.nicovideo.jp')]);
  assert.strictEqual(count,1);assert.strictEqual(meta.description,'A<br>B');
  meta.urls.length=0;urls.length=0;
  const again=await api.getPresentation('sm8',fetcher,'www.nicovideo.jp');
  assert.deepStrictEqual([...again.urls],['https://cdn.example/high.jpg']);assert.strictEqual(count,1);
 });
 it('retains literal escaped tags as text instead of executing a second decode',()=>{
  h=fixture();const result=toDom(h.s.w,h.s.util.httpLink('&lt;script&gt;alert(1)&lt;/script&gt;\nsm9'));
  assert.strictEqual(result.querySelector('script'),null);assert(result.textContent.includes('<script>'));
  assert.strictEqual(result.querySelectorAll('br').length,1);
 });
 it('does not guess video-ID boundaries inside a legitimate external URL',()=>{
  h=fixture();const url='https://example.com/items/sm46723246?next=sm46778968';
  const result=toDom(h.s.w,h.s.util.httpLink(url));assert.strictEqual(result.querySelectorAll('a').length,1);
  assert.strictEqual(result.querySelector('a').getAttribute('href'),url);
 });
});
