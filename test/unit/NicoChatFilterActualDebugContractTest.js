'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function subject(file, debug) {
  const events = [];
  const logger = {
    time() { events.push('time'); },
    timeEnd() { events.push('timeEnd'); },
    log(...args) { events.push(['log', args[0]]); },
    error(e) { throw e; }
  };
  const ctx = createContext({
    console: logger, Emitter: class { emit() {} },
    Config: {getValue: key => key === 'debug' && debug},
    _: {debounce: fn => fn, compact: list => list.filter(Boolean)},
    textUtil: {escapeRegs: s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}
  });
  const Filter = loadClass(file, 'NicoChatFilter', ctx);
  // The AST class extractor excludes the assignments immediately after the class.
  Filter.SHARED_NG_LEVEL = {MID: 'MID'};
  Filter.SHARED_NG_SCORE = {MID: -5000};
  const filter = new Filter({});
  filter.wordFilterList = 'blocked';
  filter.userIdFilterList = 'blocked-user';
  events.length = 0;
  const chat = (extra = {}) => ({type: 'naka', fork: 0, threadLabel: 'default',
    score: 0, text: 'visible', cmd: '', vpos: 100, userId: 'other', ...extra});
  return {filter, events, chat};
}

describe('Task388 AUD-05 real NG predicate and per-match diagnostic parity', () => {
  for (const file of ['packages/zenza/src/commentLayer/NicoChatFilter.js',
    'dist/ZenzaWatch-dev.user.js']) {
    it(file + ' reports a matching single comment in debug without aggregate logs', () => {
      const h = subject(file, true);
      assert.strictEqual(h.filter.applyFilter([h.chat({text: 'blocked'})]).length, 0);
      assert.deepStrictEqual(h.events.map(e => Array.isArray(e) ? e[0] : e), ['log']);
      assert.match(h.events[0][1], /NGワード/);
      assert.strictEqual(h.filter.applyFilter([h.chat()]).length, 1);
      assert.strictEqual(h.events.length, 1);
      assert.strictEqual(h.filter.applyFilter([h.chat({fork: 1, text: 'blocked'})]).length, 1);
      assert.strictEqual(h.events.length, 1);
    });

    it(file + ' keeps per-match debug logs alongside one batch aggregate', () => {
      const h = subject(file, true);
      const result = h.filter.applyFilter([h.chat(), h.chat({userId: 'blocked-user'})]);
      assert.strictEqual(result.length, 1);
      const logs = h.events.filter(e => Array.isArray(e));
      assert.strictEqual(logs.length, 2);
      assert(logs.some(e => /NGID/.test(e[1])));
      assert(logs.some(e => /NG判定結果/.test(e[1])));
      assert.strictEqual(h.events.filter(e => e === 'time').length, 1);
      assert.strictEqual(h.events.filter(e => e === 'timeEnd').length, 1);
    });

    it(file + ' applies fork/thread exclusion after NG even with debug off', () => {
      const h = subject(file, false);
      h.filter.fork2 = false;
      h.filter.ownerThread = false;
      h.events.length = 0;
      assert.strictEqual(h.filter.applyFilter([h.chat({fork: 2})]).length, 0);
      assert.strictEqual(h.filter.applyFilter([h.chat({threadLabel: 'owner'})]).length, 0);
      assert.strictEqual(h.filter.applyFilter([h.chat({text: 'blocked'})]).length, 0);
      assert.strictEqual(h.filter.applyFilter([h.chat()]).length, 1);
      assert.deepStrictEqual(h.events, []);
    });
  }
});
