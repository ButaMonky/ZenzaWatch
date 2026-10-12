'use strict';
const assert = require('assert');
const {createContext, beginSection, loadClass, run} = require('../helpers/extractSource');

const artifacts = [
  ['source', 'packages/lib/src/infra/DataStorage.js'],
  ['Zenza dist', 'dist/ZenzaWatch-dev.user.js'],
  ['Pocket dist', 'dist/MylistPocket.user.js'],
  ['Advanced Settings dist', 'dist/ZenzaAdvancedSettings.user.js']
];

function makeStorage(path, readonly = false) {
  const disk = {CFG_volume: '0.3'};
  const errors = [];
  const logger = {log(){}, warn(){}, error: (...args) => errors.push(args)};
  const context = createContext({
    console: logger,
    localStorage: {},
    bounce: {time: fn => fn},
    objUtil: {bridge: (dest, source) => {
      for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(source))) {
        if (typeof source[key] === 'function') {
          dest[key] = source[key].bind(source);
        }
      }
    }}
  });
  run(beginSection('packages/lib/src/Emitter.js'), context);
  const DataStorage = loadClass(path, 'DataStorage', context);
  return {storage: new DataStorage({volume: 0.3}, {prefix: 'CFG', storage: disk, readonly}), disk, errors};
}

const tick = () => new Promise(resolve => setTimeout(resolve, 12));

describe('Task397 AUD-21: reject non-finite numeric persistence without memory/disk divergence', () => {
  for (const [name, path] of artifacts) {
    for (const [valueName, value] of [
      ['positive infinity', Infinity],
      ['negative infinity', -Infinity],
      ['NaN', NaN]
    ]) {
      it(name + ': '+ valueName + ' cannot silently persist as JSON null', async () => {
        const {storage, disk, errors} = makeStorage(path);
        await storage.promise('restore');
        const changes = [], updates = [];
        storage.on('change', x => changes.push(new Map(x)));
        storage.on('update', (...args) => updates.push(args));
        const saved = storage.setValue('volume', value);
        await tick();
        assert.strictEqual(disk.CFG_volume, '0.3');
        assert.strictEqual(storage.getValue('volume'), 0.3);
        assert.strictEqual(storage.props.volume, 0.3);
        assert.strictEqual(saved, false);
        assert.strictEqual(changes.length, 0);
        assert.strictEqual(updates.length, 0);
        assert.strictEqual(errors.length, 1);
      });
    }

    it(name + ': finite number still persists and publishes exactly one update', async () => {
      const {storage, disk, errors} = makeStorage(path);
      await storage.promise('restore');
      const updates = [];
      storage.on('update', (...args) => updates.push(args));
      storage.setValue('volume', 0.9);
      await tick();
      assert.strictEqual(storage.getValue('volume'), 0.9);
      assert.strictEqual(disk.CFG_volume, '0.9');
      assert.deepStrictEqual(updates, [['volume', 0.9]]);
      assert.strictEqual(errors.length, 0);
    });

    it(name + ': readonly values preserve original in-memory-only contract', async () => {
      const {storage, disk, errors} = makeStorage(path, true);
      await storage.promise('restore');
      storage.setValue('volume', Infinity);
      assert.strictEqual(storage.getValue('volume'), Infinity);
      assert.strictEqual(disk.CFG_volume, '0.3');
      assert.strictEqual(errors.length, 0);
    });
  }
});
