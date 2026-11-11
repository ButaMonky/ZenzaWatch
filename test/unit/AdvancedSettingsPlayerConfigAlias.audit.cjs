'use strict';
// Standalone characterization of a known audit finding, NOT desired behavior.
// Run: node test/unit/AdvancedSettingsPlayerConfigAlias.audit.cjs
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

for (const mode of ['ginza', 'others']) {
  const ctx = createContext({
    util: {isGinzaWatchUrl: () => mode === 'ginza'},
    location: {host: mode === 'others' ? 'example.org' : 'www.nicovideo.jp'}
  });
  const PlayerConfig = loadClass('src/NicoVideoPlayerDialog.js', 'PlayerConfig', ctx);
  const Model = loadClass('src/ModernAdvancedSettingsModel.js', 'ModernAdvancedSettingsModel', ctx);
  const defaults = {
    autoPlay: true, 'autoPlay:ginza': false, 'autoPlay:others': false,
    screenMode: 'normal', 'screenMode:ginza': 'big', 'screenMode:others': 'small'
  };
  const values = {...defaults}, storage = {};
  // In-memory adapter uses DataStorage's native-key routing and synchronous writes.
  const config = {
    default: defaults, storage, readonly: false,
    getStorageKey(key) { return 'ZenzaWatch_' + key; },
    getNativeKey(key) { return key; },
    getValue(key) { return values[this.getNativeKey(key)]; },
    setValue(key, value) {
      key = this.getNativeKey(key);
      values[key] = value;
      storage[this.getStorageKey(key)] = JSON.stringify(value);
    }
  };
  PlayerConfig.wrapKey(config);
  const model = new Model({config});
  const read = {genericCard: model.get('autoPlay'), genericStored: values.autoPlay,
    contextualCard: model.get('autoPlay:' + mode)};
  assert.strictEqual(read.genericCard, false, 'characterizes redirected generic read');
  assert.strictEqual(read.genericStored, true);
  model.set('screenMode', 'wide');
  model.set('screenMode:' + mode, '3D');
  const reportedSaved = model.save();
  assert.strictEqual(reportedSaved, 2);
  assert.strictEqual(values.screenMode, 'normal', 'characterizes missing generic write');
  assert.strictEqual(values['screenMode:' + mode], '3D', 'contextual write wins collision');
  assert.strictEqual(storage.ZenzaWatch_screenMode, undefined);
  console.log(JSON.stringify({finding: 'shared-config-native-key-alias', mode, read,
    requested: {generic: 'wide', contextual: '3D'}, reportedSaved,
    actual: {generic: values.screenMode, contextual: values['screenMode:' + mode]},
    storageKeys: Object.keys(storage)}));
}
