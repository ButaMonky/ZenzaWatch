import {netUtil} from '../infra/netUtil';
import {CacheStorage} from '../infra/CacheStorage';
// GENERATED FROM tools/typescript-stage1/nico-src/PlaylistApiLoader.ts (Task463). Edit the .ts and run npm run nico:sync.
//===BEGIN===
const PlaylistApiLoader = (() => {
    const CACHE_EXPIRE_TIME = 5 * 60 * 1000;
    let cacheStorage = null;
    class PlaylistApiLoader {
        constructor() {
            if (!cacheStorage) {
                cacheStorage = new CacheStorage(sessionStorage);
            }
        }
        async load({ type, id, options, all, maxItems, isCurrent }, { frontendId = 6, frontendVersion = 0 } = {}) {
            const { url, cacheKey } = ((type) => {
                switch (type) {
                    case 'series':
                        return this._buildSeriesURL(id, options);
                    case 'user-uploaded':
                        return this._buildUserUploadedURL(id, options);
                    case 'mylist':
                        return this._buildMylistURL(id, options);
                    case 'watchlater':
                        return this._buildWatchlaterURL(options);
                    case 'search':
                        return this._buildSearchURL(options);
                    default:
                        return {};
                }
            })(type);
            if (url === undefined || cacheKey === undefined) {
                throw new Error(`プレイリストの取得失敗(3) ${type}`);
            }
            if (type !== 'search' && all !== false && (all === true || options?.page === undefined)) {
                return this._loadAll(type, url, maxItems, isCurrent, frontendId, frontendVersion);
            }
            // nvapi でソートされた結果をもらうのでそのままキャッシュする
            const cacheData = cacheStorage.getItem(cacheKey);
            if (cacheData) {
                return cacheData;
            }
            // nvapi に X-Frontend-Id header が必要
            const result = await netUtil.fetch(url, {
                headers: { 'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion },
                credentials: 'include',
            }).then((r) => r.json())
                .catch((e) => { throw new Error(`プレイリストの取得失敗(2) ${type}`, e); });
            if (result.meta.status !== 200 || !result.data.items) {
                throw new Error(`プレイリストの取得失敗(1) ${type}`, result);
            }
            const data = result.data.items;
            cacheStorage.setItem(cacheKey, data, CACHE_EXPIRE_TIME);
            return data;
        }
        // Task972: one atomic ordered collection, not the first 500-row page.
        async _loadAll(type, initialUrl, requestedMax, isCurrent, frontendId, frontendVersion) {
            const maxItems = typeof requestedMax === 'number' && Number.isFinite(requestedMax) && requestedMax > 0 ?
                Math.min(30000, Math.floor(requestedMax)) : 30000;
            const first = new URL(initialUrl);
            const rawSize = Number(first.searchParams.get('pageSize') || 500);
            const pageSize = Number.isInteger(rawSize) && rawSize > 0 ? Math.min(500, rawSize) : 500;
            first.searchParams.set('pageSize', String(pageSize));
            first.searchParams.set('page', '1');
            // A previous single-page array is never evidence of a complete collection.
            const cacheKey = `playlist; all-v1; ${maxItems}; ${first.href}`;
            const checkCurrent = () => {
                if (isCurrent && !isCurrent()) {
                    throw new Error('プレイリスト取得中止（表示対象が変更されました）');
                }
            };
            const expose = (value) => {
                const result = value.items.slice();
                Object.defineProperty(result, 'playlistLoadInfo', { value: {
                        totalCount: value.totalCount, limited: value.limited, maxItems: value.maxItems
                    }, enumerable: false });
                return result;
            };
            checkCurrent();
            const cached = cacheStorage.getItem(cacheKey);
            if (cached?.complete === true && Array.isArray(cached.items) && cached.maxItems === maxItems) {
                return expose(cached);
            }
            const items = [], seen = new Set();
            let totalCount = null, limited = false;
            // A broken API cannot keep a request alive indefinitely by repeating pages.
            const maxPages = Math.ceil(30000 / pageSize) + 1;
            for (let page = 1;; page++) {
                checkCurrent();
                if (page > maxPages) {
                    throw new Error('プレイリスト取得失敗（ページ数の安全上限）');
                }
                const url = new URL(first.href);
                url.searchParams.set('page', String(page));
                let result;
                for (let attempt = 0; attempt < 2; attempt++) {
                    checkCurrent();
                    try {
                        result = await netUtil.fetch(url.href, {
                            headers: { 'X-Frontend-Id': frontendId, 'X-Frontend-Version': frontendVersion },
                            credentials: 'include', timeout: 15000
                        }).then((r) => r.json());
                    }
                    catch (error) {
                        const status = error?.status ||
                            error?.statusCode;
                        if (attempt || [401, 403, 404].includes(Number(status))) {
                            throw new Error(`プレイリストの取得失敗(2) ${type} (${page}ページ目)`);
                        }
                        checkCurrent();
                        await new Promise(resolve => setTimeout(resolve, 400));
                        continue;
                    }
                    checkCurrent();
                    if (!attempt && Number(result?.meta?.status) >= 500) {
                        await new Promise(resolve => setTimeout(resolve, 400));
                        continue;
                    }
                    break;
                }
                checkCurrent();
                if (result?.meta?.status !== 200 || !Array.isArray(result?.data?.items)) {
                    throw new Error(`プレイリストの取得失敗(1) ${type} (${page}ページ目)`);
                }
                const data = result.data, batch = data.items;
                const count = data.totalCount;
                if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) {
                    totalCount = totalCount === null ? count : Math.max(totalCount, count);
                }
                if (!batch.length) {
                    if (data.hasNext === true || (totalCount !== null && (page - 1) * pageSize < totalCount)) {
                        throw new Error(`プレイリストの取得失敗（${page}ページ目が空です）`);
                    }
                    break;
                }
                const before = items.length;
                for (const item of batch) {
                    if (!item || typeof item !== 'object') {
                        throw new Error(`プレイリストの取得失敗（${page}ページ目のデータ形式）`);
                    }
                    const value = item;
                    const id = value.watchId ?? value.content?.id;
                    if (typeof id !== 'string' && typeof id !== 'number') {
                        throw new Error(`プレイリストの取得失敗（${page}ページ目の動画ID）`);
                    }
                    const key = String(id);
                    if (!seen.has(key)) {
                        seen.add(key);
                        items.push(item);
                    }
                }
                if (items.length === before) {
                    throw new Error('プレイリスト取得失敗（同じページが繰り返されました）');
                }
                const more = typeof data.hasNext === 'boolean' ? data.hasNext :
                    totalCount !== null ? page * pageSize < totalCount : batch.length >= pageSize;
                if (items.length >= maxItems) {
                    limited = items.length > maxItems || more;
                    items.length = maxItems;
                    break;
                }
                if (!more) {
                    break;
                }
            }
            checkCurrent();
            const value = { items, totalCount, limited, maxItems, complete: true };
            // Large collection cache writes are optional; never lose loaded items if
            // browser storage is full, or overwrite the live playlist with a partial page.
            try {
                cacheStorage.setItem(cacheKey, value, CACHE_EXPIRE_TIME);
            }
            catch (_) { /* CacheStorage is best-effort, not part of successful loading. */ }
            return expose(value);
        }
        // 動画シリーズ
        // https://nvapi.nicovideo.jp/v1/playlist/series/${seriesId}?sortOrder=${sortOrder}&sortKey=${sortKey}
        _buildSeriesURL(seriesId, options = {}) {
            const query = new URLSearchParams(options).toString();
            const url = `https://nvapi.nicovideo.jp/v1/playlist/series/${seriesId}${query ? '?' + query : ''}`;
            return { url, cacheKey: `playlist; ${url}` };
        }
        // ユーザー投稿
        // https://nvapi.nicovideo.jp/v1/playlist/user-uploaded/${userId}?sortOrder=${sortOrder}&sortKey=${sortKey}
        //
        // Task 041: cacheKeyはリクエストURLそのものから作る。
        // 以前は userId と sortKey/sortOrder だけを並べた文字列にしていたため、
        // それ以外のオプション（動画の種類の絞り込み、ページ指定など）が違っても
        // 同じキーになってしまい、**別の条件で読み込んだのに、直前に読み込んだ方の
        // 結果がキャッシュから返る**状態になっていた。
        // 返ってきたのが直前と同じ動画一覧なので、プレイリストへの追加時に
        // 「すべて重複」として弾かれ、「何も追加されない」ように見える
        // （キャッシュの有効期間は5分なので、再現したりしなかったりする）。
        // URLをそのままキーにすれば、条件が違えば必ずキーも違う。
        _buildUserUploadedURL(userId, options = {}) {
            const query = new URLSearchParams(Object.assign({ sortOrder: 'desc', sortKey: 'registeredAt' }, options));
            const url = `https://nvapi.nicovideo.jp/v1/playlist/user-uploaded/${userId}?${query.toString()}`;
            return { url, cacheKey: `playlist; ${url}` };
        }
        // マイリスト
        // https://nvapi.nicovideo.jp/v1/playlist/mylist/${mylistId}?sortOrder=${sortOrder}&sortKey=${sortKey}
        _buildMylistURL(mylistId, options = {}) {
            const query = new URLSearchParams(Object.assign({ sortOrder: 'asc', sortKey: 'registeredAt' }, options));
            const url = `https://nvapi.nicovideo.jp/v1/playlist/mylist/${mylistId}?${query.toString()}`;
            return { url, cacheKey: `playlist; ${url}` };
        }
        // 後で見る
        // https://nvapi.nicovideo.jp/v1/playlist/watch-later?sortOrder=${sortOrder}&sortKey=${sortKey}
        _buildWatchlaterURL(options = {}) {
            const query = new URLSearchParams(Object.assign({ sortOrder: 'asc', sortKey: 'registeredAt' }, options));
            const url = `https://nvapi.nicovideo.jp/v1/playlist/watch-later?${query.toString()}`;
            return { url, cacheKey: `playlist; ${url}` };
        }
        // 検索
        // https://nvapi.nicovideo.jp/v1/playlist/search?sortOrder=${sortOrder}&sortKey=${sortKey}&keyword=${keyword}&pageSize=${pageSize}&page=${page}
        _buildSearchURL(options = {}) {
            const query = new URLSearchParams(Object.assign({ sortOrder: 'desc', sortKey: 'registeredAt' }, options));
            const url = `https://nvapi.nicovideo.jp/v1/playlist/search?${query.toString()}`;
            return { url, cacheKey: `playlist; ${url}` };
        }
    }
    return new PlaylistApiLoader();
})();
//===END===
export {PlaylistApiLoader};
