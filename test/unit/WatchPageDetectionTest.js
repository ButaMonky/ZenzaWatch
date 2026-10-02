// Task175 (Watch V4 audit F02): the watch-page check must recognise both the legacy
// data.response envelope and the Watch V4 data.response.$watchV4.data envelope,
// without network access, and must not hang or throw on broken/missing metadata.
const assert = require('assert');
const {read, createContext, run} = require('../helpers/extractSource');

function detector({isWatchUrl = true, meta, root = true, contentNow = false, grid = false, mountLater = false} = {}) {
  const text = read('src/initializer.js');
  const code = text.slice(text.indexOf('  const readyContent ='), text.indexOf('  const initWorker ='));
  let content = contentNow, gridPresent = grid;
  const observers = [];
  const timers = [];
  const document = {
    querySelector(sel) {
      if (sel === 'meta[name="server-response"]') { return meta === undefined ? null : {getAttribute: () => meta}; }
      if (sel === '[aria-label="nicovideo-content"]') { return content ? {} : null; }
      if (sel === '.grid-area_\\[player\\]') { return gridPresent ? {} : null; }
      return null;
    },
    getElementById: id => (id === 'root' && root ? {} : null)
  };
  class MutationObserver {
    constructor(cb) { this.cb = cb; this.connected = false; observers.push(this); }
    observe(target) { if (!target) { throw new TypeError('observe target is null'); } this.connected = true; }
    disconnect() { this.connected = false; }
  }
  const context = createContext({
    util: {isGinzaWatchUrl: () => isWatchUrl}, document, MutationObserver,
    setTimeout: (f, ms) => { timers.push({f, ms}); return timers.length; }, clearTimeout: id => { if (timers[id - 1]) { timers[id - 1].f = null; } }
  });
  run(code + ';globalThis.isWatchPage = isWatchPage;', context);
  return {
    isWatchPage: () => context.isWatchPage(),
    mount() { content = true; gridPresent = true; for (const o of observers) { if (o.connected) { o.cb([{addedNodes: [{}]}], o); } } },
    expire() { for (const t of timers) { if (t.f) { const f = t.f; t.f = null; f(); } } },
    observers, timers
  };
}
const v4 = okReason => JSON.stringify({meta: {status: 200}, data: {response: {$watchV4: {data: {client: {}, okReason}}}}});
const legacy = () => JSON.stringify(require('../fixtures/watch-legacy-darasan.sanitized.json'));

describe('Task175 watch page detection for V3/V4 envelopes (Watch V4 audit F02)', () => {
  it('recognises a Watch V4 success envelope', async () => {
    assert.strictEqual(await detector({meta: v4('PURELY')}).isWatchPage(), true);
  });

  it('keeps recognising the legacy data.response envelope (2026-10-01 record)', async () => {
    assert.strictEqual(await detector({meta: legacy()}).isWatchPage(), true);
  });

  it('a normal error response or V4 error data is not a watch page', async () => {
    assert.strictEqual(await detector({meta: JSON.stringify({meta: {status: 404}, data: {response: {}}})}).isWatchPage(), false);
    assert.strictEqual(await detector({meta: JSON.stringify({meta: {status: 200}, data: {response: {$watchV4: {data: {errorCode: 'NOT_FOUND'}}}}})}).isWatchPage(), false);
    assert.strictEqual(await detector({meta: JSON.stringify({meta: {status: 200}, data: {}})}).isWatchPage(), false);
  });

  it('broken metadata falls back to the DOM check instead of throwing', async () => {
    assert.strictEqual(await detector({meta: '{broken', contentNow: true, grid: true}).isWatchPage(), true);
    assert.strictEqual(await detector({meta: '{broken', contentNow: true, grid: false}).isWatchPage(), false);
  });

  it('a non-watch URL returns false without reading the page', async () => {
    assert.strictEqual(await detector({isWatchUrl: false, meta: v4('PURELY')}).isWatchPage(), false);
  });

  it('waits for a delayed SPA mount when metadata is absent', async () => {
    const d = detector({meta: undefined});
    const pending = d.isWatchPage();
    d.mount();
    assert.strictEqual(await pending, true);
  });

  it('missing #root does not throw and the wait ends', async () => {
    assert.strictEqual(await detector({meta: undefined, root: false}).isWatchPage(), false);
  });

  it('the wait for content is finite when the SPA never mounts', async () => {
    const d = detector({meta: undefined});
    const pending = d.isWatchPage();
    assert(d.timers.length > 0, 'a deadline is armed');
    d.expire();
    assert.strictEqual(await pending, false);
    assert(d.observers.every(o => !o.connected), 'observer released');
  });
});
