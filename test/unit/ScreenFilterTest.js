// Task 077: 画面フィルター（ScreenFilter）の計算部分のテスト（DOMを使わない部分だけ）
import assert from 'power-assert';
import {ScreenFilter} from '../../packages/zenza/src/videoPlayer/ScreenFilter';

const DEFAULTS = {
  'screenFilter.enable': true,
  'screenFilter.brightness': 100,
  'screenFilter.contrast': 100,
  'screenFilter.saturate': 100,
  'screenFilter.sepia': 0,
  'screenFilter.hue': 0,
  'screenFilter.blur': 0,
  'screenFilter.invert': false,
  'screenFilter.gamma': 1.0,
  'screenFilter.blackLevel': 0,
  'screenFilter.whiteLevel': 0,
  'screenFilter.sharpen': 0,
  'screenFilter.temperature': 0,
  'screenFilter.tint': 0,
  'screenFilter.autoLevels': false,
  'screenFilter.vignette': 0,
  'screenFilter.colorize': 'none',
  'screenFilter.flipH': false,
  'screenFilter.flipV': false,
  'screenFilter.applyToScreenshot': true,
  'screenFilter.applyToCommentPip': true
};

// DataStorage の代わり（props の読み書きと on/onkey だけ）
const makeConfig = (overrides = {}) => {
  const data = Object.assign({}, DEFAULTS, overrides);
  const props = {};
  Object.keys(data).forEach(key => Object.defineProperty(props, key, {
    get() { return data[key]; },
    set(v) { data[key] = v; },
    enumerable: true
  }));
  return {props, on() {}, onkey() {}};
};

describe('ScreenFilter', function() {
  beforeEach(function() {
    ScreenFilter._reset();
  });

  it('既定値のままならフィルターを掛けない', function() {
    ScreenFilter.initialize(makeConfig());
    assert.equal(ScreenFilter.buildFilter(), 'none');
    assert.equal(ScreenFilter.detectPreset(), 'standard');
  });

  it('反転はページを開き直すとOFFに戻る', function() {
    const config = makeConfig({'screenFilter.flipH': true, 'screenFilter.flipV': true});
    ScreenFilter.initialize(config);
    assert.equal(config.props['screenFilter.flipH'], false);
    assert.equal(config.props['screenFilter.flipV'], false);
  });

  it('プリセット「暗い動画を見やすく」は色の行列1枚＋明るさの対応表1枚で処理する（077c）', function() {
    const config = makeConfig();
    ScreenFilter.initialize(config);
    assert.equal(ScreenFilter.execCommand('screenFilter-preset', 'dark'), '画面フィルター: 暗い動画を見やすく');
    assert.equal(ScreenFilter.buildFilter(), 'url(#zenzaScreenFilterSvg)');
    assert.equal(ScreenFilter.detectPreset(), 'dark');
    const markup = ScreenFilter.buildSvgFilterMarkup(ScreenFilter.read());
    assert.equal((markup.match(/<feColorMatrix/g) || []).length, 1);
    assert.equal((markup.match(/<feComponentTransfer/g) || []).length, 1);
    assert.ok(markup.includes('type="table"'));
  });

  it('色の処理はいくつ重ねても行列1枚にまとまる（077c 高速化）', function() {
    ScreenFilter.initialize(makeConfig({
      'screenFilter.brightness': 110, 'screenFilter.contrast': 120, 'screenFilter.saturate': 130,
      'screenFilter.hue': 30, 'screenFilter.temperature': 20, 'screenFilter.sepia': 10
    }));
    const markup = ScreenFilter.buildSvgFilterMarkup(ScreenFilter.read());
    assert.equal((markup.match(/<feColorMatrix/g) || []).length, 1);
    assert.ok(!markup.includes('feComponentTransfer'));
  });

  it('明るさ・コントラストの行列は CSS の brightness/contrast と同じ式', function() {
    const m = ScreenFilter.buildColorMatrix(Object.assign({}, ScreenFilter.DEFAULTS, {brightness: 120, contrast: 150}));
    // brightness(1.2) の後に contrast(1.5): R = 1.5 * 1.2 * R + (0.5 - 0.75)
    assert.ok(Math.abs(m[0][0] - 1.8) < 1e-6);
    assert.ok(Math.abs(m[0][3] - (-0.25)) < 1e-6);
  });

  it('値を1つでも変えると「手動で調整中」になる', function() {
    const config = makeConfig();
    ScreenFilter.initialize(config);
    ScreenFilter.applyPreset('mono');
    config.props['screenFilter.brightness'] = 110;
    assert.equal(ScreenFilter.detectPreset(), 'custom');
  });

  it('フィルターをOFFにすると何も掛けない（値は残る）', function() {
    const config = makeConfig({'screenFilter.saturate': 0});
    ScreenFilter.initialize(config);
    assert.equal(ScreenFilter.buildFilter(), 'url(#zenzaScreenFilterSvg)');
    assert.equal(ScreenFilter.execCommand('toggle-screenFilter.enable'), '画面フィルター: OFF');
    assert.equal(ScreenFilter.buildFilter(), 'none');
    assert.equal(config.props['screenFilter.saturate'], 0);
  });

  it('ぼかしは CSS の blur() で、最大20pxまで強くできる', function() {
    ScreenFilter.initialize(makeConfig({'screenFilter.blur': 8}));
    assert.equal(ScreenFilter.buildFilter(), 'blur(8px)');
  });

  it('ショートカットの増減は範囲内で止まる', function() {
    const config = makeConfig({'screenFilter.brightness': 195});
    ScreenFilter.initialize(config);
    assert.equal(ScreenFilter.execCommand('screenFilter-adjust', 'brightness:5'), '明るさ: 200%');
    assert.equal(ScreenFilter.execCommand('screenFilter-adjust', 'brightness:5'), '明るさ: 200%');
    assert.equal(ScreenFilter.execCommand('screenFilter-adjust', 'gamma:0.05'), 'ガンマ（中間の明るさ）: 1.05');
    assert.equal(ScreenFilter.execCommand('screenFilter-adjust', 'blur:25'), 'ぼかし: 20.0px');
    assert.equal(ScreenFilter.execCommand('screenFilter-adjust', 'unknown:5'), null);
  });

  it('上級者用設定から文字列で入った値も数値として扱う', function() {
    assert.equal(ScreenFilter.normalize('brightness', '120'), 120);
    assert.equal(ScreenFilter.normalize('brightness', 'abc'), 100);
    assert.equal(ScreenFilter.normalize('gamma', '9'), 3);
    assert.equal(ScreenFilter.normalize('brightness', '101'), 101);
    assert.equal(ScreenFilter.normalize('colorize', 'unknown'), 'none');
    assert.equal(ScreenFilter.normalize('invert', 'true'), true);
  });

  it('シャープは軽いアンシャープマスク（ぼかし＋差分）で作る', function() {
    ScreenFilter.initialize(makeConfig());
    const markup = ScreenFilter.buildSvgFilterMarkup(Object.assign(ScreenFilter.read(), {sharpen: 25}));
    assert.ok(markup.includes('feGaussianBlur'));
    // 077c: 強さを 077 の畳み込みと同じくらいに戻した（a = シャープ/100 × 6）
    assert.ok(markup.includes('k2="2.5" k3="-1.5"'));
    assert.ok(!markup.includes('feConvolveMatrix'));
  });

  it('黒レベル・白レベルの変換', function() {
    assert.deepEqual(ScreenFilter.levelsToLinear(0, 0), {slope: 1, intercept: 0});
    assert.deepEqual(ScreenFilter.levelsToLinear(10, 0), {slope: 0.9, intercept: 0.1});
    assert.deepEqual(ScreenFilter.levelsToLinear(-10, -10), {slope: 1, intercept: -0.1});
  });

  it('プリセットの順送りは一周して戻る', function() {
    ScreenFilter.initialize(makeConfig());
    const labels = [];
    for (let i = 0; i < ScreenFilter.PRESETS.length; i++) {
      labels.push(ScreenFilter.execCommand('screenFilter-nextPreset'));
    }
    assert.equal(labels[labels.length - 1], '画面フィルター: 標準');
  });
});
