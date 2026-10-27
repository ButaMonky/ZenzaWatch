import {netUtil} from '../infra/netUtil';

//===BEGIN===
/**
 * タグ検索の入力補完（Task 069）。
 *
 * 本家の検索欄（タグで検索／キーワードで検索）に文字を入力すると出る
 * 「存在するタグの候補」は、次のAPIから取得している（2026-09-17に実機で確認）:
 *
 *   GET https://sug.search.nicovideo.jp/suggestion/expand/{入力語をencodeURIComponent}
 *   応答: {"candidates": ["東方神起", "東方MMD", ...]}  （最大10件）
 *
 *  - 認証不要。credentials: 'omit' ならCORSで取得できる。
 *    credentials: 'include' にすると失敗する（Failed to fetch）。
 *  - Cache-Control: max-age=86400。
 *  - 空文字や該当なしは candidates: [] （HTTP 200）。
 *  - ひらがな読み（例: とうほう）でも漢字のタグ（東方…）が返る。
 *    スペースを含む語（例: 初音ミク 歌）は、最後の語を補完した「初音ミク 歌ってみた」等が返る。
 *  - 本家の配信JSでは任意のクエリ s を付けられる定義があるが、意味は未確認（付けても結果は同じだった）。
 *  - 本家では候補を選んで検索すると URL に rd=suggested_tag が付く（流入元の記録用）。
 */
const TagSuggestLoader = (() => {
  const API_BASE = 'https://sug.search.nicovideo.jp/suggestion/expand/';
  const CACHE_LIMIT = 300;
  const cache = new Map();

  const load = async (word) => {
    const w = (word || '').trim();
    if (!w) {
      return [];
    }
    if (cache.has(w)) {
      return cache.get(w);
    }
    const net = (typeof netUtil !== 'undefined') ? netUtil : {fetch: (u, o) => fetch(u, o)};
    const res = await net.fetch(API_BASE + encodeURIComponent(w), {credentials: 'omit', timeout: 5000});
    const json = await res.json();
    const candidates = (json && Array.isArray(json.candidates)) ? json.candidates.filter(c => typeof c === 'string') : [];
    cache.set(w, candidates);
    if (cache.size > CACHE_LIMIT) {
      cache.delete(cache.keys().next().value);
    }
    return candidates;
  };

  return {load};
})();

//===END===

export {TagSuggestLoader};
