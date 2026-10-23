'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function posting({keyReply, postReply}) {
  let posts = 0, keys = 0;
  const context = createContext({
    console: {log() {}, warn() {}, error() {}, info() {}},
    logSafe: {redact: value => value}, sleep: async () => {},
    netUtil: {fetch: async (url, opts = {}) => {
      const keyUrl = String(url).includes('/v1/comment/keys/post');
      if (keyUrl) {keys++; return {status: 200, json: async () => keyReply};}
      posts++;
      return {status: 200, json: async () => postReply};
    }}
  });
  const loader = run(beginSection('packages/lib/src/nico/ThreadLoader.js') +
    ';ThreadLoader;', context);
  const wire = run('CommentPostWire', context);
  const data = {threadInfo: {videoId: 'sm9', threadId: 11, language: 'ja-jp'},
    nvComment: {server: 'https://comments.invalid'}};
  return {loader, wire, data, counts: () => ({posts,keys})};
}
const goodKey = {meta:{status:200},data:{postKey:'fixture-key'}};
describe('Task488 real ThreadLoader uses typed nvComment envelope', () => {
  it('delegates key and post response interpretation to typed wire', async () => {
    const p = posting({keyReply: goodKey,
      postReply: {meta:{status:201},data:{no:5,id:'ok'}}});
    const visited = [];
    const originalKey = p.wire.getPostKey;
    p.wire.getPostKey = (...args) => {
      visited.push('post-key-request');
      return originalKey(...args);
    };
    const originalPost = p.wire.postComment;
    p.wire.postComment = (url,body) => {
      visited.push('post-comment-request');
      return originalPost(url,body);
    };
    const result = await p.loader.postChat(p.data, 'fixture', '', 10);
    assert.strictEqual(result.no, 5);
    // Task490 and Task491 own the two public transport entrypoints.
    // Separate envelope tests still verify each status/response shape.
    assert.deepStrictEqual(visited, ['post-key-request', 'post-comment-request']);
    assert.deepStrictEqual(p.counts(), {posts:1,keys:1});
  });
  it('rejects malformed post key envelope before sending a comment', async () => {
    const p = posting({keyReply: {meta:{status:'200'},data:{postKey:'key'}},
      postReply:{meta:{status:201},data:{no:1}}});
    const error = await p.loader.postChat(p.data, 'fixture', '', 0).then(() => null, x => x);
    assert(error && error.result);
    assert.strictEqual(error.result.errorCode, 'RESPONSE_SCHEMA');
    assert.deepStrictEqual(p.counts(), {posts:0,keys:1});
  });
  it('does not mark a malformed post response as accepted or retry it', async () => {
    const p = posting({keyReply:goodKey,
      postReply:{meta:{status:'201'},data:{no:9,id:'fixture'}}});
    const error = await p.loader.postChat(p.data,'fixture','',0).then(() => null, x => x);
    assert(error, 'invalid API meta must not be confirmed as success');
    assert.strictEqual(error.reason, 'schema');
    assert.strictEqual(error.outcome, 'unknown');
    assert.deepStrictEqual(p.counts(), {posts:1,keys:1});
  });
  it('preserves INVALID_CHALLENGE_TOKEN 400 as terminal rejection', async () => {
    const p = posting({keyReply:goodKey,
      postReply:{meta:{status:400,errorCode:'INVALID_CHALLENGE_TOKEN'},
        data:{}}});
    const error=await p.loader.postChat(p.data,'fixture','',0).then(()=>null,x=>x);
    assert(error && error.statusCode===400);
    assert.match(error.message,/INVALID_CHALLENGE_TOKEN/);
    assert.deepStrictEqual(p.counts(), {posts:1,keys:1},
      'a rejected challenge is not automatically bypassed or replayed');
  });
});
