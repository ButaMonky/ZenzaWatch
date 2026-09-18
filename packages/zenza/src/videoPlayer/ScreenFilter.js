//===BEGIN===
/*
 * Task 077 / 077b / 077c: 画面フィルター（バックログ D-34）
 *
 * 動画の映像だけに、明るさ・コントラスト・ガンマなどの補正を掛ける仕組み。
 * コメント層やボタンには掛けない（.zenzaWatchVideoElement にだけ効かせる）。
 *
 * 【加工の方式（077c で高速化）】
 *   色の処理（明るさ・コントラスト・彩度・暖色・色相・反転・色温度・色かぶり・着色）は、
 *   すべて1枚の色変換行列（feColorMatrix）にまとめて1回で処理する。
 *   明るさの曲線（黒/白レベル・ガンマ・自動レベル補正・着色の色）は、
 *   1枚の対応表（feComponentTransfer、65点）にまとめて1回で処理する。
 *   → 以前は CSS の brightness()…hue-rotate() を5段つないでいた。GPUなしの計測で
 *     5段: 約38fps → 行列1枚: 約59fps（フィルターなし60fps）。
 *   シャープはアンシャープマスク（ぼかした絵との差を足す）。周りの画素を見る処理なので
 *   これだけは重い。ぼかしは CSS の blur()（SVGのぼかしより数倍速い）。
 *   周辺減光は映像の上に影を重ねるだけ（処理はほぼゼロ）。
 *
 * 左右反転・上下反転（旧 toggle-flipH / toggle-flipV）もここで設定を持つが、
 * 見た目の反映は今まで通り transform（.is-flipH / .is-flipV クラス）で行う。
 *
 * 設定は Config の 'screenFilter.*' に保存する（全部の動画で共通・次回も残る）。
 * ただし反転だけは従来通り「ページを開き直すと元に戻る」（initialize で OFF に戻す）。
 *
 * スクリーンショット・コメント付きPiP は canvas に描き直しているため、
 * drawVideo() / processCanvas() で同じ加工を canvas にも掛ける（ctx.filter）。
 * 通常の P in P はブラウザが <video> をそのまま小窓に出すので加工できない。
 */
const ScreenFilter = (() => {
  const PREFIX = 'screenFilter.';
  const SVG_ID = 'zenzaScreenFilterSvg';
  const STYLE_ID = 'zenzaScreenFilterStyle';
  const CSS_VAR = '--zenza-screen-filter';
  const VIGNETTE_CLASS = 'zenzaScreenFilterVignette';

  /*
   * 調整項目の一覧。設定パネル（プレイヤー内のフィルターパネル・上級者用設定）の
   * 表示もこの配列から作るので、項目を足す時はここに1つ足せばよい。
   *   group: 'basic' 色と明るさ / 'tone' 明暗の細かい調整 / 'style' 雰囲気
   *   heavy: true … 周りの画素を見る処理で重い（説明に書く）
   */
  const PARAMS = [
    {
      key: 'brightness', label: '明るさ', group: 'basic',
      min: 0, max: 200, step: 1, def: 100, unit: '%',
      desc: '画面全体を明るく／暗くします。上げすぎると明るい所が真っ白に飛びます。' +
        '暗い動画を見やすくしたい時は、下の「ガンマ」の方が自然に明るくなります。'
    },
    {
      key: 'contrast', label: 'コントラスト', group: 'basic',
      min: 0, max: 200, step: 1, def: 100, unit: '%',
      desc: '明るい所と暗い所の差の強さです。上げるとメリハリが出てくっきり、' +
        '下げると柔らかい（眠たい）感じになります。'
    },
    {
      key: 'saturate', label: '彩度（色の濃さ）', group: 'basic',
      min: 0, max: 300, step: 1, def: 100, unit: '%',
      desc: '色の濃さです。0 で白黒、100 が元のまま、上げると色が鮮やかになります。'
    },
    {
      key: 'temperature', label: '色温度', group: 'basic',
      min: -100, max: 100, step: 1, def: 0, unit: '', signed: true,
      desc: 'マイナスで青っぽく（涼しい感じ）、プラスでオレンジっぽく（暖かい感じ）なります。' +
        '夜は少しプラスにすると目に優しくなります。'
    },
    {
      key: 'tint', label: '色かぶり補正', group: 'basic',
      min: -100, max: 100, step: 1, def: 0, unit: '', signed: true,
      desc: '映像が緑っぽい時はプラス（赤紫の方向へ）、赤紫っぽい時はマイナス（緑の方向へ）に動かすと自然な色に戻ります。'
    },
    {
      key: 'hue', label: '色相（色のずらし）', group: 'basic',
      min: -180, max: 180, step: 1, def: 0, unit: '°',
      desc: 'すべての色を虹の順番にずらします（例: 赤→黄→緑…）。普段は 0 のままで大丈夫です。' +
        '遊びや、見分けにくい色がある時の補助に。'
    },
    {
      key: 'sepia', label: 'セピア', group: 'basic',
      min: 0, max: 100, step: 1, def: 0, unit: '%',
      desc: '古い写真のような茶色っぽい色味に寄せます。色温度より色が抜けた感じになります。'
    },
    {
      key: 'invert', label: '階調反転（ネガ）', group: 'basic', type: 'boolean', def: false,
      desc: '明るい所と暗い所を入れ替えます（写真のネガのような見た目）。' +
        '白い背景の資料動画を暗くしたい時は、プリセットの「反転（暗転）」を選ぶと色味が保たれます。'
    },
    {
      key: 'gamma', label: 'ガンマ（中間の明るさ）', group: 'tone',
      min: 0.3, max: 3.0, step: 0.01, def: 1.0, unit: '', digits: 2,
      desc: '真っ黒・真っ白はそのままに、中くらいの明るさだけを持ち上げ／下げます。' +
        '1 より大きくすると、白飛びさせずに暗い部分が見えやすくなります。暗い動画にいちばん効く項目です。'
    },
    {
      key: 'blackLevel', label: '黒レベル', group: 'tone',
      min: -50, max: 50, step: 1, def: 0, unit: '', signed: true,
      desc: 'いちばん暗い部分の調整です。プラスにすると真っ黒な所が少し持ち上がって暗部が見えやすく' +
        '（そのぶん黒が灰色っぽく）なり、マイナスにすると黒が引き締まります。'
    },
    {
      key: 'whiteLevel', label: '白レベル', group: 'tone',
      min: -50, max: 50, step: 1, def: 0, unit: '', signed: true,
      desc: 'いちばん明るい部分の調整です。マイナスにすると白が少し抑えられて、まぶしさ・白飛びが和らぎます。' +
        'プラスにすると明るい部分がより明るくなります。'
    },
    {
      key: 'autoLevels', label: '自動レベル補正', group: 'tone', type: 'boolean', def: false,
      desc: '動画ごとに、いちばん暗い所が黒・いちばん明るい所が白になるよう自動で合わせます（0.5秒ごとに少しずつ）。' +
        '白っぽくかすんだ動画や、全体が暗い動画に効きます。処理はとても軽いです。'
    },
    {
      key: 'sharpen', label: 'シャープ（輪郭の強調）', group: 'tone', heavy: true,
      min: 0, max: 100, step: 1, def: 0, unit: '',
      desc: '輪郭をくっきりさせます。ぼやけた低画質の動画に。20〜40 くらいがおすすめです。' +
        '周りの画素を調べる処理なので、この項目だけは少し重めです（グラフィックボードの無いパソコンで動画がカクつく時は 0 に）。'
    },
    {
      key: 'blur', label: 'ぼかし', group: 'style',
      min: 0, max: 20, step: 0.1, def: 0, unit: 'px',
      desc: '映像をぼかします。ブロックノイズやチラつきが気になる時は 1 前後、はっきりぼかしたい時は 5 以上に。' +
        '画面上の大きさ（ピクセル）で効くので、大きな画面ほど強めにすると同じ見え方になります。'
    },
    {
      key: 'vignette', label: '周辺減光', group: 'style',
      min: 0, max: 100, step: 1, def: 0, unit: '%',
      desc: '画面の周りをだんだん暗くして、映画やカメラのような雰囲気にします。映像の上に影を重ねるだけなので、処理はほぼゼロです。'
    },
    {
      key: 'colorize', label: '着色（モノトーン）', group: 'style', type: 'select', def: 'none',
      options: [
        ['none', 'なし'],
        ['gold', 'ゴールド'],
        ['sepia', 'セピア（古写真）'],
        ['blue', 'ブルー'],
        ['green', 'グリーン（暗視カメラ風）']
      ],
      desc: '映像をいったん白黒にして、選んだ色のグラデーションで塗り直します。' +
        'ゴールドは金属っぽい高級感、セピアは古い写真、グリーンは暗視カメラのような見た目になります。'
    }
  ];
  const PARAM_MAP = PARAMS.reduce((map, p) => { map[p.key] = p; return map; }, {});
  const DEFAULTS = PARAMS.reduce((map, p) => { map[p.key] = p.def; return map; }, {});

  /*
   * プリセット。values に書いていない項目は既定値に戻る（前のプリセットの値が残らない）。
   * 反転（左右・上下）とフィルターの ON/OFF はプリセットでは変えない。
   */
  const PRESETS = [
    {id: 'standard', label: '標準', values: {},
      desc: 'すべて元のまま（フィルターなし）。'},
    {id: 'dark', label: '暗い動画を見やすく', values: {gamma: 1.35, blackLevel: 4, contrast: 105},
      desc: '夜のシーンや古い実況動画など、暗くて見えにくい動画向け。白飛びさせずに暗い所を持ち上げます。'},
    {id: 'sharp', label: 'くっきり', values: {contrast: 112, saturate: 110, sharpen: 30},
      desc: 'ぼやけた低画質の動画向け。輪郭とメリハリを強めます。輪郭の強調を使うので少しだけ重めです。'},
    {id: 'vivid', label: 'ビビッド', values: {saturate: 135, contrast: 108},
      desc: 'アニメやゲーム実況の色を鮮やかに。'},
    {id: 'faded', label: '色あせ補正', values: {saturate: 130, contrast: 110, autoLevels: true},
      desc: '古い動画や色の薄い動画向け。色を濃くし、明るさの範囲も自動で合わせます。'},
    {id: 'cinema', label: 'シネマ（銀残し風）', values: {saturate: 55, contrast: 120, gamma: 0.92, vignette: 35},
      desc: '映画でよく使われる「銀残し」風。色を抜いて硬めの階調にし、周りを少し暗くします。'},
    {id: 'film', label: 'フィルム（レトロ）', values: {saturate: 80, blackLevel: 7, whiteLevel: -6, temperature: 12},
      desc: '黒を少し浮かせて白を抑え、色を少し抜いた、昔のフィルムのような柔らかい見た目。'},
    {id: 'pastel', label: 'パステル', values: {saturate: 70, blackLevel: 14, contrast: 90, gamma: 1.1},
      desc: '明るく淡い色合いに。'},
    {id: 'cool', label: '寒色', values: {temperature: -35},
      desc: '青っぽく涼しい色合いに。'},
    {id: 'warm', label: '暖色', values: {temperature: 35},
      desc: 'オレンジっぽく暖かい色合いに。'},
    {id: 'eyeCare', label: '目に優しい（夜）', values: {brightness: 85, saturate: 90, temperature: 30},
      desc: '暗い部屋で見る時向け。少し暗く、暖かい色にして青い光を減らします。'},
    {id: 'gold', label: 'ゴールド', values: {colorize: 'gold', contrast: 105},
      desc: '明るさを金色のグラデーションに置き換えます（黄金質・金属質のような見た目）。'},
    {id: 'mono', label: '白黒', values: {saturate: 0},
      desc: '色を抜いて白黒にします。雰囲気づくりや、色のチカチカが気になる時に。'},
    {id: 'monoHigh', label: '白黒（硬調）', values: {saturate: 0, contrast: 135},
      desc: 'コントラストの強い白黒。'},
    {id: 'invert', label: '反転（暗転）', values: {invert: true, hue: 180},
      desc: '白い背景の資料動画などを暗い画面にします（色味はなるべく保ったまま明暗だけ反転）。'}
  ];
  const PRESET_MAP = PRESETS.reduce((map, p) => { map[p.id] = p; return map; }, {});

  /* 着色（colorize）のグラデーション。暗い所→明るい所の順の色（0〜1） */
  const COLORIZE_MAPS = {
    gold: [[0.08, 0.04, 0.01], [0.45, 0.28, 0.08], [0.85, 0.62, 0.25], [1, 0.9, 0.6]],
    sepia: [[0.1, 0.06, 0.03], [0.45, 0.33, 0.2], [0.8, 0.68, 0.5], [1, 0.95, 0.85]],
    blue: [[0.02, 0.05, 0.12], [0.15, 0.3, 0.55], [0.5, 0.7, 0.9], [0.9, 0.97, 1]],
    green: [[0, 0.05, 0], [0.1, 0.45, 0.1], [0.4, 0.85, 0.35], [0.85, 1, 0.8]]
  };

  let config = null;
  let bypass = false;
  let applyScheduled = false;
  let lastCss = null;
  let lastSvgKey = null;
  let lastVignette = null;
  const listeners = new Set();
  // 自動レベル補正の現在値（入力の黒点・白点。0〜1）。設定には保存しない
  const auto = {black: 0, white: 1, available: true, timer: null, canvas: null};

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const digitsOf = p => p.digits !== undefined ? p.digits : (String(p.step).split('.')[1] || '').length;

  const normalize = (key, value) => {
    const p = PARAM_MAP[key];
    if (!p) { return value; }
    if (p.type === 'boolean') {
      return value === true || value === 'true';
    }
    if (p.type === 'select') {
      return p.options.some(([v]) => v === value) ? value : p.def;
    }
    let v = parseFloat(value);
    if (!isFinite(v)) { v = p.def; }
    v = clamp(v, p.min, p.max);
    return parseFloat(v.toFixed(digitsOf(p)));
  };

  const prop = key => config && config.props ? config.props[PREFIX + key] : undefined;
  const setProp = (key, value) => {
    if (!config || !config.props) { return; }
    if (config.props[PREFIX + key] !== value) {
      config.props[PREFIX + key] = value;
    }
  };

  /** 今の設定値（調整項目だけ）を正規化して返す */
  const read = () => {
    const values = {};
    PARAMS.forEach(p => { values[p.key] = normalize(p.key, prop(p.key)); });
    return values;
  };

  const isEnabled = () => {
    const v = prop('enable');
    return v === undefined ? true : !!v;
  };

  const isDefaultValue = (key, value) => {
    const p = PARAM_MAP[key];
    if (p.type === 'boolean') { return !!value === !!p.def; }
    if (p.type === 'select') { return value === p.def; }
    return Math.abs(value - p.def) < 1e-6;
  };

  const sameValue = (p, a, b) => {
    if (p.type === 'boolean') { return !!a === !!b; }
    if (p.type === 'select') { return a === b; }
    return Math.abs(a - b) < 1e-6;
  };

  /** 今の値が一致するプリセットのid。どれとも違えば 'custom'（手動調整中） */
  const detectPreset = (values = read()) => {
    const found = PRESETS.find(preset => PARAMS.every(p => {
      const target = preset.values[p.key] !== undefined ? preset.values[p.key] : p.def;
      return sameValue(p, values[p.key], target);
    }));
    return found ? found.id : 'custom';
  };

  /** 何か1つでも効いているか（ボタンを光らせる判定） */
  const isActive = (values = read()) => isEnabled() && PARAMS.some(p => !isDefaultValue(p.key, values[p.key]));

  // ---- 色変換行列（3行×4列: RGBの係数＋足し算）。CSSの filter 関数と同じ式 ----
  const IDENTITY = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0]];
  /** a を先に掛けてから b を掛けた合成行列（b ∘ a） */
  const compose = (a, b) => {
    const r = [];
    for (let i = 0; i < 3; i++) {
      r.push([0, 1, 2].map(j => b[i][0] * a[0][j] + b[i][1] * a[1][j] + b[i][2] * a[2][j])
        .concat(b[i][0] * a[0][3] + b[i][1] * a[1][3] + b[i][2] * a[2][3] + b[i][3]));
    }
    return r;
  };
  const diag = (r, g, b, o = 0) => [[r, 0, 0, o], [0, g, 0, o], [0, 0, b, o]];
  const saturateMatrix = s => [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0]
  ];
  const sepiaMatrix = a => {
    const k = 1 - a;
    return [
      [0.393 + 0.607 * k, 0.769 - 0.769 * k, 0.189 - 0.189 * k, 0],
      [0.349 - 0.349 * k, 0.686 + 0.314 * k, 0.168 - 0.168 * k, 0],
      [0.272 - 0.272 * k, 0.534 - 0.534 * k, 0.131 + 0.869 * k, 0]
    ];
  };
  const hueMatrix = deg => {
    const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    return [
      [0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0],
      [0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0],
      [0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0]
    ];
  };
  const LUMA = [0.2126, 0.7152, 0.0722];

  /** 色の処理を全部まとめた行列。何もしない時は null */
  const buildColorMatrix = values => {
    let m = IDENTITY, changed = false;
    const add = x => { m = compose(m, x); changed = true; };
    if (!isDefaultValue('brightness', values.brightness)) { const b = values.brightness / 100; add(diag(b, b, b)); }
    if (!isDefaultValue('contrast', values.contrast)) { const c = values.contrast / 100; add(diag(c, c, c, 0.5 - 0.5 * c)); }
    if (!isDefaultValue('saturate', values.saturate)) { add(saturateMatrix(values.saturate / 100)); }
    if (!isDefaultValue('sepia', values.sepia)) { add(sepiaMatrix(values.sepia / 100)); }
    if (!isDefaultValue('hue', values.hue)) { add(hueMatrix(values.hue)); }
    if (values.invert) { add(diag(-1, -1, -1, 1)); }
    if (!isDefaultValue('temperature', values.temperature) || !isDefaultValue('tint', values.tint)) {
      const t = values.temperature / 100, n = values.tint / 100;
      add(diag(1 + 0.10 * t + 0.04 * n, 1 - 0.12 * n, 1 - 0.15 * t + 0.04 * n));
    }
    if (values.colorize !== 'none') {
      add([LUMA.concat(0), LUMA.concat(0), LUMA.concat(0)]);
    }
    return changed ? m : null;
  };

  /**
   * 黒レベル/白レベルを「出力 = slope × 入力 + intercept」に変換する。
   *   黒レベル +n … 出力の黒を n% 持ち上げる / -n … 入力の n% 以下を真っ黒にする（締める）
   *   白レベル -n … 出力の白を n% 下げる     / +n … 入力の (100-n)% 以上を真っ白にする（伸ばす）
   */
  const levelsToLinear = (blackLevel, whiteLevel) => {
    const b = blackLevel / 100, w = whiteLevel / 100;
    const inBlack = b < 0 ? -b : 0, outBlack = b > 0 ? b : 0;
    const inWhite = w > 0 ? 1 - w : 1, outWhite = w < 0 ? 1 + w : 1;
    const slope = (outWhite - outBlack) / Math.max(0.01, inWhite - inBlack);
    const intercept = outBlack - slope * inBlack;
    return {slope: +slope.toFixed(4), intercept: +intercept.toFixed(4)};
  };

  const TONE_TABLE_SIZE = 65;
  const lerpColor = (stops, x, ch) => {
    const pos = clamp(x, 0, 1) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(pos));
    const f = pos - i;
    return stops[i][ch] * (1 - f) + stops[i + 1][ch] * f;
  };

  const useAutoLevels = values => values.autoLevels && auto.available &&
    (auto.black > 0.004 || auto.white < 0.996);

  /** 明るさの曲線（自動レベル→黒/白レベル→ガンマ→着色）を1枚の対応表にする。何もしない時は null */
  const buildToneTables = values => {
    const levels = !isDefaultValue('blackLevel', values.blackLevel) || !isDefaultValue('whiteLevel', values.whiteLevel);
    const gamma = !isDefaultValue('gamma', values.gamma);
    const colorize = values.colorize !== 'none' && COLORIZE_MAPS[values.colorize];
    const autoOn = useAutoLevels(values);
    if (!levels && !gamma && !colorize && !autoOn) { return null; }
    const {slope, intercept} = levelsToLinear(values.blackLevel, values.whiteLevel);
    const exponent = 1 / values.gamma;
    const tables = [[], [], []];
    for (let i = 0; i < TONE_TABLE_SIZE; i++) {
      let x = i / (TONE_TABLE_SIZE - 1);
      if (autoOn) { x = clamp((x - auto.black) / Math.max(0.05, auto.white - auto.black), 0, 1); }
      x = clamp(slope * x + intercept, 0, 1);
      x = Math.pow(x, exponent);
      for (let ch = 0; ch < 3; ch++) {
        tables[ch].push(+(colorize ? lerpColor(colorize, x, ch) : x).toFixed(4));
      }
    }
    return tables.map(t => t.join(' '));
  };

  /*
   * シャープ: アンシャープマスク。出力 = (1 + a) × 元の絵 − a × ぼかした絵。
   * a = シャープ/100 × 6（シャープ25で a=1.5。077 の3×3畳み込みと同じくらいの効き）。
   * 077b は a = シャープ/100 × 2 で、効きが弱すぎた（077c で修正）。
   */
  const SHARPEN_GAIN = 6;

  /** SVGフィルターの中身（<filter> の子要素）を作る。何もしない時は '' */
  const buildSvgFilterMarkup = values => {
    const parts = [];
    let input = 'SourceGraphic';
    const m = buildColorMatrix(values);
    if (m) {
      const v = m.map(row => [row[0], row[1], row[2], 0, row[3]].map(n => +n.toFixed(5)).join(' ')).join('  ');
      parts.push(`<feColorMatrix type="matrix" values="${v}  0 0 0 1 0" result="sfColor"/>`);
      input = 'sfColor';
    }
    const tables = buildToneTables(values);
    if (tables) {
      const f = (ch, i) => `<feFunc${ch} type="table" tableValues="${tables[i]}"/>`;
      parts.push(`<feComponentTransfer in="${input}" result="sfTone">${f('R', 0)}${f('G', 1)}${f('B', 2)}</feComponentTransfer>`);
      input = 'sfTone';
    }
    if (!isDefaultValue('sharpen', values.sharpen)) {
      const amount = +(values.sharpen / 100 * SHARPEN_GAIN).toFixed(3);
      parts.push(`<feGaussianBlur in="${input}" stdDeviation="0.6" result="sfBlur"/>`);
      parts.push(`<feComposite in="${input}" in2="sfBlur" operator="arithmetic" k1="0" k2="${+(1 + amount).toFixed(3)}" k3="${-amount}" k4="0"/>`);
    }
    return parts.join('');
  };

  /** SVG フィルターを画面外に1つだけ置き、値に合わせて中身を差し替える */
  const ensureSvg = markup => {
    if (typeof document === 'undefined') { return; }
    if (markup === lastSvgKey && document.getElementById(SVG_ID)) { return; }
    lastSvgKey = markup;
    let svg = document.getElementById(`${SVG_ID}-root`);
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = `${SVG_ID}-root`;
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
      (document.body || document.documentElement).append(svg);
    }
    svg.innerHTML =
      `<filter id="${SVG_ID}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${markup}</filter>`;
  };

  /**
   * CSS の filter 文字列を作る（canvas の ctx.filter にもそのまま使える）。
   * 何も掛けない時は 'none'。周辺減光はここに含まない（映像の上に重ねる影で表現する）。
   */
  const buildFilter = (values = read(), {enabled = isEnabled()} = {}) => {
    if (!enabled) { return 'none'; }
    const list = [];
    const markup = buildSvgFilterMarkup(values);
    if (markup) {
      ensureSvg(markup);
      list.push(`url(#${SVG_ID})`);
    }
    if (!isDefaultValue('blur', values.blur)) { list.push(`blur(${values.blur}px)`); }
    return list.length ? list.join(' ') : 'none';
  };

  /** 周辺減光の影の濃さ（0〜1）。効かない時は 0 */
  const vignetteAlpha = (values = read()) =>
    (!isEnabled() || bypass) ? 0 : +(values.vignette / 100 * 0.85).toFixed(3);

  const vignetteBackground = alpha =>
    `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${alpha}) 100%)`;

  const ensureStyle = () => {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) { return; }
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .zenzaWatchVideoElement {
        filter: var(${CSS_VAR}, none);
      }
      .${VIGNETTE_CLASS} {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        z-index: 6;
        pointer-events: none;
        display: none;
      }
      .${VIGNETTE_CLASS}.is-active {
        display: block;
      }
    `;
    (document.head || document.documentElement).append(style);
  };

  /* 周辺減光: 動画要素のすぐ後ろ（同じ親の中）に影の要素を置く。コメントより下になる */
  const applyVignette = alpha => {
    if (typeof document === 'undefined') { return; }
    const key = String(alpha);
    const videos = document.querySelectorAll('.zenzaWatchVideoElement');
    videos.forEach(video => {
      const parent = video.parentNode;
      if (!parent) { return; }
      let el = parent.querySelector(`:scope > .${VIGNETTE_CLASS}`);
      if (!el) {
        if (!alpha) { return; }
        el = document.createElement('div');
        el.className = VIGNETTE_CLASS;
        video.after(el);
      }
      el.classList.toggle('is-active', alpha > 0);
      if (alpha > 0) { el.style.background = vignetteBackground(alpha); }
    });
    lastVignette = key;
  };

  const emitChange = () => {
    listeners.forEach(fn => {
      try { fn(); } catch (e) { window.console.warn('ScreenFilter listener error', e); }
    });
  };

  /** 動画要素へ反映する（CSS変数を書き換えるだけなので軽い） */
  const apply = (values = read(), {notify = true} = {}) => {
    applyScheduled = false;
    if (typeof document === 'undefined') { return 'none'; }
    ensureStyle();
    const css = bypass ? 'none' : buildFilter(values);
    if (css !== lastCss) {
      lastCss = css;
      document.documentElement.style.setProperty(CSS_VAR, css);
    }
    applyVignette(vignetteAlpha(values));
    updateAutoLevelsTimer(values);
    notify && emitChange();
    return css;
  };

  const scheduleApply = () => {
    if (applyScheduled) { return; }
    applyScheduled = true;
    Promise.resolve().then(() => apply());
  };

  // ---- 自動レベル補正: 0.5秒ごとに映像を小さく縮めて、暗い所・明るい所を調べる ----
  const AUTO_W = 64, AUTO_H = 36;
  const sampleAutoLevels = () => {
    if (!isEnabled() || bypass) { return; }
    const video = document.querySelector('.zenzaWatchVideoElement');
    if (!video || video.paused || video.readyState < 2 || !video.videoWidth) { return; }
    try {
      if (!auto.canvas) {
        auto.canvas = document.createElement('canvas');
        auto.canvas.width = AUTO_W;
        auto.canvas.height = AUTO_H;
        auto.ctx = auto.canvas.getContext('2d', {willReadFrequently: true});
      }
      const ctx = auto.ctx;
      ctx.drawImage(video.drawableElement || video, 0, 0, AUTO_W, AUTO_H);
      const data = ctx.getImageData(0, 0, AUTO_W, AUTO_H).data;
      const hist = new Uint32Array(256);
      for (let i = 0; i < data.length; i += 4) {
        hist[(data[i] * 54 + data[i + 1] * 183 + data[i + 2] * 19) >> 8]++;
      }
      const total = AUTO_W * AUTO_H, cut = total * 0.005;
      let low = 0, high = 255, acc = 0;
      for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > cut) { low = i; break; } }
      acc = 0;
      for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > cut) { high = i; break; } }
      // 伸ばしすぎない（黒点は最大25%、白点は最小75%、幅は最低40%）
      let b = Math.min(low / 255, 0.25), w = Math.max(high / 255, 0.75);
      if (w - b < 0.4) { return; }
      b = auto.black * 0.7 + b * 0.3;
      w = auto.white * 0.7 + w * 0.3;
      if (Math.abs(b - auto.black) < 0.004 && Math.abs(w - auto.white) < 0.004) { return; }
      auto.black = b;
      auto.white = w;
      apply(read(), {notify: false});
    } catch (e) {
      // 配信元の許可（CORS）が無い映像では調べられない。以後は止める
      auto.available = false;
      window.console.warn('ScreenFilter: 自動レベル補正はこの映像では使えません', e && e.name);
      stopAutoLevels();
      emitChange();
    }
  };
  const stopAutoLevels = () => {
    if (auto.timer) {
      clearInterval(auto.timer);
      auto.timer = null;
    }
  };
  const updateAutoLevelsTimer = values => {
    const want = values.autoLevels && isEnabled() && auto.available && typeof window !== 'undefined';
    if (want && !auto.timer) {
      auto.timer = setInterval(sampleAutoLevels, 500);
    } else if (!want && auto.timer) {
      stopAutoLevels();
      auto.black = 0;
      auto.white = 1;
    }
  };
  /** 動画が変わった時に呼ぶ（自動レベル補正をやり直す） */
  const resetAutoLevels = () => {
    auto.black = 0;
    auto.white = 1;
    auto.available = true;
    scheduleApply();
  };

  /** 値を1つ変える（パネル・ショートカット用）。範囲外は丸める */
  const set = (key, value) => {
    if (!PARAM_MAP[key]) { return; }
    setProp(key, normalize(key, value));
    scheduleApply();
  };

  /** スライダーを動かしている間のプレビュー（保存はしない） */
  const preview = (key, value) => {
    const values = read();
    values[key] = normalize(key, value);
    // パネルへは通知しない（通知するとパネルが保存済みの値でつまみを戻してしまう。077b）
    apply(values, {notify: false});
  };

  const applyPreset = id => {
    const preset = PRESET_MAP[id];
    if (!preset) { return null; }
    PARAMS.forEach(p => {
      const v = preset.values[p.key] !== undefined ? preset.values[p.key] : p.def;
      setProp(p.key, normalize(p.key, v));
    });
    scheduleApply();
    return preset;
  };

  const reset = () => applyPreset('standard');

  const nextPreset = () => {
    const current = detectPreset();
    const index = PRESETS.findIndex(p => p.id === current);
    const next = PRESETS[(index + 1) % PRESETS.length];
    return applyPreset(next.id);
  };

  const formatValue = (key, value) => {
    const p = PARAM_MAP[key];
    if (!p) { return String(value); }
    if (p.type === 'boolean') { return value ? 'ON' : 'OFF'; }
    if (p.type === 'select') { const o = p.options.find(([v]) => v === value); return o ? o[1] : String(value); }
    const text = Number(value).toFixed(digitsOf(p));
    return `${p.signed && value > 0 ? '+' : ''}${text}${p.unit || ''}`;
  };

  /** 'brightness:+5' のような文字列で値を増減する（ショートカット用） */
  const adjust = param => {
    const [key, deltaText] = String(param || '').split(':');
    const p = PARAM_MAP[key];
    if (!p || p.type === 'boolean' || p.type === 'select') { return null; }
    const delta = parseFloat(deltaText) || 0;
    const next = normalize(key, normalize(key, prop(key)) + delta);
    setProp(key, next);
    scheduleApply();
    return {param: p, value: next};
  };

  const onOff = v => v ? 'ON' : 'OFF';

  /**
   * RootDispatcher から呼ばれる。画面に出すメッセージ（無ければ null）を返す。
   *   toggle-screenFilter.enable / .flipH / .flipV / .invert / .autoLevels、
   *   screenFilter-preset(id) / screenFilter-nextPreset / screenFilter-reset / screenFilter-adjust('key:±n')
   */
  const execCommand = (command, param) => {
    switch (command) {
      case 'toggle-screenFilter.enable': {
        const v = !isEnabled();
        setProp('enable', v);
        scheduleApply();
        return `画面フィルター: ${onOff(v)}`;
      }
      case 'toggle-screenFilter.flipH': {
        const v = !prop('flipH');
        setProp('flipH', v);
        return `左右反転: ${onOff(v)}`;
      }
      case 'toggle-screenFilter.flipV': {
        const v = !prop('flipV');
        setProp('flipV', v);
        return `上下反転: ${onOff(v)}`;
      }
      case 'toggle-screenFilter.invert':
      case 'toggle-screenFilter.autoLevels': {
        const key = command.replace('toggle-screenFilter.', '');
        const v = !normalize(key, prop(key));
        set(key, v);
        !isEnabled() && setProp('enable', true);
        return `${PARAM_MAP[key].label}: ${onOff(v)}`;
      }
      case 'screenFilter-preset': {
        const preset = applyPreset(param);
        if (!preset) { return null; }
        !isEnabled() && setProp('enable', true);
        return `画面フィルター: ${preset.label}`;
      }
      case 'screenFilter-nextPreset': {
        const preset = nextPreset();
        !isEnabled() && setProp('enable', true);
        return preset ? `画面フィルター: ${preset.label}` : null;
      }
      case 'screenFilter-reset':
        reset();
        return '画面フィルター: 標準に戻しました';
      case 'screenFilter-adjust': {
        const result = adjust(param);
        if (!result) { return null; }
        !isEnabled() && setProp('enable', true);
        return `${result.param.label}: ${formatValue(result.param.key, result.value)}`;
      }
    }
    return null;
  };

  const isCanvasTarget = target => {
    const key = target === 'screenshot' ? 'applyToScreenshot' : 'applyToCommentPip';
    const v = prop(key);
    return v === undefined ? true : !!v;
  };

  /**
   * canvas へ動画（または動画を描いた canvas）を、フィルター・反転・周辺減光つきで描く。
   * target: 'screenshot' | 'commentPip'（それぞれの「反映する」設定を見る）
   */
  const drawVideo = (ctx, source, dx, dy, w, h, {target = 'commentPip'} = {}) => {
    const use = isCanvasTarget(target);
    const filter = use && !bypass ? buildFilter() : 'none';
    const flipH = use && !!prop('flipH'), flipV = use && !!prop('flipV');
    ctx.save();
    if (filter !== 'none') {
      ctx.filter = filter;
    }
    if (flipH || flipV) {
      ctx.translate(dx + (flipH ? w : 0), dy + (flipV ? h : 0));
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(source, 0, 0, w, h);
    } else {
      ctx.drawImage(source, dx, dy, w, h);
    }
    ctx.restore();
    const alpha = use ? vignetteAlpha() : 0;
    if (alpha > 0) {
      const cx = dx + w / 2, cy = dy + h / 2;
      const g = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.hypot(w, h) / 2);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${alpha})`);
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(dx, dy, w, h);
      ctx.restore();
    }
  };

  /** スクリーンショット用: 加工済みの新しい canvas を返す（加工が無ければそのまま返す） */
  const processCanvas = (canvas, {target = 'screenshot'} = {}) => {
    if (!isCanvasTarget(target)) { return canvas; }
    const filter = bypass ? 'none' : buildFilter();
    if (filter === 'none' && !prop('flipH') && !prop('flipV') && !vignetteAlpha()) { return canvas; }
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const ctx = out.getContext('2d');
    drawVideo(ctx, canvas, 0, 0, canvas.width, canvas.height, {target});
    return out;
  };

  const initialize = playerConfig => {
    if (config === playerConfig) { return; }
    config = playerConfig;
    // 反転は従来通り「ページを開き直すと元に戻る」扱いにする（ずっと反転したままの事故防止）
    setProp('flipH', false);
    setProp('flipV', false);
    if (config && typeof config.on === 'function') {
      config.on('update', key => {
        if (typeof key === 'string' && key.startsWith(PREFIX)) {
          scheduleApply();
        }
      });
    }
    apply();
  };

  return {
    PREFIX,
    PARAMS,
    PARAM_MAP,
    PRESETS,
    DEFAULTS,
    COLORIZE_MAPS,
    initialize,
    read,
    set,
    preview,
    apply,
    applyPreset,
    reset,
    nextPreset,
    adjust,
    detectPreset,
    isActive,
    buildFilter,
    buildSvgFilterMarkup,
    buildColorMatrix,
    buildToneTables,
    levelsToLinear,
    formatValue,
    normalize,
    execCommand,
    drawVideo,
    processCanvas,
    isEnabled,
    resetAutoLevels,
    get autoLevelsAvailable() { return auto.available; },
    get flipH() { return !!prop('flipH'); },
    get flipV() { return !!prop('flipV'); },
    /** 押している間だけ元の映像と見比べる用 */
    setBypass(v) {
      bypass = !!v;
      apply();
    },
    get bypass() { return bypass; },
    onChange(fn) {
      typeof fn === 'function' && listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** テスト用 */
    _reset() {
      config = null;
      bypass = false;
      lastCss = null;
      lastSvgKey = null;
      lastVignette = null;
      stopAutoLevels();
      auto.black = 0;
      auto.white = 1;
      auto.available = true;
      listeners.clear();
    }
  };
})();

/*
 * プレイヤー内の「画面フィルター」パネル。
 * 動画を見ながら調整できるよう、画面の右上に小さく出す（動画は隠さない）。
 * 全画面の時は全画面の要素の中へ、それ以外は body へ置く（全画面中も見えるように）。
 */
const ScreenFilterPanel = (() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => (
    {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'}[c]
  ));

  const CSS = `
    .zenzaScreenFilterPanel {
      position: fixed;
      top: 16px;
      right: 16px;
      width: 380px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      overscroll-behavior: contain;
      z-index: 6060000;
      display: none;
      box-sizing: border-box;
      padding: 12px 14px 14px;
      border-radius: 10px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      background: rgba(24, 24, 28, 0.9);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6);
      color: #ddd;
      font-size: 12px;
      line-height: 1.5;
      text-align: left;
      font-family: 'Hiragino Sans', 'Yu Gothic UI', 'Meiryo', sans-serif;
      user-select: none;
    }
    .zenzaScreenFilterPanel.is-open { display: block; }
    .zenzaScreenFilterPanel * { box-sizing: border-box; }
    .zenzaScreenFilterPanel .sfHead {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .zenzaScreenFilterPanel .sfTitle {
      font-size: 15px;
      font-weight: bold;
      color: #fff;
      flex: 1;
    }
    .zenzaScreenFilterPanel button {
      font-size: 12px;
      color: #eee;
      background: #3a3a44;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 3px 8px;
      cursor: pointer;
    }
    .zenzaScreenFilterPanel button:hover { background: #4a4a58; }
    .zenzaScreenFilterPanel .sfClose {
      font-size: 16px;
      line-height: 1;
      padding: 2px 8px;
    }
    .zenzaScreenFilterPanel .sfIntro,
    .zenzaScreenFilterPanel .sfDesc,
    .zenzaScreenFilterPanel .sfNote {
      color: #aaa;
      font-size: 11px;
    }
    .zenzaScreenFilterPanel .sfSection {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }
    .zenzaScreenFilterPanel .sfSectionTitle {
      font-weight: bold;
      color: #fff;
      margin-bottom: 2px;
    }
    .zenzaScreenFilterPanel .sfPresets {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 4px;
      margin-top: 4px;
    }
    .zenzaScreenFilterPanel .sfPresets button { text-align: left; }
    .zenzaScreenFilterPanel .sfPresets button.is-current {
      background: #2d6a3e;
      border-color: #5fbf78;
      color: #fff;
    }
    .zenzaScreenFilterPanel .sfPresetState { margin-top: 4px; color: #9c9; font-size: 11px; }
    .zenzaScreenFilterPanel .sfRow { margin-top: 8px; }
    .zenzaScreenFilterPanel .sfRowHead {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .zenzaScreenFilterPanel .sfLabel { flex: 1; color: #eee; }
    .zenzaScreenFilterPanel .sfValue {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-family: monospace;
      color: #fff;
    }
    .zenzaScreenFilterPanel .sfNum {
      width: 62px;
      padding: 1px 3px;
      text-align: right;
      font: 12px monospace;
      color: inherit;
      background: #111;
      border: 1px solid #555;
      border-radius: 3px;
    }
    .zenzaScreenFilterPanel .sfUnit { min-width: 16px; color: #aaa; }
    .zenzaScreenFilterPanel .sfValue.is-changed .sfNum { color: #7fd38f; border-color: #4a8a58; }
    .zenzaScreenFilterPanel select.sfSelect {
      font-size: 12px;
      color: #eee;
      background: #111;
      border: 1px solid #555;
      border-radius: 3px;
      padding: 2px 4px;
    }
    .zenzaScreenFilterPanel .sfRowReset {
      padding: 0 6px;
      font-size: 11px;
    }
    .zenzaScreenFilterPanel input[type=range] {
      width: 100%;
      margin: 2px 0 0;
      cursor: pointer;
    }
    .zenzaScreenFilterPanel label.sfCheck {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      color: #eee;
    }
    .zenzaScreenFilterPanel .sfFoot {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 12px;
    }
    .zenzaScreenFilterPanel.is-disabled .sfAdjust { opacity: 0.45; }
    .zenzaScreenFilterPanel .sfDesc.is-unavailable::after {
      content: attr(data-unavailable);
      display: block;
      color: #ff9f8f;
    }
  `;

  const rowHtml = p => {
    if (p.type === 'boolean') {
      return `
        <div class="sfRow" data-key="${p.key}">
          <label class="sfCheck"><input type="checkbox" data-param="${p.key}"> ${esc(p.label)}</label>
          <div class="sfDesc">${esc(p.desc)}</div>
        </div>`;
    }
    if (p.type === 'select') {
      return `
        <div class="sfRow" data-key="${p.key}">
          <div class="sfRowHead">
            <span class="sfLabel">${esc(p.label)}</span>
            <select class="sfSelect" data-param="${p.key}">
              ${p.options.map(([v, label]) => `<option value="${v}">${esc(label)}</option>`).join('')}
            </select>
          </div>
          <div class="sfDesc">${esc(p.desc)}</div>
        </div>`;
    }
    // Task 077c: つまみ（細かく1刻み）と、数字を直接入れられる欄の両方を置く
    return `
      <div class="sfRow" data-key="${p.key}">
        <div class="sfRowHead">
          <span class="sfLabel">${esc(p.label)}</span>
          <span class="sfValue">
            <input type="number" class="sfNum" data-num="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" title="数字を直接入力できます（Enterで決定）">
            <span class="sfUnit">${esc(p.unit || '')}</span>
          </span>
          <button type="button" class="sfRowReset" data-reset="${p.key}" title="この項目だけ元に戻す">↺</button>
        </div>
        <input type="range" data-param="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}">
        <div class="sfDesc">${esc(p.desc)}</div>
      </div>`;
  };

  const TEMPLATE = () => `
    <div class="sfHead">
      <span class="sfTitle">画面フィルター</span>
      <label class="sfCheck" title="OFFにすると元の映像に戻ります（調整した値は残ります）">
        <input type="checkbox" data-setting="enable"> 使う
      </label>
      <button type="button" class="sfClose" data-action="close" title="閉じる">×</button>
    </div>
    <div class="sfIntro">
      動画の映像だけに効きます（コメントやボタンには効きません）。
      設定は全部の動画で共通で、次に開いた時も残ります。
    </div>
    <div class="sfSection">
      <div class="sfSectionTitle">かんたん設定（プリセット）</div>
      <div class="sfDesc">迷ったらここから選んでください。選んだあとに下のつまみで微調整もできます。</div>
      <div class="sfPresets">
        ${ScreenFilter.PRESETS.map(p =>
          `<button type="button" data-preset="${p.id}" title="${esc(p.desc)}">${esc(p.label)}</button>`).join('')}
      </div>
      <div class="sfPresetState"></div>
      <div class="sfNote">
        ボタンにマウスを乗せると、それぞれの説明が出ます。
        「くっきり」だけは輪郭の強調を使うので少し重めです（グラフィックボードの無いノートパソコンなどで
        カクつく時は、下の「シャープ」を 0 に）。ほかのプリセットは色の計算だけなので軽いです。
      </div>
    </div>
    <div class="sfSection sfAdjust">
      <div class="sfSectionTitle">色と明るさ</div>
      <div class="sfNote">つまみは1刻みで動かせます。右の数字の欄に直接入力もできます（キーボードの←→でも1ずつ動きます）。</div>
      ${ScreenFilter.PARAMS.filter(p => p.group === 'basic').map(rowHtml).join('')}
    </div>
    <div class="sfSection sfAdjust">
      <div class="sfSectionTitle">明暗・画質の細かい調整（暗い動画向け）</div>
      ${ScreenFilter.PARAMS.filter(p => p.group === 'tone').map(rowHtml).join('')}
    </div>
    <div class="sfSection sfAdjust">
      <div class="sfSectionTitle">雰囲気</div>
      ${ScreenFilter.PARAMS.filter(p => p.group === 'style').map(rowHtml).join('')}
    </div>
    <div class="sfSection">
      <div class="sfSectionTitle">変形（反転）</div>
      <label class="sfCheck"><input type="checkbox" data-setting="flipH"> 左右反転（鏡のように左右を入れ替える）</label>
      <label class="sfCheck"><input type="checkbox" data-setting="flipV"> 上下反転（上下をさかさまにする）</label>
      <div class="sfDesc">反転はページを開き直すと元に戻ります。「使う」をOFFにしても反転はそのままです。</div>
    </div>
    <div class="sfSection">
      <div class="sfSectionTitle">フィルターを反映する場所</div>
      <label class="sfCheck"><input type="checkbox" data-setting="applyToScreenshot"> スクリーンショットにも反映する</label>
      <label class="sfCheck"><input type="checkbox" data-setting="applyToCommentPip"> P in P(コメント付き) にも反映する</label>
      <div class="sfNote">
        通常の P in P は、ブラウザが動画をそのまま小窓に出す仕組みのため、フィルターは反映されません。
      </div>
    </div>
    <div class="sfFoot">
      <button type="button" data-action="reset" title="すべての調整を標準に戻します（反転はそのまま）">すべて標準に戻す</button>
      <button type="button" data-action="compare" title="押している間だけ、フィルターを外した元の映像を表示します">押している間だけ元の映像</button>
    </div>
  `;

  class Panel {
    constructor({config}) {
      this.config = config;
      this.view = null;
      this._onFullscreenChange = this._onFullscreenChange.bind(this);
      this._refresh = this._refresh.bind(this);
    }

    _initializeDom() {
      if (this.view) { return; }
      if (!document.getElementById('zenzaScreenFilterPanelStyle')) {
        const style = document.createElement('style');
        style.id = 'zenzaScreenFilterPanelStyle';
        style.textContent = CSS;
        (document.head || document.documentElement).append(style);
      }
      const view = this.view = document.createElement('div');
      // zen-family: Zenza は再生中、body直下の zen-family 以外の要素の中身を
      // pointer-events: none にしている（裏のページの無効化）。付けないとパネルが操作できない。
      view.className = 'zenzaScreenFilterPanel zen-family';
      view.innerHTML = TEMPLATE();

      // 全画面中はプレイヤーの中に置かれるため、クリック等がプレイヤー側
      // （再生/一時停止の切り替え・preventDefault）へ伝わらないようにする。
      ['click', 'dblclick', 'mousedown', 'mouseup', 'wheel', 'contextmenu', 'keydown', 'keyup']
        .forEach(name => view.addEventListener(name, e => e.stopPropagation()));
      // Esc でパネルだけ閉じる（プレイヤー自体は閉じない）
      view.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
        }
      });

      view.addEventListener('input', e => {
        const key = e.target.dataset.param;
        if (key && e.target.type === 'range') {
          ScreenFilter.preview(key, e.target.value);
          this._updateValueLabel(key, ScreenFilter.normalize(key, e.target.value), {force: true});
        }
      });
      view.addEventListener('change', e => {
        const {param, setting, num} = e.target.dataset;
        if (num) {
          const v = ScreenFilter.normalize(num, e.target.value);
          e.target.value = v;
          ScreenFilter.set(num, v);
          const range = this.view.querySelector(`input[type=range][data-param="${num}"]`);
          range && (range.value = v);
          if (!ScreenFilter.isEnabled()) { this.config.props['screenFilter.enable'] = true; }
        } else if (param) {
          ScreenFilter.set(param, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
          if (!ScreenFilter.isEnabled()) { this.config.props['screenFilter.enable'] = true; }
        } else if (setting) {
          this.config.props[`screenFilter.${setting}`] = !!e.target.checked;
        }
      });
      view.addEventListener('click', e => {
        const target = e.target.closest('button');
        if (!target) { return; }
        const {preset, reset, action} = target.dataset;
        if (preset) {
          ScreenFilter.execCommand('screenFilter-preset', preset);
        } else if (reset) {
          ScreenFilter.set(reset, ScreenFilter.PARAM_MAP[reset].def);
        } else if (action === 'reset') {
          ScreenFilter.reset();
        } else if (action === 'close') {
          this.close();
        }
      });
      const compare = view.querySelector('[data-action="compare"]');
      const bypassOn = e => { e.preventDefault(); ScreenFilter.setBypass(true); };
      const bypassOff = () => ScreenFilter.bypass && ScreenFilter.setBypass(false);
      compare.addEventListener('mousedown', bypassOn);
      compare.addEventListener('touchstart', bypassOn, {passive: false});
      ['mouseup', 'mouseleave', 'touchend', 'touchcancel', 'blur']
        .forEach(name => compare.addEventListener(name, bypassOff));

      ScreenFilter.onChange(this._refresh);
      document.addEventListener('fullscreenchange', this._onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', this._onFullscreenChange);
    }

    _updateValueLabel(key, value, {force = false} = {}) {
      const row = this.view.querySelector(`.sfRow[data-key="${key}"]`);
      const label = row && row.querySelector('.sfValue');
      const num = label && label.querySelector('.sfNum');
      if (!num) { return; }
      if (force || document.activeElement !== num) {
        num.value = value;
      }
      label.classList.toggle('is-changed', Math.abs(value - ScreenFilter.PARAM_MAP[key].def) > 1e-6);
    }

    _refresh() {
      if (!this.view || !this.isOpen) { return; }
      const values = ScreenFilter.read();
      const props = this.config.props;
      ScreenFilter.PARAMS.forEach(p => {
        const input = this.view.querySelector(`[data-param="${p.key}"]`);
        if (!input) { return; }
        if (p.type === 'boolean') {
          input.checked = !!values[p.key];
        } else if (p.type === 'select') {
          input.value = values[p.key];
        } else {
          // 操作中（フォーカス中）のつまみは書き換えない。ドラッグ中はプレビューだけで
          // まだ保存していないため、ここで保存値に戻すとつまみが跳ね返ってしまう。
          if (document.activeElement !== input) {
            input.value = values[p.key];
            this._updateValueLabel(p.key, values[p.key]);
          }
        }
      });
      this.view.querySelectorAll('[data-setting]').forEach(input => {
        const name = input.dataset.setting;
        const v = props[`screenFilter.${name}`];
        input.checked = v === undefined ? name !== 'flipH' && name !== 'flipV' : !!v;
      });
      const current = ScreenFilter.detectPreset(values);
      this.view.querySelectorAll('[data-preset]').forEach(button => {
        button.classList.toggle('is-current', button.dataset.preset === current);
      });
      const preset = ScreenFilter.PRESETS.find(p => p.id === current);
      this.view.querySelector('.sfPresetState').textContent = preset ?
        `いまの設定: ${preset.label}` : 'いまの設定: 手動で調整中（どのプリセットとも違う値）';
      const autoRow = this.view.querySelector('.sfRow[data-key="autoLevels"] .sfDesc');
      if (autoRow) {
        autoRow.classList.toggle('is-unavailable', !ScreenFilter.autoLevelsAvailable);
        autoRow.dataset.unavailable = ScreenFilter.autoLevelsAvailable ? '' : 'この動画では使えません（配信元が映像の読み取りを許可していないため）';
      }
      this.view.classList.toggle('is-disabled', !ScreenFilter.isEnabled());
    }

    _getParentNode() {
      const fs = document.fullscreenElement || document.webkitFullscreenElement;
      return fs || document.body;
    }

    _onFullscreenChange() {
      if (!this.view || !this.isOpen) { return; }
      const parent = this._getParentNode();
      if (this.view.parentNode !== parent) {
        parent.append(this.view);
      }
    }

    get isOpen() {
      return !!(this.view && this.view.classList.contains('is-open'));
    }

    open() {
      this._initializeDom();
      const parent = this._getParentNode();
      if (this.view.parentNode !== parent) {
        parent.append(this.view);
      }
      this.view.classList.add('is-open');
      this._refresh();
    }

    close() {
      if (!this.view) { return; }
      this.view.classList.remove('is-open');
      ScreenFilter.bypass && ScreenFilter.setBypass(false);
    }

    toggle() {
      this.isOpen ? this.close() : this.open();
    }
  }

  return Panel;
})();

//===END===

export {ScreenFilter, ScreenFilterPanel};
