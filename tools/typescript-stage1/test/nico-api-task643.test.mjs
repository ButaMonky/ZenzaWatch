// Task643: VideoSearch parity — snapshot query building, nvapi search paging and
// schema guard, snapshot fallback/cache/parse, owner search, owner-id lookup, sort parser.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.VideoSearch;
const before=read(spec.fixture),after=read(spec.runtime);
const SUBJECT='({NicoSearchApiV2Query, NicoSearchApiV2Loader, parseVideoSearchSortValue})';
const NOW=Date.UTC(2026,9,17,3,0,0);

class FixedDate extends Date{
  constructor(...a){if(a.length)super(...a);else super(NOW);}
  static now(){return NOW;}
}
const resp=(status,body,{headerDate=null}={})=>({
  status,
  headers:{get:k=>k==='Date'?headerDate:null},
  json:async()=>typeof body==='string'?JSON.parse(body):structuredClone(body),
  text:async()=>typeof body==='string'?body:JSON.stringify(body)
});
const nvItem=(id,extra={})=>({id,title:'T'+id,shortDescription:'d'+id,duration:125,registeredAt:'2026-10-01T00:00:00+09:00',
  count:{view:10,comment:2,mylist:1,like:3},thumbnail:{url:'u/'+id,middleUrl:'m/'+id,listingUrl:null},...extra});
const nvPage=(ids,{total=ids.length,hasNext,suggested}={})=>({meta:{status:200},data:{items:ids.map(i=>nvItem(i)),totalCount:total,
  ...(hasNext===undefined?{}:{hasNext}),...(suggested?{additionals:{suggestedVideo:nvItem(suggested)}}:{})}});
const ids=(prefix,n,from=0)=>Array.from({length:n},(_,i)=>prefix+(from+i));
const snapItem=(id,extra={})=>({contentId:id,title:'S'+id,description:'<b>desc</b> '+id,thumbnailUrl:'https://th/'+id,
  startTime:'2026-09-01T00:00:00+09:00',lengthSeconds:61,likeCounter:1,mylistCounter:2,viewCounter:3,commentCounter:4,...extra});
const snapBody=(items,total=items.length,status=200)=>({meta:{status,totalCount:total},data:items});

function world(opt={}){
  const log=[];const L=(...a)=>log.push(snapshot(a));
  // makeRoute gives each world (old/new) its own stateful route.
  const route=opt.makeRoute?opt.makeRoute():(opt.route||(()=>{throw Error('no route');}));
  const call=async(kind,url,o)=>{
    L(kind,url,o);
    const r=await route(url,kind);
    if(r instanceof Error)throw r;
    return r;
  };
  class CrossDomainGate{
    constructor(o){L('gate.new',o.baseUrl,o.origin,o.type,o.messager==='WME');}
    fetch(url){return call('gate.fetch',url);}
  }
  const cache=new Map(Object.entries(opt.cache||{}));
  class CacheStorage{
    constructor(s){L('cache.new',s==='SESSION');}
    getItem(k){L('cache.get',k);return cache.has(k)?structuredClone(cache.get(k)):null;}
    setItem(k,v,e){L('cache.set',k,v,e);cache.set(k,v);}
  }
  const net={fetch:(u,o)=>call('net.fetch',u,o)};
  const globals={CrossDomainGate,CacheStorage,WindowMessageEmitter:'WME',sessionStorage:'SESSION',
    textUtil:{dateToString:d=>'D'+d.toISOString()},
    sleep:async t=>{L('sleep',t);},
    fetch:(u,o)=>call('fetch',u,o),
    window:{console:{warn:(...a)=>L('warn',a[0]),info:(...a)=>L('info',...a),error:(...a)=>L('error',a[0])}},
    console:{log:(...a)=>L('log',...a)},
    Date:FixedDate,URLSearchParams,structuredClone};
  if(!opt.noNetUtil)globals.netUtil=net;
  return {globals,log};
}
async function compare(label,run,opt={}){
  const a=world(opt),b=world(opt);
  const A=loadLegacy(before,SUBJECT,a.globals),B=loadLegacy(after,SUBJECT,b.globals);
  const ra=await settle(()=>run(A)),rb=await settle(()=>run(B));
  assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
  assert.deepEqual(b.log,a.log,label+' side effects');
  return ra;
}
const queryView=q=>({str:q.toString(),q:q.q,targets:q.targets,sort:q.sort,order:q.order,limit:q.limit,offset:q.offset,
  fields:q.fields,context:q.context,filters:q.filters,sf:q.stringfiedFilters,hotField:q.hotField,
  hotFrom:q.hotFrom&&q.hotFrom.getTime(),hotTo:q.hotTo&&q.hotTo.getTime(),now:q.now});

test('snapshot query: params to v2 query string and filters',async()=>{
  const cases=[
    ['w',{}],['',{}],['w',{searchType:'tag',sort:'v',order:'d',page:3}],['w',{sort:'h',order:'d',_now:NOW}],
    ['w',{sort:'zz',page:'99'}],['w',{f_range:4,_now:NOW}],['w',{f_range:'1',_now:NOW}],['w',{f_range:2,_now:NOW}],
    ['w',{f_range:3,_now:NOW}],['w',{f_range:9}],['w',{l_range:1}],['w',{l_range:'2'}],['w',{l_range:3}],
    ['w',{userId:'123',channelId:'45',commentCount:'7'}],['w',{userId:'u1',channelId:'x',commentCount:'-1'}],
    ['w',{utimeFrom:1000,utimeTo:5000}],['w',{utimeFrom:1000,_now:NOW}],['w',{dateFrom:'2026-01-01',dateTo:'2026-02-01'}],
    ['w',{dateTo:'2026-02-01'}],['w',{start:'2026-01-01',end:'2026-01-31'}],['w',{start:'2026-01-01'}],
    [{searchWord:'obj',sort:'f',order:'a',f_range:1,_now:NOW},{}]
  ];
  for(const [i,[word,params]] of cases.entries()){
    await compare('query '+i,({NicoSearchApiV2Query:Q})=>queryView(new Q(word,params)));
  }
  await compare('static tables',({NicoSearchApiV2Query:Q})=>[Q.SORT,Q.F_RANGE,Q.L_RANGE]);
  await compare('missing word throws',({NicoSearchApiV2Query:Q})=>new Q());
});

test('parseVideoSearchSortValue',async()=>{
  for(const raw of [undefined,null,'','playlist','playlist,a','f','l,a','v,d,x',','])
    await compare('sort '+raw,({parseVideoSearchSortValue:p})=>p(raw));
});

test('nvapi helpers: canHandle, buildQuery, normalizeConditions, toLegacyItem',async()=>{
  const params=[{},{userId:1},{channelId:2},{commentCount:3},{sort:'h'},{sort:'f',order:'a'},{sort:'registeredAt',order:'asc'},
    {sort:'p'},{searchType:'tag',l_range:1,f_range:4,_now:NOW},{l_range:'2',f_range:'3',_now:NOW},{f_range:5,_now:NOW},
    {f_range:2,_now:NOW},{f_range:1,_now:NOW},{start:'2026-01-02',end:'2026-01-03'},{start:'bad',end:'2026/01/03'},
    {dateFrom:'2026-01-01',dateTo:'2026-01-05',utimeFrom:1700000000,utimeTo:1700001000},{genre:'all'},{genre:'game'},
    {selectContentType:'long',channelVideoListingStatus:'included',kind:'any'},
    {selectContentType:'x',channelVideoListingStatus:'none',kind:'user'},{selectContentType:'',kind:null}];
  for(const [i,p] of params.entries()){
    await compare('helpers '+i,({NicoSearchApiV2Loader:Ld})=>{
      const n=Ld.nvapi;
      return [n.canHandle(p),n.buildQuery('word',p),n.normalizeConditions(p)];
    });
  }
  await compare('helper defaults',({NicoSearchApiV2Loader:Ld})=>[Ld.nvapi.canHandle(),Ld.nvapi.normalizeConditions()]);
  for(const item of [nvItem('sm1'),nvItem('sm2',{duration:0,count:null,thumbnail:null,registeredAt:null,shortDescription:null}),
    nvItem('sm3',{thumbnail:{listingUrl:'L',middleUrl:'M',url:'U'},duration:3599})])
    await compare('toLegacyItem '+item.id,({NicoSearchApiV2Loader:Ld})=>Ld.nvapi.toLegacyItem(item));
});

const nvRoute=pages=>url=>{
  if(!url.startsWith('https://nvapi.nicovideo.jp/v2/search/video?'))return Error('unexpected '+url);
  const page=Number(new URL(url).searchParams.get('page'));
  const r=pages[page];
  if(r===undefined)return Error('no page '+page);
  if(r instanceof Error)return r;
  return resp(r.status||200,r.body||r);
};

test('nvapi search: paging, suggested video, offsets, limits and partial results',async()=>{
  await compare('single page',({NicoSearchApiV2Loader:Ld})=>Ld.search('word',{sort:'v'}),
    {route:nvRoute({1:nvPage(ids('sm',3),{suggested:'sm1'})})});
  await compare('object word form',({NicoSearchApiV2Loader:Ld})=>Ld.search({searchWord:'w',searchType:'tag'}),
    {route:nvRoute({1:nvPage(ids('sm',2),{hasNext:false})})});
  const three=await compare('searchMore 3 pages',({NicoSearchApiV2Loader:Ld})=>Ld.searchMore('word',{sort:'f'},250),
    {route:nvRoute({1:nvPage(ids('a',100),{total:400}),2:nvPage(ids('b',100),{total:400}),3:nvPage(ids('c',100),{total:400})})});
  assert.equal(three.value.list.length,250);
  assert.equal(three.value.resultState,'truncated');
  await compare('page offset skip',({NicoSearchApiV2Loader:Ld})=>Ld.searchMore('word',{page:5},120),
    {route:nvRoute({2:nvPage(ids('b',100),{total:400,suggested:'zz'}),3:nvPage(ids('c',100),{total:400})})});
  await compare('hasNext false stops',({NicoSearchApiV2Loader:Ld})=>Ld.searchMore('word',{},500),
    {route:nvRoute({1:nvPage(ids('a',100),{total:1000}),2:nvPage(ids('b',100),{total:1000,hasNext:false}),
      3:nvPage(ids('c',100),{total:1000}),4:nvPage(ids('d',100),{total:1000}),5:nvPage(ids('e',100),{total:1000})})});
  const partial=await compare('middle page fails -> partial',({NicoSearchApiV2Loader:Ld})=>Ld.searchMore('word',{},500),
    {route:nvRoute({1:nvPage(ids('a',100),{total:1000}),2:nvPage(ids('b',100),{total:1000}),3:Error('net'),
      4:nvPage(ids('d',100),{total:1000}),5:nvPage(ids('e',100),{total:1000})})});
  assert.deepEqual([partial.value.resultState,partial.value.failedPage,partial.value.list.length],['partial',3,200]);
  await compare('empty',({NicoSearchApiV2Loader:Ld})=>Ld.searchMore('none',{}),{route:nvRoute({1:nvPage([],{total:0})})});
  await compare('api page limit',({NicoSearchApiV2Loader:Ld})=>Ld.searchMore('w',{page:157},5000),
    {route:nvRoute({50:nvPage(ids('z',100),{total:999999})})});
  await compare('max limit parsing',({NicoSearchApiV2Loader:Ld})=>Ld.searchMore('w',{},'abc'),
    {route:nvRoute({1:nvPage(ids('a',100),{total:100})})});
  await compare('no netUtil uses fetch',({NicoSearchApiV2Loader:Ld})=>Ld.search('w',{}),
    {noNetUtil:true,route:nvRoute({1:nvPage(ids('a',1))})});
});

const snapshotRoute=(handlers={})=>(url,kind)=>{
  if(url.startsWith('https://nvapi.nicovideo.jp/v2/search/video?'))return handlers.nvapi?handlers.nvapi(url):Error('nvapi down');
  if(url==='https://snapshot.search.nicovideo.jp/api/v2/snapshot/version')
    return resp(200,{last_modified:'2026-10-16T20:00:00Z'},{headerDate:'Sat, 17 Oct 2026 03:00:00 GMT'});
  if(url.startsWith('https://snapshot.search.nicovideo.jp/api/v2/snapshot/video/contents/search?'))
    return handlers.search?handlers.search(url):resp(200,snapBody([snapItem('sm9'),snapItem('so1',{description:''})],2));
  if(url.startsWith('https://nvapi.nicovideo.jp/v3/users/'))return handlers.user?handlers.user(url):Error('no user');
  return Error('unexpected '+kind+' '+url);
};

test('snapshot fallback: schema/HTTP/meta errors, cache, parse and error statuses',async()=>{
  const bad=body=>({nvapi:()=>resp(200,body)});
  await compare('schema error falls back',({NicoSearchApiV2Loader:Ld})=>Ld.search('w',{}),
    {route:snapshotRoute(bad({meta:{status:200},data:{items:[{id:''}],totalCount:1}}))});
  for(const [i,body] of [{meta:{status:200},data:{items:[],totalCount:-1}},{meta:{status:200},data:{items:[],totalCount:1,hasNext:'y'}},
    {meta:{status:200},data:{items:[],totalCount:0,additionals:[]}},{meta:{status:200},data:{items:[],totalCount:0,additionals:{suggestedVideo:{id:5}}}},
    {meta:{status:200},data:{items:[nvItem('a',{duration:-1})],totalCount:1}},{meta:{status:200},data:{items:[nvItem('a',{count:[]})],totalCount:1}},
    {meta:{status:403,errorCode:'FORBIDDEN'}},{meta:{status:200}},null].entries())
    await compare('bad nvapi body '+i,({NicoSearchApiV2Loader:Ld})=>Ld.search('w',{}),{route:snapshotRoute(bad(body))});
  await compare('http 500 falls back',({NicoSearchApiV2Loader:Ld})=>Ld.search('w',{}),
    {route:snapshotRoute({nvapi:()=>resp(500,{meta:{status:200},data:{items:[],totalCount:0}})})});
  await compare('unhandled params go to snapshot',({NicoSearchApiV2Loader:Ld})=>Ld.search('w',{commentCount:5}),{route:snapshotRoute()});
  await compare('useSnapshotSearch',({NicoSearchApiV2Loader:Ld})=>Ld.search('w',{useSnapshotSearch:true,sort:'v',order:'d'}),{route:snapshotRoute()});
  await compare('cache hit after first',async({NicoSearchApiV2Loader:Ld})=>{
    const r1=await Ld.searchBySnapshot('w',{});
    const r2=await Ld.searchBySnapshot('w',{});
    return [r1,r2];
  },{route:snapshotRoute()});
  for(const status of [400,500,503,418])
    await compare('snapshot status '+status,({NicoSearchApiV2Loader:Ld})=>Ld.searchBySnapshot('w',{}),
      {route:snapshotRoute({search:()=>resp(200,snapBody([],0,status))})});
  await compare('snapshot invalid json',({NicoSearchApiV2Loader:Ld})=>Ld.searchBySnapshot('w',{}),
    {route:snapshotRoute({search:()=>resp(200,'{oops')})});
  await compare('snapshot middle-thumbnail ids',({NicoSearchApiV2Loader:Ld})=>Ld.searchBySnapshot('w',{}),
    {route:snapshotRoute({search:()=>resp(200,snapBody([snapItem('sm30000000'),snapItem('sm100'),snapItem('nm5',{lengthSeconds:0})]))})});
  // The ".M" thumbnail case was a legacy crash fixed by Task644 (see the Task644 tests below).
});

test('searchMore via snapshot: paging with waits and unapplied conditions',async()=>{
  const paged=url=>{
    const offset=Number(new URL(url).searchParams.get('_offset'));
    return resp(200,snapBody(offset>=300?[]:ids('sm',2,offset).map(i=>snapItem(i)),260));
  };
  await compare('snapshot paging',({NicoSearchApiV2Loader:Ld})=>Ld.searchMore('w',{useSnapshotSearch:true,genre:'game',
    selectContentType:'long',kind:'all',channelVideoListingStatus:'x'},250),{route:snapshotRoute({search:paged})});
  await compare('snapshot paging from page 3',({NicoSearchApiV2Loader:Ld})=>Ld.searchMoreBySnapshot('w',{page:3},'1000'),
    {route:snapshotRoute({search:paged})});
  await compare('snapshot small result',({NicoSearchApiV2Loader:Ld})=>Ld.searchMoreBySnapshot('w',null),{route:snapshotRoute()});
  await compare('non-string word skips nvapi',({NicoSearchApiV2Loader:Ld})=>Ld.searchMore({searchWord:'x'},{}),{route:snapshotRoute()});
});

test('owner search and owner-id lookup',async()=>{
  const userPage=(n,total,prefix)=>({meta:{status:200},data:{totalCount:total,items:ids(prefix,n).map((id,i)=>({essential:nvItem(id,{
    duration:i*200,registeredAt:new Date(NOW-i*3600e3*30).toISOString(),count:{view:i,comment:9-i,mylist:i%3,like:i%2}})}))}});
  const makeUser=()=>{
    let failOnce=true;
    return url=>{
      const page=Number(new URL(url).searchParams.get('page'));
      if(page===3&&failOnce){failOnce=false;return Error('flaky');}
      if(page===4)return Error('down');
      return resp(200,userPage(5,450,'p'+page+'_'));
    };
  };
  const user=url=>makeUser()(url);
  const search=url=>{
    const q=new URL(url).searchParams;
    const contentIds=[...q.keys()].filter(k=>k.startsWith('filters[contentId]')).map(k=>q.get(k));
    return resp(200,{meta:{status:200},data:contentIds.filter((_,i)=>i%2===0).map(contentId=>({contentId}))});
  };
  for(const [i,p] of [{userId:'u-77',sort:'v',order:'a'},{userId:77,sort:'r',l_range:1},{userId:77,l_range:2,f_range:4},
    {userId:77,sort:'zz',f_range:3,searchType:'tag'},{userId:77,sort:'likeCount'},{userId:77,sort:'l'},{userId:77,sort:'m'}].entries()){
    await compare('owner '+i,({NicoSearchApiV2Loader:Ld})=>Ld.searchMore('word',p,7),
      {makeRoute:()=>snapshotRoute({user:makeUser(),search})});
  }
  await compare('channel only',({NicoSearchApiV2Loader:Ld})=>Ld.searchMore('w',{channelId:5}),{route:snapshotRoute()});
  await compare('no digits',({NicoSearchApiV2Loader:Ld})=>Ld.searchByOwner('w',{userId:'abc'}),{route:snapshotRoute()});
  await compare('user api fails',({NicoSearchApiV2Loader:Ld})=>Ld.searchByOwner('w',{userId:1}),
    {route:snapshotRoute({user:()=>resp(404,{meta:{status:404}})})});
  await compare('snapshot step fails',({NicoSearchApiV2Loader:Ld})=>Ld.searchByOwner('w',{userId:1}),
    {route:snapshotRoute({user,search:()=>resp(200,{meta:{status:500}})})});
  const lookup=async(Ld,list)=>[...(await Ld.lookupOwnerIds(list)).entries()];
  await compare('lookup',({NicoSearchApiV2Loader:Ld})=>lookup(Ld,['sm1','sm1',null,'so2',3]),
    {route:snapshotRoute({search:()=>resp(200,{meta:{status:200},data:[{contentId:'sm1',userId:5,channelId:null},{contentId:'so2',channelId:9}]})})});
  await compare('lookup empty',({NicoSearchApiV2Loader:Ld})=>lookup(Ld,null),{route:snapshotRoute()});
  await compare('lookup bad response',({NicoSearchApiV2Loader:Ld})=>lookup(Ld,['sm1']),
    {route:snapshotRoute({search:()=>resp(200,'not json')})});
});

test('declarations shape: only the allowlisted top-level lines and exports render',async()=>{
  const {renderNicoLegacy}=await import('../scripts/sync-nico-api.mjs');
  const emitted=read('tools/typescript-stage1/.generated/nico/VideoSearch.js');
  const ok=renderNicoLegacy(spec,emitted);
  assert.ok(ok.includes('//===BEGIN===\nconst { NicoSearchApiV2Query, NicoSearchApiV2Loader } = (function () {'));
  assert.ok(ok.endsWith('//===END===\nexport {\n  NicoSearchApiV2Query,\n  NicoSearchApiV2Loader,\n  parseVideoSearchSortValue\n};\n'));
  const exp='\nexport { NicoSearchApiV2Query, NicoSearchApiV2Loader, parseVideoSearchSortValue };';
  const body=emitted.replace(/\r\n/g,'\n').trimEnd().slice(0,-exp.length);
  for(const bad of [
    body+'\nconst extra = 1;'+exp,
    'let leak = 0;\n'+body+exp,
    body.replace('const parseVideoSearchSortValue = (raw) => {','function parseVideoSearchSortValue(raw) {')+exp,
    body+'\nexport { NicoSearchApiV2Query, NicoSearchApiV2Loader };'
  ])assert.throws(()=>renderNicoLegacy(spec,bad),/NICO_API_SYNC_VIDEOSEARCH_UNEXPECTED_(TOP_LEVEL|EXPORT|OUTPUT)/);
});

// Task644: intentional fixes. Each test runs old and new side by side and asserts
// the legacy defect and the fixed behavior; everything else stays covered above.
async function both(run,opt={}){
  const a=world(opt),b=world(opt);
  const A=loadLegacy(before,SUBJECT,a.globals),B=loadLegacy(after,SUBJECT,b.globals);
  return {legacy:await settle(()=>run(A)),fixed:await settle(()=>run(B)),legacyLog:a.log,fixedLog:b.log};
}

test('Task644 VS-RANGE-SORT-001: start/length ranges are ordered numerically',async()=>{
  const params={dateFrom:'1999-01-01T00:00:00Z',dateTo:'2026-01-01T00:00:00Z'};
  const {legacy,fixed}=await both(({NicoSearchApiV2Query:Q})=>new Q('w',params).filters);
  const from=Date.parse(params.dateFrom),to=Date.parse(params.dateTo);
  assert.deepEqual(snapshot(legacy.value[0]),{field:'startTime',type:'range',from:to,to:from},'legacy swapped (string sort)');
  assert.deepEqual(snapshot(fixed.value[0]),{field:'startTime',type:'range',from,to});
  // Same-width values were already right and stay unchanged.
  const same=await both(({NicoSearchApiV2Query:Q})=>[new Q('w',{utimeFrom:2000,utimeTo:1000}).filters,
    new Q('w',{l_range:1}).filters,new Q('w',{dateFrom:'2026-02-01',dateTo:'2026-01-01'}).stringfiedFilters]);
  assert.deepEqual(snapshot(same.fixed),snapshot(same.legacy));
  const len=await both(({NicoSearchApiV2Query:Q})=>{const q=new Q('w',{});return [q._buildLengthSecondsRangeFilter({from:1200,to:300}),
    q._buildLengthSecondsRangeFilter({from:999,to:1000})];});
  assert.deepEqual(snapshot(len.legacy.value[1]),{field:'lengthSeconds',type:'range',from:1000,to:999});
  assert.deepEqual(snapshot(len.fixed.value),[{field:'lengthSeconds',type:'range',from:300,to:1200},
    {field:'lengthSeconds',type:'range',from:999,to:1000}]);
});

test('Task644 VS-SNAPSHOT-THUMB-002: ".M" snapshot thumbnails no longer break the search',async()=>{
  const route=snapshotRoute({search:()=>resp(200,snapBody([snapItem('sm1',{thumbnailUrl:'https://th/1.M'}),
    snapItem('sm2',{thumbnailUrl:'https://th/2.Mx'}),snapItem('sm3')]))});
  const {legacy,fixed}=await both(({NicoSearchApiV2Loader:Ld})=>Ld.searchBySnapshot('w',{}),{route});
  assert.equal(legacy.ok,false);
  assert.match(String(legacy.error&&legacy.error.message),/replace/);
  assert.equal(fixed.ok,true);
  const items=Array.from(fixed.value.list,i=>[i.id,i.thumbnail_url,i.is_middle_thumbnail]);
  assert.deepEqual(items,[['sm1','https://th/1',true],['sm2','https://th/2.Mx',true],['sm3','https://th/sm3',undefined]]);
});

test('Task644 VS-PARAMS-MUTATE-003: snapshot paging leaves the caller params untouched',async()=>{
  const paged=url=>{
    const offset=Number(new URL(url).searchParams.get('_offset'));
    return resp(200,snapBody(offset>=300?[]:ids('sm',2,offset).map(i=>snapItem(i)),260));
  };
  const run=async({NicoSearchApiV2Loader:Ld})=>{
    const params={useSnapshotSearch:true,page:1,sort:'f'};
    const r=await Ld.searchMore('w',params,250);
    return {callerPage:params.page,resultPage:r.params.page,sameObject:r.params===params,count:r.list.length};
  };
  const {legacy,fixed,legacyLog,fixedLog}=await both(run,{route:snapshotRoute({search:paged})});
  assert.deepEqual(legacy.value,{callerPage:9,resultPage:9,sameObject:true,count:6},'legacy rewrote the caller page');
  assert.deepEqual(fixed.value,{callerPage:1,resultPage:9,sameObject:false,count:6});
  assert.deepEqual(fixedLog,legacyLog,'requests, waits and logs unchanged');
});

test('Task647 VS-PARSE-META-006: snapshot bodies without meta fail like unparsable JSON',async()=>{
  for(const body of ['{}','[]','"x"','{"meta":null}','{"meta":{"status":200,"totalCount":1}}','{"meta":{"status":200},"data":{}}']){
    const route=snapshotRoute({search:()=>resp(200,body)});
    const {legacy,fixed}=await both(({NicoSearchApiV2Loader:Ld})=>Ld.searchBySnapshot('w',{}),{route});
    assert.equal(legacy.ok,false,body);
    assert.equal(fixed.ok,false,body);
    assert.deepEqual(snapshot(fixed.error),{description:'UNKNOWN ERROR',status:'fail'},body);
  }
  // A well-formed body is unchanged.
  const ok=await both(({NicoSearchApiV2Loader:Ld})=>Ld.searchBySnapshot('w',{}),{route:snapshotRoute()});
  assert.deepEqual(snapshot(ok.fixed),snapshot(ok.legacy));
});
