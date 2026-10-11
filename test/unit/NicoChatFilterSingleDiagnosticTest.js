'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function fixture(file) {
  const counts = {time: 0, timeEnd: 0, log: 0};
  const logger = {
    time() { counts.time++; },
    timeEnd() { counts.timeEnd++; },
    log() { counts.log++; }
  };
  const context = createContext({Emitter: class {}, console: logger});
  const Filter = loadClass(file, 'NicoChatFilter', context);
  const filter = Object.create(Filter.prototype);
  filter.getFilterFunc = () => chat => chat.userId !== 9;
  const good = {userId: 1, type: 'naka', fork: 7, threadLabel: 'other'};
  const bad = {userId: 9, type: 'naka', fork: 7, threadLabel: 'other'};
  return {filter, counts, good, bad};
}

describe('Task387 AUD-05 consolidated single-comment diagnostic reduction', () => {
  for (const file of [
    'packages/zenza/src/commentLayer/NicoChatFilter.js',
    'dist/ZenzaWatch-dev.user.js'
  ]) {
    it(file + ' filters an individual chat without aggregate console calls', () => {
      const h = fixture(file);
      assert.deepStrictEqual(h.filter.applyFilter([h.good]), [h.good]);
      assert.deepStrictEqual(h.counts, {time: 0, timeEnd: 0, log: 0});
      assert.deepStrictEqual(h.filter.applyFilter([h.bad]), []);
      assert.deepStrictEqual(h.counts, {time: 0, timeEnd: 0, log: 0});
    });

    it(file + ' retains batch diagnostics and filtering', () => {
      const h = fixture(file);
      assert.deepStrictEqual(h.filter.applyFilter([h.good, h.bad]), [h.good]);
      assert.deepStrictEqual(h.counts, {time: 1, timeEnd: 1, log: 1});
    });
  }
});
