'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function harness(total = 250) {
  const ctx = createContext({
    CrossDomainGate: class {}, WindowMessageEmitter: {},
    sleep: async () => {}, textUtil: {dateToString: () => ''},
    CacheStorage: class {getItem() { return null; } setItem() {}}
  });
  run(beginSection('packages/lib/src/nico/VideoSearch.js') +
    '\nglobalThis.loader = NicoSearchApiV2Loader;', ctx);
  const pages = [];
  ctx.loader.searchBySnapshot = async (word, params) => {
    const page = Number(params.page || 1);
    pages.push(page);
    return {status: 'ok', count: total,
      list: Array.from({length: Math.min(100, total)}, (_, n) => ({id: 'sm' + (page * 1000 + n)}))};
  };
  return {loader: ctx.loader, pages};
}

describe('AUD #265 snapshot search limit', () => {
  for (const limit of [1, 25, 100, 101, 199, 200, 250]) {
    it('never returns more than ' + limit + ' entries', async () => {
      const h = harness(250);
      const result = await h.loader.searchMoreBySnapshot('test', {}, limit);
      assert.strictEqual(result.list.length, limit);
      assert.strictEqual(h.pages.length, limit <= 100 ? 1 : Math.ceil(limit / 100));
    });
  }
  it('keeps all eight results when limit exceeds actual count', async () => {
    const h = harness(8);
    const result = await h.loader.searchMoreBySnapshot('test', {}, 300);
    assert.strictEqual(result.list.length, 8);
    assert.strictEqual(result.count, 8);
    assert.strictEqual(h.pages.length, 1);
  });
});
