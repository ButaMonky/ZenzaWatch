// Task173 (HLS root-cause addendum 2026-10-01): when hls.js can play the stream, the
// native HLS engine must not consume the delivery session first. In the recorded
// failures native HLS fetched the AES key, then hls.js re-fetched the same signed key
// URL and received a different key for the same encrypted fragment (fragParsingError).
// Only dummy URLs are used here; no recorded key, signed URL or media is included.
const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

function player({nativeCapable = 'maybe', preference = 'yes', jsSupported = true} = {}) {
  const context = createContext({HTMLElement: class {}, Hls: {isSupported: () => jsSupported}});
  run(`const PLAYER_MODE = ${extract('src/_hls.js', 'PLAYER_MODE', 'var')};
    ${extract('src/_hls.js', 'ZenzaVideoElement')}; globalThis.Subject = ZenzaVideoElement;`, context);
  const p = Object.create(context.Subject.prototype);
  const nativeSrcs = [], jsSrcs = [];
  let removed = 0;
  const video = {
    canPlayType: () => nativeCapable,
    get src() { return nativeSrcs[nativeSrcs.length - 1] || ''; },
    set src(v) { nativeSrcs.push(v); },
    removeAttribute(name) { if (name === 'src') { removed++; } },
    error: null, currentTime: 0
  };
  Object.assign(p, {
    _videoCount: 0, _video: video,
    getAttribute: name => (name === 'use-native-hls' ? preference : null),
    _resetPlayingStatus() {}, _destroyHLSJS() {},
    _initHLSJS(src) { jsSrcs.push(src); return {}; }
  });
  Object.defineProperty(p, 'playerMode', {value: '', writable: true});
  return {p, nativeSrcs, jsSrcs, removed: () => removed};
}

const A = 'https://delivery.invalid/a/master.m3u8';
const B = 'https://delivery.invalid/b/master.m3u8';

describe('Task173 HLS engine selection keeps one engine per delivery session', () => {
  it('uses hls.js first when it is supported, without handing the stream to native HLS', () => {
    const f = player({nativeCapable: 'probably', preference: 'yes', jsSupported: true});
    f.p.src = A;
    assert.strictEqual(f.p.playerMode, 'HLS-JS');
    assert.deepStrictEqual(f.jsSrcs, [A]);
    assert.deepStrictEqual(f.nativeSrcs, [], 'native HLS must not fetch the session first');
  });

  it('keeps native HLS where hls.js/MSE is unavailable (native-only environment)', () => {
    const f = player({nativeCapable: 'maybe', preference: 'yes', jsSupported: false});
    f.p.src = A;
    assert.strictEqual(f.p.playerMode, 'HLS-N');
    assert.deepStrictEqual(f.nativeSrcs, [A]);
    assert.deepStrictEqual(f.jsSrcs, []);
  });

  it('honours an explicit native-only preference ("force")', () => {
    const f = player({nativeCapable: 'maybe', preference: 'force', jsSupported: true});
    f.p.src = A;
    assert.strictEqual(f.p.playerMode, 'HLS-N');
    assert.deepStrictEqual(f.nativeSrcs, [A]);
  });

  it('never selects native HLS when the browser cannot play HLS natively', () => {
    for (const preference of ['yes', 'force', 'no']) {
      const f = player({nativeCapable: '', preference, jsSupported: true});
      f.p.src = A;
      assert.strictEqual(f.p.playerMode, 'HLS-JS', preference);
      assert.deepStrictEqual(f.nativeSrcs, []);
    }
  });

  it('a switch A -> B opens B with the same single engine and never reuses A', () => {
    const f = player({nativeCapable: 'probably', preference: 'yes', jsSupported: true});
    f.p.src = A;
    f.p.src = B;
    assert.deepStrictEqual(f.jsSrcs, [A, B]);
    assert.deepStrictEqual(f.nativeSrcs, []);
    assert.strictEqual(f.p.src, B);
  });

  it('a late native error after hls.js was chosen does not start a second engine', () => {
    const f = player({nativeCapable: 'probably', preference: 'yes', jsSupported: true});
    f.p.src = A;
    f.p._video.error = {code: 4};
    let stopped = 0;
    assert.strictEqual(f.p._onNativeHLSError({stopImmediatePropagation() { stopped++; }}), false);
    assert.deepStrictEqual(f.jsSrcs, [A]);
    assert.strictEqual(stopped, 0);
  });

  it('forced-native startup fallback stops the native load before hls.js starts', () => {
    const f = player({nativeCapable: 'maybe', preference: 'force', jsSupported: true});
    f.p.src = A;
    f.p._video.error = {code: 4};
    assert.strictEqual(f.p._onNativeHLSError({stopImmediatePropagation() {}}), true);
    assert.strictEqual(f.removed(), 1, 'native src detached before the JS engine attaches');
    assert.deepStrictEqual(f.jsSrcs, [A]);
    assert.strictEqual(f.p._onNativeHLSError({stopImmediatePropagation() {}}), false, 'bounded: one fallback');
  });

  it('maps the saved setting to the element preference without changing direct MP4 playback', () => {
    const text = require('fs').readFileSync(require('path').join(__dirname, '../../src/_hls.js'), 'utf-8');
    assert(/setAttribute\('use-native-hls', nativeHlsPreference\(Config\.get\('use_native_hls'\)\)\)/.test(text));
    const context = createContext({});
    const map = run(`(${extract('src/_hls.js', 'nativeHlsPreference', 'var')})`, context);
    assert.strictEqual(map(true), 'yes');
    assert.strictEqual(map('force'), 'force');
    assert.strictEqual(map(false), 'no');
    assert.strictEqual(map(undefined), 'no');
    const f = player({nativeCapable: 'probably', preference: 'yes', jsSupported: true});
    f.p.src = 'https://delivery.invalid/a.mp4';
    assert.strictEqual(f.p.playerMode, 'N');
    assert.deepStrictEqual(f.jsSrcs, []);
  });
});
