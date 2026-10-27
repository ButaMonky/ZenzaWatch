'use strict';
// Task966 QA: YouTube Trusted Types rejects blob: Workers; capture must still encode.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');
const quiet = {warn() {}, log() {}, time() {}, timeEnd() {}};

function fixture(source, useOffscreen = true) {
  const image = {width: 480, height: 270, close() { image.closed = true; }};
  const blob = new Blob(['png-bytes'], {type: 'image/png'});
  const draws = [], created = [], revoked = [], timers = [];
  let attempts = 0;
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({drawImage: bitmap => draws.push(bitmap)}),
    convertToBlob: useOffscreen ? async () => blob : undefined,
    toBlob: (callback) => callback(blob)
  };
  const ctx = createContext({Blob, console: quiet,
    workerUtil: {createCrossMessageWorker() {
      attempts++; throw new TypeError("This document requires 'TrustedScriptURL' assignment.");
    }},
    OffscreenCanvas: useOffscreen ? function(width, height) {
      canvas.width = width; canvas.height = height; return canvas;
    } : undefined,
    document: {createElement: () => canvas},
    URL: {createObjectURL(value) {
      assert.strictEqual(value, blob);
      created.push(value); return 'blob:qa966-' + created.length;
    }, revokeObjectURL(url) { revoked.push(url); }},
    setTimeout(callback, delay) { timers.push({callback, delay}); return timers.length; },
    fetch: async () => ({blob: async () => blob})
  });
  run('const DataUrlConv=' + extract(source, 'DataUrlConv', 'var') + ';' +
    'globalThis.converter=DataUrlConv;', ctx);
  return {convert:ctx.converter,image,canvas,draws,created,revoked,timers,
    attempts:() => attempts};
}

for (const source of ['src/_captube.js', 'dist/CapTube.user.js']) {
  describe('CapTube Worker fallback ' + source, function() {
    it('encodes a real Blob on the main thread when TrustedScriptURL blocks Worker', async function() {
      const f=fixture(source);
      const first=await f.convert.fromBitmap(f.image);
      assert.strictEqual(first.url,'blob:qa966-1');
      assert.strictEqual(f.attempts(),1);
      assert.deepStrictEqual(f.draws,[f.image]);
      assert.strictEqual(f.canvas.width,480);
      assert.strictEqual(f.canvas.height,270);
      assert.strictEqual(f.image.closed,true);
      assert.strictEqual(f.timers[0].delay,60000);
      f.timers[0].callback();
      assert.deepStrictEqual(f.revoked,['blob:qa966-1']);
      const second=await f.convert.fromDataURL('data:image/png;base64,eA==');
      assert.strictEqual(second.url,'blob:qa966-2');
      assert.strictEqual(f.attempts(),1,'do not retry a blocked Worker');
    });
    it('uses canvas.toBlob when OffscreenCanvas is unavailable', async function() {
      const f=fixture(source,false);
      assert.strictEqual((await f.convert.fromBitmap(f.image)).url,'blob:qa966-1');
      assert.strictEqual(f.draws.length,1);
    });
  });
}
