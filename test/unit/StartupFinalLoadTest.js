'use strict';
const assert = require('assert');
const {read, extract, createContext, run, beginSection} = require('../helpers/extractSource');
const {templateBootstrap} = require('../../tools/esm/template-bootstrap.cjs');
function context(zenza = {}) {
  const c = createContext({ZenzaWatch: zenza});
  run('const startup = '+extract('src/ZenzaContext.js', 'startup', 'var')+';this.startup=startup;', c);
  run(beginSection('packages/lib/src/Emitter.js'), c);
  return c;
}
function registration(c) {
  const source = read('src/util.js');
  const start = source.indexOf('const AsyncEmitter =');
  const end = source.indexOf('//@require Fullscreen', start);
  assert(start >= 0 && end > start);
  run(source.slice(start, end)+';this.RegisteredEmitter=AsyncEmitter;', c);
}
describe('Task1088 AsyncEmitter の起動順', () => {
  it('通常の配布物では同じ場で同じコンストラクタを登録する', () => {
    const c = context({lib: {}}); registration(c);
    assert.strictEqual(c.ZenzaWatch.lib.AsyncEmitter, c.RegisteredEmitter);
    const emitter = new c.RegisteredEmitter(); let value;
    emitter.on('sample', x => { value = x; }); emitter.emit('sample', 37);
    assert.strictEqual(value, 37); assert.strictEqual(c.startup.pending.length, 0);
  });
  it('部品のまとめ読み込み時は lib の準備まで登録を待つ', () => {
    const c = context(); c.startup.defer();
    assert.doesNotThrow(() => registration(c));
    assert.strictEqual(c.ZenzaWatch.lib, undefined);
    assert.deepStrictEqual(Array.from(c.startup.pending), ['util:async-emitter']);
    c.ZenzaWatch.lib = {}; c.startup.run();
    assert.strictEqual(c.ZenzaWatch.lib.AsyncEmitter, c.RegisteredEmitter);
    assert.strictEqual(c.startup.pending.length, 0);
  });
});
describe('Task1088 読み込み検査の本体外側の準備', () => {
  const source = read('src/_template.js');
  it('トップフレームでは本体と同じ lodash 入り ZenzaLib を準備する', () => {
    const window = {}; window.top = window; const lodash = {};
    const c = createContext({window, _: lodash}); run(templateBootstrap(source), c);
    assert.strictEqual(window.ZenzaLib._, lodash);
  });
  it('子フレームには本体と同じく新しい ZenzaLib を作らない', () => {
    const window = {top: {}}; const c = createContext({window, _: {}});
    run(templateBootstrap(source), c); assert.strictEqual(window.ZenzaLib, undefined);
  });
  it('本体の準備が見つからない・二重なら検査を停止する', () => {
    const body = templateBootstrap(source);
    assert.throws(() => templateBootstrap(''), /unique production/);
    assert.throws(() => templateBootstrap(body+'\n'+body), /unique production/);
  });
});
