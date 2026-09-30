const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
function payload() {
 return {data:{response:{$watchV4:{data:{
  client:{watchId:'sm9',watchTrackId:'track'},
  comment:{threads:[{id:10,fork:0,isPostTarget:true}],layers:[{index:1,components:[{threadId:10,fork:0}]}],ng:{owner:['ng']},nvComment:{server:'https://comments.example',threadKey:'fixture'}},
  media:{contents:{videos:[{id:'video',isAvailable:true}],audios:[{id:'audio',isAvailable:true}]},accessRightKey:'fixture',isStoryboardAvailable:true},
  player:{initialPlayback:{positionSec:12}},video:{id:'sm9',title:'test',duration:60,count:{view:3},thumbnail:{url:'thumb'},isLikedByViewer:true,permission:{}},
  genre:{key:'music',label:'音楽'},tags:{items:[{name:'tag'}],edit:{isEditable:false}},payment:{ppv:{isEnabled:false},admission:{isEnabled:false},premium:{isEnabled:false}},viewer:null,lazy:{authKey:'fixture'}
 }}}}};
}
function harness(p, lazy={owner:{type:'user',id:1,nickname:'owner',icon:{url:'icon'}}}, fail=false) {
 const calls=[];
 const context=createContext({CacheStorage:class {setItem(){}},sessionStorage:{},netUtil:{fetch:async(url,options)=>{calls.push({url,options});if(url.includes('/v4/watch/lazy/')){if(fail)throw Error('offline');return {json:async()=>({meta:{status:200},data:lazy})};}return {json:async()=>p};}},nicoUtil:{hasLargeThumbnail:()=>false},textUtil:{},Config:{getValue:()=>false},emitter:{emitAsync(){}},debug:{},console:{error(){},info(){},warn(){},log(){},time(){},timeEnd(){}}});
 run(beginSection('packages/lib/src/nico/VideoInfoLoader.js')+';globalThis.loader=VideoInfoLoader;',context);
 return {load:(id='sm9')=>context.loader.load(id,{}),calls};
}
describe('Task153 watch v4 compatibility',()=>{
 it('loads new media, comments, tags and liked status',async()=>{const r=await harness(payload()).load();assert.equal(r.isPlayable,true);assert.equal(r.domandInfo.videos[0].id,'video');assert.equal(r.domandInfo.accessRightKey,'fixture');assert.equal(r.msgInfo.defaultThread.id,10);assert.equal(r.msgInfo.defaultThread.layer.index,1);assert.equal(r.watchApiData.videoDetail.isLiked,true);assert.equal(r.watchApiData.videoDetail.tagList[0].name,'tag');assert.equal(r.resumeInfo.initialPlaybackPosition,12);});
 it('loads user owner from lazy response',async()=>{const r=await harness(payload()).load();assert.equal(r.watchApiData.uploaderInfo.id,1);assert.equal(r.watchApiData.uploaderInfo.iconUrl,'icon');});
 it('uses requested numeric ID for lazy token and maps channel owner',async()=>{const h=harness(payload(),{owner:{type:'channel',id:'ch1',name:'channel',thumbnail:{url:'icon'}},series:{id:2}});const r=await h.load('1234567890');assert(h.calls[1].url.endsWith('/1234567890'));assert.equal(r.watchApiData.channelInfo.id,'ch1');assert.equal(r.series.id,2);assert.equal(JSON.parse(h.calls[1].options.body).keyToken,'fixture');});
 it('optional lazy failure does not prevent playback',async()=>{const p=payload();p.data.response.$watchV4.data.video.id='so9';const r=await harness(p,{},true).load();assert.equal(r.isPlayable,true);});
 it('does not modify source JSON',async()=>{const p=payload();const before=JSON.stringify(p);await harness(p).load();assert.equal(JSON.stringify(p),before);});
 it('preserves legacy v3 responses without lazy request',async()=>{const p=payload();const d=p.data.response.$watchV4.data;d.comment.keys={};d.comment.server={url:'legacy'};d.comment.threads[0].isDefaultPostTarget=true;d.comment.layers[0].threadIds=[{id:10,fork:0}];d.external={commons:{hasContentTree:false}};d.media={domand:{videos:[],audios:[]}};d.payment={video:{}};d.tag=d.tags;d.owner={id:1,nickname:'legacy'};p.data.response=d;const h=harness(p);const r=await h.load();assert.equal(r.watchApiData.uploaderInfo.name,'legacy');assert.equal(h.calls.length,1);});
 it('does not consider absent media playable',async()=>{const p=payload();p.data.response.$watchV4.data.media=null;await assert.rejects(harness(p).load(),e=>e.info?.isPlayable===false);});
 it('preserves paid-video classification',async()=>{const p=payload();const d=p.data.response.$watchV4.data;d.media=null;d.payment.ppv.isEnabled=true;await assert.rejects(harness(p).load(),e=>e.info?.isNeedPayment===true);});
});


