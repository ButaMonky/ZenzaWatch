// Task475: TagEditApi parity — nvapi v2 tags with one edit-key refresh retry.
// Pre-migration fixture vs generated runtime; deterministic Math.random/Date.now.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {renderNicoLegacy} from '../scripts/sync-nico-api.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.TagEditApi;
const before=read(spec.fixture),after=read(spec.runtime);

function globalsFor(scenario){
  const log=[];
  const queue=structuredClone(scenario.responses||[]);
  const util={fetch:(url,options)=>{
    log.push(['fetch',url,options]);
    const next=queue.length?queue.shift():{fail:'exhausted'};
    if(next.fail)return Promise.reject(Object.assign(Error(next.fail),{tag:next.fail}));
    return Promise.resolve({status:next.status??200,json:async()=>{
      if(next.jsonFail)throw SyntaxError('bad json');return next.body;}});
  }};
  let r=0;
  const FakeMath={floor:Math.floor,random:()=>((r+=0.137)%1)};
  const FakeDate={now:()=>1760000000000};
  return {log,globals:{util,window:{console:{warn:(...a)=>{log.push(['warn',...a]);}}},
    Math:FakeMath,Date:FakeDate,URLSearchParams,JSON,Object,Error,encodeURIComponent,Promise}};
}
async function compare(label,run,scenario){
  const a=globalsFor(scenario),b=globalsFor(scenario);
  const A=loadLegacy(before,'TagEditApi',a.globals),B=loadLegacy(after,'TagEditApi',b.globals);
  const updatesA=[],updatesB=[];
  const ra=await settle(()=>run(new A(),k=>updatesA.push(k)));
  const rb=await settle(()=>run(new B(),k=>updatesB.push(k)));
  assert.deepEqual(snapshot(rb),snapshot(ra),label+' result');
  assert.deepEqual(snapshot(b.log),snapshot(a.log),label+' requests/logs');
  assert.deepEqual(updatesB,updatesA,label+' onEditKeyUpdate');
}
const data={tags:[{tag:'東方'}]};
const okBody={body:{meta:{status:200},data}};
const watchKey=k=>({body:{data:{tag:{edit:{editKey:k}}}}});
const load=api=>api.load('sm9','KEY0');
const add=(api,up)=>api.add({videoId:'sm9',tag:'初音ミク & 歌',csrfToken:'x',editKey:'KEY0',onEditKeyUpdate:up});
const remove=(api,up)=>api.remove({videoId:'sm9',tag:'消す',id:'55',editKey:'KEY0',onEditKeyUpdate:up});

test('class shape is rendered and enforced',()=>{
  assert.equal(spec.shape,'class');
  assert.throws(()=>renderNicoLegacy(spec,'class TagEditApi {\n}\nconst x = 1;\nexport { TagEditApi };'),/UNEXPECTED_TOP_LEVEL/);
  assert.throws(()=>renderNicoLegacy(spec,'const TagEditApi = {\n};\nexport { TagEditApi };'),/UNEXPECTED_TOP_LEVEL/);
});

test('success paths for load/add/remove keep URLs, headers and data',async()=>{
  await compare('load ok',load,{responses:[okBody]});
  await compare('add ok',add,{responses:[okBody]});
  await compare('remove ok',remove,{responses:[okBody]});
  await compare('remove without tag',api=>api.remove({videoId:'sm9',editKey:'K'}),{responses:[okBody]});
});

test('edit-key refresh retries exactly once',async()=>{
  const expired={status:400,body:{meta:{status:400,errorCode:'KEY_EXPIRED'}}};
  await compare('KEY_EXPIRED -> refresh -> ok',add,{responses:[expired,watchKey('KEY1'),okBody]});
  await compare('403 FORBIDDEN -> refresh -> ok',remove,
    {responses:[{status:403,body:{meta:{status:403,errorCode:'FORBIDDEN'}}},watchKey('KEY2'),okBody]});
  await compare('KEY_EXPIRED text elsewhere in meta',load,
    {responses:[{body:{meta:{status:400,errorMessage:'KEY_EXPIRED soon'}}},watchKey('K3'),okBody]});
  await compare('retry also expired',add,{responses:[expired,watchKey('KEY1'),expired]});
  await compare('refresh without key (NO_KEY)',add,{responses:[expired,{body:{data:{tag:{}}}}]});
  await compare('refresh network failure',add,{responses:[expired,{fail:'net'}]});
  await compare('refresh json failure',add,{responses:[expired,{jsonFail:true}]});
});

test('failure classification without retry',async()=>{
  await compare('network',load,{responses:[{fail:'offline'}]});
  await compare('unparseable 200',load,{responses:[{status:200,jsonFail:true}]});
  await compare('500 with errorMessage',add,{responses:[{status:500,body:{meta:{status:500,errorCode:'INTERNAL',errorMessage:'boom'}}}]});
  await compare('403 other code',add,{responses:[{status:403,body:{meta:{status:403,errorCode:'NOT_OWNER'}}}]});
  await compare('2xx without data',load,{responses:[{body:{meta:{status:200}}}]});
  await compare('meta status from http',load,{responses:[{status:201,body:{data:{x:1}}}]});
  await compare('primitive body',load,{responses:[{body:'text'}]});
});

test('helpers keep their legacy output',async()=>{
  await compare('action track id',api=>api._createActionTrackId(),{});
  await compare('build query',api=>api._buildQuery({a:'x y',b:2,c:true}),{});
});
