'use strict';
const assert = require('node:assert/strict');
const {beginSection, createContext, run} = require('../helpers/extractSource');

const origin = 'https://public.nvcomment.nicovideo.jp';
const target = {id: '10', fork: 'main'};
const params = {language: 'ja-jp', targets: [target]};
const threadKey = 'offline-thread-key';

function clients(response) {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push({url: String(url), init});
    return new Response(JSON.stringify(response), {status: 200});
  };
  const logger = {log() {}, error() {}, warn() {}, time() {}, timeEnd() {}};
  const context = createContext({debug: {}, console: logger, netUtil: {fetch}});
  const loader = run(beginSection('packages/lib/src/nico/ThreadLoader.js') + ';ThreadLoader;', context);
  const info = {videoId: 'sm9', threads: [{id: target.id, forkLabel: target.fork}],
    language: 'en-us', when: 10, nvComment: {server: origin, threadKey, params}};
  const history = {videoId: 'sm9', server: origin, threadKey, ...params};
  return {fetch, info, history, loader, requests};
}

describe('shared nvComment thread read contract', () => {
  let requestThreads;
  before(async () => {
    ({requestThreads} = await import('../../packages/comment-history/src/transport.mjs'));
  });

  it('uses one POST format and preserves each reader’s request options', async () => {
    const h = clients({meta: {status: 200}, data: {globalComments: [],
      threads: [{...target, commentCount: 0, comments: []}]}});
    const controller = new AbortController();
    const normal = await h.loader.load(h.info, {signal: controller.signal});
    const history = await requestThreads(h.history, {fetchImpl: h.fetch, when: 10, resFrom: -5});
    assert.equal(normal.format, 'threads');
    assert.equal(history[0].id, target.id);
    const [first, second] = h.requests;
    assert.equal(first.url, origin + '/v1/threads');
    assert.equal(second.url, origin + '/v1/threads?pc=1');
    for (const {init} of h.requests) {
      assert.equal(init.method, 'POST');
      assert.equal(init.headers['X-Frontend-Id'], '6');
      assert.equal(init.headers['X-Frontend-Version'], '0');
      assert.equal(JSON.parse(init.body).threadKey, threadKey);
    }
    assert.equal(first.init.signal, controller.signal);
    assert.equal(first.init.credentials, undefined);
    assert.equal(second.init.credentials, 'omit');
    assert.equal(second.init.redirect, 'error');
    assert.equal(second.init.headers['X-Client-Os-Type'], 'others');
    assert.deepEqual(JSON.parse(first.init.body), {
      params: {...params, language: 'en-us'}, threadKey, additionals: {when: 10}
    });
    assert.deepEqual(JSON.parse(second.init.body), {
      params, threadKey, additionals: {when: 10, res_from: -5}
    });
    assert.equal(params.language, 'ja-jp');
  });

  it('identifies the same malformed field in both paths before applying any comments', async () => {
    for (const [response, missing] of [
      [{data: {threads: []}}, 'meta.status'],
      [{meta: {status: 200}, data: {threadsRenamed: []}}, 'data.threads']
    ]) {
      const h = clients(response);
      await assert.rejects(h.loader.load(h.info), error =>
        error.result?.kind === 'schema' && error.result.errorCode === 'RESPONSE_SCHEMA' &&
        error.result.missing === missing);
      await assert.rejects(requestThreads(h.history, {fetchImpl: h.fetch}), error =>
        error.code === 'RESPONSE_SCHEMA' && error.missing === missing);
      assert.equal(h.requests.length, 2);
      assert.equal(h.info.threadInfo, undefined);
    }
  });

  it('retains player 2xx compatibility and the history exact-200 policy', async () => {
    const h = clients({meta: {status: 201}, data: {globalComments: [], threads: []}});
    assert.equal((await h.loader.load(h.info)).format, 'threads');
    await assert.rejects(requestThreads(h.history, {fetchImpl: h.fetch}), {code: 'API_ERROR'});
  });
});
