const assert = require('assert');
const {createNgSettingsHarness} = require('../helpers/ngRegexHarness');
describe('ZW-029: settings and commands apply NG source/flags together', function() {
  it('real settings handler updates the running filter without reload, including clear', function() {
    const h = createNgSettingsHarness();
    h.input('wordRegFilter', 'blocked');
    assert.strictEqual(h.filter.isSafe(h.chat('BLOCKED')), false);
    h.input('wordRegFilterFlags', '');
    assert.strictEqual(h.filter.isSafe(h.chat('BLOCKED')), true);
    assert.strictEqual(h.filter.isSafe(h.chat('blocked')), false);
    h.input('wordRegFilter', '');
    assert.strictEqual(h.filter.isSafe(h.chat('blocked')), true);
    h.input('wordRegFilterFlags', 'g');
    h.input('wordRegFilter', 'again');
    for (let i = 0; i < 3; i++) assert.strictEqual(h.filter.isSafe(h.chat('again')), false);
  });
  it('settings reject a source invalid under current flags and preserve saved/live pair', function() {
    const h = createNgSettingsHarness({wordRegFilter: 'blocked', wordRegFilterFlags: 'u'});
    const target = h.input('wordRegFilter', '\\a');
    assert(target.classes.includes('error'));
    assert.strictEqual(h.props.wordRegFilter, 'blocked');
    assert.strictEqual(h.filter.isSafe(h.chat('blocked')), false);
    assert.strictEqual(h.changes(), 0);
  });
  it('settings reject flags incompatible with saved source and invalid flags', function() {
    const h = createNgSettingsHarness({wordRegFilter: '\\a', wordRegFilterFlags: ''});
    for (const flags of ['u', 'gg', 'z']) {
      const target = h.input('wordRegFilterFlags', flags);
      assert(target.classes.includes('error'));
      assert.strictEqual(h.props.wordRegFilterFlags, '');
      assert.strictEqual(h.filter.isSafe(h.chat('a')), false);
      assert.strictEqual(h.changes(), 0);
    }
  });
  it('commands keep the live counterpart and preserve transient command behavior', function() {
    const h = createNgSettingsHarness({wordRegFilter: 'old', wordRegFilterFlags: 'i'});
    h.dialog._onCommand('setWordRegFilter', 'blocked');
    assert.strictEqual(h.filter.isSafe(h.chat('BLOCKED')), false);
    h.dialog._onCommand('setWordRegFilterFlags', '');
    assert.strictEqual(h.filter.isSafe(h.chat('BLOCKED')), true);
    assert.strictEqual(h.filter.isSafe(h.chat('blocked')), false);
    h.dialog._onCommand('setWordRegFilterFlags', 'gg');
    assert.strictEqual(h.filter.isSafe(h.chat('blocked')), false);
    h.dialog._onCommand('setWordRegFilter', '');
    assert.strictEqual(h.filter.isSafe(h.chat('blocked')), true);
    assert.strictEqual(h.props.wordRegFilter, 'old');
    assert.strictEqual(h.props.wordRegFilterFlags, 'i');
  });
  it('a config update before player initialization remains harmless', function() {
    const h = createNgSettingsHarness();
    h.dialog._nicoVideoPlayer = null;
    assert.doesNotThrow(() => h.input('wordRegFilter', 'blocked'));
  });
});
