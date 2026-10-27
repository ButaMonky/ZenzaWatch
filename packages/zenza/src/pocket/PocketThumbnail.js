// GENERATED FROM packages/zenza/src/pocket/PocketThumbnail.ts (Task713). Do not edit this JS.
// SOURCE_SHA256 ac8b89534abbbd400a7778caeb15c4069af7bc19437cc2a711a2853f198b658f
//===BEGIN===
const PocketThumbnail = (() => {
    const CACHE_MS = 5 * 60 * 1000;
    const NEGATIVE_MS = 60 * 1000;
    const MAX_CACHE = 64;
    const cache = new Map();
    const pending = new Map();
    const imageOwners = new WeakMap();
    const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value) ?
        value : null;
    const normalize = (values) => {
        const urls = [];
        for (const value of values) {
            if (typeof value !== 'string' || !value.trim()) {
                continue;
            }
            try {
                const url = new URL(value);
                if (url.protocol === 'https:' || url.protocol === 'http:') {
                    const safe = url.protocol === 'http:' ? 'https:' + url.href.slice(5) : url.href;
                    if (!urls.includes(safe)) {
                        urls.push(safe);
                    }
                }
            }
            catch (_) { /* skip malformed image URL */ }
        }
        return urls;
    };
    const watchUrls = (payload) => {
        const outer = record(payload);
        const data = record(outer?.data);
        const response = record(data?.response) || record(outer?.response);
        const v4 = record(record(response?.$watchV4)?.data);
        const thumb = record(record((v4 || response)?.video)?.thumbnail);
        if (!thumb) {
            return [];
        }
        // Reuse the same official-CDN policy as PiP. Pocket retains an unknown
        // non-goptim OGP as last fallback; PiP intentionally excludes it.
        // Network/cache/image ownership remain local to this standalone helper.
        return normalize(ThumbnailSourcePolicy.select(thumb, [
            thumb.large, thumb.largeUrl, thumb.middle, thumb.middleUrl,
            thumb.normal, thumb.url
        ], { mode: 'smart', includeUnknownOgp: true }));
    };
    const legacyUrls = (thumbnail, hasLarge = false) => {
        const normal = normalize([thumbnail]);
        if (!normal.length) {
            return [];
        }
        const original = normal[0];
        // Do not alter signed URLs or URLs with search parameters.
        const large = hasLarge &&
            /^https:\/\/(?:nicovideo\.cdn\.nimg\.jp|tn\.smilevideo\.jp)\//.test(original) &&
            !/[?#]/.test(original) ?
            original.replace(/\.[ML]$/, '') + '.L' : '';
        return normalize([large, original]);
    };
    const install = (image, urls, isCurrent = () => true) => {
        const sources = normalize(urls);
        if (!sources.length || !isCurrent()) {
            return;
        }
        const token = {};
        imageOwners.set(image, token);
        let cursor = 0;
        const next = () => {
            if (imageOwners.get(image) !== token || !isCurrent()) {
                return;
            }
            if (cursor >= sources.length) {
                image.onerror = null;
                return;
            }
            const url = sources[cursor++];
            image.onerror = () => { next(); };
            image.src = url;
        };
        next();
    };
    const getHighQuality = async (watchId, fetcher, hostname) => {
        // Only for a user-opened info popup on the official www host.
        if (hostname !== 'www.nicovideo.jp' ||
            !/^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/.test(watchId)) {
            return [];
        }
        const now = Date.now();
        const saved = cache.get(watchId);
        if (saved && saved.until > now) {
            return [...saved.urls];
        }
        const existing = pending.get(watchId);
        if (existing) {
            return [...await existing];
        }
        const job = (async () => {
            let urls = [];
            try {
                const url = 'https://www.nicovideo.jp/watch/' +
                    encodeURIComponent(watchId) + '?responseType=json';
                const response = await fetcher(url, { credentials: 'include', timeout: 4000 });
                if (response.ok) {
                    urls = watchUrls(await response.json());
                }
            }
            catch (_) {
                // Keep legacy image; never log authenticated responses or signed URLs.
            }
            if (cache.size >= MAX_CACHE) {
                const first = cache.keys().next().value;
                if (first !== undefined) {
                    cache.delete(first);
                }
            }
            cache.set(watchId, { until: Date.now() + (urls.length ? CACHE_MS : NEGATIVE_MS), urls });
            return urls;
        })();
        pending.set(watchId, job);
        try {
            return [...await job];
        }
        finally {
            if (pending.get(watchId) === job) {
                pending.delete(watchId);
            }
        }
    };
    return { normalize, watchUrls, legacyUrls, install, getHighQuality };
})();
//===END===
export {PocketThumbnail};
