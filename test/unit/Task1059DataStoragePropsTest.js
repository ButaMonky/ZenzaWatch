'use strict';
// Task1059: Config.props の作成（DataStorage._makeProps）が入れ子の深さに対して指数的に遅く、
// 起動時に 0.1〜0.35 秒画面を固めていた。作り直した版が以前と同じ形を作り、十分速いことを確かめる。
const assert = require('assert');
const fs = require('fs');
const {loadClass, createContext} = require('../helpers/extractSource');

// 以前の実装（比較用にそのまま残す）
function legacyMakeProps(defaultData = {}, namespace = '') {
  namespace = namespace ? `${namespace}.` : '';
  const self = this;
  const def = {};
  const props = {};
  Object.keys(defaultData).sort()
    .filter(key => key.includes(namespace))
    .forEach(key => {
      const k = key.slice(namespace.length);
      if (k.includes('.')) {
        const ns = k.slice(0, k.indexOf('.'));
        props[ns] = legacyMakeProps.call(this, defaultData, `${namespace}${ns}`);
      }
      def[k] = {
        enumerable: !this._ignoreExportKeys.includes(key),
        get() { return self.getValue(key); },
        set(v) { self.setValue(key, v); }
      };
    });
  Object.defineProperties(props, def);
  return props;
}

const configKeys = () => {
  const src = fs.readFileSync('src/Config.js', 'utf8');
  const body = src.slice(src.indexOf('const DEFAULT_CONFIG = {'), src.indexOf('Object.assign(DEFAULT_CONFIG, buildDefaultKeyConfig'));
  const keys = new Set();
  for (const m of body.matchAll(/^\s*'?([A-Za-z_][\w.]*)'?\s*:/gm)) keys.add(m[1]);
  return keys;
};

const shape = (props, depth = 0) => {
  const out = [];
  for (const key of Reflect.ownKeys(props)) {
    const d = Object.getOwnPropertyDescriptor(props, key);
    const value = props[key];
    out.push([String(key), !!d.get, d.enumerable, typeof value === 'object' && value && depth < 6 ? shape(value, depth + 1) : value]);
  }
  return out;
};

describe('Task1059 DataStorage._makeProps', function() {
  this.timeout(20000);
  const DataStorage = loadClass('packages/lib/src/infra/DataStorage.js', 'DataStorage', createContext());
  const make = (defaults, ignore = []) => {
    const store = Object.create(DataStorage.prototype);
    store._ignoreExportKeys = ignore;
    store.getValue = key => 'value:' + key;
    store.setValue = () => {};
    return store;
  };

  it('実際の既定設定（約300件・3階層）で以前と同じ形を作る', () => {
    const defaults = {};
    for (const key of configKeys()) defaults[key] = 0;
    assert(Object.keys(defaults).length > 250, 'Config の既定値を読み取れていない');
    const store = make(defaults, ['message', 'lastPlayerId', 'lastWatchId', 'debug']);
    assert.deepStrictEqual(shape(store._makeProps(defaults)), shape(legacyMakeProps.call(store, defaults)));
  });

  it('同名のキーと名前空間（loop と loop.x）や深い入れ子も以前と同じに扱う', () => {
    const defaults = {loop: 1, 'loop.x': 2, 'a.b.c.d': 3, 'a.b.e': 4, 'a.f': 5, z: 6, 'screenFilter.userPresets': 7};
    const store = make(defaults, ['z']);
    const props = store._makeProps(defaults);
    assert.deepStrictEqual(shape(props), shape(legacyMakeProps.call(store, defaults)));
    assert.strictEqual(props.a.b.c.d, 'value:a.b.c.d');
    assert.strictEqual(props['screenFilter.userPresets'], 'value:screenFilter.userPresets');
    assert.strictEqual(Object.keys(props).includes('z'), false, '書き出さないキーは列挙しない');
  });

  it('名前空間は先頭一致で判定する（途中に同じ文字列がある別のキーを混ぜない）', () => {
    const defaults = {'o.a': 1, 'foo.bar': 2};
    const props = make(defaults)._makeProps(defaults);
    assert.deepStrictEqual(Object.keys(props.o).sort(), ['a']);
  });

  it('深い入れ子でも速い（各名前空間を1回だけ作る）', () => {
    const defaults = {};
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) for (let d = 0; d < 4; d++) {
      defaults[`n${a}.m${b}.k${c}.v${d}`] = 0;
    }
    const store = make(defaults);
    const started = Date.now();
    const props = store._makeProps(defaults);
    const ms = Date.now() - started;
    assert.strictEqual(props.n5.m5.k5.v3, 'value:n5.m5.k5.v3');
    // 以前の実装はこの形（864件・4階層）で数秒かかる。新しい実装は数十ms以内。
    assert(ms < 1500, `遅すぎる: ${ms}ms`);
  });
});
