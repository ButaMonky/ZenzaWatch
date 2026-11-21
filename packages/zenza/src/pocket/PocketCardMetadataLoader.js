// GENERATED FROM packages/zenza/src/pocket/PocketCardMetadataLoader.ts (Task210). Do not edit this JS.
// SOURCE_SHA256 c46333c69e7f01b75fb919e7f18471e514ec966a8845621c8eccd51df406aff4
//===BEGIN===
const PocketCardMetadataLoader = (() => {
    const API = 'https://nvapi.nicovideo.jp/v1/videos?watchIds=';
    const OK_TTL_MS = 10 * 60 * 1000;
    const FAILED_TTL_MS = 30 * 1000;
    const MAX_CACHE = 200;
    const cache = new Map();
    const inFlight = new Map();
    const asRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ?
        value : null;
    const safeId = (id) => typeof id === 'string' &&
        /^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/.test(id);
    const validLike = (n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
    const normalizeOwner = (raw) => {
        if (!raw || typeof raw !== 'object' || raw.visibility === 'hidden') {
            return null;
        }
        const value = raw;
        const type = value.ownerType || value.type;
        const rawId = String(value.id ?? '');
        const isUser = type === 'user' && /^\d+$/.test(rawId);
        const isChannel = type === 'channel' && /^(?:ch)?\d+$/.test(rawId);
        if (!isUser && !isChannel) {
            return null;
        }
        const id = isChannel ? rawId.replace(/^ch/, '') : rawId;
        const name = typeof value.name === 'string' && value.name.trim() ?
            value.name.trim() : '(投稿者情報なし)';
        const icon = typeof value.iconUrl === 'string' &&
            /^https?:\/\//i.test(value.iconUrl) ? value.iconUrl.replace(/^http:/i, 'https:') : '';
        const url = isUser ? `https://www.nicovideo.jp/user/${id}` :
            `https://ch.nicovideo.jp/ch${id}`;
        return { type: isUser ? 'user' : 'channel', id, name, icon, url };
    };
    // Carry only documented thumbnail URL fields from the already requested video
    // metadata. Selection belongs to ThumbnailSourcePolicy, not this transport.
    const normalizeThumbnail = (raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return null;
        }
        const record = raw;
        const result = {};
        for (const key of ['ogp', 'player', 'large', 'largeUrl', 'middle', 'middleUrl', 'normal', 'url']) {
            const value = record[key];
            if (typeof value !== 'string') {
                continue;
            }
            try {
                const url = new URL(value);
                if (/^https?:$/.test(url.protocol) && !url.username && !url.password) {
                    result[key] = value;
                }
            }
            catch (_) { /* malformed metadata cannot become an image source */ }
        }
        return Object.keys(result).length ? result : null;
    };
    const parse = (payload, requestedId) => {
        const outer = asRecord(payload);
        const meta = asRecord(outer?.meta);
        const data = asRecord(outer?.data);
        if (meta?.status !== 200 || !Array.isArray(data?.items)) {
            return null;
        }
        const item = data.items.find(row => asRecord(row)?.watchId === requestedId);
        const video = asRecord(asRecord(item)?.video);
        if (!video || !safeId(video.id)) {
            return null;
        }
        if (/^(?:sm|nm|so|ss)/.test(requestedId) && video.id !== requestedId) {
            return null;
        }
        const like = asRecord(video.count)?.like;
        return {
            videoId: video.id,
            likeCount: validLike(like) ? like : null,
            owner: normalizeOwner(video.owner),
            thumbnail: normalizeThumbnail(video.thumbnail)
        };
    };
    const query = async (watchId, fetcher) => {
        const fetchApi = fetcher || (typeof netUtil !== 'undefined' ? netUtil.fetch.bind(netUtil) : fetch);
        const url = API + encodeURIComponent(watchId);
        const diagnostics = typeof window === 'undefined' ? undefined :
            window.ZenzaLib?.RequestDiagnostics;
        const ticket = typeof diagnostics?.readFailure === 'function' && typeof diagnostics.responseFailure === 'function'
            ? diagnostics.begin('pocket-metadata', watchId, 'response', undefined, undefined, { url, method: 'GET' }) : undefined;
        let response;
        try {
            response = await fetchApi(url, { credentials: 'omit', timeout: 6000, headers: { 'X-Frontend-Id': '6', 'X-Frontend-Version': '0' } });
            if (!response?.ok) {
                ticket?.failure({ httpStatus: response?.status });
                return null;
            }
            const payload = await response.json();
            const outer = asRecord(payload), items = asRecord(outer?.data)?.items;
            const failure = diagnostics?.responseFailure?.(response, outer?.meta, Array.isArray(items) ? undefined : 'data.items');
            if (failure)
                ticket?.failure(failure);
            else
                ticket?.success();
            return parse(payload, watchId);
        }
        catch (error) {
            ticket?.failure(diagnostics?.readFailure(response, error));
            throw error;
        }
    };
    const load = (watchId, fetcher) => {
        if (!safeId(watchId)) {
            return Promise.resolve(null);
        }
        const now = Date.now();
        const old = cache.get(watchId);
        if (old && old.expires > now) {
            return Promise.resolve(old.value);
        }
        if (inFlight.has(watchId)) {
            return inFlight.get(watchId);
        }
        const pending = Promise.resolve()
            .then(() => query(watchId, fetcher))
            .catch(() => null)
            .then(value => {
            cache.delete(watchId);
            cache.set(watchId, { value, expires: Date.now() + (value ? OK_TTL_MS : FAILED_TTL_MS) });
            if (cache.size > MAX_CACHE) {
                cache.delete(cache.keys().next().value);
            }
            return value;
        })
            .finally(() => inFlight.delete(watchId));
        inFlight.set(watchId, pending);
        return pending;
    };
    return { load, parse, normalizeOwner, validLike };
})();
//===END===
export {PocketCardMetadataLoader};
