// Task185 (Watch V4 audit F11): the comment post-key and POST requests have a deadline
// that also covers reading the response body. A stalled body releases the posting state,
// is reported as "result unknown", is never re-posted, and is not saved as a success.
// The real netUtil / ThreadLoader / Dialog code is used; network and clock are fakes.
const assert = require('assert');
const {beginSection, run} = require('../helpers/extractSource');
const {createDialogHarness, flush, deferred} = require('../helpers/dialogHarness');

const ok = data => ({status: 200, ok: true, json: async () => ({meta: {status: 200}, data})});
function posting(fetcher) {
  const h = createDialogHarness(), alerts = [];
  const c = h.context;
  Object.assign(c, {AbortController, location: {host: 'www.nicovideo.jp'}, fetch: fetcher,
    logSafe: {redact: () => '<redacted>'}, sleep: async () => {}, PopupMessage: {alert() {}}, debug: {}});
  run(beginSection('packages/lib/src/infra/netUtil.js') + ';globalThis.netUtil=netUtil;', c);
  run(beginSection('packages/lib/src/nico/ThreadLoader.js') + ';globalThis.realThreadLoader=ThreadLoader;', c);
  const info = {videoId: 'so9', threadId: 10, language: 'ja-jp', is184Forced: false};
  Object.assign(h.dialog, {_watchId: 'so9', _requestId: 'r1', _threadInfo: info,
    _videoInfo: {msgInfo: {threadInfo: info, nvComment: {server: 'https://comments.invalid'}}},
    threadLoader: c.realThreadLoader, _nicoVideoPlayer: h.player});
  h.dialog.execCommand = (cmd, text) => { if (cmd === 'alert') { alerts.push(String(text)); } };
  return {h, alerts};
}

describe('Task185 comment post response-body deadline (Watch V4 audit F11)', () => {
  it('a POST whose body never arrives settles, frees posting, and is not re-posted', async () => {
    let posts = 0;
    const body = deferred();
    const {h, alerts} = posting(async (url, options) => {
      if (options && options.method === 'POST') { posts++; return {status: 200, ok: true, json: () => body.promise}; }
      return ok({postKey: 'fixture'});
    });
    let settled = null;
    const pending = h.dialog.addChat('fixture', '', 0).then(() => { settled = 'ok'; }, e => { settled = e; });
    await flush();
    assert.strictEqual(h.state.isCommentPosting, true);
    h.timers.advance(31000);
    await flush();
    assert.notStrictEqual(settled, null, 'post settles after the deadline');
    assert.strictEqual(settled.outcome, 'unknown');
    assert.strictEqual(settled.reason, 'body-timeout');
    assert.strictEqual(h.state.isCommentPosting, false);
    assert.strictEqual(posts, 1, 'never re-posted automatically');
    assert.strictEqual(h.cachePuts.length, 0, 'not recorded as a success');
    assert(alerts.some(a => a.includes('確認できませんでした')));
    body.resolve({meta: {status: 200}, data: {no: 1, id: 'late'}});
    await pending; await flush();
    assert.strictEqual(h.cachePuts.length, 0, 'a late body does not create history');
  });

  it('a POST without response headers is bounded too and reported as header timeout', async () => {
    let posts = 0;
    const {h} = posting(async (url, options) => {
      if (options && options.method === 'POST') { posts++; return new Promise(() => {}); }
      return ok({postKey: 'fixture'});
    });
    let settled = null;
    h.dialog.addChat('fixture', '', 0).catch(e => { settled = e; });
    await flush();
    h.timers.advance(31000);
    await flush();
    assert.strictEqual(settled && settled.reason, 'header-timeout');
    assert.strictEqual(posts, 1);
    assert.strictEqual(h.state.isCommentPosting, false);
  });

  it('a stalled post-key body stops before any POST', async () => {
    let posts = 0;
    const {h} = posting(async (url, options) => {
      if (options && options.method === 'POST') { posts++; return ok({no: 1, id: 'x'}); }
      return {status: 200, ok: true, json: () => new Promise(() => {})};
    });
    let settled = null;
    h.dialog.addChat('fixture', '', 0).catch(e => { settled = e; });
    await flush();
    h.timers.advance(31000);
    await flush();
    assert(settled, 'settled');
    assert.strictEqual(posts, 0);
    assert.strictEqual(h.state.isCommentPosting, false);
  });

  it('a network failure is classified and not re-posted', async () => {
    let posts = 0;
    const {h} = posting(async (url, options) => {
      if (options && options.method === 'POST') { posts++; throw new TypeError('Failed to fetch'); }
      return ok({postKey: 'fixture'});
    });
    const e = await h.dialog.addChat('fixture', '', 0).then(() => null, x => x);
    assert.strictEqual(e.reason, 'network');
    assert.strictEqual(posts, 1);
  });

  it('a normal post still succeeds once and is saved once', async () => {
    let posts = 0;
    const {h} = posting(async (url, options) => {
      if (options && options.method === 'POST') { posts++; return ok({no: 3, id: 'fixture-comment'}); }
      return ok({postKey: 'fixture'});
    });
    const r = await h.dialog.addChat('fixture', '', 123);
    assert.strictEqual(r.no, 3);
    assert.strictEqual(posts, 1);
    assert.strictEqual(h.cachePuts.length, 1);
    assert.strictEqual(h.timers.pending(), 0, 'no deadline timer left behind');
  });
});
