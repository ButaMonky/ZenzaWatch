// Task486: rejected cache payloads must not leak video IDs, signed URLs,
// secrets or entire image buffers through the browser console.
'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function fixture() {
  const warnings = [], records = [], deletes = [], lookups = [];
  const store = {
    put: async record => {records.push(record);return record;},
    updateTime: async ({key}) => {lookups.push(key);return null;},
    delete: async ({key}) => {deletes.push(key);},
    gc: async () => {},
    close: () => {}
  };
  const ctx = createContext({
    IndexedDbStorage: {open: async () => ({cache: store})},
    location: {host: 'www.nicovideo.jp'},
    console: {warn: (...args) => warnings.push(args), error() {}, log() {}}
  });
  run(beginSection('packages/lib/src/nico/StoryboardCacheDb.js') +
    ';globalThis.__storyboardDb=StoryboardCacheDb;', ctx);
  return {db: ctx.__storyboardDb, warnings, records, lookups, deletes};
}
const flatten = warnings => warnings.map(args => args.map(x =>
  typeof x === 'string' ? x : JSON.stringify(x)).join(' ')).join(' ');

describe('Task486 StoryboardCacheDb privacy and rejected payloads', () => {
  it('does not log a rejected record, watchId, URL, token or huge buffer', async () => {
    const h = fixture();
    const result = await h.db.put('sm9_PRIVATE_VIDEO', {
      status: 'fail',
      token: 'PRIVATE_TOKEN_MARKER',
      url: 'https://cdn.invalid/secret?token=PRIVATE_TOKEN_MARKER',
      images: [{buffer: new ArrayBuffer(4096)}]
    });
    assert.strictEqual(result, undefined);
    assert.equal(h.records.length, 0);
    assert.equal(h.warnings.length, 1);
    const text = flatten(h.warnings);
    for (const forbidden of ['PRIVATE_TOKEN_MARKER', 'sm9_PRIVATE_VIDEO', 'cdn.invalid',
      'images', 'ArrayBuffer', 'buffer']) {
      assert(!text.includes(forbidden), forbidden + ' must never be printed');
    }
    assert(text.includes('Storyboard cache rejected'), 'keep a safe diagnosis');
  });
  it('rejects null and primitive input with a safe diagnostic, not TypeError', async () => {
    for (const bad of [null, undefined, 42, 'not data', []]) {
      const h = fixture();
      await assert.doesNotReject(h.db.put('sm9', bad));
      assert.equal(h.records.length, 0);
      assert.equal(h.warnings.length, 1);
      assert(!flatten(h.warnings).includes('sm9'));
    }
  });
  it('continues to persist a legitimate successful storyboard record', async () => {
    const h = fixture();
    const data = {status: 'ok', watchId: 'sm9', storyboard: {images: []}};
    const saved = await h.db.put('sm9', data);
    assert.equal(saved.watchId, 'sm9');
    assert.equal(saved.sbInfo, data);
    assert.equal(h.records.length, 1);
    assert.strictEqual(h.records[0].sbInfo, data);
    assert.equal(typeof saved.updatedAt, 'number');
    assert.deepStrictEqual(h.warnings, []);
  });
  it('retains cache lookup and removal semantics', async () => {
    const h = fixture();
    assert.equal(await h.db.get('sm9'), null);
    await h.db.delete('sm9');
    assert.deepStrictEqual(h.lookups, ['sm9']);
    assert.deepStrictEqual(h.deletes, ['sm9']);
    assert.equal(h.warnings.length, 0);
  });
});
