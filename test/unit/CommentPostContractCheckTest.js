// Task186 (Watch V4 audit F12): no POST without a post key; an acknowledgement without a
// numeric comment number is "outcome unknown" (no success history, no automatic repost).
// The real ThreadLoader and Dialog are used; network responses are synthetic.
const assert = require('assert');
const {beginSection, run} = require('../helpers/extractSource');
const {createDialogHarness} = require('../helpers/dialogHarness');

const res = (meta, data) => ({status: meta, ok: meta < 300, json: async () => ({meta: {status: meta}, data})});
function posting(handler) {
  const h = createDialogHarness(), alerts = [];
  const c = h.context;
  let posts = 0, keys = 0, loads = 0;
  Object.assign(c, {netUtil: {fetch: async (url, options) => {
    const u = String(url);
    if (u.includes('/keys/post')) { keys++; return handler.key(keys); }
    if (u.endsWith('/v1/threads')) { loads++; return res(200, {globalComments: [], threads: []}); }
    posts++; return handler.post(posts);
  }}, logSafe: {redact: () => '<redacted>'}, sleep: async () => {}, PopupMessage: {alert() {}}, debug: {}});
  run(beginSection('packages/lib/src/nico/ThreadLoader.js') + ';globalThis.realThreadLoader=ThreadLoader;', c);
  const info = {videoId: 'so9', threadId: 10, language: 'ja-jp', is184Forced: false};
  Object.assign(h.dialog, {_watchId: 'so9', _requestId: 'r1', _threadInfo: info,
    _videoInfo: {msgInfo: {threadInfo: info, nvComment: {server: 'https://comments.invalid', params: {language: 'ja-jp'}}, videoId: 'so9', threadId: 10, language: 'ja-jp', threads: [], defaultThread: {is184Forced: false}}},
    threadLoader: c.realThreadLoader, _nicoVideoPlayer: h.player});
  h.dialog.execCommand = (cmd, text) => { if (cmd === 'alert') { alerts.push(String(text)); } };
  return {h, alerts, counts: () => ({posts, keys, loads})};
}

describe('Task186 post key and acknowledgement checks (Watch V4 audit F12)', () => {
  for (const data of [{}, {postKey: ''}, {postKey: 42}, null]) {
    it(`no POST when the post key is missing: ${JSON.stringify(data)}`, async () => {
      const p = posting({key: () => res(200, data), post: () => res(200, {no: 1, id: 'x'})});
      const e = await p.h.dialog.addChat('fixture', '', 0).then(() => null, x => x);
      assert.strictEqual(e.reason, 'post-key-missing');
      assert.strictEqual(p.counts().posts, 0);
      assert.strictEqual(p.h.state.isCommentPosting, false);
      assert.strictEqual(p.h.cachePuts.length, 0);
    });
  }

  for (const data of [{}, {id: 'only-id'}, {no: 'abc'}, null]) {
    it(`an incomplete acknowledgement is unknown, not success, and not re-posted: ${JSON.stringify(data)}`, async () => {
      const p = posting({key: () => res(200, {postKey: 'fixture'}), post: () => res(200, data)});
      const e = await p.h.dialog.addChat('fixture', '', 0).then(() => null, x => x);
      assert.strictEqual(e.reason, 'ack-incomplete');
      assert.strictEqual(e.outcome, 'unknown');
      assert.strictEqual(p.counts().posts, 1);
      assert.strictEqual(p.h.cachePuts.length, 0, 'no success history');
      assert.strictEqual(p.h.state.isCommentPosting, false);
      assert(p.alerts.some(a => a.includes('確認できませんでした')));
    });
  }

  it('a numeric comment number is accepted even without id; one post, one history entry', async () => {
    const p = posting({key: () => res(200, {postKey: 'fixture'}), post: () => res(200, {no: 7})});
    const r = await p.h.dialog.addChat('fixture', '', 0);
    assert.strictEqual(r.no, 7);
    assert.strictEqual(p.counts().posts, 1);
    assert.strictEqual(p.h.cachePuts.length, 1);
  });

  it('token rejection is still retried exactly once with a fresh key', async () => {
    const p = posting({key: n => res(200, {postKey: 'fixture-' + n}),
      post: n => (n === 1 ? {status: 403, ok: false, json: async () => ({meta: {status: 403, errorCode: 'EXPIRED_TOKEN'}})} : res(200, {no: 2, id: 'ok'}))});
    const r = await p.h.dialog.addChat('fixture', '', 0);
    assert.strictEqual(r.no, 2);
    assert.deepStrictEqual(p.counts(), {posts: 2, keys: 2, loads: 1});
  });
});
