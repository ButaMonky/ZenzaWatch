import {CacheStorage} from '../infra/CacheStorage';

//===BEGIN===
/**
 * Task157: titles[]を反復する一括API。wwwからcredentials:omitでCORS成功を実測。
 * titleは正規化されるためrequest_titleで元のタグへ対応付ける。
 * 10件は実測済みのクライアント側分割数（サーバー上限は未確定）。
 * 詳細: docs/research/NICONICO_COMPATIBILITY_2026-10-01.md
 */
const NicodicArticleLoader = (() => {
  const API_URL = 'https://api.dic.nicovideo.jp/v1/articles/article';
  const CACHE_PREFIX = 'nicodicBatch: ';
  const CACHE_EXPIRE_TIME = 24 * 60 * 60 * 1000;
  const BATCH_SIZE = 10;
  const inFlight = new Map();
  const pending = new Map();
  let cacheStorage;
  let scheduled = false;
  const getCache = () => cacheStorage || (cacheStorage = new CacheStorage(sessionStorage));

  const fetchBatch = async entries => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let articles = null;
    try {
      const query = new URLSearchParams();
      entries.forEach(([name]) => query.append('titles[]', name));
      const res = await fetch(`${API_URL}?${query}`, {credentials: 'omit', signal: controller.signal});
      if (!res.ok) { throw new Error(`Nicodic HTTP ${res.status}`); }
      const data = await res.json();
      if (!Array.isArray(data) || data.some(a => !a || typeof a.request_title !== 'string' || typeof a.title !== 'string')) {
        throw new Error('Invalid Nicodic batch response');
      }
      articles = new Map(data.map(a => [a.request_title, a]));
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

  const flush = async () => {
    const entries = Array.from(pending);
    pending.clear();
    scheduled = false;
    // 大きな一覧でも同時通信を増やさず、10件ずつ取得する。
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      await fetchBatch(entries.slice(i, i + BATCH_SIZE));
    }
  };

  const lookup = name => {
    if (typeof name !== 'string' || !name) { return Promise.resolve(null); }
    try {
      const cached = getCache().getItem(CACHE_PREFIX + name);
      if (cached && typeof cached.exists === 'boolean') { return Promise.resolve(cached); }
    } catch (e) { /* cache is optional */ }
    if (inFlight.has(name)) { return inFlight.get(name); }
    const promise = new Promise(resolve => pending.set(name, resolve));
    inFlight.set(name, promise);
    if (!scheduled) {
      scheduled = true;
      Promise.resolve().then(flush);
    }
    return promise;
  };

  /** true:記事あり false:記事なし null:通信失敗等で判定できず */
  const exists = async name => {
    const result = await lookup(name);
    return result ? result.exists : null;
  };

  const checkAll = async (tagNames, onResult) => {
    const names = Array.from(new Set((tagNames || []).filter(n => typeof n === 'string' && n)));
    await Promise.all(names.map(async name => {
      const result = await lookup(name);
      if (result && typeof onResult === 'function') { onResult(name, result.exists, result.article); }
    }));
  };
  return {exists, checkAll};
})();
//===END===
export {NicodicArticleLoader};
