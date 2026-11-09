'use strict';
const assert = require('assert');
const {createContext, loadClass} = require('../helpers/extractSource');

function fixture(artifact, autoplay, requestedRate = 1.75) {
  const operations = [];
  let actualRate = 1, now = 0;
  const states = {PLAYING: 1, PAUSED: 2, ENDED: 0, CUED: 5, BUFFERING: 3};
  const window = {YT: {PlayerState: states}, console};
  const ctx = createContext({
    window,
    performance: {now: () => now},
    STATE_PLAYING: 1, // loadClass extracts the class without its enclosing IIFE constant.
    Emitter: class {emit() {} emitAsync() {}},
    _: {debounce: fn => Object.assign(fn, {cancel() {}})}
  });
  const Wrapper = loadClass(artifact, 'YouTubeWrapper', ctx);
  const subject = new Wrapper({parentNode: {}, autoplay, playbackRate: requestedRate});
  subject._parseVideoId = url => url;
  subject._parseUrlParams = () => ({});
  const player = {
    loadVideoById(request) {operations.push(['load', request.videoId, request.startSeconds]); actualRate = 1;},
    cueVideoById(request) {operations.push(['cue', request.videoId, request.startSeconds]); actualRate = 1;},
    loadPlaylist() {operations.push(['playlist']);},
    stopVideo() {operations.push(['stop']);},
    getPlaybackRate() {return actualRate;},
    setPlaybackRate(rate) {operations.push(['rate', rate]); actualRate = rate;},
    getPlayerState() {return states.PLAYING;},
    getCurrentTime() {return 10;},
    getDuration() {return 200;},
    mute() {}, unMute() {}, isMuted() {return false;}
  };
  subject._player = player;
  return {subject, operations, player, states, get actualRate() {return actualRate;},
    set actualRate(rate) {actualRate = rate;}, tick(ms) {now += ms;}};
}

for (const artifact of ['packages/zenza/src/videoPlayer/YouTubeWrapper.js',
  'dist/ZenzaWatch-dev.user.js']) {
  describe('Issue #224 YouTube subsequent-video policy: ' + artifact, () => {
    it('cues subsequent videos when autoplay is disabled, never loading a playlist', async () => {
      const h = fixture(artifact, false);
      await h.subject.setSrc('videoB', 17);
      assert.deepStrictEqual(h.operations, [['cue', 'videoB', 17]]);
      h.subject._onPlayerStateChange({data: h.states.CUED});
      assert.deepStrictEqual(h.operations[1], ['rate', 1.75]);
      assert.strictEqual(h.subject.playbackRate, 1.75);
    });
    it('loads exactly one subsequent video with autoplay enabled, keeping seek time', async () => {
      const h = fixture(artifact, true, 2);
      h.subject._parseUrlParams = () => ({t: '1m20s'});
      await h.subject.setSrc('videoC', 13);
      assert.deepStrictEqual(h.operations, [['load', 'videoC', 93]]);
      h.subject._onPlayerStateChange({data: h.states.PLAYING});
      assert.deepStrictEqual(h.operations.filter(x => x[0] === 'rate'), [['rate', 2]]);
      assert.strictEqual(h.subject.playbackRate, 2);
    });
    it('reapplies the requested rate even if the requested value did not change', () => {
      const h = fixture(artifact, true, 1.5);
      h.actualRate = 1;
      h.subject.playbackRate = 1.5;
      assert.deepStrictEqual(h.operations, [['rate', 1.5]]);
    });
    it('uses provider-reported speed for time interpolation instead of cached request', () => {
      const h = fixture(artifact, true, 2);
      h.actualRate = 1;
      assert.strictEqual(h.subject.currentTime, 10);
      h.tick(1000);
      assert.strictEqual(h.subject.currentTime, 11);
      assert.strictEqual(h.subject.playbackRate, 1);
    });
    it('uses IFrame onPlaybackRateChange when direct rate access is unavailable', async () => {
      const h = fixture(artifact, true, 2);
      h.subject._player = null;
      let opts;
      h.subject._initYT = async () => ({Player: class {
        constructor(node, options) {opts = options;}
        getPlaybackRate() {return 1;}
        setPlaybackRate() {}
      }});
      const loading = h.subject._initPlayer('videoD', 0);
      for (let i = 0; i < 5 && !opts; i++) {
        await new Promise(resolve => setImmediate(resolve));
      }
      assert(opts && opts.events.onPlaybackRateChange, 'rate callback is wired');
      opts.events.onReady();
      await loading;
      h.subject._player.getPlaybackRate = undefined;
      opts.events.onPlaybackRateChange({data: 1.25});
      assert.strictEqual(h.subject.playbackRate, 1.25);
    });
  });
}
