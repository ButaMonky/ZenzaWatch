import {netUtil} from '../infra/netUtil';

//===BEGIN===
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
const CommonsTreeLoader = (() => {
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
  const pageError = (message, extra = {}) => Object.assign(new Error(message), extra);

  // Task192 (COM-04): with_meta=1 adds display fields (title, thumbnailURL, ...). It was
  // observed on the official commons page (20-slot, logged in); a www-origin request with
  // credentials:'omit' and 100-slot pages are not verified yet, so it stays off by default.
  // The fields are optional display hints only: never full video information.
  const WITH_META_DEFAULT = false;
  const fetchPage = async (globalId, kind, offset, limit, withMeta = WITH_META_DEFAULT) => {
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
    const json = await res.json();
    const metaStatus = json && json.meta ? json.meta.status : undefined;
    if (metaStatus !== undefined && !(metaStatus >= 200 && metaStatus <= 299)) {
      throw pageError(`コンテンツツリーの取得に失敗 (${kind}: meta ${metaStatus})`, {status: metaStatus});
    }
    const box = json && json.data ? json.data[kind] : undefined;
    if (!box || typeof box !== 'object' || typeof box.total !== 'number' || !Array.isArray(box.contents)) {
      throw pageError(`コンテンツツリーの応答形式が不正 (${kind})`, {reason: 'schema'});
    }
    return {total: box.total, contents: box.contents};
  };

  const isGlobalId = id => typeof id === 'string' && /^[a-z]{2}\d+$/.test(id);

  // Task192 (COM-04): keep only well-formed display hints. Missing or malformed values are
  // left out (never turned into 0 / empty), and permissions such as isEditable are not kept.
  const count = v => (Number.isInteger(v) && v >= 0) ? v : undefined;
  const pickMeta = c => {
    const meta = {};
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
  const loadRelatives = async (globalId, kind, maxItems = DEFAULT_MAX_ITEMS, {pageSize = PAGE_SIZE, startOffset = 0, withMeta = WITH_META_DEFAULT} = {}) => {
    const contents = [];
    let total = 0;
    let notFound = false;
    let stopReason = 'limit';
    // Task191 (COM-03): a continuation starts at the nextOffset of the previous call and
    // fetches at most maxItems more rows; the per-call cap (300) is kept.
    startOffset = Math.max(0, Math.floor(Number(startOffset) || 0));
    let offset = startOffset;
    let failure = null;
    // Task179 (COM-01): a page shorter than requested is not necessarily the last
    // one (captured: 20-slot pages returned 19/19/16/18/20 items with more after).
    // Advance by the requested window, and stop on the reported end, an empty page,
    // or the per-direction cap. The number of requests is bounded by maxItems/pageSize.
    const end = startOffset + maxItems;
    while (offset < end) {
      const limit = Math.min(pageSize, end - offset);
      let page;
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
    const seen = new Set();
    let duplicateCount = 0, invalidCount = 0;
    const works = [];
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
    const result = {
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
      window.console.warn(`コンテンツツリーの一部取得に失敗 (${kind})`, failure.error && failure.error.message);
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

  const abortErrorOf = signal => {
    const reason = signal && signal.reason;
    if (reason && reason.name === 'AbortError') { return reason; }
    return Object.assign(new Error('aborted'), {name: 'AbortError', kind: 'cancelled'});
  };
  const isAbort = e => !!e && (e.name === 'AbortError' || e.kind === 'cancelled');

  const abortableSleep = (ms, signal) => new Promise((resolve, reject) => {
    if (signal && signal.aborted) { reject(abortErrorOf(signal)); return; }
    let onAbort = null;
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
  const retryAfterMs = (value, now = Date.now()) => {
    if (value === null || value === undefined || value === '') { return null; }
    const s = String(value).trim();
    if (/^\d+$/.test(s)) { return parseInt(s, 10) * 1000; }
    const t = Date.parse(s);
    return Number.isFinite(t) ? Math.max(0, t - now) : null;
  };

  // 1回のGET（ヘッダー＋本文に期限。取消は本文の読取り中にも届く）
  const requestJson = async (url, {signal, timeoutMs = REQUEST_TIMEOUT_MS} = {}) => {
    if (signal && signal.aborted) { throw abortErrorOf(signal); }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null, rejectStop = null, onAbort = null;
    const stop = new Promise((resolve, reject) => { rejectStop = reject; });
    stop.catch(() => {});
    if (signal) {
      onAbort = () => { controller && controller.abort(); rejectStop(abortErrorOf(signal)); };
      signal.addEventListener('abort', onAbort, {once: true});
    }
    timer = setTimeout(() => {
      controller && controller.abort();
      rejectStop(Object.assign(new Error('timeout'), {kind: 'timeout'}));
    }, timeoutMs);
    try {
      const work = (async () => {
        const res = await netUtil.fetch(url, {credentials: 'omit', signal: controller ? controller.signal : undefined, timeout: 0});
        const headers = res && res.headers;
        const retryAfter = headers && typeof headers.get === 'function' ? headers.get('Retry-After') : null;
        let json = null, invalidJson = false;
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
      clearTimeout(timer);
      signal && onAbort && signal.removeEventListener('abort', onAbort);
    }
  };

  const scanError = (message, extra) => Object.assign(new Error(message), extra);

  // 1ページ分（再試行込み）。戻り値 {total, contents} / {notFound:true}
  const fetchScanPage = async (globalId, kind, offset, limit, {signal, withMeta = false, timeoutMs, onRetry} = {}) => {
    limit = Math.max(1, Math.min(API_MAX_LIMIT, limit | 0));
    const url = `${API_BASE}/${globalId}/relatives/${kind}` +
      `?_offset=${offset}&_limit=${limit}${withMeta ? '&with_meta=1' : ''}&_sort=-id`;
    for (let attempt = 0; ; attempt++) {
      let r;
      try {
        r = await requestJson(url, {signal, timeoutMs});
      } catch (e) {
        if (isAbort(e)) { throw e; }
        if (attempt < RETRY_MAX) {
          onRetry && onRetry({kind, offset, attempt: attempt + 1, reason: e.kind || 'network'});
          await abortableSleep(RETRY_BASE_MS * (attempt + 1), signal);
          continue;
        }
        throw scanError(`コンテンツツリーの取得に失敗 (${kind}: ${e.kind || 'network'} at ${offset})`, {kind: e.kind || 'network', offset});
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
      if (metaStatus !== undefined && !(metaStatus >= 200 && metaStatus <= 299)) {
        throw scanError(`コンテンツツリーの取得に失敗 (${kind}: meta ${metaStatus})`, {kind: 'api', status: metaStatus, offset});
      }
      const box = json && json.data ? json.data[kind] : undefined;
      if (!box || typeof box !== 'object' || !Array.isArray(box.contents)) {
        throw scanError(`コンテンツツリーの応答形式が不正 (${kind})`, {kind: 'schema', offset});
      }
      if (!(Number.isInteger(box.total) && box.total >= 0)) {
        throw scanError(`コンテンツツリーの総数が不正 (${kind})`, {kind: 'invalid-total', offset});
      }
      return {total: box.total, contents: box.contents};
    }
  };

  const toWork = c => {
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
  const scanSide = async (globalId, kind, {signal, pageSize = SCAN_PAGE_SIZE, startOffset = 0, jobSeen = new Set(),
    onPage, onRetry, timeoutMs, maxRows = SCAN_MAX_ROWS_PER_SIDE} = {}) => {
    pageSize = Math.max(1, Math.min(API_MAX_LIMIT, pageSize | 0));
    startOffset = Math.max(0, Math.floor(Number(startOffset) || 0));
    const works = [];
    let offset = startOffset, initialTotal = null, requests = 0, rows = 0;
    let duplicateCount = 0, crossDuplicateCount = 0, invalidCount = 0;
    let stopReason = null, failure = null, notFound = false, prevPageKey = null;
    const totalChanges = [];
    const sideSeen = new Set();
    while (true) {
      if (initialTotal !== null && offset >= initialTotal) { stopReason = 'end-of-range'; break; }
      if (offset - startOffset >= maxRows) { stopReason = 'job-cap'; break; }
      const limit = initialTotal === null ? pageSize : Math.min(pageSize, initialTotal - offset);
      let page;
      try {
        page = await fetchScanPage(globalId, kind, offset, limit, {signal, timeoutMs, onRetry});
        requests++;
      } catch (e) {
        if (isAbort(e)) { stopReason = 'cancelled'; break; }
        failure = {failedOffset: offset, kind: e.kind || 'error', status: e.status, message: e.message};
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
      const pageKey = page.contents.map(c => c && c.globalId).join(',');
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
        works.push(toWork(c));
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

  const kindCounts = works => works.reduce((acc, w) => {
    const k = w.contentKind || 'unknown';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

  /**
   * 親 → 子 の順に、それぞれの全範囲を直列で走査する（並列で負荷をかけない）。
   * offsets: {parents, children}（null の側は走査しない。数値ならその位置から）
   */
  const scanAll = async (globalId, {signal, pageSize = SCAN_PAGE_SIZE, offsets = null, onProgress, onRetry, timeoutMs} = {}) => {
    const jobSeen = new Set();
    const sides = {};
    for (const kind of ['parents', 'children']) {
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
        onPage: p => onProgress && onProgress({...p, phase: 'ids'})});
    }
    const {parents, children} = sides;
    const all = parents.works.concat(children.works);
    const stats = {
      requests: parents.requests + children.requests,
      rows: (parents.rows || 0) + (children.rows || 0),
      unique: all.length,
      videoCandidates: all.filter(w => w.isVideo).length,
      kinds: kindCounts(all),
      parentsTotal: parents.total, childrenTotal: children.total
    };
    const cancelled = !!(parents.cancelled || children.cancelled);
    const complete = [parents, children].every(s => s.skipped || s.complete);
    return {parents, children, stats, cancelled, complete};
  };

  /**
   * Task194: with_meta=1 の表示情報（タイトル・サムネイル等）をIDで取得する。ID収集とは別の低負荷の補完。
   * 1要求は既定100件（300件では応答が期限に達した実測があるため）。行が少なくても終端とはせず、total まで進む。
   * 失敗・取消はそこで止めて、得られた分だけ返す（IDの一覧には影響しない）。
   */
  const scanMeta = async (globalId, kind, total, {signal, pageSize = META_PAGE_SIZE, onPage, timeoutMs} = {}) => {
    pageSize = Math.max(1, Math.min(META_PAGE_SIZE, pageSize | 0));
    const metas = new Map();
    let offset = 0, requests = 0, stopReason = null;
    const end = Math.max(0, Math.min(Number.isInteger(total) ? total : 0, SCAN_MAX_ROWS_PER_SIDE));
    while (offset < end) {
      const limit = Math.min(pageSize, end - offset);
      let page;
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
  const load = async (globalId, maxItems = DEFAULT_MAX_ITEMS, {offsets = null, fullScan = false, signal, onProgress, onRetry, pageSize} = {}) => {
    if (fullScan) {
      const result = await scanAll(globalId, {signal, offsets, onProgress, onRetry, pageSize});
      const requested = [result.parents, result.children].filter(x => !x.skipped);
      if (!result.cancelled && requested.length && requested.every(x => x.failed && !x.works.length)) {
        throw Object.assign(new Error('コンテンツツリーの取得に失敗しました'), {result});
      }
      return result;
    }
    const side = kind => {
      const start = offsets ? offsets[kind] : 0;
      if (offsets && (start === null || start === undefined)) {
        return Promise.resolve({total: 0, works: [], skipped: true, stopReason: 'skipped', scanComplete: true,
          nextOffset: null, startOffset: null, fetchedCount: 0, truncated: false});
      }
      const label = kind === 'parents' ? '親作品' : '子作品';
      return loadRelatives(globalId, kind, maxItems, {startOffset: start || 0}).catch(e => {
        window.console.warn(`${label}の取得に失敗`, e && e.message);
        // a continuation that fails can be retried from the same place
        return {total: 0, works: [], failed: true, nextOffset: start ? start : null, startOffset: start || 0, fetchedCount: 0};
      });
    };
    const [parents, children] = await Promise.all([side('parents'), side('children')]);
    const requested = [parents, children].filter(x => !x.skipped);
    if (requested.length && requested.every(x => x.failed && !x.works.length)) {
      throw new Error('コンテンツツリーの取得に失敗しました');
    }
    return {parents, children};
  };

  return {load, loadRelatives, scanAll, scanSide, scanMeta, retryAfterMs, WITH_META_DEFAULT, API_MAX_LIMIT, SCAN_PAGE_SIZE, META_PAGE_SIZE};
})();

//===END===

export {CommonsTreeLoader};
