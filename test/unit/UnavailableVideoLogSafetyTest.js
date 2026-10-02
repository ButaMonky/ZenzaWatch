// Task174 (Watch V4 audit F14): an unplayable video must not write the raw watch
// response (lazy/auth keys, access-right keys, thread keys, signed URLs) into normal
// console logs. Only synthetic sentinel values are used.
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');
const {createDialogHarness, flush} = require('../helpers/dialogHarness');

const SECRETS = ['FAKE_LAZY_AUTH_SENTINEL', 'FAKE_ACCESS_RIGHT_SENTINEL', 'FAKE_THREAD_KEY_SENTINEL', 'https://signed.invalid/FAKE_SIGNED_SENTINEL'];

function payload() {
  return {data: {response: {$watchV4: {data: {
    client: {watchId: 'so9', watchTrackId: 'track'},
    comment: {threads: [{id: 10, fork: 0, isPostTarget: true}], layers: [{index: 1, components: [{threadId: 10, fork: 0}]}], ng: {}, nvComment: {server: 'https://comments.invalid', threadKey: SECRETS[2]}},
    media: null,
    player: {initialPlayback: {positionSec: 0}},
    video: {id: 'so9', title: 'test', duration: 60, count: {view: 1}, thumbnail: {url: SECRETS[3]}, permission: {}},
    genre: {key: 'anime', label: 'anime'}, tags: {items: [], edit: {isEditable: false}},
    payment: {ppv: {isEnabled: true}, admission: {isEnabled: false}, premium: {isEnabled: false}},
    viewer: null, lazy: {authKey: SECRETS[0]}, accessRightKey: SECRETS[1]
  }}}}};
}
const captured = () => {
  const logs = [];
  const sink = name => (...args) => logs.push([name, ...args]);
  const console = {};
  for (const k of ['log', 'info', 'warn', 'error', 'debug', 'time', 'timeEnd']) { console[k] = sink(k); }
  return {console, text: () => JSON.stringify(logs, (k, v) => (v instanceof Error ? {message: v.message} : v))};
};

describe('Task174 unavailable-video logs (Watch V4 audit F14)', () => {
  it('VideoInfoLoader failure logs do not contain lazy/auth/thread keys or signed URLs', async () => {
    const out = captured();
    const p = payload();
    const context = createContext({
      console: out.console, CacheStorage: class { setItem() {} }, sessionStorage: {},
      netUtil: {fetch: async url => ({json: async () => (String(url).includes('/lazy/') ? {meta: {status: 200}, data: {}} : p)})},
      nicoUtil: {hasLargeThumbnail: () => false}, textUtil: {}, Config: {getValue: () => false},
      emitter: {emitAsync() {}}, debug: {}
    });
    run(beginSection('packages/lib/src/nico/VideoInfoLoader.js') + ';globalThis.loader=VideoInfoLoader;', context);
    const err = await context.loader.load('so9', {}).then(() => null, e => e);
    assert(err, 'unplayable video rejects');
    assert.strictEqual(err.info.isNeedPayment, true, 'callers still receive the classification');
    assert.strictEqual(err.message, 'この動画は有料です');
    const text = out.text();
    for (const secret of SECRETS) { assert(!text.includes(secret), `${secret} escaped into console`); }
    assert(/need payment/.test(text), 'the safe reason is still logged');
  });

  it('the dialog failure log keeps only safe fields', async () => {
    const h = createDialogHarness();
    const logs = [];
    h.context.console.error = (...args) => logs.push(args);
    h.dialog._requestId = 'r1';
    h.dialog._onVideoInfoLoaderFail('r1', {watchId: 'so9', message: 'この動画は有料です', reason: 'need payment',
      info: {watchApiData: {videoDetail: {}}, lazy: {authKey: SECRETS[0]}, nvComment: {threadKey: SECRETS[2]}}});
    await flush();
    const text = JSON.stringify(logs);
    for (const secret of SECRETS) { assert(!text.includes(secret), `${secret} escaped into dialog log`); }
    assert(text.includes('so9') && text.includes('need payment'));
    assert.strictEqual(h.state.isError, true);
  });
});
