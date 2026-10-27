import {netUtil} from '../infra/netUtil';
import {NVApi} from './NVApi';

//===BEGIN===
//@require NVApi

/**
 * いいね！の登録・解除。
 *
 * 【Task 066】Codexのニコニコ解析（NICO-LIKES-20260913-RELATED）で、
 * ブラウザの /v1/users/me/likes/items?videoId=... は POST=201・DELETE=200
 * で成功することを実通信で確認済み。以前はHTTP/APIのエラーでも応答を
 * そのまま「成功」として返していたため、呼び出し側が「ｨｨﾈ!!」と表示して
 * 手元の状態だけ反転させてしまっていた。成功(2xx)以外は reject する。
 */
const LikeApi = {
  call: async (videoId, method = 'POST') => {
    const api = 'https://nvapi.nicovideo.jp/v1/users/me/likes/items';
    const url = `${api}?videoId=${videoId}`;
    const label = method === 'DELETE' ? 'いいね！の解除' : 'いいね！';
    const res = await NVApi.call(url, {method});
    if (!res) {
      // NVApi.call は通信失敗時に undefined を返す
      throw Object.assign(new Error(`${label}に失敗しました（通信エラー）`), {kind: 'NETWORK'});
    }
    let json = null;
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }
    const meta = (json && json.meta) || {};
    const status = typeof meta.status === 'number' ? meta.status : res.status;
    if (status < 200 || status >= 300) {
      const detail = [status, meta.errorCode].filter(Boolean).join(' ');
      throw Object.assign(new Error(`${label}に失敗しました（${detail}）`),
        {kind: 'API', status, errorCode: meta.errorCode, response: json});
    }
    return json || {meta: {status}};
  },
  like: videoId => LikeApi.call(videoId, 'POST'),
  unlike: videoId => LikeApi.call(videoId, 'DELETE')
};

//===END===
// {"meta":{"status":201},"data":{"thanksMessage": 'hogehoge'}}
export {LikeApi};