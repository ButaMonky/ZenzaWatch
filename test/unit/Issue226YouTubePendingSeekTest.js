'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function createHarness(file) {
  const seeks = [], events = [], loads = [], scheduled = [];
  const debounce = fn => {
    let pending = false;
    const delayed = () => {pending = true;};
    delayed.cancel = () => {pending = false;};
    delayed.flush = () => {
      if (!pending) return;
      pending = false;
      fn();
    };
    scheduled.push(delayed);
    return delayed;
  };
  class Emitter {
    emit(...args) {events.push(args);}
    emitAsync() {}
  }
  const context = createContext({
    Emitter, _: {debounce}, global: {debug: {}},
    textUtil: {
      parseUrl: url => new URL(url || 'https://youtu.be/'),
      parseQuery: query => Object.fromEntries(new URLSearchParams(query))
    },
    window: {}, performance: {now: () => 1000}
  });
  const Wrapper = loadClass(file, 'YouTubeWrapper', context);
  const wrapper = new Wrapper({parentNode: null});
  const player = {
    seekTo: (...args) => seeks.push(args),
    stopVideo: () => loads.push('stop'),
    loadVideoById: ({videoId, startSeconds}) => loads.push(['load', videoId, startSeconds]),
    loadPlaylist: () => {},
    getDuration: () => 300
  };
  wrapper._player = player;
  assert.strictEqual(scheduled.length, 1);
  return {wrapper, flush: scheduled[0].flush, seeks, loads, events};
}

describe('Issue #226 YouTube pending seek ownership', () => {
  for (const file of [
    'packages/zenza/src/videoPlayer/YouTubeWrapper.js',
    'dist/ZenzaWatch-dev.user.js'
  ]) {
    it(file + ' cancels A seek before loading B and commits only B seek', async () => {
      const h = createHarness(file);
      await h.wrapper.setSrc('https://youtu.be/AAA');
      h.wrapper.currentTime = 90;
      assert.strictEqual(h.seeks.length, 0);
      await h.wrapper.setSrc('https://youtu.be/BBB?t=70');
      h.flush();
      assert.deepStrictEqual(h.seeks, [], 'A pending seek must not touch B');
      h.wrapper.currentTime = 15;
      h.flush();
      // t=70 is an initial cue, not an offset to the absolute seek(15).
      assert.deepStrictEqual(h.seeks, [[15, true]], 'committed seek uses absolute media time');
      // The IFrame request is dispatched, but completion is separate: the
      // owner remains seeking until the provider acknowledges or a bounded fallback.
      assert.strictEqual(h.wrapper._isSeeking, true);
    });
    it(file + ' never seeks after stop or empty source', async () => {
      const h = createHarness(file);
      await h.wrapper.setSrc('https://youtu.be/AAA');
      h.wrapper.currentTime = 150;
      await h.wrapper.setSrc('');
      h.flush();
      h.wrapper._onSeekEnd();
      assert.deepStrictEqual(h.seeks, []);
      assert(h.loads.includes('stop'));
    });
    it(file + ' does not leak pending A or B seek into C', async () => {
      const h = createHarness(file);
      await h.wrapper.setSrc('https://youtu.be/AAA');
      h.wrapper.currentTime = 45;
      await h.wrapper.setSrc('https://youtu.be/BBB?t=12');
      h.wrapper.currentTime = 20;
      await h.wrapper.setSrc('https://youtu.be/CCC');
      h.flush();
      assert.deepStrictEqual(h.seeks, []);
      h.wrapper.currentTime = 35;
      h.flush();
      assert.deepStrictEqual(h.seeks, [[35, true]]);
    });
  }
});
