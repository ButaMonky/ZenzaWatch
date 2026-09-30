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

describe('ZW-036 Emitter.once', () => {
  it('unregisters before a recursive emit', () => {
    const Emitter = emitterClass(), e = new Emitter();
    let calls = 0;
    e.once('ready', value => { calls++; assert.strictEqual(value, 7); if (calls === 1) e.emit('READY', 7); });
    e.emit('ready', 7);
    e.emit('ready', 7);
    assert.strictEqual(calls, 1);
  });
  it('stays removed when the callback throws', () => {
    const Emitter = emitterClass(), e = new Emitter();
    const error = new Error('expected');
    let calls = 0;
    e.once('ready', () => { calls++; throw error; });
    assert.throws(() => e.emit('ready'), err => err === error);
    assert.doesNotThrow(() => e.emit('ready'));
    assert.strictEqual(calls, 1);
  });
  it('off accepts the original once callback and retains other listeners', () => {
    const Emitter = emitterClass(), e = new Emitter();
    let once = 0, other = 0;
    const callback = () => once++;
    e.once('ready', callback);
    e.on('ready', () => other++);
    e.off('READY', callback);
    e.emit('ready'); e.emit('ready');
    assert.strictEqual(once, 0); assert.strictEqual(other, 2);
  });
  it('does not skip ordinary listeners around a once listener', () => {
    const Emitter = emitterClass(), e = new Emitter(), calls = [];
    e.on('ready', () => calls.push('first'));
    e.once('ready', () => calls.push('once'));
    e.on('ready', () => calls.push('last'));
    e.emit('ready'); e.emit('ready');
    assert.deepStrictEqual(calls, ['first', 'once', 'last', 'first', 'last']);
  });
});
