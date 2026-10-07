// Task177 (Watch V4 audit F09 + HLS/Darasan addenda B/3): resume position is saved with
// the official v2 contract (PUT /v2/users/me/watch/history/playback-position, JSON
// {videoId, seconds}); HTTP and API failures are detected instead of resolving.
// The v1 form request returned 404 NOT_FOUND in the 2026-10-01 captures. No real
// request is sent; fetch is replaced and its final arguments are inspected.
const assert = require('assert');
const {beginSection, extract, createContext, run} = require('../helpers/extractSource');
const {createDialogHarness, flush} = require('../helpers/dialogHarness');

function position(responder, rel = 'packages/lib/src/nico/PlaybackPosition.js') {
  const requests = [];
  const c = createContext({netUtil: {fetch: async (url, options) => { requests.push({url, options}); return responder(); }}});
  const code = rel === 'dist/ZenzaWatch-dev.user.js'
    ? extract(rel, 'PlaybackPosition', 'var')
    : beginSection(rel) + ';PlaybackPosition;';
  const value = run(code, c);
  return {value, requests};
}
const res = (status, text) => ({ok: status >= 200 && status < 300, status, text: async () => text});
const jsonOnly = (status, body) => ({ok: status >= 200 && status < 300, status, json: async () => body});

describe('Task177 playback position uses the v2 contract and detects failures', () => {
  it('sends one JSON PUT with the canonical videoId and numeric seconds', async () => {
    const h = position(() => res(200, '{"meta":{"status":200}}'));
    await h.value.record('so46814227', 31.4, 6, 0);
    assert.strictEqual(h.requests.length, 1);
    const {url, options} = h.requests[0];
    assert.strictEqual(url, 'https://nvapi.nicovideo.jp/v2/users/me/watch/history/playback-position');
    assert.strictEqual(options.method, 'PUT');
    assert.strictEqual(options.credentials, 'include');
    assert.strictEqual(options.headers['Content-Type'], 'application/json');
    assert.strictEqual(options.headers['X-Frontend-Id'], '6');
    assert.strictEqual(options.headers['X-Frontend-Version'], '0');
    assert.deepStrictEqual(JSON.parse(options.body), {videoId: 'so46814227', seconds: 31.4});
  });

  it('keeps generated dev dist v2 playback-position request contract in parity with source', async () => {
    const h = position(() => res(200, '{"meta":{"status":200}}'), 'dist/ZenzaWatch-dev.user.js');
    await h.value.record('so46814227', 31.4, 6, 0);
    assert.strictEqual(h.requests.length, 1);
    const {url, options} = h.requests[0];
    assert.strictEqual(url, 'https://nvapi.nicovideo.jp/v2/users/me/watch/history/playback-position');
    assert.strictEqual(options.method, 'PUT');
    assert.strictEqual(options.credentials, 'include');
    assert.strictEqual(options.headers['Content-Type'], 'application/json');
    assert.deepStrictEqual(JSON.parse(options.body), {videoId: 'so46814227', seconds: 31.4});
  });

  it('accepts 200 with meta 200, and 204 / empty bodies', async () => {
    await position(() => res(200, '{"meta":{"status":200}}')).value.record('sm9', 0, 6, 0);
    await position(() => res(204, '')).value.record('sm9', 10, 6, 0);
    await position(() => res(200, '')).value.record('sm9', 10, 6, 0);
    await position(() => jsonOnly(200, {meta: {status: 200}})).value.record('sm9', 10, 6, 0);
  });

  for (const status of [401, 403, 404, 429, 500, 503]) {
    it(`rejects HTTP ${status}`, async () => {
      await assert.rejects(position(() => res(status, '{"meta":{"status":' + status + '}}')).value.record('sm9', 25, 6, 0),
        e => e.status === status);
    });
  }

  it('rejects an API failure inside HTTP 200 and an unparsable body', async () => {
    await assert.rejects(position(() => res(200, '{"meta":{"status":500,"errorCode":"INTERNAL"}}')).value.record('sm9', 25, 6, 0),
      e => e.status === 500 && e.reason === 'api');
    await assert.rejects(position(() => jsonOnly(200, {meta: {status: 500}})).value.record('sm9', 25, 6, 0));
    await assert.rejects(position(() => res(200, '<html>')).value.record('sm9', 25, 6, 0), e => e.reason === 'invalid-body');
  });

  it('does not send for a numeric watch ID, non-finite or negative seconds', async () => {
    for (const [id, sec] of [['1234567890', 10], ['', 10], ['sm9', NaN], ['sm9', -1], ['sm9', Infinity], ['sm9', '10']]) {
      const h = position(() => res(200, '{"meta":{"status":200}}'));
      await assert.rejects(h.value.record(id, sec, 6, 0));
      assert.strictEqual(h.requests.length, 0, `${id}/${sec}`);
    }
  });
});

describe('Task177 dialog sends the canonical video ID, guarded by the context watch ID', () => {
  function dialog({contextWatchId = '1234567890', videoId = 'so9', duration = 300} = {}) {
    const h = createDialogHarness();
    const calls = [], warns = [];
    h.context.PlaybackPosition = {record: async (...a) => { calls.push(a); }};
    h.context.console.warn = (...a) => warns.push(a);
    Object.defineProperty(h.dialog, 'duration', {value: duration, configurable: true});
    h.dialog._videoInfo = {contextWatchId, videoId, msgInfo: {frontendId: 6, frontendVersion: 0}};
    const save = h.Dialog.prototype._savePlaybackPosition.bind(h.dialog);
    return {h, calls, warns, save};
  }

  it('a numeric channel watch ID is checked as context, while v2 receives video.id', () => {
    const d = dialog();
    d.save('1234567890', 70);
    assert.deepStrictEqual(d.calls.map(c => c.slice(0, 2)), [['so9', 70]]);
  });

  it('saves sub-120s long-form while preserving other-video, shorts, near-end and logged-out guards', () => {
    const d = dialog();
    d.save('smOther', 70);
    const long96 = dialog({contextWatchId: 'sm96', videoId: 'sm96', duration: 96});
    long96.save('sm96', 30);
    const long119 = dialog({contextWatchId: 'sm119', videoId: 'sm119', duration: 119});
    long119.save('sm119', 70);
    const short = dialog({contextWatchId: 'ss9', videoId: 'ss9', duration: 60});
    short.save('ss9', 20);
    const end = dialog(); end.save('1234567890', 299);
    const out = dialog(); out.h.context.util.isLogin = () => false; out.save('1234567890', 70);

    assert.deepStrictEqual(long96.calls.map(c => c.slice(0, 2)), [['sm96', 30]]);
    assert.deepStrictEqual(long119.calls.map(c => c.slice(0, 2)), [['sm119', 70]]);
    assert.strictEqual(d.calls.length + short.calls.length + end.calls.length + out.calls.length, 0);
  });

  it('a rejected save is reported without the request body and is not retried', async () => {
    const d = dialog();
    d.h.context.PlaybackPosition = {record: async (...a) => { d.calls.push(a); throw {reason: 'http', status: 404}; }};
    d.save('1234567890', 70);
    await flush();
    assert.strictEqual(d.calls.length, 1);
    assert.strictEqual(d.warns.length, 1);
    assert(JSON.stringify(d.warns).includes('404'));
  });
});
