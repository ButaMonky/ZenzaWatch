'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function likeFor(status, metaStatus) {
  const response = {status, json: async () => ({meta: {status: metaStatus}, data: {}})};
  const ctx = createContext({NVApi: {call: async () => response}});
  run(beginSection('packages/lib/src/nico/LikeApi.js') +
    '\nglobalThis.subject = LikeApi;', ctx);
  return ctx.subject;
}
function tagFor(status, metaStatus) {
  const response = {status, json: async () => ({meta: {status: metaStatus}, data: {tags: []}})};
  const ctx = createContext({util: {fetch: async () => response}});
  run(beginSection('packages/lib/src/nico/TagEditApi.js') +
    '\nglobalThis.subject = TagEditApi;', ctx);
  return new ctx.subject();
}

describe('AUD #260 HTTP and meta status both have to be successful', () => {
  for (const http of [403, 500]) {
    it('rejects Like on HTTP ' + http + ' even when meta claims 200', async () => {
      await assert.rejects(likeFor(http, 200).like('sm123'),
        error => error.kind === 'API' && error.status === http);
    });
    it('rejects TagEdit on HTTP ' + http + ' even when meta claims 200', async () => {
      await assert.rejects(tagFor(http, 200).add({videoId: 'sm123', tag: 'test', editKey: 'dummy'}),
        error => error.kind === 'API' && error.status === http);
    });
  }
  it('rejects body meta failures despite HTTP success', async () => {
    await assert.rejects(likeFor(200, 403).like('sm123'), error => error.status === 403);
    await assert.rejects(tagFor(200, 500).add({videoId: 'sm123', tag: 'test', editKey: 'dummy'}),
      error => error.status === 500);
  });
  it('preserves ordinary valid HTTP/meta success', async () => {
    const like = await likeFor(201, 201).like('sm123');
    const tag = await tagFor(200, 200).add({videoId: 'sm123', tag: 'test', editKey: 'dummy'});
    assert.strictEqual(like.meta.status, 201);
    assert(Array.isArray(tag.tags));
  });
});
