'use strict';
// Test-first prototype: optional cache warmups must not delay required startup workers.
// Run the ACTUAL generated src/initializer.js function using the source VM helper.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return {promise, resolve, reject};
};
const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
};
function harness(host = 'www.nicovideo.jp') {
  const calls = [], warnings = [];
  const requiredStoryboard = deferred(), requiredVideo = deferred();
  const optionalStoryboard = deferred(), optionalWatch = deferred();
  const consoleStub = {
    time: label => calls.push('timerStart:' + label),
    timeEnd: label => calls.push('timerEnd:' + label),
    warn: reason => warnings.push(String(reason))
  };
  const context = createContext({
    location: {host},
    console: consoleStub,
    window: {console: consoleStub},
    CommentLayoutWorker: {getInstance: () => calls.push('commentWorker')},
    ThumbInfoLoader: {load: () => {
      calls.push('thumbnailWarmup');
      return Promise.resolve();
    }},
    StoryboardWorker: {initWorker: () => {
      calls.push('requiredStoryboard');
      return requiredStoryboard.promise;
    }},
    VideoSessionWorker: {initWorker: () => {
      calls.push('requiredVideo');
      return requiredVideo.promise;
    }},
    StoryboardCacheDb: {initWorker: () => {
      calls.push('optionalStoryboard');
      return optionalStoryboard.promise;
    }},
    WatchInfoCacheDb: {initWorker: () => {
      calls.push('optionalWatch');
      return optionalWatch.promise;
    }}
  });
  run('const warmWatchCache = ' + extract('src/initializer.js', 'warmWatchCache', 'var') + ';', context);
  run('globalThis.__startupInitWorker = ' +
    extract('src/initializer.js', 'initWorker', 'var') + ';', context);
  return {
    invoke: (...args) => context.__startupInitWorker(...args),
    calls, warnings,
    requiredStoryboard, requiredVideo,
    optionalStoryboard, optionalWatch
  };
}

describe('Startup optional cache warm-up gate, actual current initializer (synthetic)', function() {
  it('warms watch history during HLS setup only on an ordinary visible desktop search', async () => {
    for (const mode of ['ordinary', 'explicit', 'resume', 'hidden', 'noIdle', 'override', 'otherPage', 'failedWorker']) {
      const calls = [];
      const hls = deferred(), cache = deferred(), stop = new Error('end of probe');
      const policies = [], updates = {};
      let capacity = 128;
      const ordinary = mode === 'ordinary' || mode === 'failedWorker';
      const workerError = new Error('worker unavailable');
      const menu = {waitForPlayerIdle: async () => { calls.push('idle'); }};
      const context = createContext({
        window: {name: '', requestIdleCallback: mode === 'noIdle' ? undefined : () => {}},
        location: {hash: '', search: mode === 'explicit' ? '?playlist=1' : '?sort=h'},
        sessionStorage: {getItem: () => mode === 'resume' ? '' : null},
        navigator: {userAgent: 'desktop'}, document: {hidden: mode === 'hidden', body: {classList: {toggle() {}}}},
        URLSearchParams, Config: {props: {overrideGinza: mode === 'override'},
          getValue: key => key === 'storyboardCacheMaxMB' ? capacity : 7,
          onkey: (key, handler) => { updates[key] = handler; }},
        StoryboardCacheDb: {configure: async (policy, onFirstUse) => { policies.push([policy.maxBytes, onFirstUse]); }},
        ZenzaWatch: {}, Emitter: {}, dimport() {},
        HlsRuntime: {install: () => hls.promise}, warmWatchCache: () => { calls.push('cache'); return cache.promise; },
        domEvent: {dispatchCustomEvent() {}}, textUtil: {parseQuery: () => ({})}, START_PAGE_QUERY: '',
        initializeBySite() {}, addCommonStyle() {}, replaceRedirectLinks: async () => {}, uq: {ready: async () => {}},
        isWatchPage: async () => false, createHoverMenu: () => menu, global: {emitter: {promise: async () => {}}},
        NicoComment: {offscreenLayer: {get: async () => {}}},
        initWorker: async (thumbnail, pending) => {
          calls.push([thumbnail, pending === cache.promise]);
          if (mode === 'failedWorker') throw workerError;
        },
        initializeDialogPlayer() { throw stop; }
      });
      const initialize = run('(' + extract('src/initializer.js', 'initializePlayer', 'var') + ')', context);
      const completion = initialize(null, mode === 'otherPage' ? null : menu);
      assert.deepStrictEqual(policies, [[128 * 1024 * 1024, ordinary]], mode);
      capacity = 0;
      updates.storyboardCacheMaxMB(0);
      assert.deepStrictEqual(policies.at(-1), [0, false], mode);
      await flush();
      assert.deepStrictEqual(calls, ordinary ? ['cache','idle',[false,true]] : [], mode);
      hls.resolve();
      await assert.rejects(completion, error => error === (mode === 'failedWorker' ? workerError : stop));
      const expected = ordinary ? ['cache','idle',[false,true]] : [[mode === 'otherPage',false]];
      if (mode === 'ordinary') expected.push('idle');
      assert.deepStrictEqual(calls, expected, mode);
    }
  });

  it('reuses the early search watch cache and omits the unrelated thumbnail warm-up', async () => {
    const h = harness();
    const cache = deferred();
    let ready = false;
    const complete = h.invoke(false, cache.promise).then(() => { ready = true; });
    h.requiredStoryboard.resolve();
    h.requiredVideo.resolve();
    await flush();
    assert.strictEqual(ready, false);
    assert.deepStrictEqual(h.calls, ['requiredVideo']);
    cache.resolve();
    await complete;
  });

  it('starts all four worker/cache warmups without dropping any', async () => {
    const h = harness();
    const complete = h.invoke();
    assert.deepStrictEqual(h.calls.slice(0, 7), [
      'commentWorker', 'thumbnailWarmup', 'timerStart:init Workers',
      'requiredStoryboard', 'requiredVideo', 'optionalStoryboard', 'optionalWatch'
    ]);
    h.requiredStoryboard.resolve();
    h.requiredVideo.resolve();
    h.optionalStoryboard.resolve();
    h.optionalWatch.resolve();
    await complete;
    assert(h.calls.includes('timerEnd:init Workers'));
  });

  it('does not block startup on pending storyboard cache after required workers and watch cache finish', async () => {
    const h = harness();
    let ready = false;
    const complete = h.invoke().then(() => { ready = true; });
    h.requiredStoryboard.resolve();
    h.requiredVideo.resolve();
    h.optionalWatch.resolve();
    await flush();
    assert.strictEqual(ready, true,
      'the optional storyboard cache must not delay Dialog construction once Watch cache is ready');
    assert.strictEqual(h.calls.filter(x => x === 'optionalStoryboard').length, 1);
    assert.strictEqual(h.calls.filter(x => x === 'optionalWatch').length, 1);
    h.optionalStoryboard.resolve();
    await complete;
  });

  it('still waits for both required worker initializations', async () => {
    const h = harness();
    let ready = false;
    const complete = h.invoke().then(() => { ready = true; });
    h.optionalWatch.resolve();
    h.requiredStoryboard.resolve();
    await flush();
    assert.strictEqual(ready, false);
    h.requiredVideo.resolve();
    await flush();
    assert.strictEqual(ready, true);
    h.optionalStoryboard.resolve();
    await complete;
  });

  it('retains the Watch history DB prewarm barrier before making Dialog ready', async () => {
    const h = harness();
    let ready = false;
    const complete = h.invoke().then(() => { ready = true; });
    h.requiredStoryboard.resolve();
    h.requiredVideo.resolve();
    h.optionalStoryboard.resolve();
    await flush();
    assert.strictEqual(ready, false,
      'WatchInfoCacheDb.get is on the next pre-session path; do not shift its open wait there');
    h.optionalWatch.resolve();
    await flush();
    assert.strictEqual(ready, true);
    await complete;
  });

  it('optional cache rejections are handled without aborting required worker readiness', async () => {
    const h = harness();
    const complete = h.invoke();
    h.optionalStoryboard.reject(new Error('synthetic storyboard DB unavailable'));
    h.optionalWatch.reject(new Error('synthetic watch DB unavailable'));
    h.requiredStoryboard.resolve();
    h.requiredVideo.resolve();
    await complete;
    await flush();
    assert.deepStrictEqual(h.warnings.sort(), [
      'Storyboard cache unavailable', 'Watch info cache unavailable'
    ].sort());
  });

  it('required worker failure still rejects initialization', async () => {
    const h = harness();
    const complete = h.invoke();
    h.requiredStoryboard.reject(new Error('synthetic required Worker failure'));
    h.requiredVideo.resolve();
    h.optionalStoryboard.resolve();
    h.optionalWatch.resolve();
    await assert.rejects(complete, /synthetic required Worker failure/);
  });

  it('non-NicoNico host skips all startup workers and caches', () => {
    const h = harness('fixture.invalid');
    assert.strictEqual(h.invoke(), undefined);
    assert.deepStrictEqual(h.calls, []);
  });
});
