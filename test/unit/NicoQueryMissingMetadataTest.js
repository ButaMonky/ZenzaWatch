'use strict';

const assert = require('assert');
const {createContext, extract, run} = require('../helpers/extractSource');

function converter(rel) {
  const context = createContext({
    textUtil: {convertKansuEi: value => String(value)}
  });
  run('const ItemDataConverter = ' + extract(rel, 'ItemDataConverter', 'var') +
    '; globalThis.converter = ItemDataConverter;', context);
  return context.converter;
}

describe('Audit #266 NicoQuery optional metadata and valid-date fallback', () => {
  for (const rel of ['packages/lib/src/nico/NicoQuery.js', 'dist/ZenzaWatch-dev.user.js']) {
    it('preserves a valid video when FLAPI timestamps are missing or malformed (' + rel + ')', () => {
      const c = converter(rel);
      const data = {
        id: 'sm123', title: 'Title', length_seconds: 61,
        first_retrieve: '2024-05-01 12:00:00',
        num_res: 1, mylist_counter: 2, view_counter: 3
      };
      const result = c.fromFlapiMylistItem(data);
      assert.strictEqual(result.createdAt, result.postedAt);
      assert.strictEqual(result.updatedAt, result.postedAt);
      assert.doesNotThrow(() => c.fromFlapiMylistItem({...data,
        create_time: 'invalid', thread_update_time: 'not-a-date'}));
      assert.strictEqual(c.fromFlapiMylistItem({...data,
        create_time: 'invalid', thread_update_time: 'not-a-date'}).updatedAt,
      result.postedAt);
    });

    it('uses length_seconds without requiring legacy length text (' + rel + ')', () => {
      const c = converter(rel);
      const base = {id: 'sm234', title: 'Title', first_retrieve: '2024-05-01 12:00:00'};
      assert.strictEqual(c.fromUploadedVideo({...base, length_seconds: 61}).duration, 61);
      assert.strictEqual(c.fromUploadedVideo({...base, length: '2:03'}).duration, 123);
      assert.strictEqual(c.fromUploadedVideo({...base}).duration, 0);
    });

    it('tolerates malformed search and deflist dates without RangeError (' + rel + ')', () => {
      const c = converter(rel);
      const badSearch = {
        id: 'sm345', title: 'Title', first_retrieve: 'not-a-date', length_seconds: 30
      };
      assert.strictEqual(c.fromSearchApiV2(badSearch).postedAt, '1970-01-01T00:00:00.000Z');
      const deflist = {item_data: {
        video_id: 'sm456', watch_id: 'sm456', title: 'Title',
        first_retrieve: 1700000000, update_time: 'invalid'
      }};
      const saved = c.fromDeflistItem(deflist);
      assert.strictEqual(saved.updatedAt, saved.postedAt);
    });
  }
});
