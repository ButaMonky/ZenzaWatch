/**
 * Canonical TypeScript source for packages/lib/src/nico/TagEditApi.js (Task475).
 * nvapi v2 tag list/add/remove with one X-Tag-Edit-Key refresh-and-retry.
 * The obsolete www.nicovideo.jp/tag_edit notes that followed the legacy
 * module are kept in docs/design-pack/TASK475_NICOAPI_TS_TAG_EDIT.md.
 */
import type {NetFetchOptions, UnknownPropertyBag} from './NicoApiTypes';

/** src/util.js `util.fetch` (same contract as netUtil.fetch). */
declare const util: {fetch(url: string, options?: NetFetchOptions): Promise<Response>};

export type TagEditErrorKind = 'NETWORK' | 'API' | 'KEY_EXPIRED' | 'NO_KEY';
export interface TagEditError extends Error {
  kind: TagEditErrorKind;
  status?: number;
  errorCode?: unknown;
  response?: unknown;
  cause?: unknown;
}
export type TagEditHeaders = Record<string, string | number>;
export interface TagEditRequest {
  url: string;
  options: {method: 'GET' | 'POST' | 'DELETE'; credentials: RequestCredentials; headers: TagEditHeaders};
}
export interface TagEditCallbacks {
  /** Receives a refreshed edit key so the caller can reuse it for later edits. */
  onEditKeyUpdate?: ((editKey: string) => void) | undefined;
}
export interface TagEditChange extends TagEditCallbacks {
  videoId: string;
  tag?: string;
  editKey: string;
  /** Accepted for legacy callers; the nvapi v2 endpoint does not use these. */
  id?: unknown;
  csrfToken?: unknown;
  ownerLock?: number;
}
interface TagEditRetry extends TagEditCallbacks {
  videoId: string;
  editKey: string;
  label: string;
  request: (key: string) => TagEditRequest;
}
/** Only `data.tag.edit.editKey` is read; it is forwarded as the header value. */
interface WatchV3EditKeyProbe {
  readonly data?: {readonly tag?: {readonly edit?: {readonly editKey?: string}}};
}

/**
 * タグ一覧の取得・追加・削除（nvapi v2）。
 *
 * 【Task 066: タグ編集キー(X-Tag-Edit-Key)の期限切れ対策】
 * Codexのニコニコ解析（finding: NICO-FOLLOWUP-20260913-TAG-REFRESH）で、
 * 本家ブラウザの配信JSは、タグ操作が KEY_EXPIRED で失敗した場合に
 *   /api/watch/v3/{watchId}?noSideEffect=true&skips=adult&actionTrackId=...
 * で視聴情報を取り直し、tag.edit.editKey を使って元の操作を「1回だけ」
 * 再試行していることが分かった。
 * ZenzaWatchはページを離れずに長時間同じ動画を開いていることがあるため、
 * 動画を開いた時点のキーのまま操作すると期限切れになり得る。本家と同じ
 * 手順で1回だけ取り直して再試行する。
 * （KEY_EXPIRED の実応答・キーの寿命は解析資料でも未確認。2026-09-16に
 *   実機で不正なキーを送ると 403 FORBIDDEN になることは確認したため、
 *   KEY_EXPIRED と 403 FORBIDDEN の両方を再試行の対象にしている）
 *
 * あわせて、以前は失敗時にも result.data(undefined) を返していたため、
 * 呼び出し側(TagListView)で「更新中」のまま固まることがあった。
 * 失敗は必ず reject するようにした。
 */
class TagEditApi {

  _headers(editKey: string): TagEditHeaders {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Frontend-Id': 6,
      'X-Frontend-Version': 0,
      'X-Request-With': 'https://www.nicovideo.jp',
      'X-Niconico-Language': 'ja-jp',
      'X-Tag-Edit-Key': editKey,
    };
  }

  /** Resolves `data` of GET /v2/videos/{id}/tags as received (not schema-validated). */
  load(videoId: string, editKey: string, {onEditKeyUpdate}: TagEditCallbacks = {}): Promise<unknown> {
    const url = `https://nvapi.nicovideo.jp/v2/videos/${videoId}/tags`;
    return this._requestWithKeyRetry({videoId, editKey, onEditKeyUpdate, label: 'タグ一覧の取得',
      request: (key: string): TagEditRequest => ({url, options: {method: 'GET', credentials: 'include', headers: this._headers(key)}})
    });
  }

  async add({videoId, tag, csrfToken, editKey, ownerLock = 0, onEditKeyUpdate}: TagEditChange): Promise<unknown> {
    const encodedTag = encodeURIComponent(tag as string);
    const url = `https://nvapi.nicovideo.jp/v2/videos/${videoId}/tags?tag=${encodedTag}`;
    return this._requestWithKeyRetry({videoId, editKey, onEditKeyUpdate, label: 'タグの追加',
      request: (key: string): TagEditRequest => ({url, options: {method: 'POST', credentials: 'include', headers: this._headers(key)}})
    });
  }

  async remove({videoId, tag = '', id, csrfToken, editKey, ownerLock = 0, onEditKeyUpdate}: TagEditChange): Promise<unknown> {
    const encodedTag = encodeURIComponent(tag);
    const url = `https://nvapi.nicovideo.jp/v2/videos/${videoId}/tags?tag=${encodedTag}`;
    return this._requestWithKeyRetry({videoId, editKey, onEditKeyUpdate, label: 'タグの削除',
      request: (key: string): TagEditRequest => ({url, options: {method: 'DELETE', credentials: 'include', headers: this._headers(key)}})
    });
  }

  async _requestWithKeyRetry({videoId, editKey, onEditKeyUpdate, label, request}: TagEditRetry): Promise<unknown> {
    try {
      return await this._requestOnce(request(editKey), label);
    } catch (err) {
      if (!err || (err as TagEditError).kind !== 'KEY_EXPIRED') {
        throw err;
      }
      window.console.warn(`[TagEditApi] ${label}: タグ編集キーが期限切れのため、視聴情報から取り直して1回だけ再試行します`, videoId);
      const newKey = await this._refreshEditKey(videoId);
      if (typeof onEditKeyUpdate === 'function') {
        onEditKeyUpdate(newKey);
      }
      return await this._requestOnce(request(newKey), label);
    }
  }

  async _requestOnce({url, options}: TagEditRequest, label: string): Promise<unknown> {
    let res: Response, json: unknown = null;
    try {
      res = await util.fetch(url, options);
    } catch (e) {
      throw Object.assign(new Error(`${label}に失敗しました（通信エラー）`), {kind: 'NETWORK', cause: e});
    }
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }
    // Any truthy body is probed like the legacy JS (`json.meta`); primitives yield undefined.
    const meta = ((json && (json as UnknownPropertyBag).meta) || {}) as UnknownPropertyBag;
    const status: number = typeof meta.status === 'number' ? meta.status : res.status;
    const errorCode = meta.errorCode || '';
    // 2026-09-16の実機確認: 不正なキーを送ると 403 {errorCode:"FORBIDDEN"} が返った。
    // 期限切れのキーが KEY_EXPIRED と FORBIDDEN のどちらになるかは未確認のため、
    // 両方を「キーを取り直して1回だけ再試行する」対象にする（再試行は1回限りなので、
    // 本当に権限が無い場合も余計な通信は1往復で済む）。
    if (errorCode === 'KEY_EXPIRED' || /KEY_EXPIRED/.test(JSON.stringify(meta)) ||
        (status === 403 && errorCode === 'FORBIDDEN')) {
      throw Object.assign(new Error(`${label}に失敗しました（タグ編集キーが無効または期限切れ: ${status} ${errorCode}）`), {kind: 'KEY_EXPIRED', status, errorCode});
    }
    if (!json || status < 200 || status >= 300 || !(json as UnknownPropertyBag).data) {
      const detail = [status, errorCode, meta.errorMessage].filter(Boolean).join(' ');
      throw Object.assign(new Error(`${label}に失敗しました${detail ? `（${detail}）` : ''}`), {kind: 'API', status, errorCode, response: json});
    }
    return (json as UnknownPropertyBag).data;
  }

  _createActionTrackId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 10; i++) {
      s += chars[Math.floor(Math.random() * chars.length)] as string;
    }
    return `${s}_${Date.now()}`;
  }

  async _refreshEditKey(videoId: string): Promise<string> {
    const query = new URLSearchParams({
      _frontendId: 6,
      _frontendVersion: 0,
      actionTrackId: this._createActionTrackId(),
      noSideEffect: 'true',
      skips: 'adult',
      t: Date.now()
    } as unknown as Record<string, string>);
    const url = `https://www.nicovideo.jp/api/watch/v3/${encodeURIComponent(videoId)}?${query.toString()}`;
    let json: WatchV3EditKeyProbe | null = null;
    try {
      const res = await util.fetch(url, {credentials: 'include'});
      json = await res.json();
    } catch (e) {
      throw Object.assign(new Error('タグ編集キーの再取得に失敗しました（通信エラー）'), {kind: 'NETWORK', cause: e});
    }
    const editKey = json && json.data && json.data.tag && json.data.tag.edit && json.data.tag.edit.editKey;
    if (!editKey) {
      throw Object.assign(new Error('タグ編集キーが返却されませんでした'), {kind: 'NO_KEY', response: json});
    }
    return editKey;
  }

  _buildQuery(params: Record<string, string | number | boolean>): string {
    const t: string[] = [];
    Object.keys(params).forEach((key: string) => {
      t.push(`${key}=${encodeURIComponent(params[key] as string | number | boolean)}`);
    });
    return t.join('&');
  }
}

export {TagEditApi};
