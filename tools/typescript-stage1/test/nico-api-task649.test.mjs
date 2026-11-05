// Task649: VideoInfoLoader parity — watch v4 boundary (schema, lazy owner/series,
// comment/media/payment normalization), legacy conversion, owner supplement,
// payment / linked channel paths and retries. Timers run immediately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.VideoInfoLoader;
const before=read(spec.fixture),after=read(spec.runtime);

const res=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>{if(body instanceof Error)throw body;return structuredClone(body);}});
const v4=(over={})=>{
  const data={
    client:{watchId:'sm9',watchTrackId:'TRK'},
    video:{id:'sm9',title:'T',description:'D',duration:320,registeredAt:'2007-03-06T00:33:00+09:00',count:{view:1,comment:2,mylist:3,like:4},
      thumbnail:{url:'u',middleUrl:'m',largeUrl:'l',player:'p'},isLikedByViewer:true},
    player:{initialPlayback:{type:'resume',positionSec:12}},
    genre:{key:'game',label:'ゲーム'},
    tags:{edit:{isEditable:true},items:[{name:'tag1',isLocked:true,isNicodicArticleExists:false}]},
    comment:{nvComment:{server:'https://nv',threadKey:'TK',params:{language:'ja-jp'}},ng:{channel:[1],owner:[2]},
      threads:[{id:1,fork:'main',isPostTarget:true,isActive:true,isDefaultPostTarget:false,isThreadkeyRequired:false,isOwnerThread:false,label:'default'},
        {id:1,fork:'owner',isOwnerThread:true}],
      layers:[{index:0,components:[{threadId:1,fork:'main'},{threadId:1,fork:'owner'}]}]},
    media:{accessRightKey:'ARK',contents:{videos:[{id:'v1'}]},isStoryboardAvailable:true},
    payment:{admission:{isEnabled:false},ppv:{isEnabled:false},premium:{isEnabled:false}},
    viewer:{id:77,isPremium:true},
    lazy:{authKey:'AK'},
    metadata:{jsonLd:{owner:{type:'user',id:'4',name:'中の',iconUrl:'https://icon'}}},
    ...over
  };
  for(const k of Object.keys(over))if(over[k]===undefined)delete data[k];
  return {data:{response:{$watchV4:{data}}}};
};
function world(opt={}){
  const log=[],diagnostics=[];const L=(...a)=>log.push(snapshot(a));
  const diagnostic=(level,args)=>{
    diagnostics.push(snapshot([level,...args]));
    // Keep the historical side-effect trace, while separately checking all
    // diagnostic arguments rather than just the previous label-only capture.
    if(level==='error')L(level,args[0],args[1]);else L(level,args[0]);
  };
  const routes=opt.routes||{};
  const counters={};
  const netUtil={fetch:(url,o)=>{
    L('fetch',url,o&&{method:o.method,credentials:o.credentials,timeout:o.timeout,headers:o.headers,body:o.body});
    const key=Object.keys(routes).find(k=>url.includes(k));
    if(!key)return Promise.reject(Error('unrouted '+url));
    const r=routes[key];
    const n=counters[key]=(counters[key]||0)+1;
    const v=typeof r==='function'?r(n,url):r;
    return v instanceof Error?Promise.reject(v):Promise.resolve(v);
  }};
  class CacheStorage{constructor(){L('cache.new');}setItem(k,v,e){L('cache.set',k,v,e);}}
  const globals={netUtil,CacheStorage,sessionStorage:{},
    nicoUtil:{hasLargeThumbnail:id=>id==='sm9'},
    emitter:{emitAsync:(...a)=>L('emit',a[0],a[2],a[3])},
    debug:{},Config:{getValue:k=>{L('config',k);return opt.linked===true;}},
    CommentPostTarget:{select:(threads,issues)=>{L('select',threads.length,issues);const t=threads.find(x=>x.isDefaultPostTarget);
      return {defaultThread:t||null,threadId:t?t.id:null,canPost:!!t,postUnavailableReason:t?null:'no-target',optionalThreads:[]};}},
    URLSearchParams,
    console:{log:()=>{}},
    window:{console:{warn:(...a)=>diagnostic('warn',a),info:(...a)=>diagnostic('info',a),error:(...a)=>diagnostic('error',a),log:()=>{},time:()=>{},timeEnd:()=>{}}},
    setTimeout:(fn,ms)=>{L('setTimeout',ms);return setTimeout(fn,0);},
    Promise,Object,Array,String,Number,Error,JSON};
  if(opt.snapshotOwner!==undefined)globals.NicoSearchApiV2Loader={lookupOwnerIds:async ids=>{L('lookup',ids);
    if(opt.snapshotOwner instanceof Error)throw opt.snapshotOwner;return new Map(opt.snapshotOwner?[[ids[0],{userId:opt.snapshotOwner}]]:[]);}};
  return {globals,log,diagnostics};
}
const diagnosticReasons=['network','forbidden','not found','flv','need payment','watch api','cancelled'];
// Approved privacy projection of the historical error trace. This is applied
// only to the old fixture; current output must match the exact bounded shape.
const projectedError=error=>({
  reason:diagnosticReasons.includes(error.reason)?error.reason:'unknown',
  statusCode:Number.isInteger(error.statusCode)&&error.statusCode>=100&&error.statusCode<=599?error.statusCode:null,
  isPlayable:typeof error.isPlayable==='boolean'?error.isPlayable:{$undefined:true},
  isNeedPayment:typeof error.isNeedPayment==='boolean'?error.isNeedPayment:{$undefined:true}
});
function assertPrivateDiagnostics(events,watchId){
  for(const event of events){
    const [level,label,...args]=event;
    if(['投稿者IDを補完しました','投稿者IDを補完できませんでした',
      '投稿者IDの補完(snapshot)に失敗','resolveMissingOwner failed'].includes(label)){
      assert.deepEqual(args,[],'owner diagnostics use fixed labels without IDs/errors');
    }
    if(label==='%cloadLinkedChannelVideoInfo')assert.deepEqual(args,['background: cyan']);
    if(level==='error'||label==='watch api fail'){
      let summary;
      if(level==='error'){
        assert.equal(label,'watch api error');assert.equal(args.length,1);
        assert.deepEqual(Object.keys(args[0]).sort(),['err','isRetry']);
        assert.equal(typeof args[0].isRetry,'boolean');summary=args[0].err;
      }else{assert.equal(args.length,1);summary=args[0];}
      assert.deepEqual(Object.keys(summary).sort(),['isNeedPayment','isPlayable','reason','statusCode']);
      assert(diagnosticReasons.includes(summary.reason)||summary.reason==='unknown');
      assert(summary.statusCode===null||(Number.isInteger(summary.statusCode)&&summary.statusCode>=100&&summary.statusCode<=599));
      for(const key of ['isPlayable','isNeedPayment']){
        if(typeof summary[key]!=='boolean')assert.deepEqual(summary[key],{$undefined:true});
      }
    }
  }
  const text=JSON.stringify(events);
  for(const privateValue of [watchId,'PRIVATE_TASK649_CONSOLE_SECRET','TRK','ARK','TK']){
    assert.equal(text.includes(privateValue),false,'private value in Watch diagnostics: '+privateValue);
  }
}
async function compare(label,watchId,opt={},options={}){
  const a=world(opt),b=world(opt);
  const A=loadLegacy(before,'VideoInfoLoader',a.globals),B=loadLegacy(after,'VideoInfoLoader',b.globals);
  const ra=await settle(()=>A.load(watchId,{...options})),rb=await settle(()=>B.load(watchId,{...options}));
  assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
  // Task904 intentionally moved watch metadata from legacy JSON to the HTML page.
  // Keep every transport/rights/retry/cache/event comparison. Only the known
  // owner-label and bounded error diagnostic changes differ from the fixture.
  const normalized=(events,legacy=false)=>events.map(event=>{
    if(legacy&&event[0]==='info'&&event[1]==='%c投稿者IDを補完しました')
      return ['info','投稿者IDを補完しました'];
    if(legacy&&event[0]==='error'&&event[1]==='err')
      return ['error','watch api error',{err:projectedError(event[2].err),isRetry:event[2].isRetry}];
    if (event[0]!=='fetch' ||
        typeof event[1]!=='string' ||
        !event[1].startsWith('https://www.nicovideo.jp/watch/')) return event;
    const url=new URL(event[1]);
    if (url.searchParams.get('responseType')==='json') url.searchParams.delete('responseType');
    return [event[0],url.toString(),...event.slice(2)];
  });
  assert.deepEqual(normalized(b.log),normalized(a.log,true),label+' side effects');
  assertPrivateDiagnostics(b.diagnostics,watchId);
  return ra;
}
const LAZY='/v4/watch/lazy/',WATCH='www.nicovideo.jp/watch/',NICOAD='api.nicoad.nicovideo.jp',DANIME='channelVideoDAnimeLinks';

test('watch v4 success paths and owner sources',async()=>{
  const ok=await compare('lazy user owner + series','sm9',{routes:{[WATCH]:res(200,v4()),
    [LAZY]:res(200,{meta:{status:200},data:{owner:{type:'user',id:4,nickname:'N',icon:{url:'I'}},series:{id:5}}})}});
  assert.equal(ok.ok,true);
  await compare('lazy channel owner','so1',{routes:{[WATCH]:res(200,v4()),
    [LAZY]:res(200,{meta:{status:200},data:{owner:{type:'channel',id:'ch1',name:'C',thumbnail:{smallUrl:'s'}}}})}});
  await compare('lazy fails, jsonLd user','sm9',{routes:{[WATCH]:res(200,v4()),[LAZY]:Error('net')}});
  await compare('jsonLd channel, no lazy key','so2',{routes:{[WATCH]:res(200,v4({lazy:undefined,metadata:{jsonLd:{owner:{type:'channel',id:'ch9',name:'C9'}}}}))}});
  await compare('no owner -> nicoad supplement','sm9',{routes:{[WATCH]:res(200,v4({lazy:undefined,metadata:undefined})),
    [NICOAD]:res(200,{data:{id:'sm9',ownerId:44,ownerName:'O',ownerIcon:'OI'}})}});
  await compare('no owner -> snapshot supplement','sm9',{snapshotOwner:55,routes:{[WATCH]:res(200,v4({lazy:undefined,metadata:undefined})),[NICOAD]:res(404,{})}});
  await compare('no owner, nothing found','sm9',{snapshotOwner:null,routes:{[WATCH]:res(200,v4({lazy:undefined,metadata:undefined})),[NICOAD]:Error('x')}});
  await compare('snapshot lookup throws','sm9',{snapshotOwner:Error('PRIVATE_TASK649_CONSOLE_SECRET'),routes:{[WATCH]:res(200,v4({lazy:undefined,metadata:undefined})),[NICOAD]:res(500,{})}});
  await compare('partial comment structure','sm9',{routes:{[WATCH]:res(200,v4({comment:{nvComment:{server:'s'},threads:'x',layers:[{noComponents:1}]},
    lazy:undefined}))}});
  await compare('no comment at all','sm9',{routes:{[WATCH]:res(200,v4({comment:undefined,lazy:undefined}))}});
  await compare('economy option','sm9',{routes:{[WATCH]:res(200,v4({lazy:undefined}))}},{economy:true});
});

test('watch errors, schema, payment and linked channel video',async()=>{
  for(const [label,resp] of [['not found',{data:{response:{$watchV4:{data:{errorCode:'NOT_FOUND',statusCode:404}}}}}],
    ['forbidden',{data:{response:{$watchV4:{data:{errorCode:'FORBIDDEN',reasonCode:'X'}}}}}],
    ['admin deleted',{data:{response:{errorCode:'GONE',reasonCode:'ADMINISTRATOR_DELETE_VIDEO'}}}],
    ['deleted message',{data:{response:{errorCode:'GONE',deletedMessage:'消えた'}}}],
    ['schema',v4({video:{id:'',title:'t'}})],['schema tags',v4({tags:{items:[1]}})],
    ['no response',{data:{}}]])
    await compare(label,'sm9',{routes:{[WATCH]:res(200,resp)}});
  const pay=p=>v4({lazy:undefined,media:{},payment:p});
  await compare('premium only','sm9',{routes:{[WATCH]:res(200,pay({premium:{isEnabled:true}}))}});
  await compare('member only','so1',{routes:{[WATCH]:res(200,pay({admission:{isEnabled:true}}))}});
  await compare('not supported','sm9',{routes:{[WATCH]:res(200,pay({}))}});
  await compare('need payment (both free flags)','so1',{routes:{[WATCH]:res(200,pay({ppv:{isEnabled:true},premium:{isEnabled:true},admission:{isEnabled:true}}))}});
  const anime=v4({lazy:undefined,media:{},genre:{key:'anime',label:'アニメ'},payment:{ppv:{isEnabled:true}}});
  await compare('anime linked disabled','so1',{routes:{[WATCH]:res(200,anime)}});
  await compare('anime linked member video','so1',{linked:true,routes:{
    [DANIME]:res(200,{data:{items:[{isChannelMember:false,linkedVideoId:'so5'},{isChannelMember:true,linkedVideoId:'so6'}]}}),
    [WATCH]:n=>n===1?res(200,anime):res(200,v4({lazy:undefined,client:{watchId:'so6'},video:{...v4().data.response.$watchV4.data.video,id:'so6'}}))}});
  await compare('anime linked list fails','so1',{linked:true,routes:{[DANIME]:Error('x'),[WATCH]:res(200,anime)}});
  // 'anime linked same video' changed intentionally in Task650 (tested below).
});

test('Task650 VI-LINKED-REJECT-001: a linked video with the same ID reports the payment error',async()=>{
  const anime=v4({lazy:undefined,media:{},genre:{key:'anime',label:'アニメ'},payment:{ppv:{isEnabled:true},premium:{isEnabled:true}}});
  const opt={linked:true,routes:{[DANIME]:res(200,{data:{items:[{isChannelMember:true,linkedVideoId:'sm9'}]}}),[WATCH]:res(200,anime)}};
  const run=async code=>{const w=world(opt);const L=loadLegacy(code,'VideoInfoLoader',w.globals);
    const r=await settle(()=>L.load('sm9',{}));return {r,fetches:w.log.filter(e=>e[0]==='fetch').length};};
  const legacy=await run(before),fixed=await run(after);
  assert.equal(legacy.r.ok,false);
  assert.equal(legacy.r.error.name,'TypeError','legacy crashed reading err.reason');
  assert.equal(fixed.r.ok,false);
  assert.equal(fixed.r.error.message,'この動画は有料です (プレミアム会員無料)');
  assert.equal(fixed.r.error.watchId,'sm9');
  assert.ok(fixed.r.error.info,'payment error keeps its info');
  assert.equal(fixed.fetches,2,'watch + d-anime list only; no linked watch request');
});

test('network retry and JSON failures',async()=>{
  await compare('network then success','sm9',{routes:{[WATCH]:n=>n===1?Error('offline'):res(200,v4({lazy:undefined}))}});
  await compare('network twice','sm9',{routes:{[WATCH]:Error('offline')}});
  await compare('bad json then bad json','sm9',{routes:{[WATCH]:res(200,Error('json'))}});
});
