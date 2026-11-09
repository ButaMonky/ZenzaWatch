'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function harness(file) {
  const events = [], registered = new Map();
  class Emitter {}
  class FakeYouTubeWrapper {
    constructor() { this.handlers = new Map(); }
    on(name, fn) { this.handlers.set(name, fn); }
    fire(name, ...args) {
      const handler = this.handlers.get(name);
      assert(handler, 'missing YouTube handler: ' + name);
      handler(...args);
    }
  }
  const util = {$: element => ({
    on(name, handler) {
      let handlers = registered.get(element);
      if (!handlers) { handlers = new Map(); registered.set(element, handlers); }
      handlers.set(name, handler);
      return this;
    }
  })};
  const context = createContext({
    Emitter, util, YouTubeWrapper: FakeYouTubeWrapper,
    global: {debug: {}}, document: {createElement: () => ({})},
    Config: {props: {enableResume: false}}, window: {console}
  });
  const VideoPlayer = loadClass(file, 'VideoPlayer', context);
  const player = Object.create(VideoPlayer.prototype);
  const native = {currentTime: 12, duration: 120, videoHeight: 720,
    videoWidth: 1280, buffered: [], autoplay: false};
  player._video = native;
  player._videoElement = native;
  player._src = 'https://example.test/video';
  player._touchWrapper = {body: {}};
  player._body = {appendChild: element => element};
  player.classList = {add() {}, remove() {}};
  player._isAspectRatioFixed = true;
  player._canPlay = true;
  player.emit = (...args) => events.push(args);
  player._initializeEvents();
  player._initYouTube();
  const yt = player._videoYouTube;
  function fireNative(name, ...args) {
    const handler = registered.get(native)?.get(name);
    assert(handler, 'missing native handler: ' + name);
    handler(...args);
  }
  return {player, native, yt, events, fireNative};
}

describe('Issue #230 inactive player media event ownership', () => {
  for (const file of ['src/NicoVideoPlayer.js', 'dist/ZenzaWatch-dev.user.js']) {
    it(file + ': inactive YouTube cannot end the current HTML video', () => {
      const h = harness(file);
      h.yt.fire('ended');
      assert.deepStrictEqual(h.events, []);
      h.fireNative('ended');
      assert(h.events.some(event => event[0] === 'ended'));
      h.events.length = 0;
      h.player._isPlaying = true;
      h.yt.fire('pause');
      assert.strictEqual(h.player._isPlaying, true);
      assert.deepStrictEqual(h.events, []);
    });
    it(file + ': HTML -> pending YouTube -> active YouTube blocks old native events', () => {
      const h = harness(file);
      h.player._src = 'https://www.youtube.com/watch?v=TEST_ONLY_230';
      h.fireNative('ended');
      h.fireNative('pause');
      h.fireNative('timeupdate');
      assert.deepStrictEqual(h.events, [], 'old native event must not reach new session');
      h.yt.fire('loadedmetadata');
      assert(h.events.some(event => event[0] === 'loadedmetadata'),
        'initializing YouTube metadata remains available');
      h.events.length = 0;
      h.yt.fire('ended');
      assert.deepStrictEqual(h.events, [], 'pending YouTube cannot end before activation');
      h.player._currentVideo = h.yt;
      h.yt.fire('play');
      h.yt.fire('ended');
      assert.strictEqual(h.player._isPlaying, true);
      assert(h.events.some(event => event[0] === 'play'));
      assert(h.events.some(event => event[0] === 'ended'));
      h.events.length = 0;
      h.fireNative('ended');
      h.fireNative('pause');
      h.fireNative('seeking');
      h.fireNative('seeked');
      h.fireNative('timeupdate');
      assert.deepStrictEqual(h.events, [], 'inactive native events are ignored');
      assert.strictEqual(h.player._isPlaying, true);
    });
    it(file + ': after returning to HTML, stale YouTube events stay blocked', () => {
      const h = harness(file);
      h.player._currentVideo = h.yt;
      h.player._src = 'https://www.youtube.com/watch?v=TEST_ONLY_230';
      h.player._src = 'https://example.test/next';
      h.player._currentVideo = h.native;
      h.events.length = 0;
      h.yt.fire('ended');
      h.yt.fire('pause');
      h.yt.fire('seeked');
      assert.deepStrictEqual(h.events, []);
      h.fireNative('ended');
      assert(h.events.some(event => event[0] === 'ended'));
    });
  }
});
