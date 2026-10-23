'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function client(reply) {
  const calls = [];
  const data = {postKey:'fixture-key',
    challenge:{isRequired:true,siteKey:'synthetic-site-key'}};
  const context = createContext({
    console:{log() {},warn() {},error() {}},
    AbortController, netUtil:{fetch:async (url,options) => {
      calls.push({url:String(url), options});
      return {status:reply?.meta?.status || 200,
        json:async () => reply || {meta:{status:200},data}};
    }}
  });
  const wire = run(beginSection('packages/lib/src/nico/CommentPostWire.js') +
    ';CommentPostWire;',context);
  return {wire,calls,data};
}

describe('Task490 typed post-key request boundary', () => {
  it('uses unchanged nvapi URL, language, frontend headers and credentials', async () => {
    const p = client();
    const result=await p.wire.getPostKey('12','zh-tw');
    assert.strictEqual(result,p.data);
    assert.strictEqual(p.calls.length,1);
    assert.strictEqual(p.calls[0].url,
      'https://nvapi.nicovideo.jp/v1/comment/keys/post?threadId=12');
    const opts=p.calls[0].options;
    assert.strictEqual(opts.credentials,'include');
    assert.strictEqual(opts.headers['X-Frontend-Id'],'6');
    assert.strictEqual(opts.headers['X-Frontend-Version'],'0');
    assert.strictEqual(opts.headers['X-Niconico-Language'],'zh-tw');
    assert.strictEqual(opts.timeout,30000);
    assert.strictEqual(opts.method,undefined);
  });
  it('defaults to Japanese while preserving raw challenge metadata', async () => {
    const p=client();
    const value=await p.wire.getPostKey(21);
    assert.strictEqual(value,p.data);
    assert.strictEqual(value.challenge.isRequired,true);
    assert.strictEqual(p.calls[0].options.headers['X-Niconico-Language'],'ja-jp');
  });
  it('does not retry or conceal an API error', async () => {
    const failure={status:400,errorCode:'INVALID_CHALLENGE_TOKEN'};
    const p=client({meta:failure,data:{}});
    await assert.rejects(p.wire.getPostKey(30,'ja-jp'),
      error=>error===failure);
    assert.strictEqual(p.calls.length,1);
  });
});

describe('Task490 ThreadLoader consumes typed post-key client', () => {
  it('delegates request and preserves returned data identity', async () => {
    const reply = {meta:{status:200},data:{postKey:'fixture-key'}};
    const context = createContext({console:{log() {},warn() {},error() {}},
      netUtil:{fetch:async () => ({status:200,json:async () => reply})}});
    const loader = run(beginSection('packages/lib/src/nico/ThreadLoader.js') +
      ';ThreadLoader;',context);
    const wire = run('CommentPostWire',context);
    const seen = [];
    const original = wire.getPostKey;
    wire.getPostKey = async (id, language) => {
      seen.push({id,language});
      return original(id,language);
    };
    const data = await loader.getPostKey(88,{language:'zh-tw'});
    assert.strictEqual(data,reply.data);
    assert.deepStrictEqual(seen,[{id:88,language:'zh-tw'}]);
  });
});
