'use strict';
const assert = require('assert');
const {read, createContext, run} = require('../helpers/extractSource');
function watcher(fail = false) {
  const timers = new Set([1]); let sequence = 1, dispose, attempts = 0;
  const layer = {style: {}};
  const video = {paused: false, closest: selector => selector === '#MainVideoPlayer' ? {} : null, dispatchEvent() {}};
  const c = createContext({config: {enabled: true, interval: 300}, PRODUCT: 'Fixture',
    location: {href: 'https://embed.example.invalid/'}, CustomEvent: class {},
    document: {visibilityState: 'visible', querySelectorAll: () => [video], querySelector: () => layer},
    setInterval: () => { timers.add(++sequence); return sequence; }, clearInterval: id => timers.delete(id),
    createDetector: async args => { attempts++; dispose = args.onDispose;
      if (fail) { throw new Error('worklet failed'); } return {dispose}; }});
  const source = read('src/_shape.js');
  const start = source.indexOf('    const vmap ='); const end = source.indexOf('    const init =', start);
  run(source.slice(start, end) + ';timer=1;globalThis.watch=watch;', c);
  return {c, timers, dispose: () => dispose(), attempts: () => attempts};
}
describe('Task301 MaskedWatch detector rediscovery', () => {
  it('restarts scanning after an embedded detector is disposed', async () => {
    const h = watcher(); h.c.watch(); await Promise.resolve();
    assert.strictEqual(h.timers.size, 0); h.dispose(); assert.strictEqual(h.timers.size, 1);
    h.c.watch(); assert.strictEqual(h.attempts(), 2);
  });
  it('restarts scanning after initialization failure on an embedded page', async () => {
    const h = watcher(true); h.c.watch(); await Promise.resolve(); await Promise.resolve();
    assert.strictEqual(h.timers.size, 1);
    h.c.watch(); await Promise.resolve(); assert.strictEqual(h.attempts(), 2);
  });
});
