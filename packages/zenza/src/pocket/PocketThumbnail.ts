/**
 * Task713: MylistPocket high-resolution thumbnail presentation.
 * TypeScript source of truth for the generated userscript helper.
 */
type UnknownRecord = Record<string, unknown>;
// Injected by MylistPocket's page-world //@require immediately before
// PocketThumbnail; this pure policy module is also used by ZenzaWatch PiP.
declare const ThumbnailSourcePolicy: {
  select(thumbnail: UnknownRecord, fallback: readonly unknown[],
    options?: {mode?: 'smart' | 'legacy'; includeUnknownOgp?: boolean}): unknown[];
};
type FetchResponse = {
  ok: boolean;
  text?(): Promise<string>;
  json?(): Promise<unknown>;
};
type FetchFunction = (url: string, options: {
  credentials: 'include';
  timeout: number;
}) => Promise<FetchResponse>;
type ImageLike = Pick<HTMLImageElement, 'src' | 'onerror'>;
type VisibleCheck = () => boolean;
type PocketPresentation = {urls: string[]; description: string | null};

const PocketThumbnail = (() => {
  const CACHE_MS = 5 * 60 * 1000;
  const NEGATIVE_MS = 60 * 1000;
  const MAX_CACHE = 64;
  const cache = new Map<string, {until: number; value: PocketPresentation}>();
  const pending = new Map<string, Promise<PocketPresentation>>();
  const emptyPresentation = (): PocketPresentation => ({urls: [], description: null});
  const copyPresentation = (value: PocketPresentation): PocketPresentation =>
    ({urls: [...value.urls], description: value.description});
  const imageOwners = new WeakMap<ImageLike, object>();

  const record = (value: unknown): UnknownRecord | null =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ?
      value as UnknownRecord : null;

  const normalize = (values: readonly unknown[]): string[] => {
    const urls: string[] = [];
    for (const value of values) {
      if (typeof value !== 'string' || !value.trim()) { continue; }
      try {
        const url = new URL(value);
        if ((url.protocol === 'https:' || url.protocol === 'http:') &&
            !url.username && !url.password) {
          const safe = url.protocol === 'http:' ? 'https:' + url.href.slice(5) : url.href;
          if (!urls.includes(safe)) { urls.push(safe); }
        }
      } catch (_) { /* skip malformed image URL */ }
    }
    return urls;
  };

  const metadataUrls = (thumbnail: unknown, fallback: readonly unknown[] = []): string[] => {
    const thumb = record(thumbnail) || {};
    return normalize(ThumbnailSourcePolicy.select(thumb, [
      thumb.large, thumb.largeUrl, thumb.middle, thumb.middleUrl,
      thumb.normal, thumb.url, ...fallback,
      ...(typeof thumbnail === 'string' ? [thumbnail] : [])
    ], {mode: 'smart', includeUnknownOgp: true}));
  };

  const watchPresentation = (payload: unknown, requestedWatchId?: string): PocketPresentation => {
    const outer = record(payload);
    const data = record(outer?.data);
    const response = record(data?.response) || record(outer?.response);
    const v4 = record(record(response?.$watchV4)?.data);
    const video = record((v4 || response)?.video);
    // Numeric watch aliases may point at a canonical so/sm ID. Named IDs may not
    // borrow the poster from an unrelated video after a redirect/cache mismatch.
    if (requestedWatchId && /^(?:sm|nm|so|ss)/.test(requestedWatchId) &&
        typeof video?.id === 'string' && video.id !== requestedWatchId) { return emptyPresentation(); }
    return {urls: metadataUrls(video?.thumbnail),
      description: typeof video?.description === 'string' ? video.description : null};
  };
  const watchUrls = (payload: unknown, requestedWatchId?: string): string[] =>
    watchPresentation(payload, requestedWatchId).urls;

  const readWatchPage = (html: string): unknown => {
    // Same inert metadata path as ZenzaWatch's current watch-page loader.
    // Never inject the downloaded page, execute scripts or invent CDN URLs.
    if (typeof html !== 'string' || html.length > 4 * 1024 * 1024) { return null; }
    const page = new DOMParser().parseFromString(html, 'text/html');
    const raw = page.querySelector('meta[name="server-response"]')?.getAttribute('content');
    if (!raw) { return null; }
    try { return JSON.parse(raw) as unknown; }
    catch (_) { return null; }
  };

  const legacyUrls = (thumbnail: unknown, hasLarge = false): string[] => {
    const normal = normalize([thumbnail]);
    if (!normal.length) { return []; }
    const original = normal[0]!;
    // Do not alter signed URLs or URLs with search parameters.
    const large = hasLarge &&
      /^https:\/\/(?:nicovideo\.cdn\.nimg\.jp|tn\.smilevideo\.jp)\//.test(original) &&
      !/[?#]/.test(original) ?
      original.replace(/\.[ML]$/, '') + '.L' : '';
    return normalize([large, original]);
  };

  const install = (image: ImageLike, urls: readonly unknown[],
      isCurrent: VisibleCheck = () => true): void => {
    // Keep known composited OGP images out of fallback lists as well.
    const sources = metadataUrls(null, urls);
    if (!sources.length || !isCurrent()) { return; }
    const token = {};
    imageOwners.set(image, token);
    let cursor = 0;
    const next = (): void => {
      if (imageOwners.get(image) !== token || !isCurrent()) { return; }
      if (cursor >= sources.length) {
        image.onerror = null;
        return;
      }
      const url = sources[cursor++]!;
      image.onerror = () => { next(); };
      image.src = url;
    };
    next();
  };

  const getPresentation = async (watchId: string, fetcher: FetchFunction,
      hostname: string): Promise<PocketPresentation> => {
    // Only for a user-opened info popup on the official www host.
    if (hostname !== 'www.nicovideo.jp' ||
        !/^(?:(?:sm|nm|so|ss)\d{1,16}|\d{1,16})$/.test(watchId)) { return emptyPresentation(); }
    const now = Date.now();
    const saved = cache.get(watchId);
    if (saved && saved.until > now) { return copyPresentation(saved.value); }
    const existing = pending.get(watchId);
    if (existing) { return copyPresentation(await existing); }
    const job = (async (): Promise<PocketPresentation> => {
      let value = emptyPresentation();
      try {
        const url = 'https://www.nicovideo.jp/watch/' +
          encodeURIComponent(watchId);
        const response = await fetcher(url, {credentials: 'include', timeout: 4000});
        if (response.ok) {
          const payload = typeof response.text === 'function' ?
            readWatchPage(await response.text()) : await response.json?.();
          value = watchPresentation(payload, watchId);
        }
      } catch (_) {
        // Keep legacy image; never log authenticated responses or signed URLs.
      }
      if (cache.size >= MAX_CACHE) {
        const first = cache.keys().next().value;
        if (first !== undefined) { cache.delete(first); }
      }
      const complete = value.urls.length > 0 || value.description !== null;
      cache.set(watchId, {until: Date.now() + (complete ? CACHE_MS : NEGATIVE_MS), value});
      return value;
    })();
    pending.set(watchId, job);
    try { return copyPresentation(await job); }
    finally {
      if (pending.get(watchId) === job) { pending.delete(watchId); }
    }
  };

  // Both consumers share a single metadata request/cache; no extra page load
  // just to recover line breaks that getthumbinfo has flattened away.
  const getHighQuality = async (watchId: string, fetcher: FetchFunction,
      hostname: string): Promise<string[]> =>
    (await getPresentation(watchId, fetcher, hostname)).urls;

  return {normalize, metadataUrls, watchUrls, legacyUrls, install, getHighQuality, getPresentation};
})();

export {PocketThumbnail};
