// Task470: UaaLoader old/new API side-effect and failure parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.UaaLoader;
const original=read(spec.fixture);
const generated=read(spec.runtime);

function environment(settings={}){
  const calls=[];
  const body=Object.hasOwn(settings,'body')?settings.body:{data:[{id:'test',name:'supporter'}]};
  const netUtil={fetch:(url,options)=>{
    calls.push([url,options]);
    if(settings.networkError)return Promise.reject(Error('offline'));
    return Promise.resolve({json:()=>settings.jsonError?Promise.reject(SyntaxError('invalid json')):Promise.resolve(body)});
  }};
  return {body,calls,globals:{netUtil,Promise,Error,SyntaxError}};
}

async function parity(name,videoId,options,settings={}){
  const left=environment(settings),right=environment(settings);
  const before=loadLegacy(original,'UaaLoader',left.globals);
  const after=loadLegacy(generated,'UaaLoader',right.globals);
  const oldResult=await settle(()=>before.load(videoId,options));
  const newResult=await settle(()=>after.load(videoId,options));
  assert.deepEqual(snapshot(newResult),snapshot(oldResult),name+' result');
  assert.deepEqual(snapshot(right.calls),snapshot(left.calls),name+' request');
  if(oldResult.ok)assert.equal(newResult.value,right.body,name+' identity');
  return left.calls;
}

test('UaaLoader: default URL, credentials, options and cancellation parity',async()=>{
  const calls=await parity('default','sm9',undefined);
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],'https://api.nicoad.nicovideo.jp/v1/contents/video/sm9/thanks?limit=50');
  assert.equal(calls[0][1].credentials,'include');
  assert.ok(Object.hasOwn(calls[0][1],'signal'));
  const signal={aborted:false};
  const aborted=await parity('abort signal','sm999',{limit:7,signal});
  assert.strictEqual(aborted[0][1].signal,signal);
  assert.equal(aborted[0][0],'https://api.nicoad.nicovideo.jp/v1/contents/video/sm999/thanks?limit=7');
});

test('UaaLoader: legacy interpolation and invalid-argument parity',async()=>{
  for(const [name,id,options] of [
    ['empty video id','',{}],
    ['unicode id','動画ID',{limit:2}],
    ['zero limit','sm9',{limit:0}],
    ['negative limit','sm9',{limit:-2}],
    ['empty options','sm9',{}],
    ['undefined limit','sm9',{limit:undefined}],
    ['unexpected runtime limit','sm9',{limit:'not-a-number'}],
    ['null options throws','sm9',null]
  ])await parity(name,id,options);
});

test('UaaLoader: raw response identity and failures match legacy',async()=>{
  await parity('arbitrary response','sm9',{limit:3},{body:{data:null,unknown:'preserved'}});
  await parity('null response','sm9',{}, {body:null});
  await parity('network rejection','sm9',{}, {networkError:true});
  await parity('invalid JSON rejection','sm9',{}, {jsonError:true});
});
