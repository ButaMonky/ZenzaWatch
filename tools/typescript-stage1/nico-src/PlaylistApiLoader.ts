declare const RequestDiagnostics: typeof import('./RequestDiagnostics').RequestDiagnostics;
/**
 * Canonical TypeScript source for packages/lib/src/nico/PlaylistApiLoader.js (Task463).
 * nvapi /v1/playlist/* with a 5 minute sessionStorage cache keyed by request URL.
 */
import type {NetUtilFetcher, NetFetchOptions} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;

/** The part of the legacy CacheStorage (packages/lib/src/infra/CacheStorage.js) used here. */
export interface PlaylistCacheStorage {
  getItem(key: string): unknown;
  setItem(key: string, value: unknown, expireTime?: number): void;
}
declare const CacheStorage: new (storage: Storage) => PlaylistCacheStorage;

export type PlaylistType = 'series' | 'user-uploaded' | 'mylist' | 'watchlater' | 'search';
/** Query options; numbers are stringified by URLSearchParams (legacy behavior). */
export type PlaylistQueryOptions = Record<string, string | number>;

export interface PlaylistLoadRequest {
  type: PlaylistType;
  id?: string | number | undefined;
  options?: PlaylistQueryOptions | undefined;
  /** Non-search collections default to complete pagination unless page is explicit. */
  all?: boolean;
  maxItems?: number;
  isCurrent?: () => boolean;
}
export interface PlaylistFrontend {
  frontendId?: number;
  frontendVersion?: number;
}
export interface PlaylistUrl {
  url?: string;
  cacheKey?: string;
}

/** Untrusted fields shared by collection, search and shorts pages. */
export interface PlaylistEnvelopeProbe {
  readonly meta: {readonly status?: unknown; readonly errorCode?: unknown};
  readonly data: {readonly items?: unknown; readonly totalCount?: unknown; readonly hasNext?: unknown};
}

export interface PlaylistApiLoaderClient {
  /** Resolves the ordered item array. Auto-paged results expose non-enumerable
   * playlistLoadInfo; explicit page/all:false/search retain single-page semantics. */
  load(request: PlaylistLoadRequest, frontend?: PlaylistFrontend): Promise<unknown>;
  /** Task1040: 投稿者のショート動画（新しい順・全ページ）を、/v1/playlist と同じ {watchId, content} の形で返す */
  loadUserShorts?(userId: string | number, opts?: {maxItems?: number; isCurrent?: () => boolean}): Promise<unknown[]>;
}

const PlaylistApiLoader: PlaylistApiLoaderClient = (() => {
  const CACHE_EXPIRE_TIME = 5 * 60 * 1000;
  // #238: These endpoints can return account-private rows. Without a reliable
  // viewer identity, URL-only sessionStorage keys are unsafe across login changes.
  // Cache only public series / uploader collections; leave private loads live.
  const mayUseSharedCache = (type: PlaylistType): boolean =>
    type === 'series' || type === 'user-uploaded';
  let cacheStorage: PlaylistCacheStorage | null = null;

  const entryId = (item: unknown): string | undefined => {
    const row = item as {watchId?: unknown; content?: {id?: unknown}} | null;
    const id = row?.watchId ?? row?.content?.id;
    if (typeof id === 'string' && id.trim()) { return id; }
    if (typeof id === 'number' && Number.isFinite(id)) { return String(id); }
    return undefined;
  };
  const isEntryArray = (items: unknown): items is unknown[] =>
    Array.isArray(items) && items.every(item => entryId(item) !== undefined);

  const ensureCurrent = (isCurrent?: () => boolean): void => {
    if (isCurrent && !isCurrent()) {
      throw new Error('プレイリスト取得中止（表示対象が変更されました）');
    }
  };

  // Full collections retry once on transport/JSON/5xx failures; explicit pages and shorts do not.
  const readPage = async (url: string, options: NetFetchOptions, isCurrent: (() => boolean) | undefined,
    messages: {request: string; response: string}, retry = false) => {
    for (let attempt = 0; ; attempt++) {
      ensureCurrent(isCurrent);
      let response: Response | undefined;
      let result: PlaylistEnvelopeProbe | undefined;
      try {
        response = await netUtil.fetch(url, options);
        result = await response.json() as PlaylistEnvelopeProbe;
      } catch (cause) {
        ensureCurrent(isCurrent);
        const error = cause as {name?: unknown; status?: unknown; statusCode?: unknown} | null;
        const status = response?.status ?? error?.statusCode ?? error?.status;
        if (retry && !attempt && error?.name !== 'AbortError' && ![401, 403, 404].includes(Number(status)) &&
            !(response && response.status >= 300 && response.status < 500)) {
          await new Promise<void>(resolve => setTimeout(resolve, 400));
          continue;
        }
        const wrapped = new Error(messages.request, cause as ErrorOptions | undefined);
        if (typeof RequestDiagnostics !== 'undefined') {
          Object.assign(wrapped, RequestDiagnostics.readFailure(response, cause));
        }
        throw wrapped;
      }
      ensureCurrent(isCurrent);
      const httpStatus = response.status, apiStatus = result?.meta?.status;
      const failure = (missing?: string) => {
        const wrapped = new Error(messages.response, result as ErrorOptions | undefined);
        if (typeof RequestDiagnostics !== 'undefined') {
          Object.assign(wrapped, RequestDiagnostics.responseFailure(response, result?.meta, missing));
        }
        return wrapped;
      };
      if (retry && !attempt && (httpStatus >= 500 || (!(httpStatus >= 300) && Number(apiStatus) >= 500))) {
        await new Promise<void>(resolve => setTimeout(resolve, 400));
        continue;
      }
      if (httpStatus >= 300 || apiStatus !== 200 || result?.meta?.errorCode) { throw failure('meta.status'); }
      if (!Array.isArray(result?.data?.items)) { throw failure('data.items'); }
      return {data: result.data, items: result.data.items, failure};
    }
  };

  class PlaylistApiLoader {
    constructor() {
      if (!cacheStorage) {
        cacheStorage = new CacheStorage(sessionStorage);
      }
    }

    async load({ type, id, options, all, maxItems, isCurrent }: PlaylistLoadRequest, { frontendId = 6, frontendVersion = 0 }: PlaylistFrontend = {}): Promise<unknown> {

      let cacheHit = false;
      const markCacheHit = () => { cacheHit = true; };
      const execute = async () => {
        const { url, cacheKey } = ((type: PlaylistType): PlaylistUrl => {
          switch (type) {
            case 'series':
              return this._buildSeriesURL(id, options);
            case 'user-uploaded':
              return this._buildUserUploadedURL(id, options);
            case 'mylist':
              return this._buildMylistURL(id, options);
            case 'watchlater':
              return this._buildWatchlaterURL(options);
            case 'search':
              return this._buildSearchURL(options);
            default:
              return {};
          }
        })(type);

        if (url === undefined || cacheKey === undefined) {
          throw new Error(`プレイリストの取得失敗(3) ${type}`);
        }

        if (type !== 'search' && all !== false && (all === true || options?.page === undefined)) {
          return this._loadAll(type, url, maxItems, isCurrent, frontendId, frontendVersion, markCacheHit);
        }

        // nvapi でソートされた結果をもらうのでそのままキャッシュする
        const cacheData = mayUseSharedCache(type) ? (cacheStorage as PlaylistCacheStorage).getItem(cacheKey) : null;
        ensureCurrent(isCurrent);
        if (isEntryArray(cacheData)) {
          markCacheHit();
          return cacheData;
        }

        // nvapi に X-Frontend-Id header が必要
        const {items: data, failure} = await readPage(url, {
          headers: {'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion}, credentials: 'include',
          ...(typeof RequestDiagnostics !== 'undefined' ? {diagnosticActive: () => !isCurrent || isCurrent()} : {})
        }, isCurrent, {request: `プレイリストの取得失敗(2) ${type}`, response: `プレイリストの取得失敗(1) ${type}`});
        ensureCurrent(isCurrent);
        if (!isEntryArray(data)) { throw failure('data.items[].watchId'); }
        if (mayUseSharedCache(type)) {
          try { (cacheStorage as PlaylistCacheStorage).setItem(cacheKey, data, CACHE_EXPIRE_TIME); }
          catch (_) { /* Browser storage is optional. */ }
        }
        return data;

      };
      return typeof RequestDiagnostics === 'undefined' ? execute() :
        RequestDiagnostics.observe('playlist', JSON.stringify([type, id, options]), execute, Array.isArray, () => !cacheHit && (!isCurrent || isCurrent()));
    }

    // Task972: one atomic ordered collection, not the first 500-row page.
    async _loadAll(type: PlaylistType, initialUrl: string, requestedMax: number | undefined,
      isCurrent: (() => boolean) | undefined, frontendId: number, frontendVersion: number, markCacheHit: () => void): Promise<unknown[]> {
      const maxItems = typeof requestedMax === 'number' && Number.isFinite(requestedMax) && requestedMax > 0 ?
        Math.min(10000, Math.floor(requestedMax)) : 10000;
      const first = new URL(initialUrl);
      const rawSize = Number(first.searchParams.get('pageSize') || 500);
      const pageSize = Number.isInteger(rawSize) && rawSize > 0 ? Math.min(500, rawSize) : 500;
      first.searchParams.set('pageSize', String(pageSize));
      first.searchParams.set('page', '1');
      // A previous single-page array is never evidence of a complete collection.
      const cacheKey = `playlist; all-v1; ${maxItems}; ${first.href}`;
      type Collection = {items: unknown[]; totalCount: number | null; limited: boolean;
        maxItems: number; complete: true};
      const expose = (value: Collection): unknown[] => {
        const result = value.items.slice();
        Object.defineProperty(result, 'playlistLoadInfo', {value: {
          totalCount: value.totalCount, limited: value.limited, maxItems: value.maxItems
        }, enumerable: false});
        return result;
      };
      ensureCurrent(isCurrent);
      const cached = (mayUseSharedCache(type) ?
        (cacheStorage as PlaylistCacheStorage).getItem(cacheKey) : null) as Collection | null;
      if (cached?.complete === true && isEntryArray(cached.items) && cached.maxItems === maxItems) {
        markCacheHit();
        return expose(cached);
      }
      const items: unknown[] = [], seen = new Set<string>();
      let totalCount: number | null = null, limited = false;
      // A broken API cannot keep a request alive indefinitely by repeating pages.
      const maxPages = Math.ceil(10000 / pageSize) + 1;
      for (let page = 1; ; page++) {
        ensureCurrent(isCurrent);
        if (page > maxPages) { throw new Error('プレイリスト取得失敗（ページ数の安全上限）'); }
        const url = new URL(first.href); url.searchParams.set('page', String(page));
        const {data, items: batch, failure} = await readPage(url.href, {
          headers: {'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion}, credentials: 'include', timeout: 15000,
          ...(typeof RequestDiagnostics !== 'undefined' ? {diagnosticActive: () => !isCurrent || isCurrent()} : {})
        }, isCurrent, {request: `プレイリストの取得失敗(2) ${type} (${page}ページ目)`,
          response: `プレイリストの取得失敗(1) ${type} (${page}ページ目)`}, true);
        if (data.hasNext !== undefined && typeof data.hasNext !== 'boolean') { throw failure('data.hasNext'); }
        const count = data.totalCount;
        if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) {
          totalCount = totalCount === null ? count : Math.max(totalCount, count);
        }
        if (!batch.length) {
          if (data.hasNext === true || (totalCount !== null && (page - 1) * pageSize < totalCount)) {
            throw failure('data.items');
          }
          break;
        }
        const before = items.length;
        for (const item of batch) {
          const key = entryId(item);
          if (key === undefined) { throw failure('data.items[].watchId'); }
          if (!seen.has(key)) { seen.add(key); items.push(item); }
        }
        if (items.length === before) { throw failure('data.items'); }
        const more = typeof data.hasNext === 'boolean' ? data.hasNext :
          totalCount !== null ? page * pageSize < totalCount : batch.length >= pageSize;
        if (items.length >= maxItems) {
          limited = items.length > maxItems || more;
          items.length = maxItems;
          break;
        }
        if (!more) { break; }
      }
      ensureCurrent(isCurrent);
      const value: Collection = {items, totalCount, limited, maxItems, complete: true};
      // Large collection cache writes are optional; never lose loaded items if
      // browser storage is full, or overwrite the live playlist with a partial page.
      try {
        if (mayUseSharedCache(type)) {
          (cacheStorage as PlaylistCacheStorage).setItem(cacheKey, value, CACHE_EXPIRE_TIME);
        }
      }
      catch (_) { /* CacheStorage is best-effort, not part of successful loading. */ }
      return expose(value);
    }

    // 動画シリーズ
    // https://nvapi.nicovideo.jp/v1/playlist/series/${seriesId}?sortOrder=${sortOrder}&sortKey=${sortKey}
    _buildSeriesURL(seriesId: string | number | undefined, options: PlaylistQueryOptions = {}): PlaylistUrl {
      const query = new URLSearchParams(options as Record<string, string>).toString();
      const url = `https://nvapi.nicovideo.jp/v1/playlist/series/${seriesId}${query ? '?' + query : ''}`;
      return {url, cacheKey: `playlist; ${url}`};
    }

    // ユーザー投稿
    // https://nvapi.nicovideo.jp/v1/playlist/user-uploaded/${userId}?sortOrder=${sortOrder}&sortKey=${sortKey}
    //
    // Task 041: cacheKeyはリクエストURLそのものから作る。
    // 以前は userId と sortKey/sortOrder だけを並べた文字列にしていたため、
    // それ以外のオプション（動画の種類の絞り込み、ページ指定など）が違っても
    // 同じキーになってしまい、**別の条件で読み込んだのに、直前に読み込んだ方の
    // 結果がキャッシュから返る**状態になっていた。
    // 返ってきたのが直前と同じ動画一覧なので、プレイリストへの追加時に
    // 「すべて重複」として弾かれ、「何も追加されない」ように見える
    // （キャッシュの有効期間は5分なので、再現したりしなかったりする）。
    // URLをそのままキーにすれば、条件が違えば必ずキーも違う。
    _buildUserUploadedURL(userId: string | number | undefined, options: PlaylistQueryOptions = {}): PlaylistUrl {
      const query = new URLSearchParams(Object.assign({ sortOrder: 'desc', sortKey: 'registeredAt' }, options) as Record<string, string>);
      const url = `https://nvapi.nicovideo.jp/v1/playlist/user-uploaded/${userId}?${query.toString()}`;
      return {url, cacheKey: `playlist; ${url}`};
    }

    // マイリスト
    // https://nvapi.nicovideo.jp/v1/playlist/mylist/${mylistId}?sortOrder=${sortOrder}&sortKey=${sortKey}
    _buildMylistURL(mylistId: string | number | undefined, options: PlaylistQueryOptions = {}): PlaylistUrl {
      const query = new URLSearchParams(Object.assign({ sortOrder: 'asc', sortKey: 'registeredAt' }, options) as Record<string, string>);
      const url = `https://nvapi.nicovideo.jp/v1/playlist/mylist/${mylistId}?${query.toString()}`;
      return {url, cacheKey: `playlist; ${url}`};
    }

    // 後で見る
    // https://nvapi.nicovideo.jp/v1/playlist/watch-later?sortOrder=${sortOrder}&sortKey=${sortKey}
    _buildWatchlaterURL(options: PlaylistQueryOptions = {}): PlaylistUrl {
      const query = new URLSearchParams(Object.assign({ sortOrder: 'asc', sortKey: 'registeredAt' }, options) as Record<string, string>);
      const url = `https://nvapi.nicovideo.jp/v1/playlist/watch-later?${query.toString()}`;
      return {url, cacheKey: `playlist; ${url}`};
    }

    // 検索
    // https://nvapi.nicovideo.jp/v1/playlist/search?sortOrder=${sortOrder}&sortKey=${sortKey}&keyword=${keyword}&pageSize=${pageSize}&page=${page}
    _buildSearchURL(options: PlaylistQueryOptions = {}): PlaylistUrl {
      const query = new URLSearchParams(Object.assign({ sortOrder: 'desc', sortKey: 'registeredAt' }, options) as Record<string, string>);
      const url = `https://nvapi.nicovideo.jp/v1/playlist/search?${query.toString()}`;
      return {url, cacheKey: `playlist; ${url}`};
    }
  }

  /**
   * Task1040: 投稿者のショート動画一覧。公式のユーザーページ（/user/{id}/shorts）と同じ
   * GET https://nvapi.nicovideo.jp/v3/users/{id}/videos?selectContentType=short&sortKey=registeredAt&sortOrder=desc&pageSize=100&page=N
   * 応答 data.items[] = {series, essential:{id, title, registeredAt, duration, count, thumbnail, ...}}, data.totalCount。
   * プレイリストの読み込み処理（VideoListItem.createByMylistItem）がそのまま使えるよう {watchId, content} に直す。
   */
  const loadUserShorts = async (userId: string | number, {maxItems = 10000, isCurrent}: {maxItems?: number; isCurrent?: () => boolean} = {}): Promise<unknown[]> => {
    if (!/^\d+$/.test(String(userId))) { throw new Error('ショート動画の取得失敗（投稿者IDが不正）'); }
    const execute = async (): Promise<unknown[]> => {
      const pageSize = 100, out: unknown[] = [], seen = new Set<string>();
      let total: number | null = null;
      for (let page = 1; page <= Math.ceil(maxItems / pageSize) + 1; page++) {
        if (isCurrent && !isCurrent()) { throw new Error('ショート動画の取得中止（表示対象が変更されました）'); }
        const url = `https://nvapi.nicovideo.jp/v3/users/${userId}/videos?selectContentType=short&sortKey=registeredAt&sortOrder=desc&sensitiveContents=mask&pageSize=${pageSize}&page=${page}`;
        const {data, items: batch, failure} = await readPage(url, {
          headers: {'X-Frontend-Id': 6, 'X-Frontend-Version': 0}, credentials: 'include', timeout: 15000,
          ...(typeof RequestDiagnostics !== 'undefined' ? {diagnosticActive: () => !isCurrent || isCurrent()} : {})
        }, isCurrent, {request: `ショート動画の取得失敗(2) (${page}ページ目)`,
          response: `ショート動画の取得失敗(1) (${page}ページ目)`});
        ensureCurrent(isCurrent);
        const count = data.totalCount;
        if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) { total = count; }
        const before = out.length;
        for (const row of batch) {
          const content = (row as {essential?: {id?: unknown}} | null)?.essential;
          const id = typeof content?.id === 'string' ? content.id : '';
          if (!id.trim()) { throw failure('data.items[].essential.id'); }
          if (seen.has(id)) { continue; }
          seen.add(id);
          out.push({watchId: id, content});
          if (out.length >= maxItems) { return out; }
        }
        if (batch.length && out.length === before) { throw failure('data.items'); }
        if (!batch.length && total !== null && (page - 1) * pageSize < total) { throw failure('data.items'); }
        if (batch.length < pageSize || (total !== null && page * pageSize >= total)) { break; }
      }
      return out;
    };
    return typeof RequestDiagnostics === 'undefined' ? execute() :
      RequestDiagnostics.observe('playlist', 'user-shorts:' + userId, execute, Array.isArray, () => !isCurrent || isCurrent());
  };

  const loader = new PlaylistApiLoader() as PlaylistApiLoader & {loadUserShorts: typeof loadUserShorts};
  loader.loadUserShorts = loadUserShorts;
  return loader;
})();

export {PlaylistApiLoader};
