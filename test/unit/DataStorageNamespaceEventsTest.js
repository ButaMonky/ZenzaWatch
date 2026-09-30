const assert = require('assert');
const fs = require('fs');
const path = require('path');
function section(file) {
  const source = fs.readFileSync(path.resolve(__dirname, '../../', file), 'utf8');
  const begin = '//===BEGIN===';
  const end = '//===END===';
  assert.strictEqual(source.split(begin).length, 2, 'unique begin marker');
  assert.strictEqual(source.split(end).length, 2, 'unique end marker');
  return source.slice(source.indexOf(begin) + begin.length, source.indexOf(end));
}
function emitterClass() {
  return new Function(section('packages/lib/src/Emitter.js') + '\nreturn Emitter;')();
}

function storage() {
  const DataStorage = new Function(section('packages/lib/src/infra/DataStorage.js') + '\nreturn DataStorage;')();
  const Emitter = emitterClass(), emitter = new Emitter();
  // Namespace methods use real DataStorage and Emitter; disk/restore is outside this test.
  const store = Object.create(DataStorage.prototype);
  store.props = {};
  ['on', 'off', 'emit'].forEach(name => { store[name] = emitter[name].bind(emitter); });
  return store;
}
describe('ZW-038 namespace events', () => {
  it('preserves complete keys for named, empty and dotted namespaces', () => {
    const s = storage(), named = [], empty = [], dotted = [];
    s.namespace('screenFilter').on('update', (...args) => named.push(args));
    s.namespace('').on('update', (...args) => empty.push(args));
    s.namespace('screenFilter.color').on('update', (...args) => dotted.push(args));
    s.emit('update', 'screenFilter.enable', true);
    s.emit('update', 'screenFilter.color.red', 2);
    s.emit('update', 'screenFilterX.enable', false);
    assert.deepStrictEqual(named, [['enable', true], ['color.red', 2]]);
    assert.deepStrictEqual(empty, [['screenFilter.enable', true], ['screenFilter.color.red', 2], ['screenFilterX.enable', false]]);
    assert.deepStrictEqual(dotted, [['red', 2]]);
  });
  it('isolates the same callback across namespaces and allows re-registration', () => {
    const s = storage(), a = s.namespace('a'), b = s.namespace('b'), seen = [];
    const callback = (...args) => seen.push(args);
    a.on('update', callback); b.on('update', callback);
    a.off('update', callback); a.off('update', callback);
    s.emit('update', 'a.key', 1); s.emit('update', 'b.key', 2);
    a.on('update', callback); a.on('update', callback);
    s.emit('update', 'a.key', 3);
    assert.deepStrictEqual(seen, [['key', 2], ['key', 3]]);
  });
  it('off without callback removes only this namespace subscriptions', () => {
    const s = storage(), a = s.namespace('a'), b = s.namespace('b'), seen = [];
    a.on('update', () => seen.push('a1')); a.on('update', () => seen.push('a2'));
    b.on('update', () => seen.push('b'));
    a.off('update');
    s.emit('update', 'a.key', 1); s.emit('update', 'b.key', 2);
    assert.deepStrictEqual(seen, ['b']);
  });
  it('retains onkey/offkey and direct key event behavior', () => {
    const s = storage(), a = s.namespace('a'), seen = [];
    const callback = value => seen.push(value);
    a.onkey('key', callback); s.emit('update-a.key', 1);
    a.offkey('key', callback); s.emit('update-a.key', 2);
    a.on('key', callback); s.emit('update-a.key', 3);
    a.off('key', callback); s.emit('update-a.key', 4);
    assert.deepStrictEqual(seen, [1, 3]);
  });
});
