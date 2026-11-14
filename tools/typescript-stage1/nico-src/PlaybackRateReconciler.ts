/**
 * 再生速度を「Zenza自身の設定」と「外部からの変更」の間で調停するモジュール。
 *
 * 背景（Task1029）:
 *  Video Speed Controller のような拡張機能は <video> の playbackRate を直接書き換える。
 *  一方 Zenza は従来、
 *   (1) canplay のたびに自分の保持値を無条件に書き戻し、
 *   (2) 速度変更時に「いったん 1 倍にして 100ms 後に目的値へ」書き、
 *   (3) ratechange を一切監視していなかった。
 *  このため拡張機能で変えた速度が勝手に戻り、(2) の間は一瞬 1 倍になっていた。
 *
 * 方針:
 *  - 自分が書いた値を覚えておき（noteApplied）、ratechange で届いた値がそれと一致すれば
 *    自分の書き込みの反響なので何もしない。一致しなければ外部が変えたと判断する。
 *  - 外部の変更を尊重する設定（既定ON）なら、その値を Zenza 側の正とみなして採用する。
 *    採用値は呼び出し側で通常の速度コマンドと同じ経路へ流すため、速度表示・コメントの
 *    流れる速さの補正も一緒に追随する。
 *  - 尊重しない設定なら、自分の保持値を書き戻す（従来の挙動。ただし 1 倍を経由しない）。
 *  - canplay での再適用は、実際にズレているときだけ行う（reconcile）。
 *    <video>.defaultPlaybackRate も併せて設定すれば読み込み時の値はブラウザ側が復元するため、
 *    通常はズレが起きず、書き戻しも発生しない。
 *
 * このモジュールは DOM に触らない。判断だけを返し、実際の書き込みは呼び出し側が行う。
 */

/** HTMLMediaElement.playbackRate としてブラウザが受け付ける範囲。 */
export const MIN_RATE = 0.0625;
export const MAX_RATE = 16;

/** 浮動小数の誤差で「別の値」と誤認しないための許容差。 */
const EPSILON = 1e-4;

export type RateDecisionKind =
  /** 何もしない（自分の書き込みの反響、または不正な値）。 */
  | 'ignore'
  /** 外部の変更を Zenza 側へ取り込む。rate は取り込む値。 */
  | 'adopt'
  /** Zenza の保持値を <video> へ書き戻す。rate は書き戻す値。 */
  | 'reapply';

export interface RateDecision {
  kind: RateDecisionKind;
  /** adopt / reapply のときの対象の速度。ignore のときは直近の期待値。 */
  rate: number;
  /** 判断の理由（通知履歴・診断ログ用。英数字とハイフンのみ）。 */
  reason: string;
}

export interface ReconcilerDeps {
  /**
   * 外部（拡張機能・ブラウザのUIなど）による速度変更を尊重するか。
   * 上級者設定 'playbackRate.respectExternal'。既定 true。
   */
  respectExternal(): boolean;
}

/** 有限で正、かつブラウザが受け付ける範囲に収まる速度だけを通す。 */
export const normalizeRate = (value: unknown): number | null => {
  const rate = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(rate) || rate <= 0) { return null; }
  if (rate < MIN_RATE - EPSILON || rate > MAX_RATE + EPSILON) { return null; }
  return Math.min(Math.max(rate, MIN_RATE), MAX_RATE);
};

const sameRate = (a: number, b: number): boolean => Math.abs(a - b) <= EPSILON;

export class PlaybackRateReconciler {
  private readonly deps: ReconcilerDeps;
  /** 直近に Zenza 自身が <video> へ書いた値。 */
  private expected: number;
  /** 外部由来として取り込んだ回数（診断用）。 */
  private adoptedCount = 0;

  constructor(deps: ReconcilerDeps, initialRate = 1) {
    this.deps = deps;
    this.expected = normalizeRate(initialRate) ?? 1;
  }

  /** Zenza 自身が <video> へ書いた直後に呼ぶ。以後その値は自分の書き込みとして扱う。 */
  noteApplied(value: unknown): void {
    const rate = normalizeRate(value);
    if (rate === null) { return; }
    this.expected = rate;
  }

  /** 現在 Zenza が正としている速度。 */
  get currentRate(): number { return this.expected; }

  /** 外部由来として取り込んだ回数。 */
  get externalAdoptions(): number { return this.adoptedCount; }

  /**
   * ratechange を受けたときの判断。
   * elementRate は <video>.playbackRate の実際の値。
   */
  observe(elementRate: unknown): RateDecision {
    const rate = normalizeRate(elementRate);
    if (rate === null) {
      // 範囲外・不正。書き戻すと拡張機能と押し合いになるので触らない。
      return {kind: 'ignore', rate: this.expected, reason: 'out-of-range'};
    }
    if (sameRate(rate, this.expected)) {
      return {kind: 'ignore', rate: this.expected, reason: 'self'};
    }
    if (!this.deps.respectExternal()) {
      // 尊重しない設定。保持値を書き戻す（1 倍は経由しない）。
      return {kind: 'reapply', rate: this.expected, reason: 'external-rejected'};
    }
    this.expected = rate;
    this.adoptedCount += 1;
    return {kind: 'adopt', rate, reason: 'external'};
  }

  /**
   * canplay などで実際の値と保持値が合っているか点検する。
   * ズレているときだけ書き戻す。defaultPlaybackRate を設定していれば通常ズレない。
   */
  reconcile(elementRate: unknown): RateDecision {
    const rate = normalizeRate(elementRate);
    if (rate === null) {
      // 読み込み直後などで値が読めない場合は、保持値を入れ直す。
      return {kind: 'reapply', rate: this.expected, reason: 'unreadable'};
    }
    if (sameRate(rate, this.expected)) {
      return {kind: 'ignore', rate: this.expected, reason: 'in-sync'};
    }
    return {kind: 'reapply', rate: this.expected, reason: 'drifted'};
  }

  /**
   * 設定・コマンドから速度を変える前の検証。
   * 受け付けられない値なら null を返す（呼び出し側は何もしない）。
   */
  requestRate(value: unknown): number | null {
    return normalizeRate(value);
  }
}

export const createPlaybackRateReconciler = (
  deps: ReconcilerDeps, initialRate?: number
): PlaybackRateReconciler => new PlaybackRateReconciler(deps, initialRate);
