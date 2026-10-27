'use strict';
const assert=require('assert');
const {extract,createContext,run,read}=require('../helpers/extractSource');
const SOURCE='packages/zenza/src/pocket/PocketCardMetadataLoader.js';
function loader(fetcher){
  const context=createContext();
  run('const PocketCardMetadataLoader='+extract(SOURCE,'PocketCardMetadataLoader','var')+
    ';this.CardApi=PocketCardMetadataLoader;',context);
  return {CardApi:context.CardApi,fetcher};
}
function response(id='sm46949237',like=95,owner={
  ownerType:'user',visibility:'visible',id:'188548',name:'say2',
  iconUrl:'https://img.nicoprofile.nimg.jp/usericon/18/188548.jpg'
}){
 return {ok:true,json:async()=>({meta:{status:200},
   data:{items:[{watchId:id,video:{id,count:{like},owner}}]}})};
}
describe('Task967: public Nico video card extras',()=>{
 it('gets a grounded like count and validated owner from the 2026 API shape',async()=>{
  const requests=[];
  const h=loader();
  const data=await h.CardApi.load('sm46949237',async (url,options)=>{
    requests.push({url,options});
    return response();
  });
  assert.strictEqual(data.likeCount,95);
  assert.strictEqual(data.videoId,'sm46949237');
  assert.strictEqual(data.owner.name,'say2');
  assert.strictEqual(data.owner.url,'https://www.nicovideo.jp/user/188548');
  assert(data.owner.icon.startsWith('https://'));
  assert.deepStrictEqual(requests.map(x=>x.url),[
    'https://nvapi.nicovideo.jp/v1/videos?watchIds=sm46949237'
  ]);
  assert.strictEqual(requests[0].options.credentials,'omit');
  assert.strictEqual(requests[0].options.headers['X-Frontend-Id'],'6');
 });
 it('distinguishes valid zero likes from missing and malformed counts',()=>{
  const api=loader().CardApi;
  const good={meta:{status:200},data:{items:[{watchId:'sm9',video:{id:'sm9',count:{like:0}}}]}};
  assert.strictEqual(api.parse(good,'sm9').likeCount,0);
  for(const bad of [undefined,null,'95',-1,1.5,NaN,Infinity]){
    good.data.items[0].video.count.like=bad;
    assert.strictEqual(api.parse(good,'sm9').likeCount,null);
  }
  assert.strictEqual(api.parse({meta:{status:403}},'sm9'),null);
  assert.strictEqual(api.parse(good,'sm1'),null,'ID mismatch cannot leak other metadata');
 });
 it('does not reveal owners marked hidden or accept unsafe types',()=>{
  const api=loader().CardApi;
  assert.strictEqual(api.normalizeOwner({ownerType:'user',visibility:'hidden',
    id:'1234',name:'Hidden'}),null);
  assert.strictEqual(api.normalizeOwner({ownerType:'user',id:'../../',name:'Unknown'}),null);
  assert.strictEqual(api.normalizeOwner({ownerType:'user',id:'4',name:'Valid',
    iconUrl:'javascript:alert(1)'}).icon,'');
  const channel=api.normalizeOwner({ownerType:'channel',id:'ch12345',name:'公式',
    iconUrl:'http://img.nicoprofile.nimg.jp/a.jpg'});
  assert.strictEqual(channel.url,'https://ch.nicovideo.jp/ch12345');
  assert.strictEqual(channel.icon,'https://img.nicoprofile.nimg.jp/a.jpg');
 });
 it('coalesces simultaneous requests, caches success, and rejects unsafe IDs',async()=>{
  const h=loader();
  let count=0;
  const fetcher=async()=>{count++;await Promise.resolve();return response('sm10',0);};
  const [a,b]=await Promise.all([h.CardApi.load('sm10',fetcher),h.CardApi.load('sm10',fetcher)]);
  assert.strictEqual(a.likeCount,0);assert.strictEqual(b.likeCount,0);
  assert.strictEqual(count,1);
  await h.CardApi.load('sm10',fetcher);
  assert.strictEqual(count,1);
  assert.strictEqual(await h.CardApi.load('sm10<script>',fetcher),null);
  assert.strictEqual(count,1);
 });
 it('fails softly on network errors, non-OK and changed schemas',async()=>{
  const h=loader();
  assert.strictEqual(await h.CardApi.load('sm11',async()=>{throw Error('offline');}),null);
  assert.strictEqual(await h.CardApi.load('sm12',async()=>({ok:false})),null);
  assert.strictEqual(await h.CardApi.load('sm13',async()=>({ok:true,json:async()=>({data:{items:[]}})})),null);
 });
 it('is included as a reusable module in the page-world (not a free reference)',()=>{
  const src=read('src/_pocket.js');
  assert(src.includes('//@require PocketCardMetadataLoader'));
  assert(src.includes('loadExtra: id => PocketCardMetadataLoader.load(id)'));
  const compiled=read('dist/MylistPocket.user.js');
  assert(compiled.includes('const PocketCardMetadataLoader = (() => {'));
  assert(compiled.includes('loadExtra: id => PocketCardMetadataLoader.load(id)'));
 });
});
