// Task188 (HLS root-cause addendum C): the canplay that hls.js-mode synthesises when the
// manifest is parsed stays for compatibility, but it is marked synthetic and recorded as
// "manifestReady" only. Real media readiness (media canplay, first playing, time progress,
// first frame) is recorded separately, so a parsed manifest is never reported as playback.
// Dummy objects only; no URL, key or media is used.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function element() {
  const events = [], infos = [];
  const context = createContext({HTMLElement: class {}, Hls: {isSupported: () => true}, Event, CustomEvent,
    console: {info: (...a) => infos.push(a.join(' ')), log() {}, warn() {}, error() {}}});
  run(`const PLAYER_MODE = ${extract('src/_hls.js', 'PLAYER_MODE', 'var')};
    ${extract('src/_hls.js', 'ZenzaVideoElement')}; globalThis.Subject = ZenzaVideoElement;`, context);
  const p = Object.create(context.Subject.prototype);
  const video = {readyState: 0, buffered: {length: 0}, currentTime: 0, paused: true, seeking: false, videoWidth: 0};
  Object.assign(p, {_video: video, _throttledCurrentTime: {cancel() {}}, dispatchEvent: e => events.push(e)});
  Object.defineProperty(p, 'playerMode', {value: 'HLS-JS', writable: true});
  if (typeof p._resetPlayingStatus === 'function') { p._resetPlayingStatus(); }
  return {p, video, events, infos};
}
const ev = type => ({type});

describe('Task188 HLS readiness stages (HLS addendum C)', () => {
  it('manifest parsed with readyState 0 keeps compat events but is not media readiness', () => {
    const {p, events} = element();
    p._onHLSJSManifestParsed('manifestParsed', {levels: []});
    const canplay = events.find(e => e.type === 'canplay');
    assert(canplay, 'compat canplay is still dispatched');
    assert(events.some(e => e.type === 'loadedmetadata'), 'compat loadedmetadata is still dispatched');
    assert.strictEqual(canplay.detail && canplay.detail.synthetic, true, 'marked synthetic');
    const r = p.readiness;
    assert.strictEqual(r.manifestReady, true);
    assert.strictEqual(r.mediaCanPlay, false);
    assert.strictEqual(r.isMediaPlaying, false);
  });

  it('a real media canplay, playing and time progress are recorded as separate stages', () => {
    const {p, video, infos} = element();
    p._onHLSJSManifestParsed('manifestParsed', {levels: []});
    p._onMediaReadinessEvent(ev('canplay'));
    assert.strictEqual(p.readiness.mediaCanPlay, false, 'canplay with readyState<3 is not counted');
    video.readyState = 3;
    p._onMediaReadinessEvent(ev('canplay'));
    assert.strictEqual(p.readiness.mediaCanPlay, true);
    video.paused = false;
    p._onMediaReadinessEvent(ev('playing'));
    p._onMediaReadinessEvent(ev('timeupdate'));
    assert.strictEqual(p.readiness.firstProgress, false, 'no progress yet');
    video.currentTime = 0.5;
    p._onMediaReadinessEvent(ev('timeupdate'));
    const r = p.readiness;
    assert.strictEqual(r.firstPlaying, true);
    assert.strictEqual(r.firstProgress, true);
    assert.strictEqual(r.isMediaPlaying, true);
    assert(infos.length === 1 && !/https?:|\\.m3u8|key/i.test(infos[0]), 'one log with stage times only');
  });

  it('a new source resets the stages', () => {
    const {p, video} = element();
    video.readyState = 3;
    p._onMediaReadinessEvent(ev('canplay'));
    p._resetPlayingStatus();
    assert.strictEqual(p.readiness.mediaCanPlay, false);
  });

  it('first frame needs decoded video data', () => {
    const {p, video} = element();
    video.readyState = 2;
    p._onMediaReadinessEvent(ev('loadeddata'));
    assert.strictEqual(p.readiness.firstFrame, false, 'no width yet');
    video.videoWidth = 640;
    p._onMediaReadinessEvent(ev('loadeddata'));
    assert.strictEqual(p.readiness.firstFrame, true);
  });

  it('the dialog log no longer calls the compat canplay "playable"', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../src/NicoVideoPlayerDialog.js'), 'utf-8');
    assert(!src.includes("'動画選択から再生可能までの時間 watchId='"));
  });
});
