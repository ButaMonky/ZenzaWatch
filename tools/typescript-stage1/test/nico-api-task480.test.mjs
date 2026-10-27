// Task480: playback-position nvapi v2-only writer, legacy side-effect parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import {NICO_API_BY_NAME} from '../scripts/nico-api-registry.mjs';
import {emitNico,read,loadLegacy,snapshot,settle} from './nico-api-harness.mjs';

emitNico();
const spec=NICO_API_BY_NAME.PlaybackPosition;
const oldCode=read(spec.fixture);
const newCode=read(spec.runtime);

function environment(options={}){
  const calls=[];
  const status=Object.hasOwn(options,'status')?options.status:200;
  const body=Object.hasOwn(options,'body')?options.body:{meta:{status:200}};
  const response=options.noResponse?null:{status};
  if(response && options.hasText!==false){
    response.text=async()=>{
      if(options.textError)throw Error('text read failed');
      if(Object.hasOwn(options,'textResult'))return options.textResult;
      return JSON.stringify(body);
    };
  }
  if(response && options.hasJson!==false){
    response.json=async()=>{
      if(options.jsonError)throw Error('json read failed');
      return body;
    };
  }
  const netUtil={fetch:async(url,request)=>{
    calls.push([url,request]);
    if(options.networkError)throw Error('network unavailable');
    return response;
  }};
  return {calls,globals:{netUtil,Promise,Error,SyntaxError,JSON}};
}

async function parity(label,videoId,seconds,frontendId,frontendVersion,settings={}){
  const old=environment(settings),current=environment(settings);
  const before=loadLegacy(oldCode,'PlaybackPosition',old.globals);
  const after=loadLegacy(newCode,'PlaybackPosition',current.globals);
  const left=await settle(()=>before.record(videoId,seconds,frontendId,frontendVersion));
  const right=await settle(()=>after.record(videoId,seconds,frontendId,frontendVersion));
  assert.deepEqual(snapshot(right),snapshot(left),label+' result');
  assert.deepEqual(snapshot(current.calls),snapshot(old.calls),label+' calls');
  return current.calls;
}

test('Task480: v2 PUT, single request, auth and frontend defaults',async()=>{
  const calls=await parity('success','sm9',12.5);
  assert.equal(calls.length,1);
  const [url,opts]=calls[0];
  assert.equal(url,'https://nvapi.nicovideo.jp/v2/users/me/watch/history/playback-position');
  assert.equal(opts.method,'PUT');
  assert.equal(opts.credentials,'include');
  assert.equal(opts.headers['X-Frontend-Id'],'6');
  assert.equal(opts.headers['X-Frontend-Version'],'0');
  assert.equal(opts.headers['Content-Type'],'application/json');
  assert.equal(opts.headers['X-Request-With'],'https://www.nicovideo.jp');
  assert.equal(opts.body,JSON.stringify({videoId:'sm9',seconds:12.5}));
});
test('Task480: accepted ids, frontend fallback and seconds boundaries',async()=>{
  for(const [id,seconds,frontendId,frontendVersion] of [
    ['sm9',0,undefined,undefined],['nm42',1,0,0],['so99',42.25,'01','v2'],
    ['sm123',Number.MAX_SAFE_INTEGER,null,null],['sm1',1,'',''],['sm9',0.0001,6,0]
  ])await parity(`accepted ${id}/${seconds}`,id,seconds,frontendId,frontendVersion);
});

test('Task480: invalid arguments reject before communication',async()=>{
  for(const [id,sec] of [
    ['',1],['SM9',1],['sm',1],['sm-9',1],['sm９',1],['evil/video',1],
    [12,1],[null,1],[undefined,1],[{},1],['sm9',undefined],['sm9',null],
    ['sm9','1'],['sm9',-1],['sm9',Infinity],['sm9',-Infinity],['sm9',NaN]
  ]){
    const calls=await parity(`invalid ${String(id)}/${String(sec)}`,id,sec);
    assert.equal(calls.length,0);
  }
});

test('Task480: HTTP and JSON meta success/failure parity',async()=>{
  for(const [name,settings] of [
    ['204', {status:204}],['empty', {textResult:''}],['blank', {textResult:'  '}],
    ['text missing json fallback',{hasText:false,body:{meta:{status:200}}}],
    ['no text or json',{hasText:false,hasJson:false}],
    ['401',{status:401}],['500',{status:500}],['missing response',{noResponse:true}],
    ['meta 400',{body:{meta:{status:400,errorCode:'E_TEST'}}}],
    ['meta numeric string',{body:{meta:{status:'204'}}}],
    ['meta invalid',{body:{meta:{status:null}}}],
    ['no meta',{body:{data:{playbackPosition:4}}}],
    ['primitive JSON',{body:true}],['null JSON',{body:null}],
    ['array JSON',{body:[]}],['primitive meta',{body:{meta:'hello'}}],
    ['array meta',{body:{meta:[]}}],['status 299',{body:{meta:{status:299}}}],
    ['status 300',{body:{meta:{status:300}}}]
  ])await parity(name,'sm9',10,undefined,undefined,settings);
});
test('Task480: read errors and network rejection parity',async()=>{
  for(const [name,settings] of [
    ['invalid json',{textResult:'{bad'}],
    ['text rejection',{textError:true}],
    ['fallback json rejection',{hasText:false,jsonError:true}],
    ['network rejection',{networkError:true}],
    ['body literal null',{textResult:'null'}],
    ['body number',{textResult:'17'}]
  ])await parity(name,'sm9',1,undefined,undefined,settings);
});
