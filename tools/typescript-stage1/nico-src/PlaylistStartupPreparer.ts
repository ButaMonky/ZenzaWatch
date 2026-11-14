/**
 * 連続再生の次動画について「動画情報 → 再生セッション → 先頭データ」を順に準備する。
 * NicoVideoPlayerDialog から依存を注入して使う（ダイアログ側は薄い呼び出しだけにする）。
 *
 * 各段階の開始・成功・失敗を診断ログに出し、失敗時は理由（PrefetchError.detail）も記録する。
 */
export type PrepareStage = 'metadata' | 'eligibility' | 'session' | 'connect' | 'startup-media';

export interface SessionLike {
  connect(): Promise<{url: string; [key: string]: unknown}>;
  close(): unknown;
  promote?(): Promise<unknown>;
  getState?(): Promise<{sessionId?: unknown; isDeleted?: boolean}>;
}
export interface StartupBytesLike {dispose(): void; bytes?: number; startLevel?: number; stages?: readonly string[]}
export interface VideoInfoLike {
  isDomandAvailable: boolean;
  isDomandOnly: boolean;
  maybeBetterQualityServerType?: string;
}

export interface PreparerDeps<D, I extends VideoInfoLike, B extends StartupBytesLike> {
  loadVideoInfo(watchId: string, signal: AbortSignal): Promise<D>;
  createModel(data: D): I;
  isNgVideo(info: I): boolean;
  getConfig(key: 'domandVideoQuality' | 'videoServerType' | 'autoDisableNew'): unknown;
  createSession(info: I, videoQuality: unknown): Promise<SessionLike>;
  prepareBytes(url: string, signal: AbortSignal): Promise<B>;
  settingsKey(): string;
  log?(event: string, payload: Record<string, unknown>): void;
  now?(): number;
  /** 付随データ（コメント等）の先読み。失敗しても本体の準備は失敗にしない。 */
  prepareCompanions?(info: I, signal: AbortSignal): Promise<Record<string, unknown> | null>;
}

export interface PreparedNext<D, B extends StartupBytesLike> {
  watchId: string;
  data: D;
  session: SessionLike;
  sessionInfo: {url: string; [key: string]: unknown};
  bytes: B;
  settings: string;
  /** 再生サーバーのセッション期限（epoch ms）。わからない場合は undefined。 */
  expiresAt: number | undefined;
  /** 先読みした付随データ（コメント結果など）。 */
  companions: Record<string, unknown> | null;
  adopted: boolean;
  dispose(): void;
}

/** セッション接続結果から期限（epoch ms）を読み取る。形式が違っても失敗しない。 */
export const sessionExpiresAt = (sessionInfo: unknown): number | undefined => {
  const info = sessionInfo as {lastResponse?: {data?: {expireTime?: unknown}}} | null;
  const raw = info?.lastResponse?.data?.expireTime;
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const t = typeof raw === 'number' ? raw : Date.parse(raw);
  return Number.isFinite(t) && t > 0 ? t : undefined;
};

export class PrepareFailure extends Error {
  readonly stage: PrepareStage;
  override readonly cause: unknown;
  constructor(stage: PrepareStage, message: string, cause?: unknown) {
    super(message);
    this.name = 'PrepareFailure';
    this.stage = stage;
    this.cause = cause;
  }
}

/** Secure diagnostics: include only allowlisted fields, never raw nested request data. */
export const describeError = (error: unknown): Record<string, unknown> => {
  const seen = new WeakSet<object>();
  const sanitize = (value: unknown, limit = 300): string => String(value ?? '').replace(
    /https?:\/\/[^\s"']+/gi, (value) => {
      try {
        const url = new URL(value);
        // Tokens can occur in either path or query; always discard the query.
        return url.origin + url.pathname.replace(/[^/]{24,}/g, '…');
      } catch (_) { return '[url]'; }
    }).slice(0, limit);
  const summarize = (value: unknown, depth: number): Record<string, unknown> => {
    if (value !== null && typeof value === 'object') {
      if (seen.has(value) || depth > 3) return {name: 'Error', message: 'nested error omitted'};
      seen.add(value);
    }
    const e = value as {name?: unknown;message?: unknown;stage?: unknown;detail?: unknown;cause?: unknown}|null;
    const safeName = typeof e?.name === 'string' && /^[a-z0-9_-]{1,80}$/i.test(e.name) ? e.name : 'Error';
    const out: Record<string, unknown> = {name: safeName, message: sanitize(e?.message ?? value)};
    if (typeof e?.stage === 'string' && /^[a-z][a-z0-9-]{0,60}$/i.test(e.stage)) out.stage = e.stage;
    if (e?.detail !== null && typeof e?.detail === 'object' && !Array.isArray(e.detail)) {
      const raw = e.detail as Record<string, unknown>;
      const detail: Record<string, unknown> = {};
      if (typeof raw.stage === 'string' && /^[a-z][a-z0-9-]{0,60}$/i.test(raw.stage)) detail.stage = raw.stage;
      if (typeof raw.reason === 'string') detail.reason = sanitize(raw.reason, 100);
      if (typeof raw.host === 'string' && /^[a-z0-9.-]{1,120}$/i.test(raw.host)) detail.host = raw.host;
      if (typeof raw.status === 'number' && Number.isInteger(raw.status) && raw.status >= 100 && raw.status <= 599) detail.status = raw.status;
      if (typeof raw.bytes === 'number' && Number.isFinite(raw.bytes) && raw.bytes >= 0) detail.bytes = raw.bytes;
      if (typeof raw.message === 'string') detail.message = sanitize(raw.message);
      if (Object.keys(detail).length) out.detail = detail;
    }
    if (e?.cause && depth < 3) out.cause = summarize(e.cause, depth + 1);
    return out;
  };
  return summarize(error, 0);
};
export const createPlaylistStartupPreparer = <D, I extends VideoInfoLike, B extends StartupBytesLike>(
  deps: PreparerDeps<D, I, B>) => {
  const now = deps.now ?? (() => performance.now());
  return async (watchId: string, signal: AbortSignal): Promise<PreparedNext<D, B>> => {
    const settings = deps.settingsKey();
    const started = now();
    let stage: PrepareStage = 'metadata';
    const seconds = (): number => Number(((now() - started) / 1000).toFixed(3));
    const report = (event: string, extra: Record<string, unknown> = {}): void => {
      try { deps.log?.(event, {videoId: watchId, stage, seconds: seconds(), ...extra}); } catch (_) { /* ignore */ }
    };
    const check = (): void => { if (signal.aborted) throw new Error('Prefetch canceled'); };
    report('start');
    try {
      check();
      const data = await deps.loadVideoInfo(watchId, signal);
      check();
      stage = 'eligibility';
      const info = deps.createModel(data);
      const serverType = deps.getConfig('videoServerType');
      const autoDisableNew = !!deps.getConfig('autoDisableNew');
      if (!info.isDomandAvailable) throw new PrepareFailure(stage, 'domand unavailable');
      if (deps.isNgVideo(info)) throw new PrepareFailure(stage, 'ng video');
      if (!info.isDomandOnly && (serverType === 'dmc' || (autoDisableNew && info.maybeBetterQualityServerType === 'dmc')))
        throw new PrepareFailure(stage, 'dmc preferred');
      stage = 'session';
      const session = await deps.createSession(info, deps.getConfig('domandVideoQuality'));
      let closed = false;
      let bytes: B | null = null;
      const close = (): void => {
        if (!closed) { closed = true; void Promise.resolve().then(() => session.close()).catch(() => {}); }
        bytes?.dispose();
      };
      const abort = (): void => close();
      signal.addEventListener('abort', abort, {once: true});
      try {
        check();
        stage = 'connect';
        const sessionInfo = await session.connect();
        check();
        stage = 'startup-media';
        bytes = await deps.prepareBytes(sessionInfo.url, signal);
        check();
        const preparedBytes = bytes;
        let companions: Record<string, unknown> | null = null;
        if (deps.prepareCompanions) {
          try {
            companions = await deps.prepareCompanions(info, signal);
          } catch (error) {
            check();
            report('companions-failed', {error: describeError(error)});
          }
        }
        check();
        // Only expose the bounded remaining lifetime, never the signed session URL.
        const expiresAt = sessionExpiresAt(sessionInfo);
        const expiresInSec = typeof expiresAt === 'number' ? Math.round((expiresAt - Date.now()) / 1000) : -1;
        report('prepared', {bytes: preparedBytes.bytes, startLevel: preparedBytes.startLevel, stages: preparedBytes.stages,
          companions: companions ? Object.keys(companions).join(',') : '', expiresInSec});
        const prepared: PreparedNext<D, B> = {watchId, data, session, sessionInfo, bytes: preparedBytes, settings,
          expiresAt, companions, adopted: false,
          dispose() { if (!this.adopted) close(); }};
        return prepared;
      } catch (error) {
        close();
        throw error;
      } finally {
        signal.removeEventListener('abort', abort);
      }
    } catch (error) {
      report(signal.aborted ? 'canceled' : 'failed', signal.aborted ? {} : {error: describeError(error)});
      throw error;
    }
  };
};
