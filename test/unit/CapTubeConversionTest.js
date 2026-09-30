const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const quiet = {time() {}, timeEnd() {}, log() {}, error() {}, warn() {}};
const ticks = async () => { for (let n = 0; n < 20; n++) { await Promise.resolve(); } };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {promise, resolve, reject};
};

describe('CapTube conversion returns a usable Blob URL (ZW-051 conversion)', function() {
  function harness(options = {}) {
    const calls = [], revoked = [], timers = [], requests = new Map();
    const bitmapDraws = [];
    const blob = new Blob(['fixture'], {type: 'image/png'});
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({drawImage: image => bitmapDraws.push(image)}),
      toDataURL: () => 'data:image/png;base64,Zml4dHVyZQ=='
    };
    if (options.convertToBlob !== false) {
      canvas.convertToBlob = () => options.bitmapPromise || Promise.resolve(blob);
    }
    const context = createContext({console: quiet, Blob, PID: 'fixture', NAME: 'fixture',
      location: {origin: 'https://fixture.invalid', href: 'https://fixture.invalid/'},
      document: {createElement: () => canvas},
      fetch: options.fetch || (async () => ({blob: async () => blob})),
      URL: {createObjectURL(value) {
        assert.ok(value instanceof Blob, 'createObjectURL must receive an actual Blob');
        calls.push(value); return 'blob:fixture-' + calls.length;
      }, revokeObjectURL: url => revoked.push(url)},
      setTimeout: (callback, delay) => { timers.push({callback, delay}); return timers.length; },
      postMessage: message => {
        const pending = requests.get(message.sessionId);
        requests.delete(message.sessionId);
        if (message.status === 'ok') { pending.resolve(message.body.params.result); }
        else { pending.reject(new Error(message.body.params.result)); }
      }
    });
    if (options.offscreen !== false) { context.OffscreenCanvas = function() { return canvas; }; }
    // Run the actual converter worker and the actual RPC wrapper. The wrapper
    // supplies commandResult; the converter must return its payload, not another envelope.
    run(`(${extract('src/_captube.js', 'func', 'var')})(self);
      (${extract('packages/lib/src/infra/workerUtil.js', 'messageWrapper', 'var')})(self);`, context);
    let id = 0;
    const host = createContext({console: quiet, document: {createElement: () => ({})},
      workerUtil: {createCrossMessageWorker: () => ({post: body => {
        const sessionId = ++id;
        const pending = deferred(); requests.set(sessionId, pending);
        context.onmessage({data: {body, sessionId}});
        return pending.promise;
      }})}
    });
    run(`const DataUrlConv = ${extract('src/_captube.js', 'DataUrlConv', 'var')};
      const createBlobLinkElementAsync = ${extract('src/_captube.js', 'createBlobLinkElementAsync', 'var')};
      globalThis.convert = DataUrlConv; globalThis.link = createBlobLinkElementAsync;`, host);
    return {host, context, calls, revoked, timers, canvas, bitmapDraws, blob};
  }

  it('dataURL path waits for fetch and blob decoding before creating an ObjectURL', async function() {
    const response = deferred(), decoded = deferred();
    const f = harness({fetch: () => response.promise});
    const pending = f.host.convert.fromDataURL('data:image/png;base64,Zml4dHVyZQ==');
    let settled = false;
    pending.then(() => { settled = true; }, () => { settled = true; });
    await ticks(); assert.strictEqual(f.calls.length, 0); assert.strictEqual(settled, false);
    response.resolve({blob: () => decoded.promise});
    await ticks(); assert.strictEqual(f.calls.length, 0); assert.strictEqual(settled, false);
    decoded.resolve(f.blob);
    const result = await pending;
    assert.strictEqual(result.url, 'blob:fixture-1');
    assert.strictEqual(f.calls[0], f.blob);
    assert.strictEqual(f.timers.length, 1);
    assert.strictEqual(f.timers[0].delay, 60000);
    f.timers[0].callback();
    assert.deepStrictEqual(f.revoked, ['blob:fixture-1']);
  });

  it('bitmap convertToBlob result becomes the download link href', async function() {
    const f = harness();
    const bitmap = {width: 640, height: 360};
    const link = await f.host.link(null, 'capture.png', bitmap);
    assert.strictEqual(link.href, 'blob:fixture-1');
    assert.strictEqual(link.download, 'capture.png');
    assert.strictEqual(f.canvas.width, 640); assert.strictEqual(f.canvas.height, 360);
    assert.strictEqual(f.bitmapDraws.length, 1);
  });

  it('fallback canvas dataURL is decoded to a Blob, never passed as a string', async function() {
    const f = harness({offscreen: false, convertToBlob: false});
    const result = await f.host.convert.fromBitmap({width: 320, height: 180});
    assert.strictEqual(result.url, 'blob:fixture-1');
    assert.strictEqual(f.calls[0], f.blob);
  });

  it('non-bitmap caller receives a download href through the actual RPC payload shape', async function() {
    const f = harness();
    const link = await f.host.link({toDataURL: () => 'data:image/png;base64,Zml4dHVyZQ=='}, 'normal.png', null);
    assert.strictEqual(link.href, 'blob:fixture-1');
    assert.strictEqual(link.download, 'normal.png');
  });

  it('decode rejection propagates without allocating or revoking a URL', async function() {
    const f = harness({fetch: async () => { throw new Error('decode failed'); }});
    const result = await f.host.convert.fromDataURL('data:invalid').then(() => null, error => error);
    assert.ok(result instanceof Error);
    assert.strictEqual(f.calls.length, 0);
    assert.strictEqual(f.timers.length, 0);
    assert.strictEqual(f.revoked.length, 0);
  });

  it('bitmap encoding rejection propagates without allocating a URL', async function() {
    const encoding = deferred();
    const f = harness({bitmapPromise: encoding.promise});
    const pending = f.host.convert.fromBitmap({width: 1, height: 1}).then(() => null, error => error);
    encoding.reject(new Error('encoding failed'));
    assert.ok(await pending instanceof Error);
    assert.strictEqual(f.calls.length, 0);
    assert.strictEqual(f.timers.length, 0);
  });
});
