'use strict';
const assert = require('assert');
const {beginSection, createContext, run} = require('../helpers/extractSource');

function harness(options = {}) {
  const attempts = [], registered = new Map(), emitted = [], positions = [];
  const deniedOnce = new Set(options.failOnce || []);
  const session = {
    setActionHandler(action, fn) {
      attempts.push(action);
      if (options.alwaysReject?.includes(action)) {
        throw Object.assign(new Error('unsupported'), {name: 'NotSupportedError'});
      }
      if (deniedOnce.delete(action)) { throw new Error('temporarily unavailable'); }
      registered.set(action, fn);
    },
    setPositionState(state) {
      if (options.positionError) {throw new Error('invalid position');}
      positions.push(state);
    }
  };
  class Emitter {
    on() {}
    emit(...args) {emitted.push(args);}
  }
  const c = createContext({
    Emitter,
    navigator: options.noSession ? {} : {mediaSession: session},
    self: {MediaMetadata: options.badMetadata ? class {
      constructor() {throw new Error('broken metadata');}
    } : class {
      constructor(data) {this.data = data;}
    }}
  });
  run(beginSection('packages/lib/src/infra/MediaSessionApi.js') +
    '\nglobalThis.subject = MediaSessionApi;', c);
  return {api: c.subject, attempts, registered, emitted, positions, context: c};
}
const info = (extra = {}) => ({
  title: 'synthetic', owner: {name: 'test'}, thumbnail: 'https://example.invalid/image.jpg', duration: 120,
  ...extra
});
describe('AUD #248 optional MediaSession must not break playback', () => {
  it('does nothing on a browser with no mediaSession', () => {
    const h = harness({noSession:true});
    assert.doesNotThrow(() => h.api.updateByVideoInfo(info()));
  });
  it('keeps other media keys when seekto/stop are unsupported', () => {
    const h = harness({alwaysReject:['seekto','stop']});
    assert.doesNotThrow(() => h.api.updateByVideoInfo(info()));
    assert(h.registered.has('play'));
    assert(h.registered.has('pause'));
    assert(h.registered.has('nexttrack'));
    assert(!h.registered.has('seekto'));
    assert(!h.registered.has('stop'));
    h.registered.get('play')();
    assert.deepStrictEqual(h.emitted, [['command','play']]);
  });
  it('retries a transiently failed handler without re-registering successful actions', () => {
    const h = harness({failOnce:['seekto']});
    h.api.updateByVideoInfo(info());
    h.api.updateByVideoInfo(info());
    assert.strictEqual(h.attempts.filter(x => x === 'seekto').length, 2);
    assert.strictEqual(h.attempts.filter(x => x === 'play').length, 1);
    h.registered.get('seekto')({seekTime: 23});
    assert.deepStrictEqual(h.emitted, [['command','seekTo',23]]);
  });
  it('treats MediaMetadata and position state exceptions as non-fatal', () => {
    const h = harness({badMetadata:true,positionError:true});
    assert.doesNotThrow(() => h.api.updateByVideoInfo(info({owner:null})));
    assert(h.registered.has('play'));
  });
  it('rebinds media keys to an actually replaced mediaSession object', () => {
    const h = harness();
    h.api.updateByVideoInfo(info());
    const other = {metadata: null, calls: [], setPositionState() {},
      setActionHandler(name) {this.calls.push(name);}};
    h.context.navigator.mediaSession = other;
    h.api.updateByVideoInfo(info());
    assert(other.calls.includes('play'));
    assert(other.calls.includes('seekto'));
  });
});
