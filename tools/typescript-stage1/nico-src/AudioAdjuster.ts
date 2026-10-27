/**
 * Canonical TypeScript source for packages/zenza/src/audio/AudioAdjuster.js (Task901).
 */
/**
 * Playlist items wrap raw API/storage records of several formats and are shared with
 * views and other modules that are still JS; this one documented loose alias covers them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
export interface AudioModule {
  id: string;
  label?: string;
  configKey?: string;
  getGain(context: Loose): number;
}
type GainListener = (gain: number, context: Loose) => unknown;

/*
 * Task 074: 音量まわりの自動調整をまとめる仕組み。
 *
 * 本家ニコニコの「音声の自動調整」は、動画ごとに測った音の大きさ
 * （視聴JSON media.domand.audios[].loudnessCollection の type:"video" の値）を
 * 音量に掛けて、動画ごとの音量差を小さくする機能。
 *
 * ここでは「音量に掛ける倍率を決めるモジュール」を後から足せる形にしてある。
 * 各モジュールは次の形で、掛け算で合成される（1 = 変化なし）。
 *
 *   AudioAdjuster.register({
 *     id: 'loudnessNormalize',      // 一意な名前
 *     label: '音量の自動調整',       // 表示用
 *     configKey: 'audio.autoAdjust',// この設定がONの時だけ効く（省略可）
 *     getGain(context) { return 0.9; } // 1 = 変化なし。context は setContext() で渡した情報
 *   });
 *
 * context は動画が変わるたびに setContext() で丸ごと差し替える。
 * 現在は {loudness, watchId, isYouTube} を入れている。
 *
 * 【制限】倍率は今のところ <video> の volume に掛けているだけなので、
 * 1 より大きい倍率（音を大きくする方向）は 1 に丸められる。音を大きくする
 * モジュールを足したくなったら、この中で WebAudio の GainNode を使う実装へ
 * 差し替える（使う側は AudioAdjuster.gain を読むだけなので影響しない）。
 */
const AudioAdjuster = (() => {
  const modules = new Map<string, AudioModule>();
  const listeners = new Set<GainListener>();
  let config: Loose = null;
  let context: Loose = {};
  let gain = 1;

  const isEnabled = (module: AudioModule) =>
    !module.configKey || !config || !!config.props[module.configKey];

  const calc = () => {
    let result = 1;
    for (const module of modules.values()) {
      if (!isEnabled(module)) { continue; }
      let g = 1;
      try {
        g = module.getGain(context);
      } catch (e) {
        window.console.warn('音量調整モジュールでエラー', module.id, e);
        g = 1;
      }
      if (typeof g === 'number' && isFinite(g) && g > 0) {
        result *= g;
      }
    }
    return result;
  };

  const update = () => {
    const next = calc();
    if (Math.abs(next - gain) < 0.0001) {
      return gain;
    }
    gain = next;
    listeners.forEach(fn => {
      try {
        fn(gain, context);
      } catch (e) {
        window.console.warn('音量調整の通知でエラー', e);
      }
    });
    return gain;
  };

  return {
    /** Config を渡すと、各モジュールの configKey の変化を見て自動で再計算する */
    initialize(playerConfig: Loose) {
      config = playerConfig;
      modules.forEach(module => {
        if (module.configKey && config.onkey) {
          config.onkey(module.configKey, () => update());
        }
      });
      update();
    },
    register(module: Loose) {
      if (!module || !module.id || typeof module.getGain !== 'function') {
        return;
      }
      modules.set(module.id, module);
      if (config && module.configKey && config.onkey) {
        config.onkey(module.configKey, () => update());
      }
      update();
    },
    /** 動画が変わった時に呼ぶ。渡した情報がそのまま各モジュールへ渡る */
    setContext(next: Loose = {}) {
      context = next || {};
      return update();
    },
    get context() { return context; },
    get gain() { return gain; },
    get modules() { return [...modules.values()]; },
    onChange(fn: GainListener) {
      typeof fn === 'function' && listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** テスト用。登録済みモジュールと状態を初期化する */
    _reset() {
      modules.clear();
      listeners.clear();
      config = null;
      context = {};
      gain = 1;
    }
  };
})();

/*
 * 本家と同じ「音声の自動調整」。
 * loudness は視聴JSONの倍率（例: 0.93）。音が大きい動画ほど小さい値になる。
 */
AudioAdjuster.register({
  id: 'loudnessNormalize',
  label: '音声の自動調整（動画ごとの音量差を小さくする）',
  configKey: 'audio.autoAdjust',
  getGain(context: Loose) {
    const loudness = context && context.loudness;
    if (typeof loudness !== 'number' || !isFinite(loudness) || loudness <= 0) {
      return 1;
    }
    return Math.min(loudness, 1);
  }
});

export {AudioAdjuster};
