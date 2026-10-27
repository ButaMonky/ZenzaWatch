// Task479: CommonsTreeLoader parity — paging, full scan, retries, abort, timeouts.
// Pre-migration fixture vs generated runtime on scripted fakes; timers fire at once.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.CommonsTreeLoader;
const before=read(spec.fixture),after=read(spec.runtime);
const NOW=Date.parse('2026-10-15T00:00:00Z');

/** scenario.route(url, n) -> {status, body, headers, jsonFail, hang, fail} */
function globalsFor(scenario){
  const log=[];let n=0;
  const netUtil={fetch:(url,opts)=>{
    const {signal,...rest}=opts||{};
    log.push(['fetch',url,rest,!!signal]);
    const r=scenario.route(url,n++);
    if(r.fail)return Promise.reject(Object.assign(Error(r.fail),{tag:r.fail}));
    if(r.hang)return new Promise(()=>{});
    const status=r.status??200;
    return Promise.resolve({status,ok:status>=200&&status<300,
      headers:{get:k=>(r.headers||{})[k]??null},
      json:async()=>{if(r.jsonFail)throw SyntaxError('bad');return structuredClone(r.body);}});
  }};
  const setTimeoutFake=(fn,ms)=>{log.push(['timer',ms]);return setTimeout(fn,0);};
  const FakeDate={now:()=>NOW,parse:s=>Date.parse(s)};
  return {log,globals:{netUtil,setTimeout:setTimeoutFake,clearTimeout,Date:FakeDate,AbortController,
    window:{console:{warn:(...a)=>{log.push(['warn',...a]);}}},Promise,Error,Object,Number,Math,String,parseInt,Set,Map,Array}};
}
async function compare(label,run,scenario={route:()=>({status:404})}){
  const a=globalsFor(scenario),b=globalsFor(scenario);
  const A=loadLegacy(before,'CommonsTreeLoader',a.globals),B=loadLegacy(after,'CommonsTreeLoader',b.globals);
  const ra=await settle(()=>run(A)),rb=await settle(()=>run(B));
  assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
  assert.deepEqual(snapshot(b.log),snapshot(a.log),label+' requests/timers/warnings');
}

const row=(id,extra={})=>({globalId:id,contentKind:'video',visibleStatus:'visible',...extra});
const rows=(from,count,kind='p')=>Array.from({length:count},(_,i)=>row(`sm${kind==='p'?1:2}${String(from+i).padStart(4,'0')}`));
const page=(kind,total,contents,status=200)=>({status:200,body:{meta:{status},data:{[kind]:{total,contents}}}});
const offsetOf=url=>Number(/_offset=(\d+)/.exec(url)[1]);
const limitOf=url=>Number(/_limit=(\d+)/.exec(url)[1]);
const kindOf=url=>/relatives\/(\w+)/.exec(url)[1];
/** A tree of `total` rows per side served exactly by offset/limit. */
const tree=(totals,overrides={})=>(url,n)=>{
  if(overrides[n])return overrides[n];
  const kind=kindOf(url),total=totals[kind];
  if(total===undefined)return {status:404};
  const off=offsetOf(url),lim=limitOf(url);
  return page(kind,total,rows(off,Math.max(0,Math.min(lim,total-off)),kind[0]));
};

test('retryAfterMs: seconds, HTTP dates and unreadable values',async()=>{
  for(const v of ['5','0',' 12 ','Wed, 15 Oct 2026 00:00:30 GMT','2026-10-14T23:00:00Z','',null,undefined,'soon',7]){
    await compare('retryAfter '+String(v),api=>api.retryAfterMs(v,NOW));
  }
  await compare('retryAfter default now',api=>api.retryAfterMs('Wed, 15 Oct 2026 00:01:00 GMT'));
  await compare('constants',api=>[api.WITH_META_DEFAULT,api.API_MAX_LIMIT,api.SCAN_PAGE_SIZE,api.META_PAGE_SIZE]);
});

test('loadRelatives / load: paging, 404, partial failure, continuation, cleanup',async()=>{
  await compare('230 children in 3 pages',api=>api.loadRelatives('sm9','children'),{route:tree({children:230})});
  await compare('not registered (404 first page)',api=>api.loadRelatives('sm9','parents'),{route:()=>({status:404})});
  await compare('404 mid scan is partial failure',api=>api.loadRelatives('sm9','children'),
    {route:tree({children:250},{1:{status:404}})});
  await compare('meta 500 first page throws',api=>api.loadRelatives('sm9','parents'),{route:()=>page('parents',3,[],500)});
  await compare('schema error',api=>api.loadRelatives('sm9','parents'),{route:()=>({body:{meta:{status:200},data:{parents:{total:'3',contents:[]}}}})});
  await compare('http 500',api=>api.loadRelatives('sm9','parents'),{route:()=>({status:500})});
  await compare('continuation from 300',api=>api.loadRelatives('sm9','children',300,{startOffset:300}),{route:tree({children:1060})});
  await compare('cap leaves nextOffset',api=>api.loadRelatives('sm9','children',100),{route:tree({children:1060})});
  await compare('empty page stops',api=>api.loadRelatives('sm9','children'),{route:()=>page('children',50,[])});
  await compare('duplicates, invalid ids and meta hints',api=>api.loadRelatives('sm9','parents',300,{withMeta:true}),{route:()=>page('parents',6,[
    row('sm1',{title:'  タイトル  ',thumbnailURL:'https://x/1.jpg',userId:12,parentsCount:2,childrenCount:-1,isEditable:true}),
    row('sm1'),null,{globalId:123},row('nm7',{contentKind:'commons'}),row('so8',{visibleStatus:'hidden',thumbnailUrl:'http://insecure'})])});
  await compare('load both sides',api=>api.load('sm9'),{route:tree({parents:2,children:5})});
  await compare('load one side fails',api=>api.load('sm9'),{route:url=>kindOf(url)==='parents'?{status:500}:page('children',1,rows(0,1,'c'))});
  await compare('load both fail throws',api=>api.load('sm9'),{route:()=>({status:500})});
  await compare('load offsets skip and continue',api=>api.load('sm9',300,{offsets:{parents:null,children:100}}),{route:tree({children:150})});
  await compare('load continuation failure',api=>api.load('sm9',300,{offsets:{parents:null,children:200}}),{route:()=>({status:503})});
});

test('scanSide / scanAll / load(fullScan): retries, abort, inconsistencies',async()=>{
  const retryLog=[];
  await compare('full scan both sides',api=>api.scanAll('sm9',{onRetry:x=>retryLog.push(x)}),{route:tree({parents:3,children:650})});
  await compare('503 then ok with Retry-After',api=>api.scanSide('sm9','children',{onRetry:()=>{}}),
    {route:tree({children:10},{0:{status:503,headers:{'Retry-After':'2'}}})});
  await compare('429 Retry-After beyond cap fails',api=>api.scanSide('sm9','children'),
    {route:()=>({status:429,headers:{'Retry-After':'120'}})});
  await compare('network errors exhaust retries',api=>api.scanSide('sm9','parents'),{route:()=>({fail:'offline'})});
  await compare('invalid json',api=>api.scanSide('sm9','parents'),{route:()=>({jsonFail:true})});
  await compare('invalid total',api=>api.scanSide('sm9','parents'),{route:()=>page('parents',-1,[])});
  await compare('total changes mid scan',api=>api.scanSide('sm9','children',{pageSize:2}),
    {route:(url,n)=>page('children',n===0?4:5,rows(offsetOf(url),2,'c'))});
  await compare('repeated page',api=>api.scanSide('sm9','children',{pageSize:2}),{route:()=>page('children',10,rows(0,2,'c'))});
  await compare('no progress (all duplicates)',api=>api.scanSide('sm9','children',{pageSize:2,jobSeen:new Set()}),
    {route:(url,n)=>page('children',10,n===0?rows(0,2,'c'):[row('sm20000'),row('sm20001'),row('sm20000')])});
  await compare('empty before end',api=>api.scanSide('sm9','children',{pageSize:2}),{route:(url,n)=>page('children',10,n===0?rows(0,2,'c'):[])});
  await compare('job cap',api=>api.scanSide('sm9','children',{pageSize:3,maxRows:6}),{route:tree({children:20})});
  await compare('404 mid scan',api=>api.scanSide('sm9','children',{pageSize:2}),{route:tree({children:9},{1:{status:404}})});
  await compare('timeout then ok',api=>api.scanSide('sm9','parents',{timeoutMs:5}),{route:tree({parents:2},{0:{hang:true}})});
  await compare('already aborted',api=>{const c=new AbortController();c.abort();return api.scanAll('sm9',{signal:c.signal});},{route:tree({parents:1})});
  await compare('fullScan via load, all fail',api=>api.load('sm9',300,{fullScan:true}),{route:()=>({status:400})});
  await compare('fullScan with offsets',api=>api.load('sm9',300,{fullScan:true,offsets:{parents:null,children:2},pageSize:2}),{route:tree({children:5})});
  assert.ok(Array.isArray(retryLog));
});

test('scanMeta: display hints by ID, stops on failure',async()=>{
  await compare('meta pages',api=>api.scanMeta('sm9','children',250).then(r=>({...r,metas:[...r.metas]})),
    {route:url=>page('children',250,rows(offsetOf(url),limitOf(url),'c').map((r,i)=>({...r,title:'t'+i})))});
  await compare('meta failure keeps partial',api=>api.scanMeta('sm9','children',250).then(r=>({...r,metas:[...r.metas]})),
    {route:(url,n)=>n===0?page('children',250,[row('sm1',{title:'a'})]):{status:400}});
  await compare('meta non-integer total',api=>api.scanMeta('sm9','parents','12').then(r=>({...r,metas:[...r.metas]})));
});
