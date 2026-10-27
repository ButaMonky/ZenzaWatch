/**
 * Canonical TypeScript source for packages/lib/src/nico/CommonsTreeLoader.js (Task479).
 * Public commons tree API (parents/children), paging, full scan with retries,
 * abort and timeouts. Behavior, URLs and result fields are unchanged.
 */
import type {NetUtilFetcher} from './NicoApiTypes';

declare const netUtil: NetUtilFetcher;

export type CommonsTreeKind = 'parents' | 'children';

/** One row of `data.{kind}.contents`. Rows may also be null or malformed. */
export interface CommonsContentProbe {
  readonly globalId?: unknown;
  readonly contentKind?: unknown;
  readonly visibleStatus?: unknown;
  readonly title?: unknown;
  readonly thumbnailURL?: unknown;
  readonly thumbnailUrl?: unknown;
  readonly userId?: unknown;
  readonly parentsCount?: unknown;
  readonly childrenCount?: unknown;
}
export type CommonsContentRow = CommonsContentProbe | null | undefined;

/** Fields read before validation; everything else is ignored. */
export interface CommonsEnvelopeProbe {
  readonly meta?: {readonly status?: unknown} | null;
  readonly data?: Readonly<Partial<Record<CommonsTreeKind, unknown>>> | null;
}
interface CommonsBoxProbe {
  readonly total?: unknown;
  readonly contents?: unknown;
}

/** Well-formed display hints only (Task192); permissions are never kept. */
export interface CommonsMeta {
  title?: string;
  thumbnailUrl?: string;
  userId?: string;
  parentsCount?: number;
  childrenCount?: number;
}
export interface CommonsWork {
  meta?: CommonsMeta;
  /** The openable global ID (sm/so/nm...), never the numeric contentId. */
  contentId: string;
  isVideo: boolean;
  contentKind: unknown;
  visibleStatus: unknown;
}

export interface CommonsPage {
  total: number;
  contents: CommonsContentRow[];
  notFound?: boolean;
}
export type CommonsScanPage = {notFound: true} | {notFound?: undefined; total: number; contents: CommonsContentRow[]};

export interface RelativesOptions {
  pageSize?: number;
  startOffset?: number;
  withMeta?: boolean;
}
export interface RelativesResult {
  total: number;
  works: CommonsWork[];
  notFound?: boolean;
  stopReason?: string;
  scanComplete?: boolean;
  nextOffset: number | null;
  duplicateCount?: number;
  invalidCount?: number;
  startOffset: number | null;
  fetchedCount: number;
  truncated?: boolean;
  failed?: boolean;
  partial?: boolean;
  failedOffset?: number;
  skipped?: boolean;
}

export interface RetryInfo {
  kind: CommonsTreeKind;
  offset: number;
  attempt: number;
  reason: string;
  waitMs?: number | null;
}
export interface PageProgress {
  kind: CommonsTreeKind;
  offset: number;
  total: number | null;
  rows: number;
  works: number;
  requests: number;
  phase?: string;
}
export interface ScanFailure {
  failedOffset: number;
  kind: unknown;
  status?: unknown;
  message?: string;
}
export interface ScanSideResult {
  kind: CommonsTreeKind;
  total: number;
  works: CommonsWork[];
  rows: number;
  requests: number;
  stopReason: string | null;
  complete: boolean;
  partial?: boolean;
  failed?: boolean;
  cancelled?: boolean;
  skipped?: boolean;
  notFound?: boolean;
  totalChanges: {offset: number; total: number}[];
  duplicateCount?: number;
  crossDuplicateCount?: number;
  invalidCount?: number;
  startOffset: number | null;
  fetchedCount: number;
  scanComplete?: boolean;
  failedOffset?: number | null;
  failure?: ScanFailure | null;
  truncated?: boolean;
  nextOffset: number | null;
}
export interface ScanSideOptions {
  signal?: AbortSignal | undefined;
  pageSize?: number | undefined;
  startOffset?: number;
  jobSeen?: Set<string>;
  onPage?: ((progress: PageProgress) => void) | undefined;
  onRetry?: ((info: RetryInfo) => void) | undefined;
  timeoutMs?: number | undefined;
  maxRows?: number;
}
export interface ScanAllOptions {
  signal?: AbortSignal | undefined;
  pageSize?: number | undefined;
  offsets?: Partial<Record<CommonsTreeKind, number | null>> | null | undefined;
  onProgress?: ((progress: PageProgress) => void) | undefined;
  onRetry?: ((info: RetryInfo) => void) | undefined;
  timeoutMs?: number | undefined;
}
export interface ScanAllResult {
  parents: ScanSideResult;
  children: ScanSideResult;
  stats: {
    requests: number;
    rows: number;
    unique: number;
    videoCandidates: number;
    kinds: Record<string, number>;
    parentsTotal: number;
    childrenTotal: number;
  };
  cancelled: boolean;
  complete: boolean;
}
export interface ScanMetaOptions {
  signal?: AbortSignal | undefined;
  pageSize?: number;
  onPage?: ((progress: {kind: CommonsTreeKind; offset: number; total: number; metas: number; requests: number; map: Map<string, CommonsMeta>}) => void) | undefined;
  timeoutMs?: number | undefined;
}
export interface ScanMetaResult {
  metas: Map<string, CommonsMeta>;
  requests: number;
  stopReason: string;
  complete: boolean;
}
export interface LoadOptions {
  offsets?: Partial<Record<CommonsTreeKind, number | null>> | null;
  fullScan?: boolean;
  signal?: AbortSignal | undefined;
  onProgress?: ((progress: PageProgress) => void) | undefined;
  onRetry?: ((info: RetryInfo) => void) | undefined;
  pageSize?: number | undefined;
}
interface FetchScanPageOptions {
  signal?: AbortSignal | undefined;
  withMeta?: boolean;
  timeoutMs?: number | undefined;
  onRetry?: ((info: RetryInfo) => void) | undefined;
}
interface JsonReply {
  status: number;
  ok: boolean;
  json: CommonsEnvelopeProbe | null;
  invalidJson: boolean;
  retryAfter: string | null;
}
/** Error-like values thrown by this module (or by fetch/abort). */
interface TreeErrorLike {
  name?: unknown;
  kind?: unknown;
  status?: unknown;
  message?: string;
}

export interface CommonsTreeLoaderClient {
  load(globalId: string, maxItems?: number, options?: LoadOptions): Promise<{parents: RelativesResult; children: RelativesResult} | ScanAllResult>;
  loadRelatives(globalId: string, kind: CommonsTreeKind, maxItems?: number, options?: RelativesOptions): Promise<RelativesResult>;
  scanAll(globalId: string, options?: ScanAllOptions): Promise<ScanAllResult>;
  scanSide(globalId: string, kind: CommonsTreeKind, options?: ScanSideOptions): Promise<ScanSideResult>;
  scanMeta(globalId: string, kind: CommonsTreeKind, total: unknown, options?: ScanMetaOptions): Promise<ScanMetaResult>;
  retryAfterMs(value: unknown, now?: number): number | null;
  WITH_META_DEFAULT: boolean;
  API_MAX_LIMIT: number;
  SCAN_PAGE_SIZE: number;
  META_PAGE_SIZE: number;
}

/**
 * ニコニ・コモンズのコンテンツツリー（親作品・子作品）を取得する。
 *
 * Task 043で全面的に書き直した。
 *
 * 旧実装は https://api.commons.nicovideo.jp/tree/summary/get をJSONPで
 * 呼んでいたが、このAPIはホストごと消滅している（名前解決もできない）。
 * また、ツリーの表示先だった commons.nicovideo.jp/tree/{id} も廃止され、
 * 現在は commons.nicovideo.jp/works/{id} に変わっている。
 *
 * 現行のページが実際に何を呼んでいるかをブラウザで確認したところ、
 * 次の公開APIを使っていた（www.nicovideo.jp からのCORSも許可されている
 * ことを実際に確認済み。そのため隠しiframe等の回避策は不要）。
 *
 *   https://public-api.commons.nicovideo.jp/v1/tree/{globalId}/relatives/parents
 *   https://public-api.commons.nicovideo.jp/v1/tree/{globalId}/relatives/children
 *
 * 応答の形（2026-09時点で実際に確認）:
 *
 *   {
 *     "meta": {"status": 200},
 *     "data": {
 *       "parents": {              // childrenの時は "children"
 *         "total": 6,
 *         "contents": [
 *           {
 *             "kind": "external",       // commons: コモンズ素材 / external: 外部(動画等)
 *             "contentId": 33416354,    // 数字だけのID
 *             "globalId": "sm33416354", // 実際に使えるID
 *             "contentKind": "video",   // video / commons / ...
 *             "visibleStatus": "visible",
 *             "created": ..., "updated": ...
 *           }, ...
 *         ]
 *       }
 *     }
 *   }
 *
 * タイトルは含まれないが、プレイリスト側が動画IDから動画情報を取り直す
 * 作りになっているため問題にならない。
 *
 * ページング（Task 044で追加）:
 * このAPIは _offset / _limit を受け付ける。指定しないと**既定20件で打ち切られる**
 * ため、子作品が54件ある動画で20件しか取れていなかった。
 * _limit=100 までは1回で返ることを実測で確認したので、100件ずつ、
 * data.{kind}.total に達するまで繰り返し取得する。
 */
const CommonsTreeLoader: CommonsTreeLoaderClient = (() => {
  const API_BASE = 'https://public-api.commons.nicovideo.jp/v1/tree';

  // 1回のリクエストで取る件数。
  // 指定しないと既定20件で打ち切られる（Task 044で判明。子作品54件の動画で
  // 20件しか取れていなかった）。100件までは返ることを実測で確認済み。
  const PAGE_SIZE = 100;
  // 取得件数の上限。ツリーが巨大な動画で無制限に取ると、この後に控えている
  // 「1件ずつ動画情報を取り直す処理」が重くなりすぎるため歯止めを入れる。
  const DEFAULT_MAX_ITEMS = 300;

  // Task180 (F03): an HTTP 200 with an API failure, a missing box, a non-numeric total
  // or non-array contents is an error, not an empty tree.
  const pageError = (message: string, extra: object = {}): Error => Object.assign(new Error(message), extra);

  // Task192 (COM-04): with_meta=1 adds display fields (title, thumbnailURL, ...). It was
  // observed on the official commons page (20-slot, logged in); a www-origin request with
  // credentials:'omit' and 100-slot pages are not verified yet, so it stays off by default.
  // The fields are optional display hints only: never full video information.
  const WITH_META_DEFAULT = false;
  const fetchPage = async (globalId: string, kind: CommonsTreeKind, offset: number, limit: number, withMeta: boolean = WITH_META_DEFAULT): Promise<CommonsPage> => {
    // _sort=-id はコモンズのページ自身が使っているのと同じ並び順
    const url = `${API_BASE}/${globalId}/relatives/${kind}` +
      `?_offset=${offset}&_limit=${limit}${withMeta ? '&with_meta=1' : ''}&_sort=-id`;
    // 公開APIなのでログイン情報は送らない
    const res = await netUtil.fetch(url, {credentials: 'omit'});
    // Task 074: コンテンツツリーに登録されていない動画は404を返す。
    // これは「取得失敗」ではなく「0件」なので、エラーにせず空で返す
    // （Task180: 最初のページだけ。途中の404は矛盾として失敗扱い）
    if (res.status === 404) {
      if (offset === 0) {
        return {total: 0, contents: [], notFound: true};
      }
      throw pageError(`コンテンツツリーの取得に失敗 (${kind}: 404 at ${offset})`, {status: 404});
    }
    if (!res.ok) {
      throw pageError(`コンテンツツリーの取得に失敗 (${kind}: ${res.status})`, {status: res.status});
    }
    const json: CommonsEnvelopeProbe | null = await res.json();
    const metaStatus = json && json.meta ? json.meta.status : undefined;
    // Comparisons keep the legacy loose coercion of the raw server value.
    if (metaStatus !== undefined && !((metaStatus as number) >= 200 && (metaStatus as number) <= 299)) {
      throw pageError(`コンテンツツリーの取得に失敗 (${kind}: meta ${metaStatus})`, {status: metaStatus});
    }
    const box = (json && json.data ? json.data[kind] : undefined) as CommonsBoxProbe | undefined;
    if (!box || typeof box !== 'object' || typeof box.total !== 'number' || !Array.isArray(box.contents)) {
      throw pageError(`コンテンツツリーの応答形式が不正 (${kind})`, {reason: 'schema'});
    }
    return {total: box.total, contents: box.contents as CommonsContentRow[]};
  };

  const isGlobalId = (id: unknown): id is string => typeof id === 'string' && /^[a-z]{2}\d+$/.test(id);

  // Task192 (COM-04): keep only well-formed display hints. Missing or malformed values are
  // left out (never turned into 0 / empty), and permissions such as isEditable are not kept.
  const count = (v: unknown): number | undefined => (Number.isInteger(v) && (v as number) >= 0) ? v as number : undefined;
  const pickMeta = (c: CommonsContentProbe): CommonsMeta | null => {
    const meta: CommonsMeta = {};
    if (typeof c.title === 'string' && c.title.trim()) { meta.title = c.title.trim().slice(0, 300); }
    const thumb = c.thumbnailURL ?? c.thumbnailUrl;
    if (typeof thumb === 'string' && /^https:\/\//.test(thumb)) { meta.thumbnailUrl = thumb; }
    if ((typeof c.userId === 'string' || typeof c.userId === 'number') && /^\d+$/.test(String(c.userId))) { meta.userId = String(c.userId); }
    const parentsCount = count(c.parentsCount), childrenCount = count(c.childrenCount);
    if (parentsCount !== undefined) { meta.parentsCount = parentsCount; }
    if (childrenCount !== undefined) { meta.childrenCount = childrenCount; }
    return Object.keys(meta).length ? meta : null;
  };

  /**
   * @param {string} globalId 動画ID(sm～等)
   * @param {string} kind 'parents' または 'children'
   * @param {number} maxItems 取得する最大件数
   * @return {Promise<{total: number, works: Array}>}
   *         total はAPIが申告する総数（取得できた件数とは限らない）
   */
  const loadRelatives = async (globalId: string, kind: CommonsTreeKind, maxItems: number = DEFAULT_MAX_ITEMS, {pageSize = PAGE_SIZE, startOffset = 0, withMeta = WITH_META_DEFAULT}: RelativesOptions = {}): Promise<RelativesResult> => {
    const contents: CommonsContentRow[] = [];
    let total = 0;
    let notFound = false;
    let stopReason = 'limit';
    // Task191 (COM-03): a continuation starts at the nextOffset of the previous call and
    // fetches at most maxItems more rows; the per-call cap (300) is kept.
    startOffset = Math.max(0, Math.floor(Number(startOffset) || 0));
    let offset = startOffset;
    let failure: {failedOffset: number; error: unknown} | null = null;
    // Task179 (COM-01): a page shorter than requested is not necessarily the last
    // one (captured: 20-slot pages returned 19/19/16/18/20 items with more after).
    // Advance by the requested window, and stop on the reported end, an empty page,
    // or the per-direction cap. The number of requests is bounded by maxItems/pageSize.
    const end = startOffset + maxItems;
    while (offset < end) {
      const limit = Math.min(pageSize, end - offset);
      let page: CommonsPage;
      try {
        page = await fetchPage(globalId, kind, offset, limit, withMeta);
      } catch (e) {
        // Task180 (COM-02): nothing fetched yet -> the side failed as before;
        // otherwise keep the pages already fetched and report a partial failure.
        if (!contents.length && offset === startOffset) {
          throw e;
        }
        failure = {failedOffset: offset, error: e};
        stopReason = 'failed';
        break;
      }
      total = page.total;
      notFound = notFound || !!page.notFound;
      contents.push(...page.contents);
      offset += limit;
      if (page.notFound) {
        stopReason = 'not-found';
        break;
      }
      if (offset >= total) {
        stopReason = 'end-of-range';
        break;
      }
      if (!page.contents.length) {
        stopReason = 'empty-page';
        break;
      }
    }
    // Task180 (COM-05): keep the server order, drop duplicate global IDs and rows
    // without a usable global ID (never fall back to the numeric contentId).
    const seen = new Set<string>();
    let duplicateCount = 0, invalidCount = 0;
    const works: CommonsWork[] = [];
    for (const c of contents) {
      if (!c || !isGlobalId(c.globalId)) {
        invalidCount++;
        continue;
      }
      if (seen.has(c.globalId)) {
        duplicateCount++;
        continue;
      }
      seen.add(c.globalId);
      const meta = pickMeta(c);
      works.push({
        ...(meta ? {meta} : {}),
        // 実際に開けるIDはglobalId（sm～/so～/nm～）。contentIdは数字だけなので使わない
        contentId: c.globalId,
        // 再生できるのは動画かつ公開中のものだけ。
        // 素材(commons)や非公開・削除済みは除外できるようにフラグで返す
        isVideo: c.contentKind === 'video' && c.visibleStatus === 'visible',
        contentKind: c.contentKind,
        visibleStatus: c.visibleStatus
      });
    }
    const result: RelativesResult = {
      total: total || works.length, works, notFound,
      // Task179: why the scan stopped, and where a later request could continue.
      stopReason,
      scanComplete: stopReason === 'end-of-range' || stopReason === 'not-found',
      nextOffset: (stopReason === 'limit' && offset < total) ? offset :
        (failure ? failure.failedOffset : null),
      duplicateCount, invalidCount,
      // Task191 (COM-03): where this call started, how many rows the API returned, and
      // whether it stopped at the cap with more remaining (truncated).
      startOffset, fetchedCount: contents.length,
      truncated: stopReason === 'limit' && offset < total
    };
    if (failure) {
      Object.assign(result, {failed: true, partial: true, failedOffset: failure.failedOffset});
      window.console.warn(`コンテンツツリーの一部取得に失敗 (${kind})`, failure.error && (failure.error as TreeErrorLike).message);
    }
    return result;
  };

  /**
   * 親作品・子作品をまとめて取得する（直接の親子のみ。孫以降は辿らない）。
   * 片方が失敗しても、もう片方は返す。途中で失敗した側も取得済みの分は返す。
   */
  // ---------------------------------------------------------------------------
  // Task194: 直接の親・子の全範囲を、1回の操作で最後まで走査する（ID収集）。
  //  - 1要求の _limit は最大300（2026-10-02 実測: 301 は 400 "max: 300"）。これはAPIの1要求の上限で、取得総数の上限ではない。
  //  - 走査範囲は最初に返った total で決める。少ない返却（短いページ）は終端ではなく、要求した枠だけ進む。
  //  - total の変化・同じページの繰り返し・進まないページ・total の不正・total に届く前の空ページは
  //    「全件成功」とせず、理由付きの部分結果にする（無限に追いかけない）。
  //  - 取消（AbortSignal）は HTTP・本文の読取り・再試行の待機まで届く。
  //  - 429/502/503/504・通信失敗・期限切れは GET を有限回だけ再試行し、429 は Retry-After を尊重する。
  //  - ID の全件収集は with_meta なしを基準にする（with_meta=1 は一部の行が返らないことがある）。
  // サーバー側の最大offset・単位時間あたりの上限は未確認。ここにある上限は Zenza 側の安全のための値。
  const API_MAX_LIMIT = 300;
  const SCAN_PAGE_SIZE = 300;
  const META_PAGE_SIZE = 100;
  const SCAN_MAX_ROWS_PER_SIDE = 100000; // Zenza 側の安全上限（サーバーの上限ではない）
  const REQUEST_TIMEOUT_MS = 20000;      // 応答ヘッダーと本文の両方を含む期限
  const RETRY_MAX = 2;
  const RETRY_AFTER_CAP_MS = 60000;
  const RETRY_BASE_MS = 1000;

  const abortErrorOf = (signal: AbortSignal | null | undefined): Error => {
    const reason: unknown = signal && signal.reason;
    if (reason && (reason as TreeErrorLike).name === 'AbortError') { return reason as Error; }
    return Object.assign(new Error('aborted'), {name: 'AbortError', kind: 'cancelled'});
  };
  const isAbort = (e: unknown): boolean => !!e && ((e as TreeErrorLike).name === 'AbortError' || (e as TreeErrorLike).kind === 'cancelled');

  const abortableSleep = (ms: number, signal?: AbortSignal | undefined): Promise<void> => new Promise((resolve, reject) => {
    if (signal && signal.aborted) { reject(abortErrorOf(signal)); return; }
    let onAbort: (() => void) | null = null;
    const timer = setTimeout(() => {
      signal && onAbort && signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    if (signal) {
      onAbort = () => { clearTimeout(timer); reject(abortErrorOf(signal)); };
      signal.addEventListener('abort', onAbort, {once: true});
    }
  });

  // Retry-After（秒またはHTTP日付）をミリ秒に。読めなければ null
  const retryAfterMs = (value: unknown, now: number = Date.now()): number | null => {
    if (value === null || value === undefined || value === '') { return null; }
    const s = String(value).trim();
    if (/^\d+$/.test(s)) { return parseInt(s, 10) * 1000; }
    const t = Date.parse(s);
    return Number.isFinite(t) ? Math.max(0, t - now) : null;
  };

  // 1回のGET（ヘッダー＋本文に期限。取消は本文の読取り中にも届く）
  const requestJson = async (url: string, {signal, timeoutMs = REQUEST_TIMEOUT_MS}: {signal?: AbortSignal | undefined; timeoutMs?: number | undefined} = {}): Promise<JsonReply> => {
    if (signal && signal.aborted) { throw abortErrorOf(signal); }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer: number | null = null, rejectStop: ((reason: unknown) => void) | null = null, onAbort: (() => void) | null = null;
    const stop = new Promise<never>((resolve, reject) => { rejectStop = reject; });
    stop.catch(() => {});
    if (signal) {
      onAbort = () => { controller && controller.abort(); (rejectStop as (reason: unknown) => void)(abortErrorOf(signal)); };
      signal.addEventListener('abort', onAbort, {once: true});
    }
    timer = setTimeout(() => {
      controller && controller.abort();
      (rejectStop as (reason: unknown) => void)(Object.assign(new Error('timeout'), {kind: 'timeout'}));
    }, timeoutMs);
    try {
      const work = (async (): Promise<JsonReply> => {
        const res = await netUtil.fetch(url, {credentials: 'omit', signal: controller ? controller.signal : undefined, timeout: 0});
        const headers = res && res.headers;
        const retryAfter = headers && typeof headers.get === 'function' ? headers.get('Retry-After') : null;
        let json: CommonsEnvelopeProbe | null = null, invalidJson = false;
        if (res.status !== 404 && res.status !== 429) {
          try { json = await res.json(); } catch (e) { invalidJson = true; }
        }
        return {status: res.status, ok: !!res.ok, json, invalidJson, retryAfter};
      })();
      work.catch(() => {});
      return await Promise.race([work, stop]);
    } catch (e) {
      if (signal && signal.aborted) { throw abortErrorOf(signal); }
      throw e;
    } finally {
      clearTimeout(timer as number);
      signal && onAbort && signal.removeEventListener('abort', onAbort);
    }
  };

  const scanError = (message: string, extra: object): Error => Object.assign(new Error(message), extra);

  // 1ページ分（再試行込み）。戻り値 {total, contents} / {notFound:true}
  const fetchScanPage = async (globalId: string, kind: CommonsTreeKind, offset: number, limit: number, {signal, withMeta = false, timeoutMs, onRetry}: FetchScanPageOptions = {}): Promise<CommonsScanPage> => {
    limit = Math.max(1, Math.min(API_MAX_LIMIT, limit | 0));
    const url = `${API_BASE}/${globalId}/relatives/${kind}` +
      `?_offset=${offset}&_limit=${limit}${withMeta ? '&with_meta=1' : ''}&_sort=-id`;
    for (let attempt = 0; ; attempt++) {
      let r: JsonReply;
      try {
        r = await requestJson(url, {signal, timeoutMs});
      } catch (e) {
        if (isAbort(e)) { throw e; }
        if (attempt < RETRY_MAX) {
          onRetry && onRetry({kind, offset, attempt: attempt + 1, reason: ((e as TreeErrorLike).kind as string) || 'network'});
          await abortableSleep(RETRY_BASE_MS * (attempt + 1), signal);
          continue;
        }
        throw scanError(`コンテンツツリーの取得に失敗 (${kind}: ${(e as TreeErrorLike).kind || 'network'} at ${offset})`, {kind: (e as TreeErrorLike).kind || 'network', offset});
      }
      if (r.status === 404) {
        return {notFound: true};
      }
      if ([429, 502, 503, 504].includes(r.status)) {
        const wait = retryAfterMs(r.retryAfter);
        if (attempt < RETRY_MAX && (wait === null || wait <= RETRY_AFTER_CAP_MS)) {
          onRetry && onRetry({kind, offset, attempt: attempt + 1, reason: `http-${r.status}`, waitMs: wait});
          await abortableSleep(wait !== null ? wait : RETRY_BASE_MS * (attempt + 1), signal);
          continue;
        }
        throw scanError(`コンテンツツリーの取得に失敗 (${kind}: ${r.status} at ${offset})`,
          {kind: r.status === 429 ? 'rate-limited' : 'http', status: r.status, offset, retryAfterMs: wait});
      }
      if (!r.ok) {
        throw scanError(`コンテンツツリーの取得に失敗 (${kind}: ${r.status} at ${offset})`, {kind: 'http', status: r.status, offset});
      }
      if (r.invalidJson) {
        throw scanError(`コンテンツツリーの応答が読めません (${kind} at ${offset})`, {kind: 'schema', offset});
      }
      const json = r.json;
      const metaStatus = json && json.meta ? json.meta.status : undefined;
      if (metaStatus !== undefined && !((metaStatus as number) >= 200 && (metaStatus as number) <= 299)) {
        throw scanError(`コンテンツツリーの取得に失敗 (${kind}: meta ${metaStatus})`, {kind: 'api', status: metaStatus, offset});
      }
      const box = (json && json.data ? json.data[kind] : undefined) as CommonsBoxProbe | undefined;
      if (!box || typeof box !== 'object' || !Array.isArray(box.contents)) {
        throw scanError(`コンテンツツリーの応答形式が不正 (${kind})`, {kind: 'schema', offset});
      }
      if (!(Number.isInteger(box.total) && (box.total as number) >= 0)) {
        throw scanError(`コンテンツツリーの総数が不正 (${kind})`, {kind: 'invalid-total', offset});
      }
      return {total: box.total as number, contents: box.contents as CommonsContentRow[]};
    }
  };

  const toWork = (c: CommonsContentProbe & {globalId: string}): CommonsWork => {
    const meta = pickMeta(c);
    return {
      ...(meta ? {meta} : {}),
      contentId: c.globalId,
      isVideo: c.contentKind === 'video' && c.visibleStatus === 'visible',
      contentKind: c.contentKind,
      visibleStatus: c.visibleStatus
    };
  };

  /**
   * 片側（parents / children）の全範囲を走査する。
   * jobSeen: ジョブ全体で共有する globalId の集合（親で出たIDは子では数えない）
   */
  const scanSide = async (globalId: string, kind: CommonsTreeKind, {signal, pageSize = SCAN_PAGE_SIZE, startOffset = 0, jobSeen = new Set<string>(),
    onPage, onRetry, timeoutMs, maxRows = SCAN_MAX_ROWS_PER_SIDE}: ScanSideOptions = {}): Promise<ScanSideResult> => {
    pageSize = Math.max(1, Math.min(API_MAX_LIMIT, pageSize | 0));
    startOffset = Math.max(0, Math.floor(Number(startOffset) || 0));
    const works: CommonsWork[] = [];
    let offset = startOffset, initialTotal: number | null = null, requests = 0, rows = 0;
    let duplicateCount = 0, crossDuplicateCount = 0, invalidCount = 0;
    let stopReason: string | null = null, failure: ScanFailure | null = null, notFound = false, prevPageKey: string | null = null;
    const totalChanges: {offset: number; total: number}[] = [];
    const sideSeen = new Set<string>();
    while (true) {
      if (initialTotal !== null && offset >= initialTotal) { stopReason = 'end-of-range'; break; }
      if (offset - startOffset >= maxRows) { stopReason = 'job-cap'; break; }
      const limit = initialTotal === null ? pageSize : Math.min(pageSize, initialTotal - offset);
      let page: CommonsScanPage;
      try {
        page = await fetchScanPage(globalId, kind, offset, limit, {signal, timeoutMs, onRetry});
        requests++;
      } catch (e) {
        if (isAbort(e)) { stopReason = 'cancelled'; break; }
        failure = {failedOffset: offset, kind: (e as TreeErrorLike).kind || 'error', status: (e as TreeErrorLike).status, message: (e as TreeErrorLike).message as string};
        stopReason = 'failed';
        break;
      }
      if (page.notFound) {
        if (offset === 0 && initialTotal === null) {
          notFound = true; initialTotal = 0; stopReason = 'not-found';
        } else {
          failure = {failedOffset: offset, kind: 'not-found-mid', status: 404};
          stopReason = 'failed';
        }
        break;
      }
      if (initialTotal === null) {
        initialTotal = page.total;
      } else if (page.total !== initialTotal) {
        totalChanges.push({offset, total: page.total});
      }
      const pageKey = page.contents.map((c: CommonsContentRow) => c && c.globalId).join(',');
      if (page.contents.length && pageKey === prevPageKey) { stopReason = 'repeated-page'; break; }
      prevPageKey = pageKey;
      rows += page.contents.length;
      const before = sideSeen.size;
      for (const c of page.contents) {
        if (!c || !isGlobalId(c.globalId)) { invalidCount++; continue; }
        if (sideSeen.has(c.globalId)) { duplicateCount++; continue; }
        sideSeen.add(c.globalId);
        if (jobSeen.has(c.globalId)) { crossDuplicateCount++; continue; }
        jobSeen.add(c.globalId);
        works.push(toWork(c as CommonsContentProbe & {globalId: string}));
      }
      if (!page.contents.length) {
        stopReason = offset < initialTotal ? 'empty-before-end' : 'end-of-range';
        break;
      }
      if (sideSeen.size === before) { stopReason = 'no-progress'; break; }
      offset += limit;
      onPage && onPage({kind, offset, total: initialTotal, rows, works: works.length, requests});
    }
    const total = initialTotal === null ? 0 : initialTotal;
    const complete = (stopReason === 'end-of-range' || stopReason === 'not-found') && !totalChanges.length;
    const resumable = stopReason === 'failed' || stopReason === 'job-cap' || stopReason === 'cancelled';
    return {
      kind, total, works, rows, requests, stopReason, complete,
      partial: !complete && (works.length > 0 || rows > 0),
      failed: stopReason === 'failed',
      cancelled: stopReason === 'cancelled',
      notFound, totalChanges, duplicateCount, crossDuplicateCount, invalidCount,
      startOffset, fetchedCount: rows, scanComplete: complete,
      failedOffset: failure ? failure.failedOffset : null,
      failure,
      truncated: stopReason === 'job-cap',
      nextOffset: resumable ? offset : null
    };
  };

  const kindCounts = (works: CommonsWork[]): Record<string, number> => works.reduce((acc: Record<string, number>, w: CommonsWork) => {
    const k = (w.contentKind || 'unknown') as string;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  /**
   * 親 → 子 の順に、それぞれの全範囲を直列で走査する（並列で負荷をかけない）。
   * offsets: {parents, children}（null の側は走査しない。数値ならその位置から）
   */
  const scanAll = async (globalId: string, {signal, pageSize = SCAN_PAGE_SIZE, offsets = null, onProgress, onRetry, timeoutMs}: ScanAllOptions = {}): Promise<ScanAllResult> => {
    const jobSeen = new Set<string>();
    const sides: Partial<Record<CommonsTreeKind, ScanSideResult>> = {};
    for (const kind of ['parents', 'children'] as const) {
      const start = offsets ? offsets[kind] : 0;
      if (offsets && (start === null || start === undefined)) {
        sides[kind] = {kind, total: 0, works: [], rows: 0, requests: 0, skipped: true, stopReason: 'skipped',
          complete: true, scanComplete: true, nextOffset: null, startOffset: null, fetchedCount: 0, truncated: false,
          totalChanges: [], duplicateCount: 0, crossDuplicateCount: 0, invalidCount: 0};
        continue;
      }
      if (signal && signal.aborted) {
        sides[kind] = {kind, total: 0, works: [], rows: 0, requests: 0, stopReason: 'cancelled', cancelled: true,
          complete: false, nextOffset: start || 0, startOffset: start || 0, fetchedCount: 0, totalChanges: []};
        continue;
      }
      sides[kind] = await scanSide(globalId, kind, {signal, pageSize, startOffset: start || 0, jobSeen, timeoutMs, onRetry,
        onPage: (p: PageProgress) => onProgress && onProgress({...p, phase: 'ids'})});
    }
    const {parents, children} = sides as Record<CommonsTreeKind, ScanSideResult>;
    const all = parents.works.concat(children.works);
    const stats = {
      requests: parents.requests + children.requests,
      rows: (parents.rows || 0) + (children.rows || 0),
      unique: all.length,
      videoCandidates: all.filter((w: CommonsWork) => w.isVideo).length,
      kinds: kindCounts(all),
      parentsTotal: parents.total, childrenTotal: children.total
    };
    const cancelled = !!(parents.cancelled || children.cancelled);
    const complete = [parents, children].every((s: ScanSideResult) => s.skipped || s.complete);
    return {parents, children, stats, cancelled, complete};
  };

  /**
   * Task194: with_meta=1 の表示情報（タイトル・サムネイル等）をIDで取得する。ID収集とは別の低負荷の補完。
   * 1要求は既定100件（300件では応答が期限に達した実測があるため）。行が少なくても終端とはせず、total まで進む。
   * 失敗・取消はそこで止めて、得られた分だけ返す（IDの一覧には影響しない）。
   */
  const scanMeta = async (globalId: string, kind: CommonsTreeKind, total: unknown, {signal, pageSize = META_PAGE_SIZE, onPage, timeoutMs}: ScanMetaOptions = {}): Promise<ScanMetaResult> => {
    pageSize = Math.max(1, Math.min(META_PAGE_SIZE, pageSize | 0));
    const metas = new Map<string, CommonsMeta>();
    let offset = 0, requests = 0, stopReason: string | null = null;
    const end = Math.max(0, Math.min(Number.isInteger(total) ? total as number : 0, SCAN_MAX_ROWS_PER_SIDE));
    while (offset < end) {
      const limit = Math.min(pageSize, end - offset);
      let page: CommonsScanPage;
      try {
        page = await fetchScanPage(globalId, kind, offset, limit, {signal, withMeta: true, timeoutMs});
        requests++;
      } catch (e) {
        stopReason = isAbort(e) ? 'cancelled' : 'failed';
        break;
      }
      if (page.notFound) { stopReason = 'not-found'; break; }
      for (const c of page.contents) {
        if (!c || !isGlobalId(c.globalId)) { continue; }
        const meta = pickMeta(c);
        meta && metas.set(c.globalId, meta);
      }
      offset += limit;
      onPage && onPage({kind, offset, total: end, metas: metas.size, requests, map: metas});
    }
    return {metas, requests, stopReason: stopReason || 'end-of-range', complete: !stopReason};
  };

  // Task191 (COM-03): offsets = {parents, children}. A side whose offset is null is not
  // requested again (it was already scanned to the end); a number continues from there.
  // Task194: fullScan=true なら 1回の呼出しで全範囲を走査する（scanAll）。互換のため、従来の呼出しは従来どおり。
  const load = async (globalId: string, maxItems: number = DEFAULT_MAX_ITEMS, {offsets = null, fullScan = false, signal, onProgress, onRetry, pageSize}: LoadOptions = {}): Promise<{parents: RelativesResult; children: RelativesResult} | ScanAllResult> => {
    if (fullScan) {
      const result = await scanAll(globalId, {signal, offsets, onProgress, onRetry, pageSize});
      const requested = [result.parents, result.children].filter((x: ScanSideResult) => !x.skipped);
      if (!result.cancelled && requested.length && requested.every((x: ScanSideResult) => x.failed && !x.works.length)) {
        throw Object.assign(new Error('コンテンツツリーの取得に失敗しました'), {result});
      }
      return result;
    }
    const side = (kind: CommonsTreeKind): Promise<RelativesResult> => {
      const start = offsets ? offsets[kind] : 0;
      if (offsets && (start === null || start === undefined)) {
        return Promise.resolve({total: 0, works: [], skipped: true, stopReason: 'skipped', scanComplete: true,
          nextOffset: null, startOffset: null, fetchedCount: 0, truncated: false});
      }
      const label = kind === 'parents' ? '親作品' : '子作品';
      return loadRelatives(globalId, kind, maxItems, {startOffset: start || 0}).catch((e: unknown): RelativesResult => {
        window.console.warn(`${label}の取得に失敗`, e && (e as TreeErrorLike).message);
        // a continuation that fails can be retried from the same place
        return {total: 0, works: [], failed: true, nextOffset: start ? start : null, startOffset: start || 0, fetchedCount: 0};
      });
    };
    const [parents, children] = await Promise.all([side('parents'), side('children')]);
    const requested = [parents, children].filter((x: RelativesResult) => !x.skipped);
    if (requested.length && requested.every((x: RelativesResult) => x.failed && !x.works.length)) {
      throw new Error('コンテンツツリーの取得に失敗しました');
    }
    return {parents, children};
  };

  return {load, loadRelatives, scanAll, scanSide, scanMeta, retryAfterMs, WITH_META_DEFAULT, API_MAX_LIMIT, SCAN_PAGE_SIZE, META_PAGE_SIZE};
})();

export {CommonsTreeLoader};
