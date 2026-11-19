import {RequestDiagnostics} from '../infra/RequestDiagnostics';
import {util} from '../../../../src/util';
// GENERATED FROM tools/typescript-stage1/nico-src/TagEditApi.ts (Task475). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RequestDiagnostics
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
    _headers(editKey) {
        return {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Frontend-Id': 6,
            'X-Frontend-Version': 0,
            'X-Request-With': 'https://www.nicovideo.jp',
            'X-Niconico-Language': 'ja-jp',
            'X-Tag-Edit-Key': editKey,
        };
    }
    /** Resolves `data` of GET /v2/videos/{id}/tags after validating the tag list used by TagListView. */
    load(videoId, editKey, { onEditKeyUpdate } = {}) {
        const url = `https://nvapi.nicovideo.jp/v2/videos/${videoId}/tags`;
        return this._requestWithKeyRetry({ videoId, editKey, onEditKeyUpdate, label: 'タグ一覧の取得',
            request: (key) => ({ url, options: { method: 'GET', credentials: 'include', headers: this._headers(key) } })
        });
    }
    async add({ videoId, tag, csrfToken, editKey, ownerLock = 0, onEditKeyUpdate }) {
        const encodedTag = encodeURIComponent(tag);
        const url = `https://nvapi.nicovideo.jp/v2/videos/${videoId}/tags?tag=${encodedTag}`;
        return this._requestWithKeyRetry({ videoId, editKey, onEditKeyUpdate, label: 'タグの追加',
            request: (key) => ({ url, options: { method: 'POST', credentials: 'include', headers: this._headers(key) } })
        });
    }
    async remove({ videoId, tag = '', id, csrfToken, editKey, ownerLock = 0, onEditKeyUpdate }) {
        const encodedTag = encodeURIComponent(tag);
        const url = `https://nvapi.nicovideo.jp/v2/videos/${videoId}/tags?tag=${encodedTag}`;
        return this._requestWithKeyRetry({ videoId, editKey, onEditKeyUpdate, label: 'タグの削除',
            request: (key) => ({ url, options: { method: 'DELETE', credentials: 'include', headers: this._headers(key) } })
        });
    }
    async _requestWithKeyRetry({ videoId, editKey, onEditKeyUpdate, label, request }) {
        try {
            return await this._requestOnce(request(editKey), label);
        }
        catch (err) {
            if (!err || err.kind !== 'KEY_EXPIRED') {
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
    async _requestOnce({ url, options }, label) {
        const diag = typeof RequestDiagnostics === 'undefined' ? undefined : RequestDiagnostics;
        const operation = options.method === 'POST' ? 'tag-add' : options.method === 'DELETE' ? 'tag-remove' : 'tags';
        const ticket = diag?.begin(operation, url.split('?')[0], 'response');
        let res;
        let json;
        try {
            res = await util.fetch(url, ticket ? { ...options, diagnosticActive: () => false } : options);
            json = await res.json();
        }
        catch (cause) {
            ticket?.failure(diag?.readFailure(res, cause));
            if (!res) {
                throw Object.assign(new Error(`${label}に失敗しました（通信エラー）`), { kind: 'NETWORK', cause });
            }
            throw Object.assign(new Error(`${label}に失敗しました（${res.status}）`), { kind: 'API', status: res.status, errorCode: '', response: null });
        }
        const meta = json?.meta;
        const status = res.status >= 200 && res.status < 300 && typeof meta?.status === 'number' ? meta.status : res.status;
        const errorCode = meta?.errorCode || '';
        const rejected = this._rejected(res, meta);
        // Only replay a rejected key. Server failures and uncertain write outcomes must not replay a mutation.
        const keyRejected = (errorCode === 'KEY_EXPIRED' && ((status >= 200 && status < 300) || (status >= 400 && status < 500))) ||
            (status === 403 && errorCode === 'FORBIDDEN') ||
            (status >= 400 && status < 500 && !errorCode && typeof meta?.errorMessage === 'string' &&
                /\bKEY_EXPIRED\b/.test(meta.errorMessage));
        if (keyRejected) {
            ticket?.failure(diag?.responseFailure(res, meta));
            throw Object.assign(new Error(`${label}に失敗しました（タグ編集キーが無効または期限切れ: ${status} ${errorCode}）`), { kind: 'KEY_EXPIRED', status, errorCode });
        }
        const data = json?.data;
        const tags = data?.tags;
        const missing = !Array.isArray(tags) ? 'data.tags' : tags.some(row => typeof row?.name !== 'string' || !row.name.trim()) ? 'data.tags[].name' : undefined;
        if (rejected || missing) {
            ticket?.failure(diag?.responseFailure(res, meta, rejected ? 'meta.status' : missing));
            const detail = [status, errorCode, meta?.errorMessage].filter(Boolean).join(' ');
            throw Object.assign(new Error(`${label}に失敗しました${detail ? `（${detail}）` : ''}`), { kind: 'API', status, errorCode, response: json });
        }
        if (data?.error_msg) {
            // Older replies can carry usable tag rows alongside a rejected operation.
            ticket?.failure({ kind: 'service', httpStatus: res.status, apiStatus: meta?.status });
        }
        else {
            ticket?.success();
        }
        return data;
    }
    // Older watch and tags replies may omit meta.status. A supplied status must agree with HTTP.
    _rejected(res, meta) {
        const apiStatus = meta?.status;
        return res.status < 200 || res.status >= 300 || !!meta?.errorCode ||
            (apiStatus !== undefined && (typeof apiStatus !== 'number' || !Number.isInteger(apiStatus) ||
                apiStatus < 200 || apiStatus >= 300));
    }
    _createActionTrackId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let s = '';
        for (let i = 0; i < 10; i++) {
            s += chars[Math.floor(Math.random() * chars.length)];
        }
        return `${s}_${Date.now()}`;
    }
    async _refreshEditKey(videoId) {
        const query = new URLSearchParams({
            _frontendId: '6', _frontendVersion: '0', actionTrackId: this._createActionTrackId(),
            noSideEffect: 'true', skips: 'adult', t: String(Date.now())
        });
        const url = `https://www.nicovideo.jp/api/watch/v3/${encodeURIComponent(videoId)}?${query.toString()}`;
        const diag = typeof RequestDiagnostics === 'undefined' ? undefined : RequestDiagnostics;
        const ticket = diag?.begin('tag-key', videoId, 'response');
        let res;
        let json;
        try {
            res = await util.fetch(url, { credentials: 'include', ...(ticket ? { diagnosticActive: () => false } : {}) });
            json = await res.json();
        }
        catch (cause) {
            ticket?.failure(diag?.readFailure(res, cause));
            throw Object.assign(new Error('タグ編集キーの再取得に失敗しました（通信エラー）'), { kind: 'NETWORK', cause });
        }
        if (this._rejected(res, json?.meta)) {
            ticket?.failure(diag?.responseFailure(res, json?.meta, 'meta.status'));
            throw Object.assign(new Error('タグ編集キーの再取得に失敗しました'), { kind: 'API', status: res.status });
        }
        const editKey = json?.data?.tag?.edit?.editKey;
        if (typeof editKey !== 'string' || !editKey.trim()) {
            ticket?.failure(diag?.responseFailure(res, json?.meta, 'data.tag.edit.editKey'));
            throw Object.assign(new Error('タグ編集キーが返却されませんでした'), { kind: 'NO_KEY', response: json });
        }
        ticket?.success();
        return editKey;
    }
    _buildQuery(params) {
        const t = [];
        Object.keys(params).forEach((key) => {
            t.push(`${key}=${encodeURIComponent(params[key])}`);
        });
        return t.join('&');
    }
}
//===END===
export {TagEditApi};
