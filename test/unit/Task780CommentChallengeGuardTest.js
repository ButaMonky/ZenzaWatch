'use strict';
const assert = require('assert');
const {beginSection, run} = require('../helpers/extractSource');
const {createDialogHarness} = require('../helpers/dialogHarness');

// All API replies are synthetic; tests never call the live site or save tokens.
function fixture({challenge, postMeta = {status: 200}, postAck = {no: 8}} = {}) {
  const h = createDialogHarness();
  const logs = [], alerts = [], requests = [];
  const data = {postKey: 'secret-post-key'};
  if (challenge !== undefined) { data.challenge = challenge; }
  const c = h.context;
  const res = (meta, payload) => ({status: meta.status, json: async () =>
    ({meta, ...(payload === undefined ? {} : {data: payload})})});
  Object.assign(c, {
    netUtil: {fetch: async (url) => {
      const key = String(url).includes('/keys/post');
      requests.push(key ? 'post-key' : 'post');
      return key ? res({status: 200}, data) : res(postMeta, postAck);
    }},
    logSafe: {redact: value => value}, sleep: async () => {},
    PopupMessage: {alert() {}}, debug: {}
  });
  c.console = c.window.console = {log: (...args) => logs.push(args), warn() {}, time() {}, timeEnd() {}};
  run(beginSection('packages/lib/src/nico/ThreadLoader.js') +
    ';globalThis.realThreadLoader=ThreadLoader;', c);
  const info = {videoId: 'sm9', threadId: 11, language: 'ja-jp',
    canPost: true, is184Forced: false};
  Object.assign(h.dialog, {_watchId: 'sm9', _requestId: 'request1',
    _threadInfo: info, _videoInfo: {msgInfo: {threadInfo: info,
      nvComment: {server: 'https://comments.invalid'}}},
    threadLoader: c.realThreadLoader, _nicoVideoPlayer: h.player});
  h.dialog.execCommand = (cmd, value) => { if (cmd === 'alert') { alerts.push(String(value)); } };
  return {h, logs, alerts, requests};
}
const failure = p => p.h.dialog.addChat('draft text', 'red', 100).then(
  () => {throw new Error('Unexpected acceptance');}, e => e);

describe('Task780 AUD-02 comment post challenge guard', () => {
  for (const challenge of [
    {isRequired: true, siteKey: 'public-site-key'},
    {isRequired: true}
  ]) {
    it('does not POST or automatically retry when the key requires verification', async () => {
      const p = fixture({challenge});
      const err = await failure(p);
      assert.strictEqual(err.reason, 'challenge-unavailable');
      assert.strictEqual(err.outcome, 'not-sent');
      assert.deepStrictEqual(p.requests, ['post-key']);
      assert.strictEqual(p.h.state.isCommentPosting, false);
      assert.strictEqual(p.h.cachePuts.length, 0);
      assert(p.alerts.some(value => /公式プレイヤー/.test(value)));
      assert(!JSON.stringify(p.logs).includes('secret-post-key'), 'secrets never logged');
    });
  }
  for (const challenge of [undefined, {isRequired: false, siteKey: 'public-site-key'}]) {
    it('keeps the ordinary unchallenged posting path functional', async () => {
      const p = fixture({challenge});
      const posted = await p.h.dialog.addChat('hello', '', 3);
      assert.strictEqual(posted.no, 8);
      assert.deepStrictEqual(p.requests, ['post-key', 'post']);
      assert.strictEqual(p.h.cachePuts.length, 1);
      assert.strictEqual(p.h.state.isCommentPosting, false);
    });
  }
  it('shows a specific next action for rejected challenge tokens without replaying POST', async () => {
    const p = fixture({postMeta: {status: 400, errorCode: 'INVALID_CHALLENGE_TOKEN'}});
    const err = await failure(p);
    assert.strictEqual(err.reason, 'challenge-rejected');
    assert.strictEqual(err.outcome, 'rejected');
    assert.strictEqual(err.statusCode, 400);
    assert.deepStrictEqual(p.requests, ['post-key', 'post']);
    assert.strictEqual(p.h.cachePuts.length, 0);
    assert(p.alerts.some(v => /公式プレイヤー/.test(v)));
    assert(!JSON.stringify(p.logs).includes('secret-post-key'));
  });
});
