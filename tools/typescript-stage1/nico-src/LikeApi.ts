/**
 * Canonical TypeScript source for packages/lib/src/nico/LikeApi.js (Task457).
 * Endpoint, HTTP methods, cookie mode, messages and error properties are the
 * pre-migration behavior; only types and documentation were added.
 */
import type {NVApiClient} from './NVApi';
import type {NicoApiErrorKind, NvapiWriteMethod, UnknownPropertyBag} from './NicoApiTypes';

/** Provided by the userscript bundle via `//@require NVApi`. */
declare const NVApi: NVApiClient;

/**
 * Successful result. The server body is returned as received and is NOT
 * schema-validated: callers must narrow it (ZenzaWatch only reads
 * `result.data.thanksMessage` defensively). When the body cannot be parsed,
 * `{meta: {status}}` from the HTTP status is returned instead.
 */
export type LikeApiResult = unknown;

/** Rejection reason. `errorCode` is an own property even when undefined. */
export interface LikeApiError extends Error {
  kind: NicoApiErrorKind;
  status?: number;
  errorCode?: unknown;
  response?: unknown;
}

export interface LikeApiClient {
  call(videoId: string, method?: NvapiWriteMethod): Promise<LikeApiResult>;
  like(videoId: string): Promise<LikeApiResult>;
  unlike(videoId: string): Promise<LikeApiResult>;
}

/**
 * いいね！の登録・解除。
 *
 * 【Task 066】Codexのニコニコ解析（NICO-LIKES-20260913-RELATED）で、
 * ブラウザの /v1/users/me/likes/items?videoId=... は POST=201・DELETE=200
 * で成功することを実通信で確認済み。以前はHTTP/APIのエラーでも応答を
 * そのまま「成功」として返していたため、呼び出し側が「ｨｨﾈ!!」と表示して
 * 手元の状態だけ反転させてしまっていた。成功(2xx)以外は reject する。
 */
const LikeApi: LikeApiClient = {
  call: async (videoId: string, method: NvapiWriteMethod = 'POST'): Promise<LikeApiResult> => {
    const api = 'https://nvapi.nicovideo.jp/v1/users/me/likes/items';
    const url = `${api}?videoId=${videoId}`;
    const label = method === 'DELETE' ? 'いいね！の解除' : 'いいね！';
    const res = await NVApi.call(url, {method});
    if (!res) {
      // NVApi.call は通信失敗時に undefined を返す
      throw Object.assign(new Error(`${label}に失敗しました（通信エラー）`), {kind: 'NETWORK'});
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }
    // Any truthy body is probed like the legacy JS (`json.meta`); primitives yield undefined.
    const meta = ((json && (json as UnknownPropertyBag).meta) || {}) as UnknownPropertyBag;
    const status: number = typeof meta.status === 'number' ? meta.status : res.status;
    if (status < 200 || status >= 300) {
      const detail = [status, meta.errorCode].filter(Boolean).join(' ');
      throw Object.assign(new Error(`${label}に失敗しました（${detail}）`),
        {kind: 'API', status, errorCode: meta.errorCode, response: json});
    }
    return json || {meta: {status}};
  },
  like: (videoId: string): Promise<LikeApiResult> => LikeApi.call(videoId, 'POST'),
  unlike: (videoId: string): Promise<LikeApiResult> => LikeApi.call(videoId, 'DELETE')
};

export {LikeApi};
