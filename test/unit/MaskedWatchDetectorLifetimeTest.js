'use strict';
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
async function detector() {
  const listeners = new Map(), timers = new Set(); let next = 0, terminated = 0, disconnected = 0, observe;
  const style = {setProperty() {}};
  const layer = {isConnected: true, style};
  const video = {isConnected: true, currentTime: 0};
  const worker = {terminate() { terminated++; }, postMessage() {}, addEventListener() {}};
  const c = createContext({createWorker: () => worker, css: {addModule: async () => {}},
    PRODUCT: 'Fixture', config: {enabled: true, tmpWidth: 10, tmpHeight: 10},
    OffscreenCanvas: class {getContext() { return {}; }},
    MutationObserver: class {constructor(fn) { observe = fn; } observe() {} disconnect() { disconnected++; }},
    setInterval: () => { timers.add(++next); return next; }, clearInterval: id => timers.delete(id),
    addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    document: {documentElement: {}, visibilityState: 'visible', body: {append() {}},
      createElement: () => ({style, classList: {add() {}}, dataset: {}, remove() {}})}});
  c['\u696d\u52d9'] = () => {}; c['\u4e0b\u8acb'] = () => {};
  run(`globalThis.create = ${extract('src/_shape.js', 'createDetector', 'var')}`, c);
  const d = await c.create({video, layer, interval: 300, type: 'fixture'});
  return {d, video, layer, listeners, timers, observe: () => observe(),
    terminated: () => terminated, disconnected: () => disconnected};
}
describe('Task301 MaskedWatch detector lifetime', () => {
  it('start is idempotent and dispose releases owned resources once', async () => {
    const h = await detector(); h.d.start(); h.d.start(); assert.strictEqual(h.timers.size, 1);
    h.d.dispose(); h.d.dispose();
    assert.strictEqual(h.timers.size, 0); assert.strictEqual(h.listeners.size, 0);
    assert.strictEqual(h.terminated(), 1); assert.strictEqual(h.disconnected(), 1);
    h.d.start(); assert.strictEqual(h.timers.size, 0);
  });
  for (const name of ['video', 'layer']) {
    it(`disposes a disconnected ${name} even while stopped`, async () => {
      const h = await detector(); h.d.stop(); h[name].isConnected = false; h.observe();
      assert.strictEqual(h.terminated(), 1); assert.strictEqual(h.listeners.size, 0);
    });
  }
  it('keeps connected detectors running', async () => {
    const h = await detector(); h.observe(); assert.strictEqual(h.terminated(), 0);
    assert.strictEqual(h.timers.size, 1);
  });
});
