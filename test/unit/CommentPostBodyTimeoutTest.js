// Task185 (Watch V4 audit F11): the comment post-key and POST requests have a deadline
// that also covers reading the response body. A stalled body releases the posting state,
// is reported as "result unknown", is never re-posted, and is not saved as a success.
// The real netUtil / ThreadLoader / Dialog code is used; network and clock are fakes.
const assert = require('assert');
const {beginSection, run} = require('../helpers/extractSource');
const {createDialogHarness, flush, deferred} = require('../helpers/dialogHarness');

const ok = data => ({status: 200, ok: true, json: async () => ({meta: {status: 200}, data})});

const {assertSafePostDiagnosticRecord} = require('../helpers/strictPostDiagnostic');

function posting(fetcher) {
  const h = createDialogHarness(), alerts = [];
  const c = h.context;
  Object.assign(c, {AbortController, location: {host: 'www.nicovideo.jp'}, fetch: fetcher,
    logSafe: {redact: value => value}, sleep: async () => {}, PopupMessage: {alert() {}}, debug: {}});
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

  it('Task215 keeps HTTP status in diagnostics when the POST body is not JSON', async () => {
    let posts = 0;
    const {h} = posting(async (url, options) => {
      if (options && options.method === 'POST') {
        posts++;
        return {status: 502, ok: false, json: async () => { throw new SyntaxError('invalid json'); }};
      }
      return ok({postKey: 'fixture'});
    });
    const consoleCalls = [];
    h.context.console.log = (...args) => consoleCalls.push(args);
    const e = await h.dialog.addChat('fixture', '', 0).then(() => null, x => x);
    assert.strictEqual(e.reason, 'network', 'outward behavior stays unchanged');
    const diagnostics = consoleCalls.filter(args => args[0] === '[ZenzaWatch][CommentPost]');
    assert(diagnostics.length > 0, 'structured diagnostic records exist');
    diagnostics.forEach(assertSafePostDiagnosticRecord);
    const failures = diagnostics.filter(args => args[1].statusCode === 502);
    assert.strictEqual(failures.length, 1, 'one retained HTTP failure record');
    assert.strictEqual(failures[0][1].statusCode, 502);
    assert.strictEqual(posts, 1, 'unknown acceptance must not trigger a duplicate POST');
    assert.strictEqual(h.state.isCommentPosting, false, 'posting state is released');
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


describe('R5 strict diagnostic object and JSON parity', () => {
  const record = payload => ['[ZenzaWatch][CommentPost]', payload, JSON.stringify(payload)];
  it('accepts only retained primitive diagnostics and exact JSON', () => {
    assertSafePostDiagnosticRecord(record({attempt:1,statusCode:502,hasNo:false}));
    assertSafePostDiagnosticRecord(record({attempt:2,retryAfterMs:0,delayMs:1,nextAttempt:3,
      commandCount:2,retryScheduled:true,postKeyPresent:true,challengeRequired:false,hasId:false}));
  });
  it('rejects opaque or arbitrary fields instead of hiding them from the test', () => {
    for (const key of ['phase','event','errorName','outcome','videoId','threadId','postKey','body','unknown']) {
      assert.throws(() => assertSafePostDiagnosticRecord(record({attempt:1,[key]:'synthetic-private'})),
        undefined, 'unexpected field must fail: '+key);
    }
    for (const payload of [{attempt:NaN},{attempt:Infinity},{attempt:-1},
      {attempt:'1'},{statusCode:99},{statusCode:600},{statusCode:502.5},
      {hasNo:'false'},{hasNo:0},{attempt:{nested:1}},[]]) {
      assert.throws(() => assertSafePostDiagnosticRecord(record(payload)));
    }
  });
  it('rejects extra arguments, wrong prefix and missing or inconsistent JSON', () => {
    for (const args of [record({attempt:1}).concat('extra'),
      ['other',{attempt:1},'{"attempt":1}'], ['[ZenzaWatch][CommentPost]',{attempt:1}],
      ['[ZenzaWatch][CommentPost]',{attempt:1},'{"attempt":2}'],
      ['[ZenzaWatch][CommentPost]',{attempt:1},'{bad'],
      ['[ZenzaWatch][CommentPost]',{attempt:1},{attempt:1}]]) {
      assert.throws(() => assertSafePostDiagnosticRecord(args));
    }
  });
});
