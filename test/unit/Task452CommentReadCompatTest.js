// Task452 NICOCOMPAT-04 phase 1: fail closed on malformed comment-read payloads.
// Synthetic responses only. Never access the live website or submit comments.
'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function harness(reply) {
  const requests = [], notices = [], waits = [];
  const logger = {log() {}, info() {}, warn() {}, error() {}, time() {}, timeEnd() {}};
  const ctx = createContext({
    console: logger, debug: {}, logSafe: {redact: value => value},
    PopupMessage: {alert: text => notices.push(text)},
    sleep: async ms => { waits.push(ms); },
    netUtil: {fetch: async (url, options = {}) => {
      requests.push({url: String(url), options});
      const response = typeof reply === 'function' ? reply(String(url)) : reply;
      return {status: response?.meta?.status || 200,
        headers: {get: () => null}, json: async () => response};
    }}
  });
  run(beginSection('packages/lib/src/nico/ThreadLoader.js') +
    ';globalThis.__commentLoader=ThreadLoader;', ctx);
  const msg = {
    videoId: 'sm9', threadId: '10', userId: 'fixture',
    language: 'ja-jp', when: 0,
    defaultThread: {is184Forced: false},
    threads: [{id: '10', forkLabel: 'main'}],
    nvComment: {
      server: 'https://public.nvcomment.nicovideo.jp',
      threadKey: 'offline-key',
      params: {language: 'ja-jp', targets: [{id: '10', fork: 'main'}]}
    }
  };
  return {loader: ctx.__commentLoader, msg, requests, notices, waits};
}
const thread = (id = '10', fork = 'main') => ({
  id, fork, commentCount: 1, comments: [{id: 'fixture-comment'}]
});
const data = () => ({globalComments: [{count: 1}], threads: [thread()]});
const ok = body => ({meta: {status: 200}, data: body});
async function catchError(p) {
  try { await p; } catch (error) { return error; }
  assert.fail('expected a protocol failure');
}
async function expectSchemaFailure(payload) {
  const h = harness(payload);
  const err = await catchError(h.loader.load(h.msg));
  assert.strictEqual(err.result?.kind, 'schema', 'explicit schema classification');
  assert.strictEqual(err.result?.errorCode, 'RESPONSE_SCHEMA');
  assert.strictEqual(h.requests.length, 1, 'malformed payload must not retry');
  assert.strictEqual(h.notices.length, 0, 'no repeated alerts for a schema failure');
  assert.deepStrictEqual(h.waits, [], 'no needless delay for an unknown format');
  assert.strictEqual(h.msg.threadInfo, undefined, 'do not install bogus thread context');
  return h;
}
describe('Task452 comment read adapter / NICOCOMPAT-04 phase 1', () => {
  it('preserves good current-thread read, counts and language', async () => {
    const h = harness(ok(data()));
    const result = await h.loader.load(h.msg);
    assert.strictEqual(result.format, 'threads');
    assert.strictEqual(result.threadInfo.totalResCount, 1);
    assert.strictEqual(result.threadInfo.language, 'ja-jp');
    assert.strictEqual(result.body.threads[0].info, h.msg.threads[0]);
    assert.strictEqual(h.requests.length, 1);
  });
  it('preserves a legitimate empty thread response', async () => {
    const h = harness(ok({globalComments: [], threads: []}));
    const result = await h.loader.load(h.msg);
    assert.strictEqual(result.threadInfo.totalResCount, 0);
    assert.strictEqual(result.body.threads.length, 0);
  });
  it('rejects missing and malformed API success envelopes explicitly', async () => {
    for (const payload of [null, {}, {data: data()}, {meta: {status: '200'}, data: data()}]) {
      await expectSchemaFailure(payload);
    }
  });
  it('rejects malformed read shapes instead of accepting an empty comment list', async () => {
    for (const bad of [null, {}, {threads: []}, {globalComments: []},
      {globalComments: {}, threads: []}, {globalComments: [], threads: {}}]) {
      await expectSchemaFailure(ok(bad));
    }
  });
  it('rejects invalid global comment totals instead of NaN or negative totals', async () => {
    for (const count of [-1, 1.5, '1', NaN, Infinity]) {
      await expectSchemaFailure(ok({globalComments: [{count}], threads: []}));
    }
  });
  it('rejects a thread belonging to another video or fork', async () => {
    await expectSchemaFailure(ok({globalComments: [], threads: [thread('999')]}));
    await expectSchemaFailure(ok({globalComments: [], threads: [thread('10', 'owner')]}));
  });
  it('rejects duplicate thread identities and malformed comments', async () => {
    await expectSchemaFailure(ok({globalComments: [], threads: [thread(), thread()]}));
    await expectSchemaFailure(ok({globalComments: [], threads: [{...thread(), comments: {}}]}));
    await expectSchemaFailure(ok({globalComments: [], threads: [{...thread(), commentCount: -1}]}));
  });
  it('rejects invalid thread identifiers without changing the current video', async () => {
    for (const id of ['evil', null, -1, Infinity]) {
      await expectSchemaFailure(ok({globalComments: [], threads: [thread(id)]}));
    }
  });
  it('does not cache malformed refreshed thread keys', async () => {
    for (const value of [undefined, '', 42, null]) {
      const h = harness(ok({threadKey: value}));
      const err = await catchError(h.loader.getThreadKey('sm9'));
      assert.strictEqual(err.result?.kind, 'schema');
      assert.strictEqual(h.loader._threadKeys.sm9, undefined);
      assert.strictEqual(h.requests.length, 1);
    }
  });
});
