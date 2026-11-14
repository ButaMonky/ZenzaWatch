// GENERATED FROM tools/typescript-stage1/hls-src/PlaylistPreloader.ts (Task997). Edit TypeScript and run npm run hls:sync.
//===BEGIN===
const MIN_PLAYED_SECONDS = 3;
const MIN_AHEAD_TO_START = 15;
const PREPARE_TIMEOUT_MS = 20000;
const SESSION_EXPIRY_MARGIN_MS = 60 * 1000;
const DEFAULT_HOLD_MS = 30 * 60 * 1000;
const MAX_FAILURES = 2;
const RETRY_DELAY_MS = 3000;
const RETRY_JITTER_MS = 3000;
const HARD_MAX_WINDOW = 96;
const MAX_FAILURE_ENTRIES = 64;
class PlaylistPreloader {
    settings = '';
    ready = new Map();
    failures = new Map();
    controller = null;
    inflightId = '';
    busy = false;
    nextAllowedAt = 0;
    timer;
    prepare;
    now;
    onReady;
    onEvent;
    sizeOf;
    expiresOf;
    random;
    timeoutMs;
    constructor(prepare, now = () => Date.now(), onReady, onEvent, sizeOf, expiresOf, random, timeoutMs = PREPARE_TIMEOUT_MS) {
        this.prepare = prepare;
        this.now = now;
        this.onReady = onReady;
        this.onEvent = onEvent;
        this.sizeOf = sizeOf ?? (() => 0);
        this.expiresOf = expiresOf ?? (() => undefined);
        this.random = random ?? Math.random;
        this.timeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : PREPARE_TIMEOUT_MS;
    }
    emit(event) {
        try {
            this.onEvent?.(event);
        }
        catch (_) { /* ignore */ }
    }
    deadlineFor(value, at) {
        const sessionExpiry = this.expiresOf(value);
        return typeof sessionExpiry === 'number' && Number.isFinite(sessionExpiry) ?
            sessionExpiry - SESSION_EXPIRY_MARGIN_MS : at + DEFAULT_HOLD_MS;
    }
    abortPending() {
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
    interrupt(reason) {
        if (!this.controller)
            return;
        const id = this.inflightId;
        this.abortPending();
        this.emit({ type: 'paused', id, reason });
    }
    cancel() {
        this.abortPending();
        for (const entry of this.ready.values())
            entry.value.dispose();
        this.ready.clear();
    }
    reset() {
        this.cancel();
        this.settings = '';
        this.failures.clear();
    }
    totalBytes() {
        let total = 0;
        for (const entry of this.ready.values())
            total += entry.bytes;
        return total;
    }
    readyIds() {
        return [...this.ready.keys()];
    }
    expireStale() {
        for (const [id, entry] of this.ready) {
            if (this.now() >= entry.deadline) {
                this.ready.delete(id);
                entry.value.dispose();
                this.failures.delete(id);
                this.emit({ type: 'expired', id });
            }
        }
    }
    enforceBudget(maxStoreBytes) {
        if (!(maxStoreBytes > 0))
            return;
        while (this.ready.size > 1 && this.totalBytes() > maxStoreBytes) {
            const oldest = this.ready.keys().next().value;
            const entry = this.ready.get(oldest);
            this.ready.delete(oldest);
            entry?.value.dispose();
            this.emit({ type: 'evicted', id: oldest });
        }
    }
    update(s) {
        if (!s.enabled) {
            this.reset();
            return;
        }
        if (s.settings !== this.settings) {
            this.cancel();
            this.failures.clear();
            this.settings = s.settings;
        }
        this.expireStale();
        this.enforceBudget(s.maxStoreBytes);
        if (this.failures.size > MAX_FAILURE_ENTRIES) {
            const oldest = this.failures.keys().next().value;
            this.failures.delete(oldest);
        }
        const windowCount = Math.max(1, Math.min(HARD_MAX_WINDOW, Math.floor(s.windowCount) || 1));
        const windowIds = [];
        for (const id of s.candidates) {
            if (!id || id === s.currentId || windowIds.includes(id))
                continue;
            windowIds.push(id);
            if (windowIds.length >= windowCount)
                break;
        }
        // 準備中の対象がウィンドウから外れたら止める（並べ替え・削除・その動画へ移動した場合）
        if (this.controller && !windowIds.includes(this.inflightId))
            this.abortPending();
        if (!windowIds.length)
            return;
        const rate = Math.max(0.25, s.rate || 1);
        const ahead = Math.max(0, s.bufferEnd - s.currentTime) / rate;
        const endBuffered = Number.isFinite(s.duration) && s.duration > 0 && s.bufferEnd >= s.duration - 0.15;
        if (s.ended && !s.seeking && !s.waiting)
            return;
        const pause = !s.playing ? 'not-playing' : s.seeking ? 'seeking' : s.waiting ? 'waiting' :
            (!endBuffered && ahead < MIN_AHEAD_TO_START) ? 'low-buffer' : null;
        if (pause) {
            this.interrupt(pause);
            return;
        }
        if (this.busy || !(s.currentTime >= MIN_PLAYED_SECONDS))
            return;
        const pacingMs = Number.isFinite(s.pacingMs) && s.pacingMs > 0 ? s.pacingMs : 0;
        if (pacingMs > 0 && this.now() < this.nextAllowedAt)
            return;
        let target = '';
        for (const id of windowIds) {
            if (this.ready.has(id))
                continue;
            const failure = this.failures.get(id);
            if (failure && (failure.count >= MAX_FAILURES || this.now() < failure.retryAt))
                continue;
            target = id;
            break;
        }
        if (!target)
            return;
        this.busy = true;
        this.inflightId = target;
        const controller = this.controller = new AbortController();
        const settings = this.settings;
        const attempt = (this.failures.get(target)?.count ?? 0) + 1;
        this.emit({ type: 'start', id: target, attempt });
        this.timer = setTimeout(() => {
            if (this.controller !== controller)
                return;
            // A timed-out request is a failed attempt. Otherwise the next update
            // immediately retries the same hung video and starves every later ID.
            const count = (this.failures.get(target)?.count ?? 0) + 1;
            this.failures.set(target, { count, retryAt: this.now() + RETRY_DELAY_MS + this.random() * RETRY_JITTER_MS });
            this.abortPending();
            this.emit({ type: 'timeout', id: target });
        }, this.timeoutMs);
        const current = () => !controller.signal.aborted && this.controller === controller && settings === this.settings;
        void this.prepare(target, controller.signal).then(value => {
            if (!current()) {
                value.dispose();
                return;
            }
            const at = this.now();
            this.ready.set(target, { value, at, bytes: this.sizeOf(value), deadline: this.deadlineFor(value, at) });
            this.failures.delete(target);
            this.enforceBudget(s.maxStoreBytes);
            this.emit({ type: 'ready', id: target });
            try {
                this.onReady?.(target, value);
            }
            catch (_) { /* ignore */ }
        }, (error) => {
            if (!current())
                return;
            const count = (this.failures.get(target)?.count ?? 0) + 1;
            const willRetry = count < MAX_FAILURES;
            this.failures.set(target, { count, retryAt: this.now() + RETRY_DELAY_MS + this.random() * RETRY_JITTER_MS });
            this.emit({ type: 'failed', id: target, attempt, willRetry, error });
        }).finally(() => {
            // A canceled request may settle after its replacement starts. Only its own
            // generation can release busy state, pacing and the timeout handle.
            if (this.controller !== controller)
                return;
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
    take(id) {
        const entry = this.ready.get(id);
        if (!entry) {
            this.emit({ type: 'take-miss', id, reason: 'none' });
            return null;
        }
        this.ready.delete(id);
        if (this.now() >= entry.deadline) {
            entry.value.dispose();
            this.emit({ type: 'take-miss', id, reason: 'expired' });
            return null;
        }
        return entry.value;
    }
}
//===END===
export {PlaylistPreloader};
