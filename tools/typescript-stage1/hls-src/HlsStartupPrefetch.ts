/**
 * 連続再生の「次の1本」の先頭データ（マスター／メディアプレイリスト・鍵・init・先頭セグメント）を
 * 低優先度で取得してメモリに保持し、hls.js のローダーへ差し込むモジュール。
 *
 * prefetch1028.4 での主な変更:
 *  - domand は delivery.domand.nicovideo.jp（プレイリスト・鍵）と asset.domand.nicovideo.jp（init・セグメント）で
 *    ホストが分かれている。旧版は「マスターと同一オリジンのみ許可」だったため、init/セグメント取得の直前で
 *    必ず失敗していた。→ https かつ nicovideo.jp 配下（ポート・認証情報なし）を許可する。
 *  - 失敗理由を PrefetchError.detail（段階・理由・ホスト・HTTPステータス）として返す。
 *  - 開始画質を hls.js と同じ考え方（設定の startLevel／推定回線速度）で選ぶ。旧版は常に最低画質だった。
 */
export type PrefetchKind = 'video' | 'audio' | 'media';
export type PrefetchPart = 'playlist' | 'key' | 'init' | 'segment';
export type PrefetchStage = 'master' | `${PrefetchKind}-${PrefetchPart}`;

export interface PrefetchErrorDetail {
  stage: PrefetchStage;
  reason: string;
  host?: string;
  status?: number;
  bytes?: number;
  message?: string;
}

export class PrefetchError extends Error {
  readonly detail: PrefetchErrorDetail;
  constructor(detail: PrefetchErrorDetail) {
    super('prefetch ' + detail.reason);
    this.name = 'PrefetchError';
    this.detail = detail;
  }
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  url: string;
  headers: {get(name: string): string | null};
  body: ReadableStream<Uint8Array> | null;
}
export type FetchLike = (url: string, init: RequestInit & {priority?: 'low' | 'high' | 'auto'}) => Promise<FetchResponseLike>;

export interface PrefetchEntry {data: ArrayBuffer; url: string; elapsed: number}

export interface PreparedStartup {
  source: string;
  entries: Map<string, PrefetchEntry>;
  bytes: number;
  startLevel: number;
  stages: PrefetchStage[];
  /** hls.js が先読みデータを実際に使った回数（診断用）。 */
  hits: number;
  dispose(): void;
}

export interface PrefetchOptions {
  fetcher?: FetchLike;
  /** hls.js の startLevel 設定。-1/undefined は自動。 */
  startLevel?: number;
  /** 自動のときに使う推定回線速度 (bps)。 */
  bandwidthEstimate?: number;
  /** 合計取得量の上限 (bytes)。 */
  maxBytes?: number;
  now?: () => number;
}

interface Variant {uri: string; bandwidth: number; audio?: string; index: number}

export const MAX_PREFETCH_BYTES = 16 * 1024 * 1024;
const MAX_TEXT_BYTES = 256 * 1024;
const MAX_REQUESTS = 12;
/** hls.js の abrBandWidthFactor 相当。推定速度に余裕を持たせて選ぶ。 */
const BANDWIDTH_FACTOR = 0.8;

const DOMAND_HOSTS = new Set(['delivery.domand.nicovideo.jp', 'asset.domand.nicovideo.jp']);
export const isAllowedPrefetchUrl = (u: URL, sourceHost: string): boolean =>
  u.protocol === 'https:' && !u.port && !u.username && !u.password &&
  DOMAND_HOSTS.has(sourceHost) && DOMAND_HOSTS.has(u.hostname);

export const parseAttributes = (line: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const m of line.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/g)) {
    const key = m[1], value = m[2];
    if (key !== undefined && value !== undefined) out[key] = value.replace(/^"|"$/g, '');
  }
  return out;
};

/** hls.js はレベルをビットレート昇順に並べるので、同じ並びでのインデックスを返す。 */
export const chooseStartVariant = <T extends {bandwidth: number; index: number}>(
  variants: readonly T[], startLevel?: number, bandwidthEstimate?: number): {variant: T; level: number} | null => {
  const sorted = variants.slice().sort((a, b) => a.bandwidth - b.bandwidth || a.index - b.index);
  if (!sorted.length) return null;
  let level = 0;
  if (typeof startLevel === 'number' && Number.isFinite(startLevel) && startLevel >= 0) {
    level = Math.min(Math.round(startLevel), sorted.length - 1);
  } else if (typeof bandwidthEstimate === 'number' && bandwidthEstimate > 0) {
    const budget = bandwidthEstimate * BANDWIDTH_FACTOR;
    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i];
      if (v && Number.isFinite(v.bandwidth) && v.bandwidth <= budget) level = i;
    }
  }
  const variant = sorted[level];
  return variant ? {variant, level} : null;
};

type LoaderContext = {url: string; responseType?: string; rangeStart?: number; rangeEnd?: number};
type LoaderCallbacks = {onSuccess(response: {url: string; data: ArrayBuffer | string; code: number}, stats: unknown, context: LoaderContext, networkDetails: unknown): void};
type LoaderStats = {aborted: boolean; loaded: number; total: number; retry: number; bwEstimate: number;
  loading: {start: number; first: number; end: number}};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TS mixin の制約
type LoaderBase = new (...args: any[]) => {
  stats: LoaderStats; context?: LoaderContext;
  load(context: LoaderContext, config: unknown, callbacks: LoaderCallbacks): void;
  abort(): void; destroy(): void;
};

const HlsPrefetch = (() => {
  let active: PreparedStartup | null = null;
  let expires: ReturnType<typeof setTimeout> | undefined;
  const clear = (): void => {
    active?.dispose(); active = null;
    clearTimeout(expires); expires = undefined;
  };

  const prepare = async (source: string, signal: AbortSignal, options: PrefetchOptions = {}): Promise<PreparedStartup> => {
    const fetcher: FetchLike = options.fetcher ?? ((url, init) => fetch(url, init));
    const now = options.now ?? (() => performance.now());
    const maxBytes = options.maxBytes ?? MAX_PREFETCH_BYTES;
    const sourceHost = new URL(source).hostname;
    const entries = new Map<string, PrefetchEntry>();
    const stages: PrefetchStage[] = [];
    let bytes = 0, requests = 0, stage: PrefetchStage = 'master';

    const fail = (reason: string, extra: Omit<PrefetchErrorDetail, 'stage' | 'reason'> = {}): PrefetchError =>
      new PrefetchError({stage, reason, ...extra});
    const check = (): void => { if (signal.aborted) throw new Error('prefetch canceled'); };
    const resolve = (uri: string, base: string): string => {
      let u: URL;
      try { u = new URL(uri, base); } catch (_) { throw fail('invalid URL'); }
      if (!isAllowedPrefetchUrl(u, sourceHost)) throw fail('unsupported URL', {host: u.hostname});
      return u.href;
    };

    const get = async (url: string, text: boolean, aliases: readonly string[] = []): Promise<ArrayBuffer> => {
      check();
      const prior = entries.get(url);
      if (prior) return prior.data;
      if (++requests > MAX_REQUESTS) throw fail('request limit');
      const target = resolve(url, source);
      const host = new URL(target).hostname;
      const begin = now();
      let response: FetchResponseLike;
      try {
        response = await fetcher(target, {credentials: 'include', signal, cache: 'no-store', priority: 'low', redirect: 'error'});
      } catch (error) {
        check();
        throw fail('network error', {host, message: String((error as Error)?.message ?? error)});
      }
      check();
      if (response.url) resolve(response.url, source);
      if (!response.ok || response.status === 206) {
        void response.body?.cancel().catch(() => {});
        throw fail('HTTP error', {host, status: response.status});
      }
      const limit = text ? MAX_TEXT_BYTES : maxBytes - bytes;
      const length = Number(response.headers.get('content-length'));
      if (length > limit) {
        void response.body?.cancel().catch(() => {});
        throw fail('size limit', {host, bytes: length});
      }
      if (!response.body) throw fail('streaming unavailable', {host});
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      const abort = (): void => { void reader.cancel().catch(() => {}); };
      signal.addEventListener('abort', abort, {once: true});
      try {
        for (;;) {
          check();
          const part = await reader.read();
          check();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > limit || bytes + size > maxBytes) {
            await reader.cancel().catch(() => {});
            throw fail('size limit', {host, bytes: size});
          }
          chunks.push(part.value);
        }
      } finally {
        signal.removeEventListener('abort', abort);
        try { reader.releaseLock(); } catch (_) { /* already released */ }
      }
      const data = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
      bytes += size;
      const entry: PrefetchEntry = {data: data.buffer, url: response.url || target, elapsed: Math.max(1, now() - begin)};
      for (const key of new Set([url, target, ...aliases])) entries.set(key, entry);
      stages.push(stage);
      return entry.data;
    };
    const getText = async (url: string): Promise<string> => new TextDecoder().decode(await get(url, true));

    const media = async (url: string, kind: PrefetchKind): Promise<void> => {
      stage = `${kind}-playlist`;
      const text = await getText(url);
      if (!text.startsWith('#EXTM3U') || !text.includes('#EXT-X-ENDLIST') || /#EXT-X-(?:BYTERANGE|PART|SESSION-KEY)/.test(text))
        throw fail('unsupported media playlist');
      let map: {href: string; raw: string} | null = null;
      let key: {href: string; raw: string} | null = null;
      let segment: {href: string; raw: string} | null = null;
      for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith('#EXT-X-MAP:')) {
          const a = parseAttributes(line);
          if (a.BYTERANGE || !a.URI) throw fail('unsupported init range');
          map = {href: resolve(a.URI, url), raw: a.URI};
        } else if (line.startsWith('#EXT-X-KEY:')) {
          const a = parseAttributes(line);
          if (a.METHOD === 'NONE') { key = null; continue; }
          if (a.METHOD !== 'AES-128' || !a.URI || (a.KEYFORMAT && a.KEYFORMAT !== 'identity'))
            throw fail('unsupported encryption');
          key = {href: resolve(a.URI, url), raw: a.URI};
        } else if (line && !line.startsWith('#')) {
          segment = {href: resolve(line, url), raw: line};
          break;
        }
      }
      if (!segment) throw fail('missing startup segment');
      // hls.js の context.url は絶対URLならプレイリストの文字列そのまま。正規化後と両方で引けるようにする。
      const alias = (r: {raw: string}): string[] => /^https:\/\//i.test(r.raw) ? [r.raw] : [];
      if (key) { stage = `${kind}-key`; await get(key.href, false, alias(key)); }
      if (map) { stage = `${kind}-init`; await get(map.href, false, alias(map)); }
      stage = `${kind}-segment`;
      await get(segment.href, false, alias(segment));
    };

    try {
      stage = 'master';
      const master = await getText(source);
      if (!master.startsWith('#EXTM3U')) throw fail('invalid playlist');
      if (master.includes('#EXT-X-SESSION-KEY')) throw fail('unsupported session key');
      const lines = master.split(/\r?\n/).map(s => s.trim());
      const variants: Variant[] = [];
      const audio: Record<string, string>[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? '';
        if (line.startsWith('#EXT-X-MEDIA:')) audio.push(parseAttributes(line));
        if (line.startsWith('#EXT-X-STREAM-INF:')) {
          const a = parseAttributes(line), uri = lines[i + 1];
          if (!uri || uri.startsWith('#')) throw fail('invalid variant');
          const v: Variant = {uri: resolve(uri, source), bandwidth: Number(a.BANDWIDTH) || Infinity, index: variants.length};
          if (a.AUDIO) v.audio = a.AUDIO;
          variants.push(v);
        }
      }
      let startLevel = 0;
      if (!variants.length) {
        await media(source, 'media');
      } else {
        const choice = chooseStartVariant(variants, options.startLevel, options.bandwidthEstimate);
        if (!choice) throw fail('invalid variant');
        startLevel = choice.level;
        const chosen = choice.variant;
        if (chosen.audio) {
          const tracks = audio.filter(a => a.TYPE === 'AUDIO' && a['GROUP-ID'] === chosen.audio);
          const track = tracks.find(a => a.DEFAULT === 'YES') ?? tracks[0];
          if (!track) throw fail('missing audio group');
          if (track.URI) await media(resolve(track.URI, source), 'audio');
        }
        await media(chosen.uri, 'video');
      }
      check();
      return {source, entries, bytes, startLevel, stages, hits: 0, dispose() { entries.clear(); }};
    } catch (error) {
      entries.clear();
      throw error;
    }
  };

  /** hls.js のローダーを包み、先読み済みURLはネットワークに出ずに即応答する。 */
  const wrapLoader = <B extends LoaderBase>(Base: B): B => {
    const Wrapped = class StartupLoader extends Base {
      cached = false;
      canceled = false;
      override load(context: LoaderContext, config: unknown, callbacks: LoaderCallbacks): void {
        const hit = !context.rangeStart && !context.rangeEnd ? active?.entries.get(context.url) : undefined;
        if (!hit) { super.load(context, config, callbacks); return; }
        this.cached = true;
        if (active) active.hits++;
        this.context = context;
        const data = context.responseType === 'arraybuffer' ? hit.data.slice(0) : new TextDecoder().decode(hit.data);
        const t = performance.now();
        Object.assign(this.stats, {aborted: false, loaded: hit.data.byteLength, total: hit.data.byteLength, retry: 0,
          bwEstimate: hit.data.byteLength * 8000 / hit.elapsed});
        Object.assign(this.stats.loading, {start: t - hit.elapsed, first: t - hit.elapsed, end: t});
        queueMicrotask(() => {
          if (this.canceled) return;
          callbacks.onSuccess({url: hit.url, data, code: 200}, this.stats, context, null);
        });
      }
      override abort(): void { this.canceled = true; if (this.cached) this.stats.aborted = true; super.abort(); }
      override destroy(): void { this.canceled = true; super.destroy(); }
    };
    return Wrapped;
  };

  return {
    prepare, wrapLoader, clear,
    /** 次動画の再生開始時に呼ぶ。45秒で自動破棄（長時間メモリに残さない）。 */
    activate(value: PreparedStartup): void { clear(); active = value; expires = setTimeout(clear, 45000); },
    startLevel(source: string): number | undefined { return active?.source === source ? active.startLevel : undefined; },
    /** 診断用: 再生開始時に、先読みデータが実際に hls.js から引かれたかを返す。 */
    hits(source: string): number { return active?.source === source ? active.hits : 0; }
  };
})();

export {HlsPrefetch};
