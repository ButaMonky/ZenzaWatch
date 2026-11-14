/**
 * 先読みスケジューラ兼キャッシュ（prefetch1028.9）。
 *  - 「ウィンドウ」: プレイリストの次 windowCount 本を準備済みに保つ（取得は直列1本ずつ）。
 *  - 「格納」: 準備済みは watchId キーの LRU。maxStoreBytes を超えたら古い順に破棄。
 *    候補から外れても破棄しない（どの動画を開いてもキャッシュがあれば使う）。
 *  - 取得と取得の間の待機は設定値 pacingMs（実際は設定値の1〜2倍の乱数、0で待機なし）。
 *  - 期限（セッション期限の60秒手前。不明なら30分）を過ぎた項目は破棄し、
 *    ウィンドウ内なら自動で作り直す。使う瞬間の検証は呼び出し側にもある。
 *  - 一時停止・シーク・バッファ不足では準備中の通信だけ止め、条件が戻れば再挑戦。
 *  - 失敗した動画は少し待って1回だけ再試行し、その間も他の候補を進める。
 */
export interface PreloaderSample {
  settings: string;
  candidates: readonly string[];
  currentId: string | null;
  enabled: boolean;
  playing: boolean;
  seeking: boolean;
  waiting: boolean;
  currentTime: number;
  duration: number;
  bufferEnd: number;
  rate: number;
  ended: boolean;
  /** ウィンドウ本数（1〜HARD_MAX_WINDOW）。 */
  windowCount: number;
  /** 格納の合計サイズ上限 (bytes)。 */
  maxStoreBytes: number;
  /** 取得間の待機時間 (ms)。実際の待機は 1〜2倍の乱数。0 で待機なし。 */
  pacingMs: number;
}
export interface Disposable {dispose(): void}
export type PrepareFn<T extends Disposable> = (id: string, signal: AbortSignal) => Promise<T>;
export type PreloaderEvent =
  | {type: 'start'; id: string; attempt: number}
  | {type: 'ready'; id: string}
  | {type: 'paused'; id: string; reason: 'not-playing' | 'seeking' | 'waiting' | 'low-buffer'}
  | {type: 'failed'; id: string; attempt: number; willRetry: boolean; error: unknown}
  | {type: 'timeout'; id: string}
  | {type: 'expired'; id: string}
  | {type: 'evicted'; id: string}
  | {type: 'take-miss'; id: string; reason: 'none' | 'expired'};

export const MIN_PLAYED_SECONDS = 3;
export const MIN_AHEAD_TO_START = 15;
export const PREPARE_TIMEOUT_MS = 20000;
export const SESSION_EXPIRY_MARGIN_MS = 60 * 1000;
export const DEFAULT_HOLD_MS = 30 * 60 * 1000;
export const MAX_FAILURES = 2;
export const RETRY_DELAY_MS = 3000;
export const RETRY_JITTER_MS = 3000;
export const HARD_MAX_WINDOW = 96;
const MAX_FAILURE_ENTRIES = 64;

interface ReadyEntry<T> {value: T; at: number; bytes: number; deadline: number}
interface FailureEntry {count: number; retryAt: number}

class PlaylistPreloader<T extends Disposable = Disposable> {
  settings = '';
  ready = new Map<string, ReadyEntry<T>>();
  failures = new Map<string, FailureEntry>();
  controller: AbortController | null = null;
  inflightId = '';
  busy = false;
  nextAllowedAt = 0;
  timer: ReturnType<typeof setTimeout> | undefined;
  private readonly prepare: PrepareFn<T>;
  private readonly now: () => number;
  private readonly onReady: ((id: string, value: T) => void) | undefined;
  private readonly onEvent: ((event: PreloaderEvent) => void) | undefined;
  private readonly sizeOf: (value: T) => number;
  private readonly expiresOf: (value: T) => number | undefined;
  private readonly random: () => number;
  private readonly timeoutMs: number;

  constructor(prepare: PrepareFn<T>, now: () => number = () => Date.now(),
    onReady?: (id: string, value: T) => void, onEvent?: (event: PreloaderEvent) => void,
    sizeOf?: (value: T) => number, expiresOf?: (value: T) => number | undefined,
    random?: () => number, timeoutMs = PREPARE_TIMEOUT_MS) {
    this.prepare = prepare;
    this.now = now;
    this.onReady = onReady;
    this.onEvent = onEvent;
    this.sizeOf = sizeOf ?? (() => 0);
    this.expiresOf = expiresOf ?? (() => undefined);
    this.random = random ?? Math.random;
    this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : PREPARE_TIMEOUT_MS;
  }

  private emit(event: PreloaderEvent): void {
    try { this.onEvent?.(event); } catch (_) { /* ignore */ }
  }

  private deadlineFor(value: T, at: number): number {
    const sessionExpiry = this.expiresOf(value);
    return typeof sessionExpiry === 'number' && Number.isFinite(sessionExpiry) ?
      sessionExpiry - SESSION_EXPIRY_MARGIN_MS : at + DEFAULT_HOLD_MS;
  }

  private abortPending(): void {
    // Release the old owner before firing AbortSignal listeners (which can re-enter update).
    const oldController = this.controller;
    const oldTimer = this.timer;
    this.controller = null;
    this.busy = false;
    this.inflightId = '';
    this.timer = undefined;
    clearTimeout(oldTimer);
    oldController?.abort();
  }

  interrupt(reason: 'not-playing' | 'seeking' | 'waiting' | 'low-buffer'): void {
    if (!this.controller) return;
    const id = this.inflightId;
    this.abortPending();
    this.emit({type: 'paused', id, reason});
  }

  cancel(): void {
    this.abortPending();
    for (const entry of this.ready.values()) entry.value.dispose();
    this.ready.clear();
  }

  reset(): void {
    this.cancel();
    this.settings = '';
    this.failures.clear();
  }

  totalBytes(): number {
    let total = 0;
    for (const entry of this.ready.values()) total += entry.bytes;
    return total;
  }

  readyIds(): string[] {
    return [...this.ready.keys()];
  }

  private expireStale(): void {
    for (const [id, entry] of this.ready) {
      if (this.now() >= entry.deadline) {
        this.ready.delete(id);
        entry.value.dispose();
        this.failures.delete(id);
        this.emit({type: 'expired', id});
      }
    }
  }

  private enforceBudget(maxStoreBytes: number): void {
    if (!(maxStoreBytes > 0)) return;
    while (this.ready.size > 1 && this.totalBytes() > maxStoreBytes) {
      const oldest = this.ready.keys().next().value as string;
      const entry = this.ready.get(oldest);
      this.ready.delete(oldest);
      entry?.value.dispose();
      this.emit({type: 'evicted', id: oldest});
    }
  }

  update(s: PreloaderSample): void {
    if (!s.enabled) { this.reset(); return; }
    if (s.settings !== this.settings) {
      this.cancel();
      this.failures.clear();
      this.settings = s.settings;
    }
    this.expireStale();
    this.enforceBudget(s.maxStoreBytes);
    if (this.failures.size > MAX_FAILURE_ENTRIES) {
      const oldest = this.failures.keys().next().value as string;
      this.failures.delete(oldest);
    }

    const windowCount = Math.max(1, Math.min(HARD_MAX_WINDOW, Math.floor(s.windowCount) || 1));
    const windowIds: string[] = [];
    for (const id of s.candidates) {
      if (!id || id === s.currentId || windowIds.includes(id)) continue;
      windowIds.push(id);
      if (windowIds.length >= windowCount) break;
    }
    // 準備中の対象がウィンドウから外れたら止める（並べ替え・削除・その動画へ移動した場合）
    if (this.controller && !windowIds.includes(this.inflightId)) this.abortPending();
    if (!windowIds.length) return;

    const rate = Math.max(0.25, s.rate || 1);
    const ahead = Math.max(0, s.bufferEnd - s.currentTime) / rate;
    const endBuffered = Number.isFinite(s.duration) && s.duration > 0 && s.bufferEnd >= s.duration - 0.15;
    if (s.ended && !s.seeking && !s.waiting) return;
    const pause = !s.playing ? 'not-playing' : s.seeking ? 'seeking' : s.waiting ? 'waiting' :
      (!endBuffered && ahead < MIN_AHEAD_TO_START) ? 'low-buffer' : null;
    if (pause) { this.interrupt(pause); return; }
    if (this.busy || !(s.currentTime >= MIN_PLAYED_SECONDS)) return;
    const pacingMs = Number.isFinite(s.pacingMs) && s.pacingMs > 0 ? s.pacingMs : 0;
    if (pacingMs > 0 && this.now() < this.nextAllowedAt) return;

    let target = '';
    for (const id of windowIds) {
      if (this.ready.has(id)) continue;
      const failure = this.failures.get(id);
      if (failure && (failure.count >= MAX_FAILURES || this.now() < failure.retryAt)) continue;
      target = id;
      break;
    }
    if (!target) return;

    this.busy = true;
    this.inflightId = target;
    const controller = this.controller = new AbortController();
    const settings = this.settings;
    const attempt = (this.failures.get(target)?.count ?? 0) + 1;
    this.emit({type: 'start', id: target, attempt});
    this.timer = setTimeout(() => {
      if (this.controller !== controller) return;
      // A timed-out request is a failed attempt. Otherwise the next update
      // immediately retries the same hung video and starves every later ID.
      const count = (this.failures.get(target)?.count ?? 0) + 1;
      this.failures.set(target, {count, retryAt: this.now() + RETRY_DELAY_MS + this.random() * RETRY_JITTER_MS});
      this.abortPending();
      this.emit({type: 'timeout', id: target});
    }, this.timeoutMs);
    const current = (): boolean => !controller.signal.aborted && this.controller === controller && settings === this.settings;
    void this.prepare(target, controller.signal).then(value => {
      if (!current()) { value.dispose(); return; }
      const at = this.now();
      this.ready.set(target, {value, at, bytes: this.sizeOf(value), deadline: this.deadlineFor(value, at)});
      this.failures.delete(target);
      this.enforceBudget(s.maxStoreBytes);
      this.emit({type: 'ready', id: target});
      try { this.onReady?.(target, value); } catch (_) { /* ignore */ }
    }, (error: unknown) => {
      if (!current()) return;
      const count = (this.failures.get(target)?.count ?? 0) + 1;
      const willRetry = count < MAX_FAILURES;
      this.failures.set(target, {count, retryAt: this.now() + RETRY_DELAY_MS + this.random() * RETRY_JITTER_MS});
      this.emit({type: 'failed', id: target, attempt, willRetry, error});
    }).finally(() => {
      // A canceled request may settle after its replacement starts. Only its own
      // generation can release busy state, pacing and the timeout handle.
      if (this.controller !== controller) return;
      this.busy = false;
      // 連続アクセスを避けるため、次の取得まで乱数込みの待機を置く（設定値の1〜2倍）
      this.nextAllowedAt = pacingMs > 0 ? this.now() + pacingMs + this.random() * pacingMs : 0;
      clearTimeout(this.timer);
      this.timer = undefined;
      this.controller = null;
      this.inflightId = '';
    });
  }

  /** 指定の動画の準備済みを取り出す（他の項目は残す）。 */
  take(id: string): T | null {
    const entry = this.ready.get(id);
    if (!entry) { this.emit({type: 'take-miss', id, reason: 'none'}); return null; }
    this.ready.delete(id);
    if (this.now() >= entry.deadline) {
      entry.value.dispose();
      this.emit({type: 'take-miss', id, reason: 'expired'});
      return null;
    }
    return entry.value;
  }
}

export {PlaylistPreloader};
