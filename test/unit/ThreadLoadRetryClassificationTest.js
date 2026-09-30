const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
function subject(sequence, language = 'ja-jp') {
  const waits = [], alerts = [], packets = []; let requests = 0, keyRequests = 0;
  const logger = {log() {}, warn() {}, error() {}, time() {}, timeEnd() {}};
  const c = createContext({console: logger, debug: {}, logSafe: {redact: value => value},
    PopupMessage: {alert: message => alerts.push(message)}, sleep: async ms => { waits.push(ms); },
    netUtil: {fetch: async (url, options) => {
      if (String(url).includes('/keys/thread')) {
        keyRequests++; return {json: async () => ({meta: {status: 200}, data: {threadKey: 'refreshed'}})};
      }
      packets.push(JSON.parse(options.body));
      const outcome = sequence[Math.min(requests++, sequence.length - 1)];
      if (outcome instanceof Error) { throw outcome; }
      return {json: async () => outcome === 'ok' ?
        {meta: {status: 200}, data: {threads: [], globalComments: []}} : {meta: outcome}};
    }}});
  run(beginSection('packages/lib/src/nico/ThreadLoader.js') + '\nglobalThis.loader = ThreadLoader;', c);
  const msgInfo = {videoId: 'sm9', userId: 'user', language, threadId: 'thread', threads: [],
    defaultThread: {is184Forced: false}, nvComment: {server: 'https://comment.nicovideo.jp', threadKey: 'initial', params: {language: 'ja-jp'}}};
  return {loader: c.loader, msgInfo, waits, alerts, packets, requests: () => requests, keyRequests: () => keyRequests};
}
async function rejected(promise) { try { await promise; } catch (error) { return error; } assert.fail('expected rejection'); }
describe('ZW031 partial ThreadLoader retry classification', () => {
  it('does not retry permanent 4xx and preserves the existing failure envelope', async () => {
    for (const status of [401, 403, 404, 410]) {
      const failure = {status, errorCode: 'PERMANENT'}, h = subject([failure]);
      const result = await rejected(h.loader.load(h.msgInfo));
      assert.strictEqual(result.result, failure); assert.strictEqual(typeof result.message, 'string');
      assert.strictEqual(h.requests(), 1); assert.deepStrictEqual(h.waits, []); assert.deepStrictEqual(h.alerts, []);
    }
  });
  it('keeps the bounded Task B-5 retries for plain 400 and expired thread keys', async () => {
    for (const failure of [{status: 400}, {status: 400, errorCode: 'EXPIRED_TOKEN'}]) {
      const h = subject([failure]); await rejected(h.loader.load(h.msgInfo));
      assert.strictEqual(h.requests(), 3); assert.deepStrictEqual(h.waits, [3000, 6000]); assert.strictEqual(h.keyRequests(), 2);
    }
  });
  it('propagates the original AbortError without waiting or retry alerts', async () => {
    const error = Object.assign(new Error('cancelled'), {name: 'AbortError'}), h = subject([error]);
    assert.strictEqual(await rejected(h.loader.load(h.msgInfo)), error);
    assert.strictEqual(h.requests(), 1); assert.deepStrictEqual(h.waits, []); assert.deepStrictEqual(h.alerts, []);
  });
  it('retains bounded retries for 408, 429, 503 and network errors', async () => {
    for (const failure of [{status: 408}, {status: 429}, {status: 503}, new TypeError('network')]) {
      const h = subject([failure]); await rejected(h.loader.load(h.msgInfo));
      assert.strictEqual(h.requests(), 3); assert.deepStrictEqual(h.waits, [3000, 6000]);
      assert.strictEqual(h.keyRequests(), 2); assert.strictEqual(h.alerts.length, 2);
    }
  });
  it('stops retrying after a transient failure recovers and preserves caller options', async () => {
    const h = subject([{status: 503}, 'ok']), options = Object.freeze({marker: 7});
    const result = await h.loader.load(h.msgInfo, options);
    assert.strictEqual(result.format, 'threads'); assert.strictEqual(h.requests(), 2); assert.deepStrictEqual(h.waits, [3000]);
    assert.deepStrictEqual(options, {marker: 7});
  });
  it('preserves one usable INVALID_PARAMETER language fallback and its actual language', async () => {
    const h = subject([{status: 400, errorCode: 'INVALID_PARAMETER'}, 'ok'], 'en-us');
    const result = await h.loader.load(h.msgInfo);
    assert.strictEqual(h.requests(), 2); assert.deepStrictEqual(h.waits, [3000]);
    assert.deepStrictEqual(h.packets.map(packet => packet.params.language), ['en-us', 'ja-jp']);
    assert.strictEqual(h.msgInfo.language, 'ja-jp'); assert.strictEqual(result.threadInfo.language, 'ja-jp');
  });
  it('does not repeatedly retry an unsuccessful or unavailable language fallback', async () => {
    const failure = {status: 400, errorCode: 'INVALID_PARAMETER'};
    const fallback = subject([failure], 'en-us'); await rejected(fallback.loader.load(fallback.msgInfo));
    assert.strictEqual(fallback.requests(), 2); assert.deepStrictEqual(fallback.waits, [3000]);
    const unavailable = subject([failure]); await rejected(unavailable.loader.load(unavailable.msgInfo));
    assert.strictEqual(unavailable.requests(), 1); assert.deepStrictEqual(unavailable.waits, []);
  });
});
