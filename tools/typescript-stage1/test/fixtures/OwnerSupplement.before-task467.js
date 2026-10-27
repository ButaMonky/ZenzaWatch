import {netUtil} from '../infra/netUtil';

//===BEGIN===
/**
 * 投稿者情報が無い動画の投稿者を補う（Task 069。MylistPocket用に共通化）。
 *
 * getthumbinfo（ext.nicovideo.jp/api/getthumbinfo/{id}）は、投稿者が退会済み・非公開扱い等の
 * 動画では user_id / user_nickname / user_icon_url の要素自体を返さない
 * （2026-09-17、sm46778748 で実機確認。status="ok" で、その他の項目は通常通り）。
 * 視聴ページのJSONでも owner が null になる動画。
 *
 * 広告の単独動画情報API（認証不要・www.nicovideo.jp から credentials:'omit' でCORS可）には
 * ownerId / ownerName / ownerIcon が入っている（同日実機確認。sm46778748 → 145346240、
 * ownerIcon は既定の blank.jpg だった）。広告履歴の無い動画は404（NICOAD_5_2）になり補えない。
 *
 * なお nvapi /v1/users/{id} はこの投稿者IDで 404 NOT_FOUND を返した（ユーザー情報は取得できない）。
 */
const OwnerSupplement = (() => {
  const BLANK_ICON = 'https://secure-dcdn.cdn.nimg.jp/nicoaccount/usericon/defaults/blank.jpg';

  const loadFromNicoad = async (videoId) => {
    const net = (typeof netUtil !== 'undefined') ? netUtil : {fetch: (u, o) => fetch(u, o)};
    const res = await net.fetch(`https://api.nicoad.nicovideo.jp/v1/contents/video/${videoId}`,
      {credentials: 'omit', timeout: 5000});
    if (!res || !res.ok) {
      return null;
    }
    const json = await res.json();
    const d = json && json.data;
    if (!d || String(d.id) !== String(videoId) || !d.ownerId) {
      return null;
    }
    return {id: String(d.ownerId), name: d.ownerName || '', icon: d.ownerIcon || ''};
  };

  /**
   * thumbInfo.owner が無ければ補う（thumbInfo自体を書き換えて返す）。
   * 補えなかった場合も、表示が壊れないよう名前だけの owner を入れる。
   */
  const supplementThumbInfo = async (thumbInfo) => {
    if (!thumbInfo || thumbInfo.status !== 'ok' || thumbInfo.owner) {
      return thumbInfo;
    }
    const videoId = thumbInfo.videoId || thumbInfo.id;
    let found = null;
    if (videoId && !thumbInfo.isChannel && /^(sm|nm)\d+$/.test(videoId)) {
      try {
        found = await loadFromNicoad(videoId);
      } catch (e) {
        window.console.warn('投稿者情報の補完に失敗', videoId, e);
      }
    }
    if (found) {
      thumbInfo.owner = {
        type: 'user',
        id: found.id,
        linkId: `user/${found.id}`,
        name: found.name || '(非公開ユーザー)',
        url: `https://www.nicovideo.jp/user/${found.id}`,
        icon: (found.icon || BLANK_ICON).replace(/^http:/, 'https:'),
        isSupplemented: true
      };
    } else {
      thumbInfo.owner = {
        type: thumbInfo.isChannel ? 'channel' : 'user',
        id: '',
        linkId: '',
        name: '(投稿者情報なし)',
        url: '#',
        icon: BLANK_ICON,
        isSupplemented: true
      };
    }
    return thumbInfo;
  };

  return {supplementThumbInfo, loadFromNicoad};
})();

//===END===

export {OwnerSupplement};
