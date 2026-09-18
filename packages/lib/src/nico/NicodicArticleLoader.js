import {CrossDomainGate} from '../infra/CrossDomainGate';
import {CacheStorage} from '../infra/CacheStorage';

//===BEGIN===
/**
 * タグに対応するニコニコ大百科の記事が存在するかを調べる（Task 044）。
 *
 * 【なぜ必要になったか】
 * タグの大百科アイコンは、視聴ページのAPIが返すタグ情報の
 * isNicodicArticleExists を見て出し分けていた。ZenzaWatch側の実装は
 * 今も正しいが、**ニコニコ側がこの値を返さなくなった**。
 * 2026-09時点で実際に確認したところ、
 *
 *   sm9 / sm500873 / sm33824596 / sm44839793 の全40件以上のタグについて、
 *   「陰陽師」「音楽」「けものフレンズ」「クッキー☆」など、明らかに
 *   大百科記事があるタグまで含めて **すべて false** だった。
 *
 * つまり値が壊れているため、ZenzaWatch側では常にアイコンが出ない状態だった。
 *
 * 【代わりの判定方法】
 * 大百科の記事ページは、記事があれば200・無ければ404を返す
 * （実測で確認。無い場合も「記事を作成」ページが表示されるが、
 *   HTTPステータスは404になっている）。
 *
 *   https://dic.nicovideo.jp/a/{タグ名}
 *
 * ただし www.nicovideo.jp から dic.nicovideo.jp へ直接fetchすると
 * CORSで拒否される（実測で確認）。そこでZenzaWatchに元からある
 * CrossDomainGate（対象ドメインのページを隠しiframeで開き、その中で
 * 動いているZenzaWatch自身に代理取得させる仕組み。ext.nicovideo.jp等で
 * 既に使われている）を経由する。ゲート側の受け口はGateAPI.nicodic、
 * iframeを開く条件の分岐はsrc/boot.jsにある。
 *
 * 【負荷への配慮】
 * - 本文は不要なのでHEADで問い合わせる
 * - 結果はsessionStorageに1日キャッシュする（同じタグを何度も問い合わせない）
 * - 動画を開くたびに数個〜十数個のタグをまとめて問い合わせる程度で済む
 */
const NicodicArticleLoader = (() => {
  const BASE_URL = 'https://dic.nicovideo.jp/robots.txt';
  const MESSAGE_ORIGIN = 'https://dic.nicovideo.jp/';
  const CACHE_EXPIRE_TIME = 24 * 60 * 60 * 1000;
  const CACHE_PREFIX = 'nicodicExists: ';

  let gate = null;
  let cacheStorage = null;
  // 同じタグへの問い合わせが同時に走らないようにする
  const inFlight = new Map();

  const initGate = () => {
    if (gate) { return gate; }
    gate = new CrossDomainGate({
      baseUrl: BASE_URL,
      origin: MESSAGE_ORIGIN,
      type: 'nicodic'
    });
    return gate;
  };

  const getCache = () => {
    if (!cacheStorage) { cacheStorage = new CacheStorage(sessionStorage); }
    return cacheStorage;
  };

  /**
   * @param {string} tagName
   * @return {Promise<boolean|null>} true:記事あり false:記事なし null:判定できず
   */
  const exists = async tagName => {
    if (!tagName) { return null; }
    const key = CACHE_PREFIX + tagName;
    const cached = getCache().getItem(key);
    if (typeof cached === 'boolean') { return cached; }
    if (inFlight.has(tagName)) { return inFlight.get(tagName); }

    const promise = (async () => {
      try {
        initGate();
        const url = `https://dic.nicovideo.jp/a/${encodeURIComponent(tagName)}`;
        const res = await gate.fetch(url, {method: 'HEAD'});
        const status = (res && typeof res.status === 'number') ? res.status : 0;
        if (status !== 200 && status !== 404) {
          // 想定外の応答は「判定できず」とし、キャッシュもしない
          return null;
        }
        const result = status === 200;
        getCache().setItem(key, result, CACHE_EXPIRE_TIME);
        return result;
      } catch (e) {
        window.console.warn('大百科の記事有無を調べられませんでした', tagName, e);
        return null;
      } finally {
        inFlight.delete(tagName);
      }
    })();
    inFlight.set(tagName, promise);
    return promise;
  };

  /**
   * 複数のタグをまとめて調べる。
   * 一度に大量のリクエストを投げないよう、少しずつ処理する。
   * @param {string[]} tagNames
   * @param {function(string, boolean)} onResult 1件確定するたびに呼ばれる
   */
  const checkAll = async (tagNames, onResult) => {
    const CONCURRENCY = 4;
    const names = Array.from(new Set((tagNames || []).filter(n => n)));
    for (let i = 0; i < names.length; i += CONCURRENCY) {
      const chunk = names.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map(async name => {
        const result = await exists(name);
        if (typeof result === 'boolean' && typeof onResult === 'function') {
          onResult(name, result);
        }
      }));
    }
  };

  return {exists, checkAll};
})();

//===END===

export {NicodicArticleLoader};
