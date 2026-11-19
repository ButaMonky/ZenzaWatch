import {RequestDiagnostics} from '../infra/RequestDiagnostics';
import {netUtil} from '../infra/netUtil';
import {CacheStorage} from '../infra/CacheStorage';
import {Emitter} from '../Emitter';
const emitter = new Emitter();
// GENERATED FROM tools/typescript-stage1/nico-src/MylistApiLoader.ts (Task471). Edit the .ts and run npm run nico:sync.
//===BEGIN===
//@require RequestDiagnostics
const MylistApiLoader = (() => {
    // マイリスト/あとで見るの取得APIには
    // www.nicovideo.jp配下とflapi.nicovideo.jp配下の２種類がある
    // 他人のマイリストを取得するにはflapi、マイリストの編集にはwwwのapiが必要
    // データのフォーマットが微妙に異なるのでめんどくさい
    //
    // おかげでソート処理が悲しいことに
    //
    // #261: Authenticated identity cannot be inferred from a URL or a tab's
    // sessionStorage. Never persist or reuse CSRF credentials across logins.
    const createMylistError = (message, { status = 'fail', result, code, cause } = {}) => {
        const error = new Error(message);
        error.status = status;
        if (result !== undefined) {
            error.result = result;
        }
        if (code !== undefined) {
            error.code = code;
        }
        if (cause !== undefined) {
            error.cause = cause;
        }
        return error;
    };
    let cacheStorage = null;
    let token = '';
    if (window.ZenzaWatch) {
        emitter.on('csrfTokenUpdate', (t) => {
            // Keep the event API for consumers, but not a reusable auth cache.
            token = t;
        });
    }
    class MylistApiLoader {
        constructor() {
            if (!cacheStorage) {
                cacheStorage = new CacheStorage(sessionStorage);
            }
            // Drop credentials and private list entries stored by previous versions.
            cacheStorage.removeItem('csrfToken');
            cacheStorage.removeItem('mylistList');
        }
        setCsrfToken(t) {
            // Compatibility entry for live token events; not persisted or trusted as
            // evidence of the viewer when a write operation needs a fresh token.
            token = t;
        }
        async _getCsrfToken() {
            // The CSRF token is tied to the authenticated page, not a fixed key
            // with a 59-minute TTL. Fetch it anew so switching A -> B cannot reuse A.
            const tokenUrl = 'https://www.nicovideo.jp/my/mylist';
            let page;
            try {
                page = await netUtil.fetch(tokenUrl, { credentials: 'include' })
                    .then((r) => r.text());
            }
            catch (_) {
                token = '';
                throw createMylistError('マイリストトークン取得失敗');
            }
            try {
                const dom = new DOMParser().parseFromString(page, 'text/html');
                const element = dom.querySelector('#js-initial-userpage-data');
                const rawEnvironment = element?.getAttribute('data-environment');
                if (!rawEnvironment) {
                    throw new Error('missing environment');
                }
                const env = JSON.parse(rawEnvironment);
                const csrfToken = env?.csrfToken;
                if (typeof csrfToken !== 'string' || !csrfToken.trim()) {
                    throw new Error('missing CSRF token');
                }
                token = csrfToken;
                return csrfToken;
            }
            catch (_) {
                token = '';
                throw createMylistError('マイリストトークン取得失敗（認証情報がありません）');
            }
        }
        async _readList(url, kind, frontendId, frontendVersion, isCurrent) {
            const label = kind === 'watchLater' ? 'あとで見る' : kind === 'mylists' ? 'マイリスト一覧' : 'マイリスト';
            const ensureCurrent = () => {
                if (!isCurrent) {
                    return;
                }
                let current = false;
                try {
                    current = isCurrent() === true;
                }
                catch (_) { /* A disposed owner is stale. */ }
                if (!current) {
                    throw createMylistError(label + '取得中止（動画が変更されました）', { code: 'STALE' });
                }
            };
            ensureCurrent();
            let response;
            let result;
            try {
                response = await netUtil.fetch(url, {
                    headers: { 'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion }, credentials: 'include',
                    ...(typeof RequestDiagnostics !== 'undefined' && isCurrent ? { diagnosticActive: isCurrent } : {})
                });
                result = await response.json();
            }
            catch (cause) {
                ensureCurrent();
                const wrapped = createMylistError(label + 'の取得失敗(2)', { cause, ...(kind === 'mylists' ? { result: cause } : {}) });
                if (typeof RequestDiagnostics !== 'undefined') {
                    Object.assign(wrapped, RequestDiagnostics.readFailure(response, cause));
                }
                throw wrapped;
            }
            ensureCurrent();
            const failure = (missing, code, message = label + 'の取得失敗(1)') => {
                const wrapped = createMylistError(message, { code: code ?? result?.error?.code, ...(kind === 'mylists' ? { result } : {}) });
                if (typeof RequestDiagnostics !== 'undefined') {
                    const meta = result?.meta && { status: result.meta.status, errorCode: result.meta.errorCode ?? result?.error?.code };
                    Object.assign(wrapped, RequestDiagnostics.responseFailure(response, meta, missing));
                }
                return wrapped;
            };
            if (response.status >= 300 || result?.meta?.status !== 200 || result?.meta?.errorCode || result?.error?.code) {
                throw failure('meta.status');
            }
            const page = kind === 'mylists' ? undefined : result.data?.[kind];
            const items = kind === 'mylists' ? result.data?.mylists : page?.items;
            if (!Array.isArray(items)) {
                throw failure(kind === 'mylists' ? 'data.mylists' : 'data.' + kind + '.items');
            }
            if (kind === 'mylists' && items.some(group => {
                const id = group?.id;
                return !(typeof id === 'string' && id.trim()) && !(typeof id === 'number' && Number.isSafeInteger(id));
            })) {
                throw failure('data.mylists');
            }
            if (page?.hasNext !== undefined && typeof page.hasNext !== 'boolean') {
                throw failure('data.' + kind + '.hasNext');
            }
            return { items: items, hasNext: page?.hasNext === true, failure };
        }
        // Stop a single-item lookup as soon as the matching row is available.
        async _scanItems(kind, id, frontendId, frontendVersion, watchId, isCurrent) {
            const execute = async () => {
                const url = kind === 'watchLater' ?
                    'https://nvapi.nicovideo.jp/v1/users/me/watch-later?sortKey=addedAt&sortOrder=desc&' :
                    `https://nvapi.nicovideo.jp/v1/users/me/mylists/${encodeURIComponent(id)}?`;
                const query = new URLSearchParams({ pageSize: '100', page: '1' });
                const results = [];
                const fingerprints = new Set();
                const label = kind === 'watchLater' ? 'あとで見る' : 'マイリスト';
                const field = 'data.' + kind + '.items';
                for (let page = 1; page <= 100; page++) {
                    query.set('page', String(page));
                    const { items, hasNext, failure } = await this._readList(url + query.toString(), kind, frontendId, frontendVersion, isCurrent);
                    if (items.some(item => !item || typeof item !== 'object')) {
                        throw failure(field);
                    }
                    if (watchId !== undefined) {
                        const found = items.find(item => item.watchId === watchId);
                        if (found) {
                            if (!(typeof found.itemId === 'number' && Number.isSafeInteger(found.itemId)) &&
                                !(typeof found.itemId === 'string' && found.itemId.trim())) {
                                throw failure(field);
                            }
                            return [found];
                        }
                    }
                    if (hasNext && !items.length) {
                        throw failure(field, 'INVALID_PAGE', label + 'の取得失敗（空ページが連続）');
                    }
                    if (items.length) {
                        const fingerprint = JSON.stringify(items.map(item => [item.itemId, item.watchId]));
                        if (fingerprints.has(fingerprint)) {
                            throw failure(field, 'REPEATED_PAGE', label + 'の取得失敗（ページが重複）');
                        }
                        fingerprints.add(fingerprint);
                    }
                    if (watchId === undefined) {
                        results.push(...items);
                    }
                    if (!hasNext) {
                        return results;
                    }
                }
                throw createMylistError(label + 'の取得失敗（ページ数の安全上限）', { code: 'PAGE_LIMIT' });
            };
            return typeof RequestDiagnostics === 'undefined' ? execute() :
                RequestDiagnostics.observe('mylist', JSON.stringify([kind, id]), execute, Array.isArray, () => !isCurrent || isCurrent());
        }
        async _getDeflistItems(frontendId = 6, frontendVersion = 0, watchId, isCurrent) {
            return this._scanItems('watchLater', null, frontendId, frontendVersion, watchId, isCurrent);
        }
        async _getMylistItems(id, frontendId = 6, frontendVersion = 0, watchId, isCurrent) {
            return this._scanItems('mylist', id, frontendId, frontendVersion, watchId, isCurrent);
        }
        async getMylistList({ frontendId = 6, frontendVersion = 0, isCurrent } = {}) {
            const execute = async () => {
                // /users/me/mylists must always reflect the currently signed-in viewer.
                const result = await this._readList('https://nvapi.nicovideo.jp/v1/users/me/mylists', 'mylists', frontendId, frontendVersion, isCurrent);
                return result.items;
            };
            return typeof RequestDiagnostics === 'undefined' ? execute() :
                RequestDiagnostics.observe('mylist', 'lists', execute, Array.isArray, () => !isCurrent || isCurrent());
        }
        async findDeflistItemByWatchId(watchId, { frontendId = 6, frontendVersion = 0, isCurrent } = {}) {
            const items = await this._getDeflistItems(frontendId, frontendVersion, watchId, isCurrent);
            for (let item of items) {
                if (item.watchId === watchId) {
                    return item;
                }
            }
            throw createMylistError('動画が見つかりません', {
                status: 'not_found',
                code: 'NOT_FOUND',
                result: { watchId, list: 'watchLater' }
            });
        }
        async findMylistItemByWatchId(watchId, groupId, { frontendId = 6, frontendVersion = 0, isCurrent } = {}) {
            const items = await this._getMylistItems(groupId, frontendId, frontendVersion, watchId, isCurrent);
            for (let item of items) {
                if (item.watchId === watchId) {
                    return item;
                }
            }
            throw createMylistError('動画が見つかりません', {
                status: 'not_found',
                code: 'NOT_FOUND',
                result: { watchId, groupId, list: 'mylist' }
            });
        }
        async _writeItem(operation, url, watchId, groupId, frontend, label, body, onConfirmed, allowDuplicate = false) {
            const { frontendId = 6, frontendVersion = 0, isCurrent } = frontend;
            const active = () => {
                try {
                    return !isCurrent || isCurrent() === true;
                }
                catch (_) {
                    return false;
                }
            };
            const staleError = () => createMylistError('操作中止（動画が変更されました）', { code: 'STALE' });
            if (!active()) {
                throw staleError();
            }
            const scope = JSON.stringify([watchId, groupId === null ? null : String(groupId)]);
            const ticket = typeof RequestDiagnostics === 'undefined' ? null :
                RequestDiagnostics.begin(operation, scope, 'response', active, watchId);
            const adding = body !== undefined;
            let response;
            let result;
            try {
                response = await netUtil.fetch(url, {
                    method: adding ? 'POST' : 'DELETE',
                    ...(adding ? { body } : {}),
                    headers: {
                        ...(adding ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
                        'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion,
                        'X-Request-With': 'https://www.nicovideo.jp'
                    },
                    credentials: 'include', ...(ticket ? { diagnosticActive: () => false } : {})
                });
                result = await response.json();
            }
            catch (cause) {
                if (ticket) {
                    ticket.failure(RequestDiagnostics.readFailure(response, cause));
                }
                if (!active()) {
                    throw staleError();
                }
                throw createMylistError(label + (adding ? '失敗(200)' : '失敗(2)'), { result: cause, cause });
            }
            if (!active()) {
                ticket?.failure({ name: 'AbortError' });
                throw staleError();
            }
            // Older fetch adapters omit HTTP status. When present, it must confirm the body.
            const wire = response.status;
            const httpOk = wire === undefined || (wire >= 200 && wire < 300);
            const api = result?.meta?.status;
            const code = result?.meta?.errorCode || result?.error?.code;
            if (allowDuplicate && api === 409 && (httpOk || wire === 409)) {
                // The existing entry is intact. A duplicate cannot confirm recovery of a failed write.
                ticket?.failure({ name: 'AbortError' });
                return { status: 'ok', result, message: 'あとで見るに登録済み（既存の登録を保持しました）' };
            }
            if (!httpOk || !(api === 200 || (adding && api === 201)) || code) {
                if (ticket) {
                    ticket.failure(wire === 0 ? { kind: 'network' } :
                        RequestDiagnostics.responseFailure(response, { status: api, errorCode: code }, 'meta.status'));
                }
                const description = result?.error?.description;
                const message = typeof description === 'string' && description ? description :
                    label + (adding ? '失敗(100)' : '失敗(1)');
                throw createMylistError(message, { result, code: result?.error?.code ?? result?.meta?.errorCode });
            }
            ticket?.success();
            onConfirmed();
            return { status: 'ok', result, message: label };
        }
        async removeDeflistItem(watchId, frontend = {}) {
            const item = await this.findDeflistItemByWatchId(watchId, frontend);
            const url = 'https://nvapi.nicovideo.jp/v1/users/me/watch-later?itemIds=' + encodeURIComponent(String(item.itemId));
            return this._writeItem('watch-later-remove', url, watchId, null, frontend, 'あとで見るから削除', undefined, () => {
                cacheStorage.removeItem('deflistItems');
                emitter.emitAsync('deflistRemove', watchId);
            });
        }
        async removeMylistItem(watchId, groupId, frontend = {}) {
            const item = await this.findMylistItemByWatchId(watchId, groupId, frontend);
            const url = 'https://nvapi.nicovideo.jp/v1/users/me/mylists/' + encodeURIComponent(groupId) +
                '/items?itemIds=' + encodeURIComponent(String(item.itemId));
            return this._writeItem('mylist-remove', url, watchId, groupId, frontend, 'マイリストから削除', undefined, () => {
                cacheStorage.removeItem(`mylistItems: ${groupId}`);
                emitter.emitAsync('mylistRemove', watchId, groupId);
            });
        }
        async addDeflistItem(watchId, description, isRetry = false, frontend = {}) {
            const url = 'https://nvapi.nicovideo.jp/v1/users/me/watch-later';
            const body = 'watchId=' + encodeURIComponent(watchId) + '&memo=' + encodeURIComponent(description || '');
            return this._writeItem('watch-later-add', url, watchId, null, frontend, 'あとで見る登録', body, () => {
                cacheStorage.removeItem('deflistItems');
                emitter.emitAsync('deflistAdd', watchId, description);
            }, !isRetry);
        }
        async addMylistItem(watchId, groupId, description, frontend = {}) {
            const body = 'itemId=' + encodeURIComponent(watchId) + '&description=' + encodeURIComponent(description || '');
            const url = 'https://nvapi.nicovideo.jp/v1/users/me/mylists/' + encodeURIComponent(groupId) + '/items?' + body;
            return this._writeItem('mylist-add', url, watchId, groupId, frontend, 'マイリスト登録', body, () => {
                cacheStorage.removeItem(`mylistItems: ${groupId}`);
                emitter.emitAsync('mylistAdd', watchId, groupId, description);
                // A confirmed add moves the entry out of watch-later. A failed cleanup cannot undo the add.
                this.removeDeflistItem(watchId, frontend).catch(() => { });
            });
        }
    }
    return new MylistApiLoader();
})();
//===END===
export {MylistApiLoader};
