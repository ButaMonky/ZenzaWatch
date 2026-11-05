'use strict';
// Private offline compatibility of two *actual generated* startup modules.
// Entirely synthetic IndexedDB, no real videos, sites, tokens or network.
const assert = require('assert');
const {beginSection, extract, createContext, run, observe, deferred, ticks} =
  require('../helpers/idbRecoveryFixture');

const WATCH_ID = 'SYNTHETIC_DUAL_GATE_WATCH';
function harness() {
  const calls = [], warnings = [], reads = [], touches = [];
  const requiredStoryboard = deferred();
  const requiredVideo = deferred();
  const optionalStoryboard = deferred();
  const watchConnection = deferred();
  const db = {
    cache: {
      get(query) {
        const result = deferred();
        reads.push({query, ...result});
        calls.push('history.readonly-get');
        return result.promise;
      },
      updateTime(query) {
        const result = deferred();
        touches.push({query, ...result});
        calls.push('history.atomic-touch');
        return result.promise;
      }
    }
  };
  const logger = {
    time(label) { calls.push('timer-start:' + label); },
    timeEnd(label) { calls.push('timer-end:' + label); },
    warn(...args) { warnings.push(args); },
    log() {}, info() {}, error() {}
  };
  const ctx = createContext({
    location: {host: 'www.nicovideo.jp'},
    console: logger, window: {console: logger},
    IndexedDbStorage: {
      open() {
        calls.push('watch.db-prewarm');
        return watchConnection.promise;
      }
    },
    CommentLayoutWorker: {getInstance: () => calls.push('comment.worker')},
    ThumbInfoLoader: {load: () => {
      calls.push('thumb.warmup');
      return Promise.resolve();
    }},
    StoryboardWorker: {initWorker: () => {
      calls.push('storyboard.required-worker');
      return requiredStoryboard.promise;
    }},
    VideoSessionWorker: {initWorker: () => {
      calls.push('video.required-worker');
      return requiredVideo.promise;
    }},
    StoryboardCacheDb: {initWorker: () => {
      calls.push('storyboard.optional-db-warmup');
      return optionalStoryboard.promise;
    }}
  });
  // Both symbols below are evaluated from the actual GitHub candidate JS,
  // not parallel approximations of their algorithm.
  run(beginSection('packages/lib/src/nico/WatchInfoCacheDb.js') +
    ';\nglobalThis.__watchCacheSubject = WatchInfoCacheDb;', ctx);
  ctx.WatchInfoCacheDb = ctx.__watchCacheSubject;
  run('globalThis.__startupInitWorkerSubject = ' +
    extract('src/initializer.js', 'initWorker', 'var') + ';', ctx);
  return {
    invoke: () => ctx.__startupInitWorkerSubject(),
    watch: ctx.__watchCacheSubject,
    calls, warnings, reads, touches, db,
    requiredStoryboard, requiredVideo, optionalStoryboard, watchConnection
  };
}
async function flush() {
  await ticks();
  await new Promise(resolve => setImmediate(resolve));
}
function resolveWarmup(f) {
  f.requiredStoryboard.resolve();
  f.requiredVideo.resolve();
  f.watchConnection.resolve(f.db);
}
const historyRow = () => ({
  watchId: WATCH_ID,
  resume: [{now: 1, time: 34}],
  comment: [{text: 'synthetic-history'}]
});

describe('Startup: two independently approved private cache hypotheses coexist', function() {
  it('awaits real Watch cache prewarm but not optional Storyboard cache warmup', async () => {
    const f = harness();
    const init = observe(f.invoke());
    assert(f.calls.includes('watch.db-prewarm'));
    assert(f.calls.includes('storyboard.optional-db-warmup'));
    f.requiredStoryboard.resolve();
    f.requiredVideo.resolve();
    await flush();
    assert.strictEqual(init.status, 'pending', 'Watch DB prewarm remains required');
    f.watchConnection.resolve(f.db);
    await flush();
    assert.strictEqual(init.status, 'resolved',
      'optional Storyboard cache does not delay global readiness');
    assert.strictEqual(f.calls.filter(x => x === 'watch.db-prewarm').length, 1);
    assert.strictEqual(f.calls.filter(x => x === 'storyboard.optional-db-warmup').length, 1);
    f.optionalStoryboard.resolve();
    await flush();
  });

  it('first-history snapshot follows prewarmed Watch DB but precedes atomic timestamp commit', async () => {
    const f = harness();
    const initialized = f.invoke();
    resolveWarmup(f);
    await initialized;
    const pending = observe(f.watch.get(WATCH_ID));
    await flush();
    assert.strictEqual(f.reads.length, 1);
    assert.strictEqual(f.reads[0].query.key, WATCH_ID);
    assert.strictEqual(f.touches.length, 0);
    f.reads[0].resolve(historyRow());
    await flush();
    assert.strictEqual(pending.status, 'resolved');
    assert.strictEqual(pending.value.resume[0].time, 34);
    assert.strictEqual(pending.value.comment[0].text, 'synthetic-history');
    assert.strictEqual(f.touches.length, 1);
    assert.strictEqual(f.touches[0].query.key, WATCH_ID);
    assert(f.calls.indexOf('history.readonly-get') < f.calls.indexOf('history.atomic-touch'));
    assert.strictEqual(f.calls.filter(x => x === 'watch.db-prewarm').length, 1,
      'first history read must reuse the already opened Watch DB');
    // The atomic write is intentionally unresolved at this point.
    f.touches[0].resolve(historyRow());
    f.optionalStoryboard.resolve();
    await flush();
  });

  it('missing history causes no updatedAt touch even when optional Storyboard is pending', async () => {
    const f = harness();
    const initialized = f.invoke();
    resolveWarmup(f);
    await initialized;
    const pending = observe(f.watch.get(WATCH_ID));
    await flush();
    f.reads[0].resolve(null);
    await flush();
    assert.strictEqual(pending.status, 'resolved');
    assert.strictEqual(pending.value, null);
    assert.strictEqual(f.touches.length, 0);
    f.optionalStoryboard.resolve();
    await flush();
  });

  it('late timestamp rejection does not revoke returned history or expose synthetic keys', async () => {
    const f = harness();
    const initialized = f.invoke();
    resolveWarmup(f);
    await initialized;
    const pending = observe(f.watch.get(WATCH_ID));
    await flush();
    f.reads[0].resolve(historyRow());
    await flush();
    assert.strictEqual(pending.status, 'resolved');
    f.touches[0].reject(new Error('SYNTHETIC_PRIVATE_ERROR_BODY'));
    await flush();
    assert.strictEqual(pending.status, 'resolved');
    assert.strictEqual(f.warnings.length, 1);
    assert.deepStrictEqual(f.warnings[0], ['Watch info cache access timestamp update failed']);
    assert(!JSON.stringify(f.warnings).includes(WATCH_ID));
    assert(!JSON.stringify(f.warnings).includes('SYNTHETIC_PRIVATE_ERROR_BODY'));
    f.optionalStoryboard.resolve();
    await flush();
  });
});
