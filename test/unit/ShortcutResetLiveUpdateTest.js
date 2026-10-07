'use strict';

const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function resetFixture(sourcePath, actionId, override, defaultValue) {
  const SettingPanel = loadClass(sourcePath, 'SettingPanel', createContext());
  const key = 'KEY_' + actionId;
  const calls = [];
  let value = override;
  let storedOverride = override;
  const config = {
    default: {[key]: defaultValue},
    props: {},
    deleteValue(name) {
      calls.push(['delete', name]);
      storedOverride = undefined;
      value = this.default[name];
    }
  };
  Object.defineProperty(config.props, key, {
    get() { return value; },
    set(next) {
      value = next;
      calls.push(['publish', key, next]);
    }
  });
  const panel = Object.create(SettingPanel.prototype);
  panel._playerConfig = config;
  panel._cancelShortcutRecording = () => calls.push(['cancel']);
  panel._refreshAllShortcutRows = () => calls.push(['refresh', value]);
  panel._hideCustomSeekSlotIfUnset = id => calls.push(['hide', id]);

  panel._onShortcutResetClick({target: {dataset: {actionId}}});
  assert.strictEqual(value, defaultValue, 'effective value must match the default');
  assert.strictEqual(storedOverride, undefined, 'persisted override must be removed');
  return calls;
}

describe('Task294 reset shortcut publishes the live default', () => {
  for (const sourcePath of ['src/_setting.js', 'dist/ZenzaAdvancedSettings.user.js']) {
    it('publishes a legacy default before deleting the override: ' + sourcePath, () => {
      assert.deepStrictEqual(resetFixture(sourcePath, 'TOGGLE_PLAY', 88, 32), [
        ['cancel'], ['publish', 'KEY_TOGGLE_PLAY', 32],
        ['delete', 'KEY_TOGGLE_PLAY'], ['refresh', 32], ['hide', 'TOGGLE_PLAY']
      ]);
    });
    it('publishes zero for an unassigned custom seek slot: ' + sourcePath, () => {
      assert.deepStrictEqual(resetFixture(sourcePath, 'CUSTOM_SEEK_1', 901, 0), [
        ['cancel'], ['publish', 'KEY_CUSTOM_SEEK_1', 0],
        ['delete', 'KEY_CUSTOM_SEEK_1'], ['refresh', 0], ['hide', 'CUSTOM_SEEK_1']
      ]);
    });
  }
});
