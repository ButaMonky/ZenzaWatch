'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
async function ticks() { for (let i = 0; i < 20; i++) await Promise.resolve(); }
function fixture({holdKey=false, rejectedFirst=false} = {}) {
  let original = true, posts = 0, keys = 0, releaseKey = null, releaseSleep = null;
  const ctx = createContext({
    logSafe: {redact: v => v},
    sleep: () => new Promise(ok => { releaseSleep = ok; }),
    PopupMessage: {alert() {}}, debug: {},
    console: {log() {}, warn() {}, error() {}, time() {}, timeEnd() {}}
  });
  run(beginSection('packages/lib/src/nico/ThreadLoader.js') +
    ';globalThis.subject = ThreadLoader;', ctx);
  const loader = ctx.subject;
  loader.getPostKey = async () => {
    keys++;
    if (holdKey) await new Promise(ok => { releaseKey = ok; });
    return {postKey: 'synthetic-post-key'};
  };
  loader.load = async () => {};
  loader._post = async () => {
    posts++;
    if (rejectedFirst && posts === 1)
      throw {result: {status: 403, errorCode: 'EXPIRED_TOKEN'}};
    return {no: 5, id: 'TEST_ONLY_ACK'};
  };
  const data = {threadInfo: {videoId: 'smTEST', threadId: '100',
    language: 'ja-jp', canPost: true, is184Forced: false},
    nvComment: {server: 'https://comments.invalid'}};
  return {
    post: () => loader.postChat(data, 'synthetic', '', 120, () => original),
    switchVideo: () => {original = false;},
    releaseKey: () => { if (!releaseKey) throw Error('key not pending'); releaseKey(); },
    releaseSleep: () => { if (!releaseSleep) throw Error('sleep not pending'); releaseSleep(); },
    keyPending: () => !!releaseKey,
    sleepPending: () => !!releaseSleep,
    counts: () => ({posts, keys})
  };
}
describe('Issue #252 post ownership after asynchronous waits', () => {
  it('does not send after the post-key await if video changed', async () => {
    const h = fixture({holdKey: true});
    const pending = h.post(); await ticks();
    assert(h.keyPending()); h.switchVideo(); h.releaseKey();
    await assert.rejects(pending, e => e.reason === 'challenge-stale-video' && e.outcome === 'not-sent');
    assert.deepStrictEqual(h.counts(), {posts: 0, keys: 1});
  });
  it('does not retry a previously rejected POST after video switch during 3-second sleep', async () => {
    const h = fixture({rejectedFirst: true});
    const pending = h.post(); await ticks();
    assert(h.sleepPending()); h.switchVideo(); h.releaseSleep();
    await assert.rejects(pending, e => e.reason === 'challenge-stale-video' && e.outcome === 'not-sent');
    assert.deepStrictEqual(h.counts(), {posts: 1, keys: 1});
  });
  it('retries once on confirmed expired token for an unchanged video', async () => {
    const h = fixture({rejectedFirst: true});
    const pending = h.post(); await ticks();
    assert(h.sleepPending()); h.releaseSleep();
    const result = await pending;
    assert.strictEqual(result.no, 5);
    assert.deepStrictEqual(h.counts(), {posts: 2, keys: 2});
  });
});
