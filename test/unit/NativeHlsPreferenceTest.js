const assert = require('assert');
const {extract, createContext, run} = require('../helpers/extractSource');

describe('native HLS preference selects the requested engine (ZW-049)', function() {
  function player(supported, preference) {
    const context = createContext({HTMLElement: class {}});
    run(`const PLAYER_MODE = ${extract('src/_hls.js', 'PLAYER_MODE', 'var')};
      ${extract('src/_hls.js', 'ZenzaVideoElement')}; globalThis.Subject = ZenzaVideoElement;`, context);
    const p = Object.create(context.Subject.prototype);
    let attr = preference;
    let jsStarts = 0;
    Object.assign(p, {_videoCount: 0,
      _video: {canPlayType: () => supported, src: ''},
      getAttribute: () => attr,
      _resetPlayingStatus() {}, _destroyHLSJS() {},
      _initHLSJS() { jsStarts++; return {}; }
    });
    // Observe the real src setter's choice without invoking unrelated rendering.
    Object.defineProperty(p, 'playerMode', {value: '', writable: true});
    return {p, setPreference(value) { attr = value; }, jsStarts: () => jsStarts};
  }

  for (const supported of ['', 'maybe', 'probably']) {
    for (const preference of ['yes', 'no']) {
      it(`support=${JSON.stringify(supported)}, preference=${preference}`, function() {
        const f = player(supported, preference);
        f.p.src = 'https://fixture.invalid/master.m3u8';
        const native = supported !== '' && preference === 'yes';
        assert.strictEqual(f.p.playerMode, native ? 'HLS-N' : 'HLS-JS');
        assert.strictEqual(f.jsStarts(), native ? 0 : 1);
        if (native) { assert.strictEqual(f.p._video.src, 'https://fixture.invalid/master.m3u8'); }
      });
    }
  }

  it('reload observes changes to the preference in both directions', function() {
    const f = player('probably', 'yes');
    f.p.src = 'https://fixture.invalid/a.m3u8';
    assert.strictEqual(f.p.playerMode, 'HLS-N');
    f.setPreference('no'); f.p.src = 'https://fixture.invalid/a.m3u8';
    assert.strictEqual(f.p.playerMode, 'HLS-JS');
    f.setPreference('yes'); f.p.src = 'https://fixture.invalid/a.m3u8';
    assert.strictEqual(f.p.playerMode, 'HLS-N');
    assert.strictEqual(f.jsStarts(), 1);
  });

  it('missing or invalid preference does not silently opt into native playback', function() {
    for (const preference of [null, '', 'true', 'invalid']) {
      const f = player('probably', preference);
      f.p.src = 'https://fixture.invalid/a.m3u8';
      assert.strictEqual(f.p.playerMode, 'HLS-JS');
    }
  });

  it('ordinary video URLs still use ordinary playback', function() {
    const f = player('probably', 'yes');
    f.p.src = 'https://fixture.invalid/a.mp4';
    assert.strictEqual(f.p.playerMode, 'N');
    assert.strictEqual(f.jsStarts(), 0);
  });
});
