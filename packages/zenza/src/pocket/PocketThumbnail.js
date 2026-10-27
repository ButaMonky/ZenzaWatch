// GENERATED FROM packages/zenza/src/pocket/PocketThumbnail.ts (Task713). Do not edit this JS.
// SOURCE_SHA256 205f2a23de948e0e072b2a0e000e7a7428c68a962e8ca0db3c7dba2695038bf1
//===BEGIN===
const PocketThumbnail = (() => {
    const CACHE_MS = 5 * 60 * 1000;
    const NEGATIVE_MS = 60 * 1000;
    const MAX_CACHE = 64;
    const cache = new Map();
    const pending = new Map();
    const emptyPresentation = () => ({ urls: [], description: null });
    const copyPresentation = (value) => ({ urls: [...value.urls], description: value.description });
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
                if ((url.protocol === 'https:' || url.protocol === 'http:') &&
                    !url.username && !url.password) {
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
    const metadataUrls = (thumbnail, fallback = []) => {
        const thumb = record(thumbnail) || {};
        return normalize(ThumbnailSourcePolicy.select(thumb, [
            thumb.large, thumb.largeUrl, thumb.middle, thumb.middleUrl,
            thumb.normal, thumb.url, ...fallback,
            ...(typeof thumbnail === 'string' ? [thumbnail] : [])
        ], { mode: 'smart', includeUnknownOgp: true }));
    };
    const watchPresentation = (payload, requestedWatchId) => {
        const outer = record(payload);
        const data = record(outer?.data);
        const response = record(data?.response) || record(outer?.response);
        const v4 = record(record(response?.$watchV4)?.data);
        const video = record((v4 || response)?.video);
        // Numeric watch aliases may point at a canonical so/sm ID. Named IDs may not
        // borrow the poster from an unrelated video after a redirect/cache mismatch.
        if (requestedWatchId && /^(?:sm|nm|so|ss)/.test(requestedWatchId) &&
            typeof video?.id === 'string' && video.id !== requestedWatchId) {
            return emptyPresentation();
        }
        return { urls: metadataUrls(video?.thumbnail),
            description: typeof video?.description === 'string' ? video.description : null };
    };
    const watchUrls = (payload, requestedWatchId) => watchPresentation(payload, requestedWatchId).urls;
    const readWatchPage = (html) => {
        // Same inert metadata path as ZenzaWatch's current watch-page loader.
        // Never inject the downloaded page, execute scripts or invent CDN URLs.
        if (typeof html !== 'string' || html.length > 4 * 1024 * 1024) {
            return null;
        }
        const page = new DOMParser().parseFromString(html, 'text/html');
        const raw = page.querySelector('meta[name="server-response"]')?.getAttribute('content');
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        }
        catch (_) {
            return null;
        }
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
        // Keep known composited OGP images out of fallback lists as well.
        const sources = metadataUrls(null, urls);
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
    const getPresentation = async (watchId, fetcher, hostname) => {
        // Only for a user-opened info popup on the official www host.
        if (hostname !== 'www.nicovideo.jp' ||
            !/^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/.test(watchId)) {
            return emptyPresentation();
        }
        const now = Date.now();
        const saved = cache.get(watchId);
        if (saved && saved.until > now) {
            return copyPresentation(saved.value);
        }
        const existing = pending.get(watchId);
        if (existing) {
            return copyPresentation(await existing);
        }
        const job = (async () => {
            let value = emptyPresentation();
            try {
                const url = 'https://www.nicovideo.jp/watch/' +
                    encodeURIComponent(watchId);
                const response = await fetcher(url, { credentials: 'include', timeout: 4000 });
                if (response.ok) {
                    const payload = typeof response.text === 'function' ?
                        readWatchPage(await response.text()) : await response.json?.();
                    value = watchPresentation(payload, watchId);
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
            const complete = value.urls.length > 0 || value.description !== null;
            cache.set(watchId, { until: Date.now() + (complete ? CACHE_MS : NEGATIVE_MS), value });
            return value;
        })();
        pending.set(watchId, job);
        try {
            return copyPresentation(await job);
        }
        finally {
            if (pending.get(watchId) === job) {
                pending.delete(watchId);
            }
        }
    };
    // Both consumers share a single metadata request/cache; no extra page load
    // just to recover line breaks that getthumbinfo has flattened away.
    const getHighQuality = async (watchId, fetcher, hostname) => (await getPresentation(watchId, fetcher, hostname)).urls;
    return { normalize, metadataUrls, watchUrls, legacyUrls, install, getHighQuality, getPresentation };
})();
//===END===
export {PocketThumbnail};
