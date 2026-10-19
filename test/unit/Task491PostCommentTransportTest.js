'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

const endpoint = 'https://comments.invalid/v1/threads/10/comments';
const packet = '{"body":"synthetic","commands":["red"],"vposMs":10,"postKey":"fixture"}';
function client(mode) {
  const requests = [];
  const ack = {no:21,id:'fixture-id'};
  const meta = {status:400,errorCode:'INVALID_CHALLENGE_TOKEN'};
  const context = createContext({AbortController, netUtil:{fetch:async (url,opts) => {
    requests.push({url:String(url), opts});
    if (mode==='offline') {throw new TypeError('offline');}
    if (mode==='bad-json') {
      return {status:502, json:async () => {throw new SyntaxError('invalid json');}};
    }
    return {status:mode==='reject'?400:201, json:async () =>
      mode==='reject'?{meta,data:null}:{meta:{status:201},data:ack}};
  }}});
  const wire = run(beginSection('packages/lib/src/nico/CommentPostWire.js') +
    ';CommentPostWire;',context);
  return {wire,requests,ack,meta};
}
describe('Task491 typed nvComment POST transport', () => {
  it('preserves legacy headers, body, one request and the ACK identity', async () => {
    const p=client('success');
    const value=await p.wire.postComment(new URL(endpoint),packet);
    assert.strictEqual(value,p.ack);
    assert.strictEqual(p.requests.length,1);
    const req=p.requests[0];
    assert.strictEqual(req.url,endpoint);
    assert.strictEqual(req.opts.method,'POST');
    assert.strictEqual(req.opts.timeout,30000);
    assert.strictEqual(req.opts.headers['X-Frontend-Id'],'6');
    assert.strictEqual(req.opts.headers['X-Frontend-Version'],'0');
    assert.strictEqual(req.opts.headers['Content-Type'],'text/plain; charset=UTF-8');
    assert.strictEqual(req.opts.body,packet);
    assert.strictEqual(req.opts.credentials,undefined,'preserve old implicit default');
  });
  it('preserves HTTP 400 INVALID_CHALLENGE_TOKEN without retrying', async () => {
    const p=client('reject');
    await assert.rejects(p.wire.postComment(endpoint,packet),err=>err===p.meta);
    assert.strictEqual(p.requests.length,1);
  });
  it('reports lost JSON body with HTTP status only as diagnostic metadata', async () => {
    const p=client('bad-json');
    await assert.rejects(p.wire.postComment(endpoint,packet),err =>
      err instanceof SyntaxError && err.httpStatus===502);
    assert.strictEqual(p.requests.length,1);
  });
  it('classifies network failure and never retries the POST', async () => {
    const p=client('offline');
    await assert.rejects(p.wire.postComment(endpoint,packet),err =>
      err.kind==='network');
    assert.strictEqual(p.requests.length,1);
  });
});

describe('Task491 ThreadLoader delegates the actual POST to the TS client', () => {
  it('preserves the existing result wrapper and calls the typed transport once', async () => {
    const sent=[];
    const resultBody={no:11,id:'fixture-comment'};
    const context=createContext({console:{log() {},warn() {},error() {}},
      AbortController,netUtil:{fetch:async (url,opts)=>{
        sent.push({url:String(url),opts});
        return {status:201,json:async () => ({meta:{status:201},data:resultBody})};
      }}});
    const loader=run(beginSection('packages/lib/src/nico/ThreadLoader.js')+
      ';ThreadLoader;',context);
    const wire=run('CommentPostWire',context);
    const seen=[];
    const original=wire.postComment;
    wire.postComment=(url,body) => {
      seen.push([String(url),body]);
      return original(url,body);
    };
    const result=await loader._post(new URL(endpoint),packet);
    assert.strictEqual(result,resultBody);
    assert.deepStrictEqual(seen,[[endpoint,packet]]);
    assert.strictEqual(sent.length,1);
  });
});
