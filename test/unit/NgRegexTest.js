const assert = require('assert');
const {createNgHarness} = require('../helpers/ngRegexHarness');
describe('ZW-027/028: NG regex transitions and per-comment state', function() {
  for (const debug of [false, true]) {
    it(`empty/nonempty transitions preserve ordinary comments (debug=${debug})`, function() {
      const h = createNgHarness(debug, {wordRegFilter: '', wordRegFilterFlags: 'i'});
      assert.strictEqual(h.filter.isSafe(h.chat('safe')), true);
      h.filter.setWordRegFilter('blocked', 'i');
      assert.strictEqual(h.filter.isSafe(h.chat('BLOCKED')), false);
      h.filter.setWordRegFilter('', 'i');
      assert.strictEqual(h.filter.isSafe(h.chat('blocked')), true);
      assert.strictEqual(h.filter.isSafe(h.chat('safe')), true);
      h.filter.setWordRegFilter('safe', '');
      assert.strictEqual(h.filter.isSafe(h.chat('safe')), false);
      assert.strictEqual(h.filter.isSafe(h.chat('blocked')), true);
    });
    for (const flags of ['g', 'y', 'gy']) {
      it(`repeated calls and reordered lists are deterministic (${flags}, debug=${debug})`, function() {
        const h = createNgHarness(debug, {wordRegFilter: 'blocked', wordRegFilterFlags: flags});
        const f = h.filter.getFilterFunc();
        for (let i = 0; i < 4; i++) assert.strictEqual(f(h.chat('blocked')), false);
        for (const words of [['blocked', 'safe', 'blocked'], ['safe', 'blocked', 'blocked']]) {
          assert.deepStrictEqual(Array.from(h.filter.applyFilter(words.map(h.chat)), c => c.text), ['safe']);
        }
        assert.strictEqual(f(h.chat('xblocked')), flags.includes('y'), 'sticky anchoring must remain');
        assert.strictEqual(f(Object.assign(h.chat('blocked'), {fork: 1})), true);
      });
    }
  }
  it('invalid source and flags retain the accepted filter without change events', function() {
    const h = createNgHarness(false, {wordRegFilter: 'blocked', wordRegFilterFlags: 'i'});
    const before = h.filter._wordRegReg;
    for (const [source, flags] of [['[', 'i'], ['other', 'ii'], ['other', 'z'], ['', 'z']]) {
      h.filter.setWordRegFilter(source, flags);
      assert.strictEqual(h.filter._wordRegReg, before);
      assert.strictEqual(h.filter.isSafe(h.chat('BLOCKED')), false);
      assert.strictEqual(h.filter.isSafe(h.chat('other')), true);
      assert.strictEqual(h.changes(), 0);
    }
  });
  it('identical accepted pairs do not invalidate; valid changes and clear each notify once', function() {
    const h = createNgHarness(false, {wordRegFilter: 'blocked', wordRegFilterFlags: 'ig'});
    h.filter.setWordRegFilter('blocked', 'gi');
    assert.strictEqual(h.changes(), 0);
    h.filter.setWordRegFilter('other', 'i');
    assert.strictEqual(h.changes(), 1);
    h.filter.setWordRegFilter('', 'i');
    assert.strictEqual(h.changes(), 2);
    h.filter.setWordRegFilter('', 'i');
    assert.strictEqual(h.changes(), 2);
  });
});
