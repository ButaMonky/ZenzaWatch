'use strict';
// Source-driven synthetic proof of the IndexedDB read-before-timestamp-touch gate.
// No real site, user data, tokens, network or video interaction.
const assert = require('assert');
const {beginSection, createContext, run, observe, deferred, ticks} =
  require('../helpers/idbRecoveryFixture');

const KEY = 'SYNTHETIC_HISTORY_ONLY';
const quiet = {log() {}, error() {}, info() {}, time() {}, timeEnd() {}};

function fixture({remote = false} = {}) {
  const pendingReads = [], pendingTouches = [], warnings = [];
  const opens = [], bridges = [];
  const store = {
    get(query) {
      const d = deferred();
      pendingReads.push({query, ...d});
      return d.promise;
    },
    updateTime(query) {
      const d = deferred();
      pendingTouches.push({query, ...d});
      return d.promise;
    }
  };
  const ctx = createContext({
    console: {...quiet, warn: (...args) => warnings.push(args)},
    location: {host: remote ? 'ext.nicovideo.jp' : 'www.nicovideo.jp'},
    IndexedDbStorage: {
      open: async () => {
        opens.push('local');
        return {cache: store};
      }
    }
  });
  run(beginSection('packages/lib/src/nico/WatchInfoCacheDb.js') +
    ';globalThis.__watchHistory = WatchInfoCacheDb;', ctx);
  const db = ctx.__watchHistory;
  if (remote) {
    db.api({bridgeDb: async () => {
      bridges.push('bridge');
      return {cache: store};
    }});
  }
  return {db, pendingReads, pendingTouches, opens, bridges, warnings};
}
const record = () => ({
  watchId: KEY,
  updatedAt: 1,
  resume: [{now: 1, time: 33}],
  comment: [{text: 'synthetic comment'}]
});

describe('Startup Watch history read-before-atomic timestamp touch (current source VM)', function() {
  it('starts a readonly get instead of blocking immediately on updateTime write', async () => {
    const h = fixture();
    const state = observe(h.db.get(KEY));
    await ticks();
    assert.strictEqual(h.opens.length, 1);
    assert.strictEqual(h.pendingReads.length, 1);
    assert.strictEqual(h.pendingReads[0].query.key, KEY);
    assert.strictEqual(h.pendingTouches.length, 0);
    h.pendingReads[0].resolve(record());
    await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(h.pendingTouches.length, 1);
    h.pendingTouches[0].resolve(record());
    await ticks();
  });

  it('returns resume/comment snapshot before the timestamp write completes', async () => {
    const h = fixture();
    const state = observe(h.db.get(KEY));
    await ticks();
    assert.strictEqual(h.pendingReads.length, 1);
    const expected = record();
    h.pendingReads[0].resolve(expected);
    await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(state.value, expected);
    assert.strictEqual(state.value.resume[0].time, 33);
    assert.strictEqual(state.value.comment[0].text, 'synthetic comment');
    assert.strictEqual(h.pendingTouches.length, 1);
    assert.strictEqual(h.pendingTouches[0].query.key, KEY);
    // Touch is deliberately still pending. Playback's history snapshot is ready.
    h.pendingTouches[0].resolve({...expected, updatedAt: 2});
    await ticks();
  });

  it('does not touch or create a row when no cached history exists', async () => {
    const h = fixture();
    const state = observe(h.db.get(KEY));
    await ticks();
    assert.strictEqual(h.pendingReads.length, 1);
    h.pendingReads[0].resolve(null);
    await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(state.value, null);
    assert.strictEqual(h.pendingTouches.length, 0);
  });

  it('propagates a readonly get failure instead of silently hiding history failure', async () => {
    const h = fixture();
    const state = observe(h.db.get(KEY));
    await ticks();
    assert.strictEqual(h.pendingReads.length, 1);
    const error = new Error('synthetic local readonly get failure');
    h.pendingReads[0].reject(error);
    await ticks();
    assert.strictEqual(state.status, 'rejected');
    assert.strictEqual(state.error, error);
    assert.strictEqual(h.pendingTouches.length, 0);
  });

  it('contains a delayed timestamp commit failure without losing the read history', async () => {
    const h = fixture();
    const state = observe(h.db.get(KEY));
    await ticks();
    h.pendingReads[0].resolve(record());
    await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(h.pendingTouches.length, 1);
    const sensitiveError = new Error('PRIVATE_ERROR_VALUE_SYNTHETIC_ONLY');
    h.pendingTouches[0].reject(sensitiveError);
    await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(h.warnings.length, 1);
    assert.strictEqual(h.warnings[0].length, 1);
    assert(!JSON.stringify(h.warnings).includes(KEY));
    assert(!JSON.stringify(h.warnings).includes('PRIVATE_ERROR_VALUE_SYNTHETIC_ONLY'));
  });

  it('allows simultaneous reads and updates each confirmed existing row only once', async () => {
    const h = fixture();
    const a = observe(h.db.get(KEY));
    const b = observe(h.db.get('SYNTHETIC_SECOND'));
    await ticks();
    assert.strictEqual(h.opens.length, 1);
    assert.strictEqual(h.pendingReads.length, 2);
    h.pendingReads[0].resolve(record());
    h.pendingReads[1].resolve({watchId: 'SYNTHETIC_SECOND', resume: []});
    await ticks();
    assert.strictEqual(a.status, 'resolved');
    assert.strictEqual(b.status, 'resolved');
    assert.deepStrictEqual(
      h.pendingTouches.map(x => x.query.key),
      [KEY, 'SYNTHETIC_SECOND']
    );
    h.pendingTouches.forEach(x => x.resolve(null));
    await ticks();
  });

  it('uses the same read-first contract through the offsite bridge', async () => {
    const h = fixture({remote: true});
    const state = observe(h.db.get(KEY));
    await ticks();
    assert.strictEqual(h.opens.length, 0);
    assert.strictEqual(h.bridges.length, 1);
    assert.strictEqual(h.pendingReads.length, 1);
    h.pendingReads[0].resolve(record());
    await ticks();
    assert.strictEqual(state.status, 'resolved');
    assert.strictEqual(state.value.watchId, KEY);
    assert.strictEqual(h.pendingTouches.length, 1);
    h.pendingTouches[0].resolve(null);
    await ticks();
  });
});
