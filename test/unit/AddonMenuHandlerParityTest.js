'use strict';

const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function subject(rel = 'src/VideoControlBar.js') {
  const resolved = [];
  const asyncCalls = [];
  const emitter = {
    emitResolve(name, payload) {
      resolved.push({name, payload});
      return Promise.resolve(payload);
    },
    emitAsync(name, container, handler) {
      asyncCalls.push({name, container, handler});
    }
  };
  class Emitter {
    emit() {}
  }
  const context = createContext({
    Emitter,
    global: {emitter}
  });
  const VideoControlBar = loadClass(rel, 'VideoControlBar', context);
  const bar = Object.create(VideoControlBar.prototype);
  bar._$view = [{
    querySelector(selector) {
      return {selector};
    }
  }];
  return {bar, resolved, asyncCalls};
}

describe('Task234 addon-menu handler parity', function() {
  it('keeps the control-bar legacy bridge handler identical to the resolved payload', async function() {
    const s = subject();
    await s.bar._onFirstVideoInitialized();
    await Promise.resolve();
    const resolved = s.resolved.find(x => x.name === 'videoControBar.addonMenuReady');
    const legacy = s.asyncCalls.find(x => x.name === 'videoControBar.addonMenuReady');
    assert(resolved);
    assert(legacy);
    assert.strictEqual(legacy.container, resolved.payload.container);
    assert.strictEqual(legacy.handler, resolved.payload.handler);
  });

  it('keeps the seek-bar legacy bridge handler identical to the resolved payload', async function() {
    const s = subject();
    await s.bar._onFirstVideoInitialized();
    await Promise.resolve();
    const resolved = s.resolved.find(x => x.name === 'seekBar.addonMenuReady');
    const legacy = s.asyncCalls.find(x => x.name === 'seekBar.addonMenuReady');
    assert(resolved);
    assert(legacy);
    assert.strictEqual(legacy.container, resolved.payload.container);
    assert.strictEqual(legacy.handler, resolved.payload.handler);
  });

  it('keeps generated dev dist addon-menu handler parity with source', async function() {
    const s = subject('dist/ZenzaWatch-dev.user.js');
    await s.bar._onFirstVideoInitialized();
    await Promise.resolve();
    for (const name of ['videoControBar.addonMenuReady', 'seekBar.addonMenuReady']) {
      const resolved = s.resolved.find(x => x.name === name);
      const legacy = s.asyncCalls.find(x => x.name === name);
      assert(resolved);
      assert(legacy);
      assert.strictEqual(legacy.container, resolved.payload.container);
      assert.strictEqual(legacy.handler, resolved.payload.handler);
    }
  });
});
