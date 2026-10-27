/**
 * Task466: TypeScript canonical implementation of the Nicodic batch lookup.
 * The server array is unknown until the original runtime guards validate it.
 * Other article properties are not guaranteed by the observed API contract.
 */
export interface NicodicArticle {
  request_title: string;
  title: string;
  readonly [key: string]: unknown;
}
export interface NicodicLookupResult {
  exists: boolean;
  article: NicodicArticle | null;
}
export interface NicodicArticleLoaderClient {
  /** null means the remote lookup failed or the input was invalid. */
  exists(name: string | null | undefined): Promise<boolean | null>;
  checkAll(
    tagNames: readonly unknown[] | null | undefined,
    onResult?: (name: string, exists: boolean, article: NicodicArticle | null) => void
  ): Promise<void>;
}
interface NicodicCache {
  getItem(key: string): NicodicLookupResult | null | undefined;
  setItem(key: string, value: NicodicLookupResult, expiresMs: number): void;
}
declare const CacheStorage: new (storage: Storage) => NicodicCache;

const NicodicArticleLoader: NicodicArticleLoaderClient = (() => {
  const API_URL = 'https://api.dic.nicovideo.jp/v1/articles/article';
  const CACHE_PREFIX = 'nicodicBatch: ';
  const CACHE_EXPIRE_TIME = 24 * 60 * 60 * 1000;
  const BATCH_SIZE = 10;
  const inFlight = new Map<string, Promise<NicodicLookupResult | null>>();
  const pending = new Map<string, (result: NicodicLookupResult | null) => void>();
  let cacheStorage: NicodicCache | undefined;
  let scheduled = false;
  const getCache = (): NicodicCache => cacheStorage || (cacheStorage = new CacheStorage(sessionStorage));

  const fetchBatch = async (entries: Array<[string, (result: NicodicLookupResult | null) => void]>): Promise<void> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let articles: Map<string, NicodicArticle> | null = null;
    try {
      const query = new URLSearchParams();
      entries.forEach(([name]) => query.append('titles[]', name));
      const res = await fetch(`${API_URL}?${query}`, {credentials: 'omit', signal: controller.signal});
      if (!res.ok) { throw new Error(`Nicodic HTTP ${res.status}`); }
      const data: unknown = await res.json();
      if (!Array.isArray(data) || data.some((a: unknown) =>
        !a || typeof (a as NicodicArticle).request_title !== 'string' ||
        typeof (a as NicodicArticle).title !== 'string')) {
        throw new Error('Invalid Nicodic batch response');
      }
      articles = new Map((data as NicodicArticle[]).map(a => [a.request_title, a]));
    } catch (e) {
      window.console.warn('大百科の記事有無を調べられませんでした', e);
    } finally {
      clearTimeout(timeout);
    }
    entries.forEach(([name, resolve]) => {
      const result = articles ? {exists: articles.has(name), article: articles.get(name) || null} : null;
      if (result) {
        try { getCache().setItem(CACHE_PREFIX + name, result, CACHE_EXPIRE_TIME); } catch (e) { /* cache is optional */ }
      }
      inFlight.delete(name);
      resolve(result);
    });
  };

  const flush = async (): Promise<void> => {
    try {
      // drain中に追加されたタグも同じownerが逐次処理し、通信を重ねない。
      while (pending.size) {
        const entries = Array.from(pending);
        pending.clear();
        // 大きな一覧でも同時通信を増やさず、10件ずつ取得する。
        for (let i = 0; i < entries.length; i += BATCH_SIZE) {
          await fetchBatch(entries.slice(i, i + BATCH_SIZE));
        }
      }
    } finally {
      scheduled = false;
      // 予期せぬ例外との境界で追加済みなら、取り残さず次のdrainを予約する。
      if (pending.size) {
        scheduled = true;
        Promise.resolve().then(flush);
      }
    }
  };

  const lookup = (name: string | null | undefined): Promise<NicodicLookupResult | null> => {
    if (typeof name !== 'string' || !name) { return Promise.resolve(null); }
    try {
      const cached = getCache().getItem(CACHE_PREFIX + name);
      if (cached && typeof cached.exists === 'boolean') { return Promise.resolve(cached); }
    } catch (e) { /* cache is optional */ }
    if (inFlight.has(name)) { return inFlight.get(name) as Promise<NicodicLookupResult | null>; }
    const promise = new Promise<NicodicLookupResult | null>(resolve => pending.set(name, resolve));
    inFlight.set(name, promise);
    if (!scheduled) {
      scheduled = true;
      Promise.resolve().then(flush);
    }
    return promise;
  };

  /** true:記事あり false:記事なし null:通信失敗等で判定できず */
  const exists = async (name: string | null | undefined): Promise<boolean | null> => {
    const result = await lookup(name);
    return result ? result.exists : null;
  };

  const checkAll = async (
    tagNames: readonly unknown[] | null | undefined,
    onResult?: (name: string, exists: boolean, article: NicodicArticle | null) => void
  ): Promise<void> => {
    const names = Array.from(new Set((tagNames || []).filter((n): n is string => typeof n === 'string' && !!n)));
    await Promise.all(names.map(async name => {
      const result = await lookup(name);
      if (result && typeof onResult === 'function') { onResult(name, result.exists, result.article); }
    }));
  };
  return {exists, checkAll};
})();

export {NicodicArticleLoader};
