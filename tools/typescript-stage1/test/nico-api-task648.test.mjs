// Task648: ThreadLoader parity — thread load (retries, language fallback, schema,
// abort), posting (key, packet, ack, retry-token, unknown outcome), delete, nicoru.
// The 130 root tests that execute this section (CommentPost*, LogSafety, PostContract,
// PostKeyLanguage, CommentRequestLifetime ...) cover the generated runtime as well.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.ThreadLoader;
const before=read(spec.fixture),after=read(spec.runtime);
// Task780 adds this dependency; use its real validator for legacy no-challenge parity.
const challengeWire=loadLegacy(read(NICO_API_BY_NAME.CommentPostWire.runtime),'CommentPostWire',{});

const json=(status,body,headers={})=>({status,headers:{get:k=>headers[k]??null},json:async()=>{if(body instanceof Error)throw body;return structuredClone(body);}});
const threadsBody=(fork='main')=>({meta:{status:200},data:{globalComments:[{count:10}],
  threads:[{id:'1',fork,commentCount:3,comments:[]},{id:'1',fork:'easy',commentCount:2,comments:[]}]}});
function world(opt={}){
  const log=[];const L=(...a)=>log.push(snapshot(a));
  const responses=[...(opt.responses||[])];
  const posts=[...(opt.posts||[])];
  const next=(url)=>{const r=responses.shift();if(r===undefined)return Promise.reject(Error('no response for '+url));
    return r instanceof Error?Promise.reject(r):Promise.resolve(typeof r==='function'?r(url):r);};
  const netUtil={fetch:(url,o)=>{L('fetch',String(url),o&&{method:o.method,headers:o.headers,body:o.body,credentials:o.credentials,signal:!!o.signal});return next(url);}};
  const CommentPostWire={
    getPostKey:async(id,lang)=>{L('wire.getPostKey',id,lang);if(opt.postKeyFails)throw {status:403,errorCode:'FORBIDDEN'};return opt.postKey===undefined?{postKey:'PK'}:opt.postKey;},
    readPostKey:v=>v&&typeof v.postKey==='string'&&v.postKey.trim()?v.postKey:null,
    readChallenge:challengeWire.readChallenge,
    buildPacket:({text,cmd,vpos,postKey,videoId})=>({packet:JSON.stringify({body:text,commands:(cmd||'').split(' ').filter(Boolean),vposMs:vpos*10,postKey,videoId}),commandCount:(cmd||'').split(' ').filter(Boolean).length,hasBlankCommand:false}),
    postComment:async(url,body)=>{L('wire.post',String(url),body);const r=posts.shift();if(r&&r.throw)throw r.throw;return r?r.ack:{no:5,id:'x'};},
    parseAcknowledgement:v=>v&&typeof v.no==='number'?{no:v.no,id:v.id}:null,
    classifyPostFailure:(e,retrying)=>{const code=e&&e.result&&e.result.errorCode;
      if(e&&e.kind)return {statusCode:undefined,errorCode:undefined,action:'unknown'};
      if(code==='INVALID_TOKEN'&&!retrying)return {statusCode:400,errorCode:code,action:'retry-token'};
      return {statusCode:e&&e.result&&e.result.status,errorCode:code,action:'fail'};},
    fetchJsonWithin:()=>{throw Error('unused');}
  };
  const CommentReadAdapter={
    threadKey:d=>{if(!d||typeof d.threadKey!=='string')throw {kind:'schema',errorCode:'RESPONSE_SCHEMA'};return {...d};},
    threads:(d,m)=>{if(!d||!Array.isArray(d.threads))throw {kind:'schema',errorCode:'RESPONSE_SCHEMA',reason:'threads'};return d;}
  };
  const globals={netUtil,CommentPostWire,CommentReadAdapter,
    logSafe:{redact:v=>v&&typeof v==='object'?{...v,redacted:true}:{value:typeof v}},
    PopupMessage:{alert:m=>L('alert',m)},
    sleep:async ms=>{L('sleep',ms);},
    debug:{},
    console:{log:()=>{},time:()=>{},timeEnd:()=>{},warn:(...a)=>L('warn',a[0])},
    window:{console:{log:(...a)=>L('wlog',a[0],a[2]),error:(...a)=>L('error',a[0]),warn:(...a)=>L('warn',a[0])}},
    setTimeout:(fn,ms)=>{L('setTimeout',ms);return setTimeout(fn,0);},clearTimeout,
    URL,Promise,Object,Error,JSON,Number,Date:{now:()=>1000,parse:Date.parse}};
  return {globals,log};
}
async function compare(label,run,opt={}){
  const a=world(opt),b=world(opt);
  const A=loadLegacy(before,'ThreadLoader',a.globals),B=loadLegacy(after,'ThreadLoader',b.globals);
  const ra=await settle(()=>run(A)),rb=await settle(()=>run(B));
  assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
  // These legacy fixtures omit challenge; Task780 deliberately reports false.
  // Preserve exact comparison of every other log field and transport effect.
  const expectedLog=a.log.map(entry=>{
    if(entry[0]!=='wlog'||entry[1]!=='[ZenzaWatch][CommentPost]')return entry;
    const diagnostic=JSON.parse(entry[2]);
    if(diagnostic.phase!=='post-key'||diagnostic.event!=='success')return entry;
    return [entry[0],entry[1],JSON.stringify({...diagnostic,challengeRequired:false})];
  });
  assert.deepEqual(b.log,expectedLog,label+' side effects');
  return ra;
}
const msgInfo=(extra={})=>({videoId:'sm9',userId:'u1',threadId:'1',language:'ja-jp',when:0,canPost:true,defaultThread:{is184Forced:false},
  threads:[{id:1,forkLabel:'main'},{id:1,forkLabel:'easy'}],
  nvComment:{params:{language:'ja-jp',targets:[]},server:'https://public.nvcomment.nicovideo.jp',threadKey:'TK'},...extra});

test('load: success, retries, language fallback, schema and status handling',async()=>{
  await compare('success',l=>l.load(msgInfo()),{responses:[json(200,threadsBody())]});
  await compare('wayback when',l=>l.load(msgInfo({when:1700000000})),{responses:[json(200,threadsBody())]});
  await compare('500 then success (retry refreshes key)',l=>l.load(msgInfo()),
    {responses:[json(500,{meta:{status:500}}),json(200,{meta:{status:200},data:{threadKey:'TK2'}}),json(200,threadsBody())]});
  await compare('language fallback',l=>l.load(msgInfo({language:'en-us'})),
    {responses:[json(400,{meta:{status:400,errorCode:'INVALID_PARAMETER'}}),json(200,{meta:{status:200},data:{threadKey:'TK2'}}),json(200,threadsBody())]});
  await compare('403 stops',l=>l.load(msgInfo()),{responses:[json(403,{meta:{status:403,errorCode:'FORBIDDEN'}})]});
  await compare('schema stops',l=>l.load(msgInfo()),{responses:[json(200,{meta:{status:200},data:{nope:1}})]});
  await compare('bad meta',l=>l.load(msgInfo()),{responses:[json(200,{data:{}})]});
  await compare('retry-after too long',l=>l.load(msgInfo()),{responses:[json(503,{meta:{status:503}},{'Retry-After':'600'})]});
  await compare('all attempts fail',l=>l.load(msgInfo({when:5})),
    {responses:[json(500,{meta:{status:500}}),json(200,{meta:{status:200},data:{threadKey:'a'}}),json(500,{meta:{status:500}}),
      json(200,{meta:{status:200},data:{threadKey:'b'}}),json(502,{meta:{status:502,errorCode:'BAD'}})]});
  await compare('aborted before start',l=>{const c=new AbortController();c.abort('stop');return l.load(msgInfo(),{signal:c.signal});});
});

test('reload: refreshes a previously used thread key before the first POST and retains safe failure codes',async()=>{
  const seen=world({responses:[
    json(200,{meta:{status:200},data:{threadKey:'FRESH_KEY'}}),
    json(200,threadsBody())
  ]});
  const loader=loadLegacy(after,'ThreadLoader',seen.globals);
  const info=msgInfo({threadInfo:{videoId:'sm9',threadId:'1'}});
  const untouchedParams=structuredClone(info.nvComment.params);
  const result=await loader.load(info,{manualReload:true});
  assert.equal(result.format,'threads');
  const calls=seen.log.filter(x=>x[0]==='fetch');
  assert.equal(calls.length,2);
  assert.match(calls[0][1],/\/v1\/comment\/keys\/thread\?videoId=sm9/);
  assert.match(calls[1][1],/\/v1\/threads$/);
  assert.equal(JSON.parse(calls[1][2].body).threadKey,'FRESH_KEY');
  assert.deepEqual(info.nvComment.params,untouchedParams,'do not mutate watch metadata on reload');
  assert.equal(seen.log.filter(x=>x[0]==='alert').length,0,'no avoidable failing toast');

  const internal=world({responses:[json(200,threadsBody())]});
  const internalLoader=loadLegacy(after,'ThreadLoader',internal.globals);
  await internalLoader.load(msgInfo({threadInfo:{videoId:'sm9',threadId:'1'}}));
  const internalCalls=internal.log.filter(x=>x[0]==='fetch');
  assert.equal(internalCalls.length,1,
    'a post-token recovery reusing threadInfo must not trigger a new thread-key request');
  assert.match(internalCalls[0][1],/\/v1\/threads$/);

  const denied=world({responses:[
    json(200,{meta:{status:200},data:{threadKey:'FRESH_KEY'}}),
    json(403,{meta:{status:403,errorCode:'FORBIDDEN'}})
  ]});
  const rejected=loadLegacy(after,'ThreadLoader',denied.globals);
  const failure=await rejected.load(msgInfo({threadInfo:{videoId:'sm9',threadId:'1'}}),{manualReload:true})
    .then(()=>null,error=>error);
  assert.equal(failure.statusCode,403);
  assert.equal(failure.errorCode,'FORBIDDEN');
  assert.match(failure.message,/HTTP 403.*FORBIDDEN/);
});

test('postChat: precheck, post key, ack, retry-token and unknown outcome',async()=>{
  const loaded=async(l,opt)=>{const m=msgInfo();await l.load(m);return m;};
  await compare('success',async l=>{const m=await loaded(l);return l.postChat(m,'hello','184 big',123);},{responses:[json(200,threadsBody())]});
  await compare('no target',async l=>{const m=await loaded(l);m.threadInfo.canPost=false;return l.postChat(m,'x');},{responses:[json(200,threadsBody())]});
  await compare('post key fails',async l=>{const m=await loaded(l);return l.postChat(m,'x');},{responses:[json(200,threadsBody())],postKeyFails:true});
  await compare('post key missing',async l=>{const m=await loaded(l);return l.postChat(m,'x');},{responses:[json(200,threadsBody())],postKey:{postKey:' '}});
  await compare('ack incomplete',async l=>{const m=await loaded(l);return l.postChat(m,'x');},{responses:[json(200,threadsBody())],posts:[{ack:{id:1}}]});
  await compare('unknown outcome',async l=>{const m=await loaded(l);return l.postChat(m,'x');},
    {responses:[json(200,threadsBody())],posts:[{throw:{kind:'body-timeout',result:{}}}]});
  await compare('retry-token then success',async l=>{const m=await loaded(l);return l.postChat(m,'x','',1);},
    {responses:[json(200,threadsBody()),json(200,threadsBody())],posts:[{throw:{result:{status:400,errorCode:'INVALID_TOKEN'}}},{ack:{no:9}}]});
  await compare('rejected',async l=>{const m=await loaded(l);return l.postChat(m,'x');},
    {responses:[json(200,threadsBody())],posts:[{throw:{result:{status:403,errorCode:'BANNED'}}}]});
});

test('deleteChat / nicoru / keys',async()=>{
  const loaded=async l=>{const m=msgInfo();await l.load(m);return m;};
  await compare('delete ok',async l=>l.deleteChat(await loaded(l),{fork:1,no:3}),
    {responses:[json(200,threadsBody()),json(200,{meta:{status:200},data:{deleteKey:'DK'}}),json(200,{meta:{status:200}})]});
  await compare('delete rejected',async l=>l.deleteChat(await loaded(l),{no:3}),
    {responses:[json(200,threadsBody()),json(200,{meta:{status:200},data:{deleteKey:'DK'}}),json(200,{meta:{status:403,errorCode:'NOPE'}})]});
  await compare('delete key fails',async l=>l.deleteChat(await loaded(l),{no:3}),
    {responses:[json(200,threadsBody()),json(200,{meta:{status:401}})]});
  await compare('nicoru ok',async l=>l.nicoru(await loaded(l),{fork:2,no:4,text:'w'}),
    {responses:[json(200,threadsBody()),json(200,{meta:{status:200},data:{nicoruKey:'NK'}})],posts:[{ack:{nicoruId:'n1',nicoruCount:7}}]});
  await compare('nicoru rejected',async l=>l.nicoru(await loaded(l),{no:4,text:'w'}),
    {responses:[json(200,threadsBody()),json(200,{meta:{status:200},data:{nicoruKey:'NK'}})],posts:[{throw:{result:{status:409,errorCode:'DUP'}}}]});
  await compare('thread key ok',l=>l.getThreadKey('sm9'),{responses:[json(200,{meta:{status:200},data:{threadKey:'K'}})]});
  await compare('thread key schema',l=>l.getThreadKey('sm9'),{responses:[json(200,{meta:{status:200},data:{}})]});
  await compare('post key wrapper',l=>l.getPostKey('1',{language:'en-us'}));
});
