'use strict';

const assert = require('assert');
const {beginSection, read, createContext, run} = require('../helpers/extractSource');

const chats = n => ({
  top: [],
  bottom: [],
  naka: Array.from({length: n}, (_, i) => ({vpos: i * 1000, fork: 0}))
});

function makeCanvas(name = 'original') {
  const ctx = {
    fillStyle: '',
    beginPath() {},
    fillRect() {},
    drawImage() {}
  };
  return {
    name,
    className: 'heatMap',
    width: 200,
    height: 10,
    style: {},
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,AA',
    transferControlToOffscreen: () => ({offscreen: true}),
    cloneNode() {
      return makeCanvas('replacement');
    }
  };
}

function setup(postImpl, rel = 'packages/zenza/src/heatMap/HeatMapWorker.js') {
  let currentCanvas = makeCanvas();
  let replacements = 0;
  let terminated = 0;
  const posts = [];
  const parent = {
    replaceChild(next, prev) {
      assert.strictEqual(prev, currentCanvas);
      currentCanvas = next;
      replacements += 1;
    }
  };
  currentCanvas.parentNode = parent;

  const worker = {
    async post(msg, options) {
      posts.push({msg, options});
      return postImpl(msg, options);
    },
    terminate() { terminated += 1; }
  };

  const context = createContext({
    HTMLCanvasElement: {prototype: {transferControlToOffscreen() {}}},
    workerUtil: {createCrossMessageWorker: () => worker},
    global: {emitter: {emit() {}}},
    console: {time() {}, timeEnd() {}, log() {}, warn() {}, error() {}}
  });

  if (rel === 'packages/zenza/src/heatMap/HeatMapWorker.js') {
    run(beginSection(rel) + ';globalThis.API={HeatMapWorker};', context);
  } else {
    const text = read(rel);
    const start = text.indexOf('function HeatMapInitFunc(self)');
    const end = text.indexOf('\nconst HeatMap = HeatMapInitFunc', start);
    if (start < 0 || end < 0) {
      throw new Error('generated heatmap block not found');
    }
    run(text.slice(start, end) + ';globalThis.API={HeatMapWorker};', context);
  }

  const container = {
    querySelector(selector) {
      assert.strictEqual(selector, 'canvas.heatMap');
      return currentCanvas;
    }
  };

  return {
    context,
    container,
    posts,
    get canvas() { return currentCanvas; },
    get replacements() { return replacements; },
    get terminated() { return terminated; }
  };
}

const flush = async () => {
  for (let i = 0; i < 5; i++) { await Promise.resolve(); }
};

describe('Task263 HeatMap worker failure isolation', () => {
  it('falls back to a replacement main-thread canvas when worker init fails after transfer', async () => {
    const h = setup(async msg => {
      if (msg.command === 'init') { throw new Error('init-fail'); }
      return {status: 'ok'};
    });

    const hm = await h.context.API.HeatMapWorker.init({container: h.container});

    assert.strictEqual(h.replacements, 1);
    assert.strictEqual(h.canvas.name, 'replacement');
    assert.strictEqual(h.terminated, 1);
    assert.strictEqual(typeof hm.setData, 'function');
    assert.doesNotThrow(() => hm.setData({
      watchId: 'sm1',
      duration: 120,
      chatList: chats(3)
    }));
  });

  it('absorbs a runtime setData/reset failure and disables the failed worker proxy', async () => {
    let calls = 0;
    const h = setup(async msg => {
      calls += 1;
      if (msg.command === 'init') { return {status: 'ok'}; }
      throw new Error('rpc-fail');
    });

    const hm = await h.context.API.HeatMapWorker.init({container: h.container});

    await assert.doesNotReject(() => hm.setData({
      watchId: 'sm2',
      duration: 100,
      chatList: chats(2)
    }));
    assert.strictEqual(h.terminated, 1);
    const afterFailure = calls;

    await assert.doesNotReject(() => hm.reset({watchId: 'sm3'}));
    assert.strictEqual(calls, afterFailure, 'disabled proxy must not post again');
  });

  it('absorbs fire-and-forget duration/chatList RPC failures without unhandled rejection', async () => {
    const unhandled = [];
    const listener = reason => unhandled.push(reason);
    process.on('unhandledRejection', listener);
    try {
      const h = setup(async msg => {
        if (msg.command === 'init') { return {status: 'ok'}; }
        throw new Error('setter-fail');
      });
      const hm = await h.context.API.HeatMapWorker.init({container: h.container});

      hm.duration = 90;
      hm.chatList = chats(1);
      await flush();

      assert.strictEqual(unhandled.length, 0);
      assert.strictEqual(h.terminated, 1);
    } finally {
      process.removeListener('unhandledRejection', listener);
    }
  });

  it('keeps generated dev dist failure isolation in parity with source', async () => {
    const h = setup(async msg => {
      if (msg.command === 'init') { throw new Error('dist-init-fail'); }
      return {status: 'ok'};
    }, 'dist/ZenzaWatch-dev.user.js');

    const hm = await h.context.API.HeatMapWorker.init({container: h.container});

    assert.strictEqual(h.replacements, 1);
    assert.strictEqual(h.canvas.name, 'replacement');
    assert.strictEqual(h.terminated, 1);
    assert.strictEqual(typeof hm.setData, 'function');
  });
});
